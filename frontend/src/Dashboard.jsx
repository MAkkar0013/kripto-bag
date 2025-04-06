import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
} from "chart.js";
import "./css/Dashboard.css";
import Navigation from "./Header";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title
);

const Dashboard = () => {
  // Состояния для портфеля
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState({
    portfolio: false,
    coins: false,
    details: false,
    price: false,
  });
  const [error, setError] = useState(null);
  const userId = localStorage.getItem("user_id");

  // Состояния для добавления монет
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [useCurrentPrice, setUseCurrentPrice] = useState(true);

  // Состояния для поиска монет
  const [searchQuery, setSearchQuery] = useState("");
  const [popularCoins, setPopularCoins] = useState([]);
  const [allCoins, setAllCoins] = useState([]);
  const [filteredCoins, setFilteredCoins] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Состояния для деталей монеты
  const [expandedCoin, setExpandedCoin] = useState(null);
  const [coinDetails, setCoinDetails] = useState(null);
  const [coinChartData, setCoinChartData] = useState(null);

  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  // Загрузка данных портфеля
  useEffect(() => {
    fetchPortfolio();
    fetchCoinsData();
  }, []);

  // Фильтрация монет при изменении поиска
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCoins(popularCoins.slice(0, 10));
    } else {
      const filtered = allCoins
        .filter(
          (coin) =>
            coin.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            coin.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 10);
      setFilteredCoins(filtered);
    }
  }, [searchQuery, popularCoins, allCoins]);

  // Обработка кликов вне dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Получение портфеля
  const fetchPortfolio = async () => {
    try {
      setLoading((prev) => ({ ...prev, portfolio: true }));
      setError(null);

      const response = await axios.get(
        `http://localhost:5000/api/portfolio/${userId}`
      );

      if (response.data) {
        const portfolioWithPrices = await Promise.all(
          response.data.map(async (coin) => {
            try {
              const priceResponse = await axios.get(
                `http://localhost:5000/api/coin-price/${coin.id}`
              );
              return {
                ...coin,
                current_price: priceResponse.data?.price || 0,
                profit_loss:
                  (priceResponse.data?.price - coin.buy_price) * coin.quantity,
              };
            } catch (e) {
              return {
                ...coin,
                current_price: 0,
                profit_loss: -coin.buy_price * coin.quantity,
              };
            }
          })
        );

        // Рассчитываем общую стоимость портфеля
        const totalValue = portfolioWithPrices.reduce(
          (sum, coin) => sum + coin.current_price * coin.quantity,
          0
        );

        setTotalPortfolioValue(totalValue);
        setPortfolio(portfolioWithPrices);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка загрузки портфеля");
    } finally {
      setLoading((prev) => ({ ...prev, portfolio: false }));
    }
  };

  // Получение данных о монетах
  const fetchCoinsData = async () => {
    try {
      setLoading((prev) => ({ ...prev, coins: true }));
      setError(null);

      // Сначала популярные монеты
      const popularResponse = await axios.get(
        "http://localhost:5000/api/popular-cryptocurrencies"
      );

      if (Array.isArray(popularResponse.data)) {
        const formattedPopular = popularResponse.data.map((coin) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol,
          image: coin.image,
        }));
        setPopularCoins(formattedPopular);

        // Затем все монеты
        const allResponse = await axios.get(
          "http://localhost:5000/api/cryptocurrencies"
        );

        if (Array.isArray(allResponse.data)) {
          setAllCoins(allResponse.data);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Ошибка загрузки данных о монетах"
      );
    } finally {
      setLoading((prev) => ({ ...prev, coins: false }));
    }
  };

  // Получение текущей цены
  const getCurrentPrice = async (coinId) => {
    try {
      setLoading((prev) => ({ ...prev, price: true }));

      const response = await axios.get(
        `http://localhost:5000/api/coin-price/${coinId}`
      );

      return response.data?.price || 0;
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка получения цены");
      return 0;
    } finally {
      setLoading((prev) => ({ ...prev, price: false }));
    }
  };

  // Добавление монеты в портфель
  const addCoinToPortfolio = async () => {
    if (!selectedCoin || !quantity || parseFloat(quantity) <= 0) {
      setError("Выберите монету и укажите количество");
      return;
    }

    try {
      setError(null);

      const price = useCurrentPrice
        ? await getCurrentPrice(selectedCoin.id)
        : parseFloat(customPrice);

      if (price <= 0) {
        setError("Цена должна быть больше 0");
        return;
      }

      await axios.post(`http://localhost:5000/api/portfolio/${userId}`, {
        coin_id: selectedCoin.id,
        quantity: parseFloat(quantity),
        buy_price: price,
      });

      await fetchPortfolio();
      setIsAddPanelOpen(false);
      setSelectedCoin(null);
      setQuantity("");
      setCustomPrice("");
      setSearchQuery("");
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка добавления монеты");
    }
  };

  // Удаление монеты из портфеля
  const removeCoinFromPortfolio = async (coinId) => {
    try {
      setError(null);

      await axios.delete(
        `http://localhost:5000/api/portfolio/${userId}/${coinId}`
      );

      await fetchPortfolio();
      if (expandedCoin === coinId) setExpandedCoin(null);
    } catch (err) {
      setError(err.response?.data?.message || "Ошибка удаления монеты");
    }
  };

  // Получение деталей монеты
  const fetchCoinDetails = async (coinId) => {
    try {
      setLoading((prev) => ({ ...prev, details: true }));
      setError(null);

      // Получаем детали монеты и данные графика за 1 день
      const [detailsResponse, chartResponse] = await Promise.all([
        axios.get(`http://localhost:5000/api/coin/${coinId}`),
        axios.get(
          `http://localhost:5000/api/coin/${coinId}/market_chart?days=1`
        ),
      ]);

      // Форматируем данные для графика
      const chartData = {
        prices: chartResponse.data.prices.map((item) => ({
          time: new Date(item[0]),
          price: item[1],
        })),
        // Добавляем другие данные если нужно
      };

      setCoinDetails(detailsResponse.data.details);
      setCoinChartData(chartData);
    } catch (err) {
      if (err.response.status === 429) {
        setError(
          "Слишком много запросов. Подождите немного перед повторной попыткой."
        );
      }
      setError(err.response?.data?.message || "Ошибка загрузки деталей монеты");
    } finally {
      setLoading((prev) => ({ ...prev, details: false }));
    }
  };

  // Переключение деталей монеты
  const toggleCoinDetails = (coinId) => {
    if (expandedCoin === coinId) {
      setExpandedCoin(null);
    } else {
      setExpandedCoin(coinId);
      fetchCoinDetails(coinId);
    }
  };

  // Выбор монеты из поиска
  const selectCoin = (coin) => {
    setSelectedCoin(coin);
    setSearchQuery(coin.name);
    setShowDropdown(false);

    if (useCurrentPrice) {
      getCurrentPrice(coin.id).then((price) => {
        setCustomPrice(price.toString());
      });
    }
  };

  // Данные для графиков
  const portfolioChartData = {
    labels: portfolio.map((coin) => coin.id),
    datasets: [
      {
        data: portfolio.map((coin) => coin.quantity * coin.current_price),
        backgroundColor: [
          "#00FF88",
          "#1A1A1A",
          "#333333",
          "#555555",
          "#777777",
          "#999999",
          "#BBBBBB",
          "#DDDDDD",
        ],
        borderWidth: 1,
      },
    ],
  };

  const priceChartData = coinChartData
    ? {
        labels:
          coinChartData.prices?.map((p) =>
            new Date(p[0]).toLocaleDateString()
          ) || [],
        datasets: [
          {
            label: "Цена (USD)",
            data: coinChartData.prices?.map((p) => p[1]) || [],
            borderColor: "#00FF88",
            backgroundColor: "rgba(0, 255, 136, 0.1)",
            tension: 0.1,
            fill: true,
          },
        ],
      }
    : null;

  return (
    <>
      <div className="dashboard-container">
        {/* Шапка */}
        <div className="header">
          <h1>Крипто Портфель</h1>
          {loading.portfolio && (
            <div className="message">
              Пожалуйста подождите. Данные загружаются. Ожидание может составить
              до 30 секунд
            </div>
          )}
        </div>

        {/* Сообщения об ошибках */}
        {error && (
          <div className="alert alert-warning">
            {error}
            <button className="close-error" onClick={() => setError(null)}>
              ×
            </button>
          </div>
        )}

        {/* Основное содержимое */}
        <div className="main-content">
          {/* График портфеля */}
          <div className="portfolio-chart">
            <h2>Ваш портфель</h2>
            {loading.portfolio ? (
              <div className="loading">Загрузка...</div>
            ) : portfolio.length > 0 ? (
              <div className="chart-with-summary">
                <div className="chart-container">
                  <Pie
                    data={portfolioChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: { color: "#FFF" },
                        },
                      },
                    }}
                  />
                </div>
                <div className="portfolio-summary">
                  <div className="profit-summary">Общая стоимость портфеля</div>
                  <div className="balance">
                    ${totalPortfolioValue.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <p>Ваш портфель пуст. Добавьте монеты чтобы начать.</p>
            )}
          </div>

          {/* Список монет */}
          <div className="portfolio-list">
            <h2>Монеты в портфеле</h2>
            {loading.portfolio ? (
              <div className="loading">Загрузка...</div>
            ) : (
              <ul className="coin-list">
                {portfolio.map((coin) => (
                  <React.Fragment key={coin.id}>
                    <li
                      className="coin-item"
                      onClick={() => toggleCoinDetails(coin.id)}
                    >
                      <div className="coin-header">
                        <span className="coin-name">{coin.id}</span>
                        <div className="coin-meta">
                          <span className="coin-amount">
                            {coin.quantity} монет
                          </span>
                          <span className="buy-price">
                            Куплено по: ${coin.buy_price.toFixed(2)}
                          </span>
                          <span className="buy-time">
                            {new Date(coin.added_at).toLocaleDateString(
                              "ru-RU",
                              {
                                day: "numeric",
                                month: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                          <span className="current-price">
                            Текущая: ${coin.current_price.toFixed(2)}
                          </span>
                        </div>
                        <span
                          className={`profit-loss ${
                            coin.profit_loss >= 0 ? "positive" : "negative"
                          }`}
                        >
                          {coin.profit_loss >= 0 ? "+" : ""}
                          {coin.profit_loss.toFixed(2)} $
                        </span>
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCoinFromPortfolio(coin.id);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </li>

                    {expandedCoin === coin.id && (
                      <li className="coin-details">
                        {loading.details ? (
                          <div className="loading">Загрузка деталей...</div>
                        ) : coinDetails ? (
                          <>
                            <div className="coin-info">
                              <h3>
                                {coinDetails.name} (
                                {coinDetails.symbol.toUpperCase()})
                              </h3>
                              <div className="stats-grid">
                                <div className="stat-item">
                                  <span className="stat-label">
                                    Текущая цена:
                                  </span>
                                  <span className="stat-value">
                                    $
                                    {coinDetails.market_data?.current_price?.usd?.toLocaleString() ||
                                      "N/A"}
                                  </span>
                                </div>
                                <div className="stat-item">
                                  <span className="stat-label">
                                    Капитализация:
                                  </span>
                                  <span className="stat-value">
                                    $
                                    {coinDetails.market_data?.market_cap?.usd?.toLocaleString() ||
                                      "N/A"}
                                  </span>
                                </div>
                                <div className="stat-item">
                                  <span className="stat-label">
                                    Объем (24ч):
                                  </span>
                                  <span className="stat-value">
                                    $
                                    {coinDetails.market_data?.total_volume?.usd?.toLocaleString() ||
                                      "N/A"}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="price-chart">
                              {priceChartData && (
                                <Line
                                  data={{
                                    labels: coinChartData.prices.map((item) =>
                                      item.time.toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    ),
                                    datasets: [
                                      {
                                        label: "Цена (USD)",
                                        data: coinChartData.prices.map(
                                          (item) => item.price
                                        ),
                                        borderColor: "#00FF88",
                                        backgroundColor:
                                          "rgba(0, 255, 136, 0.1)",
                                        tension: 0.1,
                                        fill: true,
                                        pointRadius: 2,
                                        pointHoverRadius: 5,
                                      },
                                    ],
                                  }}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: {
                                        display: true,
                                        position: "top",
                                        labels: {
                                          color: "#FFF",
                                          font: {
                                            size: 14,
                                          },
                                        },
                                      },
                                      tooltip: {
                                        callbacks: {
                                          label: (context) =>
                                            `$${context.parsed.y.toFixed(4)}`,
                                          title: (context) => context[0].label,
                                        },
                                        displayColors: false,
                                        backgroundColor: "#1E1E1E",
                                        titleColor: "#00FF88",
                                        bodyColor: "#FFF",
                                        borderColor: "#333",
                                        borderWidth: 1,
                                      },
                                    },
                                    scales: {
                                      x: {
                                        grid: {
                                          color: "rgba(255, 255, 255, 0.1)",
                                          drawBorder: false,
                                        },
                                        ticks: {
                                          color: "#AAA",
                                          maxRotation: 45,
                                          minRotation: 45,
                                          autoSkip: true,
                                          maxTicksLimit: 10,
                                        },
                                      },
                                      y: {
                                        grid: {
                                          color: "rgba(255, 255, 255, 0.1)",
                                          drawBorder: false,
                                        },
                                        ticks: {
                                          color: "#AAA",
                                          callback: (value) =>
                                            `$${value.toFixed(2)}`,
                                        },
                                      },
                                    },
                                  }}
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="error">
                            Не удалось загрузить данные
                          </div>
                        )}
                      </li>
                    )}
                  </React.Fragment>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Кнопка добавления */}
        <button
          className="add-btn"
          onClick={() => setIsAddPanelOpen(!isAddPanelOpen)}
        >
          {isAddPanelOpen ? "×" : "+"}
        </button>

        {/* Панель добавления монет */}
        <div className={`add-panel ${isAddPanelOpen ? "open" : ""}`}>
          <button
            className="close-btn"
            onClick={() => {
              setIsAddPanelOpen(false);
              setSearchQuery("");
              setSelectedCoin(null);
            }}
          >
            ×
          </button>
          <h2>Добавить монету</h2>

          {/* Поле поиска монет */}
          <div className="form-group search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск монет..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />

            {/* Выпадающий список монет */}
            {showDropdown && (
              <div className="dropdown-menu" ref={dropdownRef}>
                {loading.coins ? (
                  <div className="dropdown-item">Загрузка...</div>
                ) : filteredCoins.length > 0 ? (
                  filteredCoins.map((coin) => (
                    <div
                      key={coin.id}
                      className="dropdown-item"
                      onClick={() => selectCoin(coin)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span className="coin-name">{coin.name}</span>
                      <span className="coin-symbol">
                        ({coin.symbol.toUpperCase()})
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="dropdown-item">
                    {searchQuery
                      ? "Ничего не найдено"
                      : "Начните вводить название"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Выбранная монета */}
          {selectedCoin && (
            <div className="selected-coin-info">
              Выбрано: {selectedCoin.name} ({selectedCoin.symbol.toUpperCase()})
            </div>
          )}

          {/* Количество */}
          <div className="form-group">
            <label>Количество:</label>
            <input
              type="number"
              min="0.00000001"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="kolvo"
              placeholder="Введите количество"
              disabled={!selectedCoin}
            />
          </div>

          {/* Варианты цены */}
          <div className="price-options">
            <label className="radio-label">
              <input
                type="radio"
                checked={useCurrentPrice}
                onChange={() => {
                  setUseCurrentPrice(true);
                  if (selectedCoin) {
                    getCurrentPrice(selectedCoin.id).then((price) => {
                      setCustomPrice(price.toString());
                    });
                  }
                }}
                disabled={!selectedCoin}
              />
              Использовать текущую цену
            </label>

            <label className="radio-label">
              <input
                type="radio"
                checked={!useCurrentPrice}
                onChange={() => setUseCurrentPrice(false)}
                disabled={!selectedCoin}
              />
              Указать свою цену
            </label>

            {/* Поле для своей цены */}
            {!useCurrentPrice && (
              <div className="form-group">
                <label>Цена покупки (USD):</label>
                <input
                  type="number"
                  min="0.00000001"
                  step="any"
                  value={customPrice}
                  className="kolvo"
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Введите цену"
                />
              </div>
            )}
          </div>

          {/* Кнопка добавления */}
          <button
            className="submit-btn"
            onClick={addCoinToPortfolio}
            disabled={!selectedCoin || !quantity || loading.price}
          >
            {loading.price ? "Загрузка..." : "Добавить в портфель"}
          </button>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
