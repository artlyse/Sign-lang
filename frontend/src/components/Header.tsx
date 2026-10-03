interface HeaderProps {
  title: string;
  onMenuClick: () => void;
}

function Header({
  title,
  onMenuClick,
}: HeaderProps) {
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

      <div className="system-status">
        <span />
        Sistema activo
      </div>
    </header>
  );
}

export default Header;