import psycopg2
import psycopg2.extras
from config import DATABASE_URL


def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def test_connection():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        print("✅ Neon Database connected successfully!")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False