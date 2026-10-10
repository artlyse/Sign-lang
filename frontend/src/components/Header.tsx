interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  backendOnline: boolean | null;
}

function Header({
  title,
  onMenuClick,
  backendOnline,
}: HeaderProps) {
  const statusLabel =
    backendOnline === null
      ? "Verificando..."
      : backendOnline
        ? "Sistema activo"
        : "Backend sin conexión";

  return (
    <header className="main-header">
      <div className="header-left">
        <button
          className="menu-button"
          onClick={onMenuClick}
          aria-label="Abrir menú"
        >
          ☰
        </button>

        <div>
          <h1>{title}</h1>
          <p>Traductor Inteligente de Lengua de Señas</p>
        </div>
      </div>

      <div
        className={`system-status ${
          backendOnline === false ? "offline" : backendOnline === null ? "checking" : ""
        }`}
      >
        <span />
        {statusLabel}
      </div>
    </header>
  );
}

export default Header;
