from app import app, db, User, bcrypt

with app.app_context():
    # Пересоздаем всю структуру БД
    db.drop_all()
    db.create_all()
    
    # Создаем администратора
    admin = User(
        username="admin",
        password=bcrypt.generate_password_hash("admin123").decode('utf-8'),
        is_admin=True  # Явно указываем права
    )
    
    # Создаем обычного пользователя для теста
    user = User(
        username="testuser",
        password=bcrypt.generate_password_hash("user123").decode('utf-8'),
        is_admin=False
    )
    
    db.session.add(admin)
    db.session.add(user)
    db.session.commit()
    
    print("✅ База данных пересоздана!")
    print("Администратор: admin / admin123")
    print("Обычный пользователь: testuser / user123")