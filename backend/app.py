from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import requests
from datetime import datetime, timedelta
import time
from functools import wraps
import threading
from collections import deque
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, send_from_directory
import os



app = Flask(__name__, static_folder='../frontend/build')
CORS(app)
bcrypt = Bcrypt(app)

app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,  # Для стабильности подключений к БД
    'pool_recycle': 300     # Переподключение каждые 5 минут
}

# Конфигурация
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///crypto_portfolio.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Настройка логирования
handler = RotatingFileHandler('app.log', maxBytes=10000, backupCount=3)
handler.setLevel(logging.INFO)
app.logger.addHandler(handler)
f_folder = os.path.join(os.getcwd(), "..","frontend")
b_folder = os.path.join(f_folder, "build")

def upgrade():
    # Добавляем колонку is_admin
    db.engine.execute('ALTER TABLE user ADD COLUMN is_admin BOOLEAN DEFAULT FALSE')

def downgrade():
    # Удаляем колонку is_admin
    db.engine.execute('ALTER TABLE user DROP COLUMN is_admin')

# Модели данных
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)  # Это должно быть!
    portfolio = db.relationship('PortfolioItem', backref='user', lazy=True)

class PortfolioItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    coin_id = db.Column(db.String(50), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    buy_price = db.Column(db.Float, nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

class CachedPrice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coin_id = db.Column(db.String(50), nullable=False, unique=True)
    price = db.Column(db.Float, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

class CachedPopularCoins(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coins_data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

class CachedAllCoins(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coins_data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

class CachedCoinDetails(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coin_id = db.Column(db.String(50), unique=True, nullable=False)
    details_data = db.Column(db.JSON, nullable=False)
    chart_data = db.Column(db.JSON, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)

# Создание таблиц
with app.app_context():
    db.create_all()

# Конфигурация API
CRYPTO_API_URL = "https://api.coingecko.com/api/v3"
API_RATE_LIMIT = 10  # Максимальное количество запросов в минуту
REQUEST_INTERVAL = 2

# Система rate limiting
request_times = deque(maxlen=API_RATE_LIMIT)
rate_lock = threading.Lock()

def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        global request_times
        
        with rate_lock:
            now = time.time()
            
            # Удаляем старые запросы
            while request_times and now - request_times[0] > 60:
                request_times.popleft()
            
            # Если достигнут лимит - ждем
            if len(request_times) >= API_RATE_LIMIT:
                time_to_wait = 60 - (now - request_times[0])
                time.sleep(time_to_wait)
                now = time.time()
                request_times.popleft()
            
            # Добавляем искусственную задержку между запросами
            if request_times:
                time_since_last = now - request_times[-1]
                if time_since_last < REQUEST_INTERVAL:
                    time.sleep(REQUEST_INTERVAL - time_since_last)
                    now = time.time()
            
            request_times.append(now)
        
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = request.headers.get('X-User-Id')
        if not user_id:
            return jsonify({"message": "Authentication required"}), 401
        
        user = User.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({"message": "Admin access required"}), 403
        
        return f(*args, **kwargs)
    return decorated_function

# Вспомогательные функции
def handle_api_error(e, endpoint):
    error_message = f"API error in {endpoint}: {str(e)}"
    app.logger.error(error_message)
    return jsonify({
        "status": 500,
        "message": "Failed to fetch data from external API"
    }), 500

def validate_required_fields(data, required_fields):
    for field in required_fields:
        if field not in data or not data[field]:
            return False, f"{field} is required"
    return True, None

# Логирование запросов
@app.after_request
def after_request(response):
    timestamp = datetime.strftime(datetime.now(), '[%Y-%m-%d %H:%M:%S]')
    app.logger.info(
        f'{timestamp} {request.remote_addr} {request.method} {request.path} '
        f'{response.status_code}'
    )
    return response

@app.route('/', defaults={"filename": ""})
@app.route('/<path:filename>')
def index(filename):
    if not filename:
        filename = "index.html"
    return send_from_directory(b_folder, filename)

@app.route('/health')
def health_check():
    return jsonify({"status": "ok"}), 200

# API Endpoints
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    
    valid, message = validate_required_fields(data, ['username', 'password'])
    if not valid:
        return jsonify({"message": message}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({"message": "Username already exists"}), 400

    try:
        hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        new_user = User(username=data['username'], password=hashed_password)
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"Registration failed: {str(e)}"}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    
    valid, message = validate_required_fields(data, ['username', 'password'])
    if not valid:
        return jsonify({"message": message}), 400

    try:
        user = User.query.filter_by(username=data['username']).first()
        
        if user and bcrypt.check_password_hash(user.password, data['password']):
            return jsonify({
                "message": "Login successful",
                "user_id": user.id,
                "is_admin": user.is_admin
            }), 200
        else:
            return jsonify({"message": "Invalid credentials"}), 401
    except Exception as e:
        return jsonify({"message": f"Login failed: {str(e)}"}), 500

@app.route('/api/popular-cryptocurrencies', methods=['GET'])
@rate_limit
def get_popular_cryptocurrencies():
    cached = None
    try:
        cached = CachedPopularCoins.query.first()
        
        # Кэш на 10 минут
        if cached and (datetime.utcnow() - cached.last_updated) < timedelta(minutes=10):
            return jsonify(cached.coins_data)
        
        params = {
            'vs_currency': 'usd',
            'order': 'market_cap_desc',
            'per_page': 100,
            'page': 1,
            'sparkline': False
        }
        
        response = requests.get(f"{CRYPTO_API_URL}/coins/markets", params=params)
        response.raise_for_status()
        coins_data = response.json()
        
        if cached:
            cached.coins_data = coins_data
            cached.last_updated = datetime.utcnow()
        else:
            cached = CachedPopularCoins(coins_data=coins_data)
            db.session.add(cached)
        
        db.session.commit()
        return jsonify(coins_data)
    except requests.exceptions.RequestException as e:
        if cached:
            return jsonify(cached.coins_data)
        return handle_api_error(e, 'get_popular_cryptocurrencies')
    except Exception as e:
        db.session.rollback()
        if cached:
            return jsonify(cached.coins_data)
        return jsonify({
            "status": 500,
            "message": f"Server error: {str(e)}"
        }), 500

@app.route('/api/cryptocurrencies', methods=['GET'])
@rate_limit
def get_all_cryptocurrencies():
    cached = None
    try:
        cached = CachedAllCoins.query.first()
        
        # Кэш на 24 часа
        if cached and (datetime.utcnow() - cached.last_updated) < timedelta(hours=24):
            return jsonify(cached.coins_data)
        
        response = requests.get(f"{CRYPTO_API_URL}/coins/list")
        response.raise_for_status()
        coins_data = response.json()
        
        if cached:
            cached.coins_data = coins_data
            cached.last_updated = datetime.utcnow()
        else:
            cached = CachedAllCoins(coins_data=coins_data)
            db.session.add(cached)
        
        db.session.commit()
        return jsonify(coins_data)
    except requests.exceptions.RequestException as e:
        if cached:
            return jsonify(cached.coins_data)
        return handle_api_error(e, 'get_all_cryptocurrencies')
    except Exception as e:
        db.session.rollback()
        if cached:
            return jsonify(cached.coins_data)
        return jsonify({
            "status": 500,
            "message": f"Server error: {str(e)}"
        }), 500

@app.route('/api/coin-price/<string:coin_id>', methods=['GET'])
@rate_limit
def get_coin_price(coin_id):
    cached_price = None
    try:
        cached_price = CachedPrice.query.filter_by(coin_id=coin_id).first()
        
        # Кэш на 5 минут
        if cached_price and (datetime.utcnow() - cached_price.last_updated) < timedelta(minutes=5):
            return jsonify({"price": cached_price.price})
        
        params = {'ids': coin_id, 'vs_currencies': 'usd'}
        response = requests.get(f"{CRYPTO_API_URL}/simple/price", params=params)
        response.raise_for_status()
        
        price_data = response.json()
        price = price_data.get(coin_id, {}).get('usd', 0)
        
        if price > 0:
            if cached_price:
                cached_price.price = price
                cached_price.last_updated = datetime.utcnow()
            else:
                cached_price = CachedPrice(coin_id=coin_id, price=price)
                db.session.add(cached_price)
            
            db.session.commit()
        
        return jsonify({"price": price})
    except requests.exceptions.RequestException as e:
        if cached_price:
            return jsonify({"price": cached_price.price})
        return handle_api_error(e, 'get_coin_price')
    except Exception as e:
        db.session.rollback()
        if cached_price:
            return jsonify({"price": cached_price.price})
        return jsonify({
            "status": 500,
            "message": f"Server error: {str(e)}",
            "price": 0
        }), 500

@app.route('/api/portfolio/<int:user_id>', methods=['GET'])
def get_user_portfolio(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        portfolio_items = PortfolioItem.query.filter_by(user_id=user_id).all()
        portfolio_data = []
        
        for item in portfolio_items:
            price_response = requests.get(
                f"http://localhost:5000/api/coin-price/{item.coin_id}"
            )
            current_price = price_response.json().get('price', 0) if price_response.status_code == 200 else 0
            
            profit_loss = (current_price - item.buy_price) * item.quantity
            
            portfolio_data.append({
                'id': item.coin_id,
                'quantity': item.quantity,
                'buy_price': item.buy_price,
                'current_price': current_price,
                'profit_loss': profit_loss,
                'added_at': item.added_at.isoformat()
            })
        
        return jsonify(portfolio_data)
    except Exception as e:
        return jsonify({
            "status": 500,
            "message": f"Failed to get portfolio: {str(e)}"
        }), 500

@app.route('/api/portfolio/<int:user_id>', methods=['POST'])
def add_to_portfolio(user_id):
    try:
        data = request.json
        
        valid, message = validate_required_fields(data, ['coin_id', 'quantity', 'buy_price'])
        if not valid:
            return jsonify({"message": message}), 400
        
        quantity = float(data['quantity'])
        buy_price = float(data['buy_price'])
        
        if quantity <= 0 or buy_price <= 0:
            return jsonify({"message": "Quantity and price must be positive"}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        existing_item = PortfolioItem.query.filter_by(
            user_id=user_id,
            coin_id=data['coin_id']
        ).first()
        
        if existing_item:
            total_quantity = existing_item.quantity + quantity
            total_cost = (existing_item.quantity * existing_item.buy_price) + (quantity * buy_price)
            existing_item.buy_price = total_cost / total_quantity
            existing_item.quantity = total_quantity
        else:
            new_item = PortfolioItem(
                user_id=user_id,
                coin_id=data['coin_id'],
                quantity=quantity,
                buy_price=buy_price
            )
            db.session.add(new_item)
        
        db.session.commit()
        return jsonify({"message": "Coin added to portfolio successfully"}), 201
    except ValueError:
        return jsonify({"message": "Invalid quantity or price format"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": 500,
            "message": f"Failed to add to portfolio: {str(e)}"
        }), 500

@app.route('/api/portfolio/<int:user_id>/<string:coin_id>', methods=['DELETE'])
def remove_from_portfolio(user_id, coin_id):
    try:
        portfolio_item = PortfolioItem.query.filter_by(
            user_id=user_id,
            coin_id=coin_id
        ).first()
        
        if not portfolio_item:
            return jsonify({"message": "Coin not found in portfolio"}), 404
        
        db.session.delete(portfolio_item)
        db.session.commit()
        
        return jsonify({"message": "Coin removed from portfolio successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": 500,
            "message": f"Failed to remove from portfolio: {str(e)}"
        }), 500
    
@app.route('/api/coin/<string:coin_id>/chart', methods=['GET'])
@rate_limit
def get_coin_chart(coin_id):
    try:
        days = request.args.get('days', '1')
        response = requests.get(
            f"{CRYPTO_API_URL}/coins/{coin_id}/market_chart",
            params={
                'vs_currency': 'usd',
                'days': days
            }
        )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return handle_api_error(e, 'get_coin_chart')
    except Exception as e:
        return jsonify({
            "status": 500,
            "message": f"Server error: {str(e)}"
        }), 500
    
@app.route('/api/coin/<string:coin_id>/market_chart', methods=['GET'])
@rate_limit
def get_coin_market_chart(coin_id):
    try:
        days = request.args.get('days', '1')  # По умолчанию 1 день
        response = requests.get(
            f"{CRYPTO_API_URL}/coins/{coin_id}/market_chart",
            params={
                'vs_currency': 'usd',
                'days': days
            }
        )
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({
            "status": 500,
            "message": f"Server error: {str(e)}"
        }), 500

@app.route('/api/coin/<string:coin_id>', methods=['GET'])
@rate_limit
def get_coin_details(coin_id):
    try:
        # Сначала проверяем кэш
        cached_details = CachedCoinDetails.query.filter_by(coin_id=coin_id).first()
        if cached_details and (datetime.utcnow() - cached_details.last_updated) < timedelta(minutes=30):
            return jsonify({
                "details": cached_details.details_data,
                "chart_data": cached_details.chart_data
            })
        
        # Делаем запросы с обработкой 429 ошибки
        try:
            details_response = requests.get(f"{CRYPTO_API_URL}/coins/{coin_id}")
            details_response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                if cached_details:
                    return jsonify({
                        "details": cached_details.details_data,
                        "chart_data": cached_details.chart_data
                    }), 200
                return jsonify({
                    "status": 429,
                    "message": "Rate limit exceeded. Please try again later."
                }), 429
            raise
        
        # Аналогично для chart data
        try:
            chart_response = requests.get(
                f"{CRYPTO_API_URL}/coins/{coin_id}/market_chart",
                params={'vs_currency': 'usd', 'days': '1'}
            )
            chart_response.raise_for_status()
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                chart_data = cached_details.chart_data if cached_details else None
                return jsonify({
                    "details": details_response.json(),
                    "chart_data": chart_data
                }), 200
            raise
        
        # Сохраняем в кэш
        if not cached_details:
            cached_details = CachedCoinDetails(
                coin_id=coin_id,
                details_data=details_response.json(),
                chart_data=chart_response.json()
            )
            db.session.add(cached_details)
        else:
            cached_details.details_data = details_response.json()
            cached_details.chart_data = chart_response.json()
            cached_details.last_updated = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            "details": details_response.json(),
            "chart_data": chart_response.json()
        })
    except Exception as e:
        return handle_api_error(e, 'get_coin_details')
    
@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    try:
        users = User.query.all()
        users_data = []
        
        for user in users:
            portfolio_items = PortfolioItem.query.filter_by(user_id=user.id).all()
            portfolio_value = 0
            
            for item in portfolio_items:
                price_response = requests.get(
                    f"http://localhost:5000/api/coin-price/{item.coin_id}"
                )
                current_price = price_response.json().get('price', 0) if price_response.status_code == 200 else 0
                portfolio_value += current_price * item.quantity
            
            users_data.append({
                'id': user.id,
                'username': user.username,
                'portfolio_count': len(portfolio_items),
                'portfolio_value': portfolio_value
            })
        
        return jsonify(users_data)
    except Exception as e:
        return jsonify({
            "status": 500,
            "message": f"Failed to get users: {str(e)}"
        }), 500

@app.route('/api/admin/user/<int:user_id>/portfolio', methods=['GET'])
@admin_required
def get_user_portfolio_admin(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        portfolio_items = PortfolioItem.query.filter_by(user_id=user_id).all()
        portfolio_data = []
        
        for item in portfolio_items:
            price_response = requests.get(
                f"http://localhost:5000/api/coin-price/{item.coin_id}"
            )
            current_price = price_response.json().get('price', 0) if price_response.status_code == 200 else 0
            
            portfolio_data.append({
                'coin_id': item.coin_id,
                'quantity': item.quantity,
                'buy_price': item.buy_price,
                'current_price': current_price,
                'value': current_price * item.quantity,
                'added_at': item.added_at.isoformat()
            })
        
        return jsonify({
            'user': {
                'id': user.id,
                'username': user.username
            },
            'portfolio': portfolio_data,
            'total_value': sum(item['value'] for item in portfolio_data)
        })
    except Exception as e:
        return jsonify({
            "status": 500,
            "message": f"Failed to get portfolio: {str(e)}"
        }), 500


@app.route('/api/admin/user/<int:user_id>/toggle-admin', methods=['POST'])
@admin_required
def toggle_admin_status(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
            
        user.is_admin = not user.is_admin
        db.session.commit()
        
        return jsonify({
            "message": "Admin status updated",
            "is_admin": user.is_admin
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "status": 500,
            "message": f"Failed to update admin status: {str(e)}"
        }), 500
    

# API-роуты
@app.route('/api/test')
def test():
    return {"status": "ok"}

# Отдача React-приложения
@app.route('/', methods=['GET', 'HEAD'])
def serve_frontend():
    if request.method == 'HEAD':
        return '', 200  # Для health-чеков хоста
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True)