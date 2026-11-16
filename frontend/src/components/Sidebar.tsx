import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Hand,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  ScanLine,
  Settings,
  Target,
} from "lucide-react";

type Page =
  | "dashboard"
  | "translator"
  | "practice"
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

interface NavItem {
  page: Page;
  label: string;
  icon: LucideIcon;
}

const MAIN_ITEMS: NavItem[] = [
  { page: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { page: "translator", label: "Traductor", icon: ScanLine },
  { page: "practice", label: "Práctica", icon: Target },
  { page: "templates", label: "Plantillas", icon: LayoutTemplate },
  { page: "statistics", label: "Estadísticas", icon: BarChart3 },
];

const SECONDARY_ITEMS: NavItem[] = [
  { page: "help", label: "Ayuda", icon: HelpCircle },
  { page: "settings", label: "Configuración", icon: Settings },
];

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

  const renderItem = ({ page, label, icon: Icon }: NavItem) => (
    <button
      key={page}
      className={currentPage === page ? "active" : ""}
      onClick={() => navigate(page)}
    >
      <span className="nav-icon">
        <Icon size={19} strokeWidth={2} />
      </span>
      {label}
    </button>
  );

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Hand size={22} strokeWidth={2.2} />
          </div>

          <div>
            <h2>Sign-lang</h2>
            <span>Traductor LSP con IA</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <small className="sidebar-section-label">Menú</small>
          {MAIN_ITEMS.map(renderItem)}

          <div className="sidebar-divider" />

          <small className="sidebar-section-label">Soporte</small>
          {SECONDARY_ITEMS.map(renderItem)}
        </nav>

        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>

          <div className="sidebar-user-info">
            <strong>{displayName || username || "Usuario"}</strong>
            <span>@{username || "operador"}</span>
          </div>

          <button
            type="button"
            className="sidebar-logout"
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
