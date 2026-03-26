# ======================== Auth Router ========================
# Auth Router -> Handles user registration and login with bcrypt password hashing and JWT token generation.
# ||
# ||
# ||
# Functions/Methods -> register() -> Validate input -> Hash password -> Insert user -> Return JWT
# ||                 | login()    -> Lookup user -> Verify password -> Return JWT
# ||                 |
# ||                 |---> Logic Flow -> Request lifecycle:
# ||                                  |
# ||                                  |--- register()
# ||                                  |    ├── Sanitize -> Strip + lowercase name, email, phone
# ||                                  |    ├── Validate -> Empty fields -> Raise 400
# ||                                  |    ├── Validate -> Password length < 8 -> Raise 400
# ||                                  |    ├── Hash -> bcrypt password with gensalt()
# ||                                  |    ├── INSERT -> users table -> RETURNING id
# ||                                  |    ├── IF duplicate key -> Raise 409 (email taken)
# ||                                  |    ├── IF other exception -> Raise 500
# ||                                  |    └── Encode -> JWT with user_id + expiry -> Return token + user
# ||                                  |
# ||                                  |--- login()
# ||                                  |    ├── Sanitize -> Strip + lowercase email
# ||                                  |    ├── SELECT -> users WHERE email = %s
# ||                                  |    ├── IF user not found -> Raise 401
# ||                                  |    ├── bcrypt.checkpw -> Compare password to hash
# ||                                  |    ├── IF mismatch -> Raise 401
# ||                                  |    ├── IF HTTPException -> Re-raise as-is (skip 500 wrapper)
# ||                                  |    ├── IF other exception -> Raise 500
# ||                                  |    └── Encode -> JWT with user_id + expiry -> Return token + user
# ||
# ======================================================================

# ---------------------------------------------------------------
# SECTION: IMPORTS
# ---------------------------------------------------------------
import jwt
import bcrypt
import datetime
import traceback
import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from config import JWT_SECRET, JWT_ALGO, JWT_EXPIRE_DAYS
from models.db import get_db

# ---------------------------------------------------------------
# SECTION: ROUTER INIT
# ---------------------------------------------------------------
router = APIRouter()


# ---------------------------------------------------------------
# SECTION: REQUEST MODELS
# ---------------------------------------------------------------

# RegisterRequest -> Validates incoming registration fields
# phone_number -> Optional, defaults to empty string
class RegisterRequest(BaseModel):
    name:         str
    email:        EmailStr
    password:     str
    phone_number: str = ""


# LoginRequest -> Validates incoming login credentials
class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


# ---------------------------------------------------------------
# SECTION: ROUTE HANDLERS
# ---------------------------------------------------------------

# register -> Validates input, hashes password, inserts user, returns JWT token
# Raises -> 400 (missing fields / short password), 409 (duplicate email), 500 (unexpected)
@router.post("/register")
def register(body: RegisterRequest):

    # Sanitize -> Strip whitespace and normalize email to lowercase
    name         = body.name.strip()
    email        = body.email.strip().lower()
    password     = body.password
    phone_number = body.phone_number.strip()

    # Validate -> All required fields must be non-empty
    if not name or not email or not password:
        raise HTTPException(status_code=400, detail="All fields are required")

    # Validate -> Password must meet minimum length requirement
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Hash -> bcrypt with auto-generated salt -> decode to UTF-8 string for DB storage
    password_hash = bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")

    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Insert -> New user with default role "user" -> RETURNING id (PostgreSQL)
        cursor.execute(
            "INSERT INTO users (name, email, password_hash, phone_number, role) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (name, email, password_hash, phone_number or None, "user"),
        )
        user_id = cursor.fetchone()["id"]
        conn.commit()
        cursor.close()
        conn.close()

        # JWT -> Encode user_id + expiry -> Sign with JWT_SECRET using JWT_ALGO
        token = jwt.encode(
            {
                "user_id": user_id,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRE_DAYS),
            },
            JWT_SECRET,
            algorithm=JWT_ALGO,
        )

        # Return -> Token + user profile for immediate frontend auth state hydration
        return {
            "message": "Account created",
            "token":   token,
            "user": {
                "id":           user_id,
                "name":         name,
                "email":        email,
                "phone_number": phone_number,
                "role":         "user",
            },
        }

    except Exception as e:
        traceback.print_exc()

        # Guard -> Catch duplicate email constraint violation -> Raise 409
        if "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail="Email already registered")

        raise HTTPException(status_code=500, detail=str(e))


# login -> Looks up user by email, verifies bcrypt password, returns JWT token
# Raises -> 401 (user not found / wrong password), 500 (unexpected)
@router.post("/login")
def login(body: LoginRequest):

    # Sanitize -> Normalize email to lowercase
    email    = body.email.strip().lower()
    password = body.password

    try:
        conn   = get_db()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Query -> Fetch full user row by email
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        # Guard -> Raise 401 if no user found with this email
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Verify -> bcrypt compare incoming password against stored hash
        if not bcrypt.checkpw(
            password.encode("utf-8"), user["password_hash"].encode("utf-8")
        ):
            # Guard -> Raise 401 on password mismatch (same message to prevent enumeration)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # JWT -> Encode user_id + expiry -> Sign with JWT_SECRET using JWT_ALGO
        token = jwt.encode(
            {
                "user_id": user["id"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRE_DAYS),
            },
            JWT_SECRET,
            algorithm=JWT_ALGO,
        )

        # Return -> Token + user profile for frontend auth state hydration
        return {
            "message": "Login successful",
            "token":   token,
            "user": {
                "id":           user["id"],
                "name":         user["name"],
                "email":        user["email"],
                "phone_number": user["phone_number"],
                "role":         user["role"],
            },
        }

    except HTTPException:
        # Re-raise -> Pass through 401s without wrapping in 500
        raise

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))