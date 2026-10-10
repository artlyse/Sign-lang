/**
 * Enrutador interno principal del frontend. Gestiona autenticación, navegación lateral y estado general de la aplicación.
 */

import { useEffect, useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Statistics from "./pages/Statistics";
import Help from "./pages/Help";
import Settings from "./pages/Settings";
import Translator from "./pages/Translator";
import Practice from "./pages/Practice";

import Login from "./pages/Login";
import Register from "./pages/Register";

import {
  getAccessToken,
  logoutAccount,
  getCurrentUser,
  getUserProfile,
  checkBackendHealth,
  clearAuth,
} from "./services/auth";

import { applyStoredTheme } from "./services/preferences";

import "./App.css";

type Page =
  | "dashboard"
  | "translator"
  | "practice"
  | "templates"
  | "statistics"
  | "help"
  | "settings";

type AuthPage = "login" | "register";

function App() {
  useEffect(() => {
    applyStoredTheme();
  }, []);

  
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(getAccessToken())
  );

  const [authPage, setAuthPage] =
    useState<AuthPage>("login");

  const [currentPage, setCurrentPage] =
    useState<Page>("dashboard");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [backendOnline, setBackendOnline] =
    useState<boolean | null>(null);

  const titles: Record<Page, string> = {
    dashboard: "Inicio",
    translator: "Traductor",
    practice: "Práctica",
    templates: "Plantillas",
    statistics: "Estadísticas",
    help: "Ayuda",
    settings: "Configuración",
  };

  // Obtener los datos del usuario autenticado
useEffect(() => {
  if (!isAuthenticated) {
    setUsername("");
    setDisplayName("");
    return;
  }

  const loadUser = async () => {
    try {
      const [user, profile] = await Promise.all([
        getCurrentUser(),
        getUserProfile(),
      ]);

      setUsername(user.username);
      setDisplayName(profile.display_name ?? "");
    } catch (error) {
      console.error(
        "Error obteniendo usuario:",
        error
      );
      clearAuth();
      setIsAuthenticated(false);
      setAuthPage("login");
    }
  };

  loadUser();
}, [isAuthenticated]);

useEffect(() => {
  let active = true;

  const verifyBackend = async () => {
    const online = await checkBackendHealth();
    if (active) setBackendOnline(online);
  };

  verifyBackend();
  const timer = window.setInterval(verifyBackend, 20000);

  return () => {
    active = false;
    window.clearInterval(timer);
  };
}, []);

  // Cuando Login o Registro es correcto
  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setCurrentPage("dashboard");
  };

  // Cerrar sesión
  const handleLogout = async () => {
    await logoutAccount();

    setUsername("");
    setDisplayName("");
    setIsAuthenticated(false);
    setAuthPage("login");
    setCurrentPage("dashboard");
    setSidebarOpen(false);
  };

  // Si no existe una sesión, mostrar Login o Registro
  if (!isAuthenticated) {
    if (authPage === "register") {
      return (
        <Register
          onRegistered={handleAuthenticated}
          onLogin={() => setAuthPage("login")}
        />
      );
    }

    return (
      <Login
        onLogin={handleAuthenticated}
        onRegister={() =>
          setAuthPage("register")
        }
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;

      case "translator":
        return <Translator />;

      case "practice":
        return <Practice />;

      case "templates":
        return <Templates />;

      case "statistics":
        return <Statistics />;

      case "help":
        return <Help />;

      case "settings":
        return (
          <Settings
            onDisplayNameChange={setDisplayName}
          />
        );

      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
          username={username}
          displayName={displayName}
        />

      <div className="main-layout">
        <Header
          title={titles[currentPage]}
          backendOnline={backendOnline}
          onMenuClick={() =>
            setSidebarOpen(
              (previous) => !previous
            )
          }
        />

        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;