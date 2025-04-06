import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./css/Auth.css"; // Или Register.css, если используете отдельный файл

const Register = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await axios.post("http://localhost:5000/api/register", {
        username,
        password,
      });
      if (response.status === 201) {
        setSuccess("Регистрация прошла успешно! Перенаправляем...");
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch (error) {
      setError(error.response?.data?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="auth-container">
        <div className="auth-box">
          <div className="auth-header">
            <h1 className="auth-title">Регистрация</h1>
            <p className="auth-subtitle">Создайте новый аккаунт</p>
          </div>

          {error && (
            <div className="auth-alert error">
              <span>{error}</span>
              <button className="close-alert" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="auth-alert success">
              <span>{success}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleRegister}>
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
              <div className="password-strength">
                <div
                  className="password-strength-bar"
                  style={{
                    width: `${Math.min(password.length * 10, 100)}%`,
                    backgroundColor:
                      password.length > 8
                        ? "#00ff88"
                        : password.length > 5
                        ? "#ffc107"
                        : "#ff4444",
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Подтвердите пароль</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="auth-btn" disabled={loading}>
              {loading ? "Регистрация..." : "Зарегистрироваться"}
            </button>
          </form>

          <div className="auth-footer">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="auth-link">
              Войдите
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
