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
  onLogout: () => void;
  username: string;
  displayName: string;
}

function Sidebar({
  currentPage,
  onNavigate,
  open,
  onClose,
  onLogout,
  username,
  displayName,
}: SidebarProps) {
  const navigate = (page: Page) => {
    onNavigate(page);

    // En celular cerramos el menú después de seleccionar
    if (window.innerWidth <= 900) {
      onClose();
    }
  };

  // Usamos el nombre visible para generar las iniciales.
  // Si no existe, usamos el username.
  const nameForInitials = displayName || username;

  const initials = nameForInitials
    ? nameForInitials
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0))
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "US";

  return (
    <>
      {open && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        {/* LOGO */}
        <div className="sidebar-brand">
          <div className="brand-icon"></div>

          <div>
            <h2>Sing-lang</h2>
            <span>Sistema inteligente</span>
          </div>
        </div>

        {/* MENÚ */}
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
            <span>✋</span>
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

        {/* USUARIO */}
        <div className="sidebar-user">
          <div className="user-avatar">
            {initials}
          </div>

          <div className="sidebar-user-info">
            <strong>
              {displayName || username || "Usuario"}
            </strong>

            <span>{username || "Operador"}</span>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            ↪
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;