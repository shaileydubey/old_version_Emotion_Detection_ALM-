import mysql.connector
from config import DB_CONFIG


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def test_connection():
    try:
        conn = get_db()
        cursor = conn.cursor(buffered=True)
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        print("✅ Database connected successfully!")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False