from app import app, db, User, bcrypt
import os

def create_admin():
    with app.app_context():
        # Проверяем, не существует ли уже администратор
        existing_admin = db.session.execute(
            db.select(User).filter_by(username='admin')
        ).scalar_one_or_none()
        
        if not existing_admin:
            admin = User(
                username='admin',
                password=bcrypt.generate_password_hash('admin123').decode('utf-8'),
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            print("✅ Администратор успешно создан!")
        else:
            print("ℹ️ Администратор уже существует")

if __name__ == '__main__':
    create_admin()