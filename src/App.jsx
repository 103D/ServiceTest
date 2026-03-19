import { useEffect, useState } from "react";
import { FiLogOut } from "react-icons/fi";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import BranchesPage from "./pages/BranchesPage";
import EmployeesPage from "./pages/EmployeesPage";
import GradesPage from "./pages/GradesPage";
import RatingsPage from "./pages/RatingsPage";
import SecretRegisterPage from "./pages/SecretRegisterPage";

function App() {
  const isLocalHost = isLocalBrowserHost();
  const defaultApiBaseUrl = isLocalHost
    ? import.meta.env.VITE_API_BASE_URL || inferApiBaseUrl()
    : import.meta.env.VITE_API_BASE_URL || inferApiBaseUrl();

  const [apiBaseUrl, setApiBaseUrl] = useState(
    defaultApiBaseUrl,
  );
  const [token, setToken] = useState(localStorage.getItem("accessToken") || "");
  const [toast, setToast] = useState(null);
  const [userRole, setUserRole] = useState(getRoleFromToken(localStorage.getItem("accessToken") || ""));

  const notify = (type, text) => {
    setToast({ type, text });
    window.clearTimeout(notify.timeoutId);
    notify.timeoutId = window.setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    if (isLocalHost) {
      localStorage.setItem("apiBaseUrl", apiBaseUrl);
    }
  }, [apiBaseUrl, isLocalHost]);

  useEffect(() => {
    if (token) {
      localStorage.setItem("accessToken", token);
      setUserRole(getRoleFromToken(token));
    } else {
      localStorage.removeItem("accessToken");
      setUserRole(null);
    }
  }, [token]);

  return (
    <Routes>
      <Route
        path="/auth"
        element={<AuthPage apiBaseUrl={apiBaseUrl} onLogin={setToken} notify={notify} />}
      />
      <Route
        path="/0x8f3a"
        element={<SecretRegisterPage apiBaseUrl={apiBaseUrl} notify={notify} />}
      />

      <Route
        element={
          <ProtectedRoute token={token}>
            <AppLayout
              apiBaseUrl={apiBaseUrl}
              token={token}
              setToken={setToken}
              toast={toast}
              notify={notify}
            />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/branches" replace />} />
        <Route
          path="/branches"
          element={<BranchesPage apiBaseUrl={apiBaseUrl} token={token} notify={notify} />}
        />
        <Route
          path="/employees"
          element={<EmployeesPage apiBaseUrl={apiBaseUrl} token={token} notify={notify} />}
        />
        <Route
          path="/grades"
          element={<GradesPage apiBaseUrl={apiBaseUrl} token={token} notify={notify} />}
        />
        <Route
          path="/ratings"
          element={<RatingsPage apiBaseUrl={apiBaseUrl} token={token} notify={notify} />}
        />
      </Route>

      <Route path="*" element={<Navigate to={token ? "/branches" : "/auth"} replace />} />
    </Routes>
  );
}

function inferApiBaseUrl() {
  if (typeof window === "undefined") {
    return "/api";
  }

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? "http://127.0.0.1:8000/api" : "/api";
}

function isLocalBrowserHost() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function AppLayout({ token, setToken, toast, notify }) {
  const navigate = useNavigate();

  const logout = () => {
    setToken("");
    notify("success", "Выход выполнен");
    navigate("/auth");
  };

  return (
    <div className="app-layout">
      <header className="topbar">
        <div className="brand-block">
          <img src="/1.jpg" alt="Логотип" className="brand-logo" />
          <h1>Employee Rating Dashboard</h1>
        </div>
        <div className="topbar-row">
          <button
            type="button"
            className="topbar-logout icon-btn"
            onClick={logout}
            aria-label="Выход"
            title="Выход"
          >
            <FiLogOut aria-hidden="true" />
          </button>
        </div>
      </header>

      {toast ? <div className={`notice toast-fixed ${toast.type}`}>{toast.text}</div> : null}

      <main className="page page-with-bottom-nav">
        <Outlet />
      </main>

      <nav className="bottom-navbar">
        <NavLink to="/branches" aria-label="Филиалы" title="Филиалы">
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 21H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M5 21V6.5C5 5.67 5.67 5 6.5 5H11V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11 21V3.5C11 2.67 11.67 2 12.5 2H17.5C18.33 2 19 2.67 19 3.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 8H8.01M8 11H8.01M8 14H8.01M14 6H14.01M14 9H14.01M14 12H14.01M16 6H16.01M16 9H16.01M16 12H16.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </span>
        </NavLink>
        <NavLink to="/employees" aria-label="Сотрудники" title="Сотрудники">
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M3.5 19C3.5 15.96 5.96 13.5 9 13.5C12.04 13.5 14.5 15.96 14.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M14.5 19C14.62 16.77 16.46 15 18.72 15C20.95 15 22.77 16.72 23 18.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
        </NavLink>
        <NavLink to="/grades" aria-label="Оценки" title="Оценки">
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 3H15L20 8V21H6V3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M15 3V8H20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 12H16M9 16H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
        </NavLink>
        <NavLink to="/ratings" aria-label="Рейтинг" title="Рейтинг">
          <span className="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4H17V7C17 9.76 14.76 12 12 12C9.24 12 7 9.76 7 7V4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M9 12V14.5C9 15.88 10.12 17 11.5 17H12.5C13.88 17 15 15.88 15 14.5V12" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M8 21H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M7 5H4.5C4.22 5 4 5.22 4 5.5V7C4 9.21 5.79 11 8 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M17 5H19.5C19.78 5 20 5.22 20 5.5V7C20 9.21 18.21 11 16 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
        </NavLink>
      </nav>
    </div>
  );
}

export default App;

function getRoleFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.role || payload?.user_role || payload?.user?.role || null;
  } catch {
    return null;
  }
}
