import { useState } from "react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import Statistics from "./pages/Statistics";
import Help from "./pages/Help";
import Settings from "./pages/Settings";

import Translator from "./pages/Translator";

import "./App.css";

type Page =
  | "dashboard"
  | "translator"
  | "templates"
  | "statistics"
  | "help"
  | "settings";

function App() {
  const [currentPage, setCurrentPage] =
    useState<Page>("dashboard");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const titles: Record<Page, string> = {
    dashboard: "Inicio",
    translator: "Traductor",
    templates: "Plantillas",
    statistics: "Estadísticas",
    help: "Ayuda",
    settings: "Configuración",
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;

        case "translator":
          return <Translator />;

      case "templates":
        return <Templates />;

      case "statistics":
        return <Statistics />;

      case "help":
        return <Help />;

      case "settings":
        return <Settings />;

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
      />

      <div className="main-layout">

        <Header
          title={titles[currentPage]}
          onMenuClick={() =>
            setSidebarOpen((previous) => !previous)
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