import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./css/AdminPanel.css";
import Navigation from "./Header";

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPortfolio, setUserPortfolio] = useState(null);
  const [loading, setLoading] = useState({
    users: false,
    portfolio: false,
    adminToggle: false,
  });
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const isAdmin = localStorage.getItem("is_admin") === "true";

    if (!userId || !isAdmin) {
      navigate("/dashboard");
      return;
    }

    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading((prev) => ({ ...prev, users: true }));
      setError(null);

      const response = await axios.get(
        "http://localhost:5000/api/admin/users",
        {
          headers: {
            "X-User-Id": localStorage.getItem("user_id"),
          },
        }
      );
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка загрузки пользователей");
    } finally {
      setLoading((prev) => ({ ...prev, users: false }));
    }
  };

  const fetchUserPortfolio = async (userId) => {
    try {
      setLoading((prev) => ({ ...prev, portfolio: true }));
      setError(null);

      const response = await axios.get(
        `http://localhost:5000/api/admin/user/${userId}/portfolio`,
        {
          headers: {
            "X-User-Id": localStorage.getItem("user_id"),
          },
        }
      );
      setUserPortfolio(response.data);
      setSelectedUser(userId);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка загрузки портфеля");
    } finally {
      setLoading((prev) => ({ ...prev, portfolio: false }));
    }
  };

  const toggleAdminStatus = async (userId) => {
    try {
      setLoading((prev) => ({ ...prev, adminToggle: true }));

      const response = await axios.post(
        `http://localhost:5000/api/admin/user/${userId}/toggle-admin`,
        {},
        {
          headers: {
            "X-User-Id": localStorage.getItem("user_id"),
          },
        }
      );

      setUsers(
        users.map((user) =>
          user.id === userId
            ? { ...user, is_admin: response.data.is_admin }
            : user
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка изменения прав");
    } finally {
      setLoading((prev) => ({ ...prev, adminToggle: false }));
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toString().includes(searchTerm)
  );

  return (
    <>
      <div className="admin-container">
        <h1>Панель администратора</h1>

        {error && (
          <div className="admin-alert">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="admin-toolbar">
          <div className="search-box">
            <input
              type="text"
              placeholder="Поиск пользователей..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={fetchUsers} disabled={loading.users}>
            Обновить данные
          </button>
        </div>

        <div className="admin-content">
          <div className="users-list">
            <h2>Пользователи ({filteredUsers.length})</h2>
            {loading.users ? (
              <div className="loading">Загрузка...</div>
            ) : (
              <div className="table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Имя пользователя</th>
                      <th>Монеты</th>
                      <th>Стоимость</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={selectedUser === user.id ? "active" : ""}
                      >
                        <td>{user.id}</td>
                        <td>{user.username}</td>
                        <td>{user.portfolio_count}</td>
                        <td>${user.portfolio_value?.toFixed(2) || "0.00"}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => fetchUserPortfolio(user.id)}
                              disabled={loading.portfolio}
                            >
                              Портфель
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="portfolio-details">
            <h2>
              {userPortfolio
                ? `Портфель: ${userPortfolio.user.username}`
                : "Выберите пользователя"}
            </h2>

            {loading.portfolio ? (
              <div className="loading">Загрузка портфеля...</div>
            ) : userPortfolio ? (
              <>
                <div className="portfolio-summary">
                  <div className="summary-card">
                    <span>Общая стоимость:</span>
                    <span className="value">
                      ${userPortfolio.total_value.toFixed(2)}
                    </span>
                  </div>
                  <div className="summary-card">
                    <span>Количество монет:</span>
                    <span className="value">
                      {userPortfolio.portfolio.length}
                    </span>
                  </div>
                </div>

                <div className="table-container">
                  <table className="portfolio-table">
                    <thead>
                      <tr>
                        <th>Монета</th>
                        <th>Количество</th>
                        <th>Цена покупки</th>
                        <th>Текущая цена</th>
                        <th>Стоимость</th>
                        <th>Дата</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPortfolio.portfolio.map((item, index) => (
                        <tr key={index}>
                          <td>{item.coin_id}</td>
                          <td>{parseFloat(item.quantity).toFixed(8)}</td>
                          <td>${parseFloat(item.buy_price).toFixed(2)}</td>
                          <td>${parseFloat(item.current_price).toFixed(2)}</td>
                          <td>${parseFloat(item.value).toFixed(2)}</td>
                          <td>
                            {new Date(item.added_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Выберите пользователя для просмотра портфеля</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminPanel;
