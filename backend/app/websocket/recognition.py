# Handler de reconocimiento 
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.recognition_service import recognition_service

router = APIRouter()


@router.websocket("/ws/recognition")
async def websocket_recognition(websocket: WebSocket):
    await websocket.accept()
    print("Cliente WebSocket conectado")
    
    try:
        while True:
            data = await websocket.receive_json()
            mode = data.get("mode", "static")
            
            if mode == "static":
                landmarks = data.get("landmarks", [])
                result = recognition_service.predict_static(landmarks)
            elif mode == "dynamic":
                sequence = data.get("sequence", [])
                result = recognition_service.predict_dynamic(sequence)
            else:
                result = {"error": "Modo no valido"}
            
            await websocket.send_json(result)
    
    except WebSocketDisconnect:
        print("Cliente WebSocket desconectado")
    except Exception as e:
        print(f"Error en WebSocket: {e}")
        try:
            await websocket.close()
        except:
            pass