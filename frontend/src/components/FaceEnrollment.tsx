import { useEffect, useRef, useState } from "react";
import "../styles/face.css";
import { Camera, Loader2, RefreshCw, ScanFace, ShieldCheck, Trash2, X } from "lucide-react";
import {
  captureFrame,
  deleteFace,
  getFacePhotoUrl,
  getFaceStatus,
  saveFace,
} from "../services/face";
import type { FaceStatus } from "../services/face";

const FACE_CAMERA_KEY = "signlang_face_camera";

/**
 * Sección de Configuración para registrar el rostro de la cuenta.
 * El Traductor lo usa para reconocer a la persona y completar su nombre.
 */
function FaceEnrollment() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState(() => {
    try {
      return localStorage.getItem(FACE_CAMERA_KEY) ?? "";
    } catch {
      return "";
    }
  });

  // Cada vez que se abre o cambia la cámara, el <video> recibe la nueva señal.
  const [streamVersion, setStreamVersion] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!cameraOpen || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch(() => undefined);
  }, [cameraOpen, streamVersion]);

  const refresh = async () => {
    try {
      const next = await getFaceStatus();
      setStatus(next);
      const url = next.enrolled ? await getFacePhotoUrl() : null;
      setPhotoUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el registro facial.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  useEffect(() => {
    refresh();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lista de cámaras (los nombres solo aparecen después de dar permiso).
  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((device) => device.kind === "videoinput");
      setCameras(videos);
      return videos;
    } catch {
      return [];
    }
  };

  const openCamera = async (deviceId: string = selectedCamera) => {
    setError("");
    setMessage("");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
          : { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);

      const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? "";
      if (activeId) {
        setSelectedCamera(activeId);
        try {
          localStorage.setItem(FACE_CAMERA_KEY, activeId);
        } catch {
          /* almacenamiento no disponible */
        }
      }
      setStreamVersion((v) => v + 1);
      await loadCameras();
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (deviceId && (name === "OverconstrainedError" || name === "NotFoundError")) {
        // La cámara guardada ya no existe: se abre la predeterminada.
        setSelectedCamera("");
        return openCamera("");
      }
      setError(
        name === "NotAllowedError"
          ? "Permite el acceso a la cámara para registrar tu rostro."
          : name === "NotReadableError"
            ? "La cámara está siendo usada por otra aplicación o pestaña. Ciérrala o elige otra cámara."
            : "No se encontró una cámara disponible.",
      );
    }
  };

  const capture = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    setError("");
    try {
      const image = await captureFrame(videoRef.current);
      const result = await saveFace(image);
      setMessage(result.message);
      stopCamera();
      setConsent(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el rostro.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("¿Eliminar tu registro facial? Se borrarán la foto y la plantilla biométrica.")) return;
    setBusy(true);
    try {
      await deleteFace();
      setMessage("Registro facial eliminado.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el registro.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel settings-panel face-panel">
      <div className="settings-section-title">
        <span>Identidad</span>
        <h3>Reconocimiento facial</h3>
      </div>

      <p className="face-intro">
        Registra tu rostro para que el Traductor te reconozca con el botón
        <strong> Presentarme</strong> y escriba tu nombre automáticamente.
        La foto se guarda cifrada en la base de datos de tu cuenta.
      </p>

      <div className="face-body">
        <div className="face-preview">
          {cameraOpen ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : photoUrl ? (
            <img src={photoUrl} alt="Rostro registrado" />
          ) : (
            <ScanFace size={48} />
          )}
        </div>

        <div className="face-info">
          <div className={`face-badge ${status?.recognition_ready ? "ok" : ""}`}>
            {status?.recognition_ready ? <ShieldCheck size={15} /> : <ScanFace size={15} />}
            {status ? status.message : "Consultando…"}
          </div>

          {cameraOpen ? (
            <>
              <label className="face-camera-select">
                <Camera size={15} />
                <select
                  value={selectedCamera}
                  onChange={(event) => openCamera(event.target.value)}
                  aria-label="Cámara para el registro facial"
                  disabled={busy}
                >
                  {cameras.length === 0 && <option value="">Cámara predeterminada</option>}
                  {cameras.map((camera, index) => (
                    <option key={camera.deviceId || index} value={camera.deviceId}>
                      {camera.label || `Cámara ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="face-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                Acepto que se guarde mi imagen facial y su plantilla biométrica para identificarme en este sistema.
              </label>
              <div className="face-actions">
                <button
                  type="button"
                  className="settings-save-button"
                  onClick={capture}
                  disabled={!consent || busy}
                >
                  {busy ? <Loader2 size={16} className="tw-spin" /> : <Camera size={16} />}
                  {busy ? "Procesando…" : "Capturar y guardar"}
                </button>
                <button type="button" className="face-secondary" onClick={stopCamera} disabled={busy}>
                  <X size={16} /> Cancelar
                </button>
              </div>
            </>
          ) : (
            <div className="face-actions">
              <button type="button" className="settings-save-button" onClick={() => openCamera()} disabled={busy}>
                {status?.enrolled ? <RefreshCw size={16} /> : <Camera size={16} />}
                {status?.enrolled ? "Actualizar rostro" : "Registrar rostro"}
              </button>
              {status?.enrolled && (
                <button type="button" className="face-secondary danger" onClick={remove} disabled={busy}>
                  <Trash2 size={16} /> Eliminar registro
                </button>
              )}
            </div>
          )}

          {error && <div className="settings-message settings-error">{error}</div>}
          {message && <div className="settings-message settings-success">{message}</div>}
        </div>
      </div>
    </section>
  );
}

export default FaceEnrollment;
