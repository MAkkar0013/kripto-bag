import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./css/Auth.css"; // Или Login.css, если используете отдельный файл

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const response = await axios.post("/api/login", {
        username,
        password,
      });
      if (response.status === 200) {
        localStorage.setItem("user_id", response.data.user_id);
        localStorage.setItem("is_admin", response.data.is_admin); // Это критически важно!
        navigate("/dashboard");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-header">
            <h1 className="auth-title">Вход</h1>
            <p className="auth-subtitle">Введите свои учетные данные</p>
          </div>

          {error && (
            <div className="auth-alert error">
              <span>{error}</span>
              <button className="close-alert" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">Имя пользователя</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>

          <div className="auth-footer">
            Нет аккаунта?{" "}
            <Link to="/register" className="auth-link">
              Зарегистрируйтесь
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
