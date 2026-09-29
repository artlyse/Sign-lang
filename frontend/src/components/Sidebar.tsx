type Page =
  | "dashboard"
  | "translator"
  | "templates"
  | "statistics"
  | "help"
  | "settings";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  open: boolean;
  onClose: () => void;
}

function Sidebar({
  currentPage,
  onNavigate,
  open,
  onClose,
}: SidebarProps) {
  const navigate = (page: Page) => {
    onNavigate(page);

    // En celular cerramos el menú después de seleccionar
    if (window.innerWidth <= 900) {
      onClose();
    }
  };

  return (
    <>
      {open && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"></div>

          <div>
            <h2>Sing-lang</h2>
            <span>Sistema inteligente</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button
            className={
              currentPage === "dashboard" ? "active" : ""
            }
            onClick={() => navigate("dashboard")}
          >
            <span>⌂</span>
            Inicio
          </button>

          <button
            className={
              currentPage === "translator" ? "active" : ""
            }
            onClick={() => navigate("translator")}
          >
            <span></span>
            Traductor
          </button>

          <button
            className={
              currentPage === "templates" ? "active" : ""
            }
            onClick={() => navigate("templates")}
          >
            <span>▤</span>
            Plantillas
          </button>

          <button
            className={
              currentPage === "statistics" ? "active" : ""
            }
            onClick={() => navigate("statistics")}
          >
            <span>▥</span>
            Estadísticas
          </button>

          <div className="sidebar-divider" />

          <button
            className={
              currentPage === "help" ? "active" : ""
            }
            onClick={() => navigate("help")}
          >
            <span>?</span>
            Ayuda
          </button>

          <button
            className={
              currentPage === "settings" ? "active" : ""
            }
            onClick={() => navigate("settings")}
          >
            <span>⚙</span>
            Configuración
          </button>
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">OP</div>

          <div>
            <strong>Personal de atención</strong>
            <span>Operador</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;