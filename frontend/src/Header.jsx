import { NavLink, useNavigate } from "react-router-dom";
import React from "react";
import "./css/Navigation.css";

const Navigation = () => {
  const isAuthenticated = !!localStorage.getItem("user_id");
  const isAdmin = localStorage.getItem("is_admin") === "true";
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("is_admin");
    navigate("/login");
  };

  return (
    <nav className="app-navigation">
      <ul className="nav-list">
        {isAuthenticated ? (
          <>
            <li className="nav-item">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? "nav-linki active" : "nav-linki"
                }
              >
                Портфель
              </NavLink>
            </li>
            {isAdmin && (
              <li className="nav-item">
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    isActive ? "nav-linki active" : "nav-linki"
                  }
                >
                  Админ-панель
                </NavLink>
              </li>
            )}
            <li className="nav-item">
              <NavLink className="logout-btn" onClick={handleLogout}>
                Выйти
              </NavLink>
            </li>
          </>
        ) : (
          <>
            <li className="nav-item">
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  isActive ? "nav-linki active" : "nav-linki"
                }
              >
                Вход
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/register"
                className={({ isActive }) =>
                  isActive ? "nav-linki active" : "nav-linki"
                }
              >
                Регистрация
              </NavLink>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navigation;
