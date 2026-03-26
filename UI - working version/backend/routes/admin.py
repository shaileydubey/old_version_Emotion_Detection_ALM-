# ======================== Admin Router ========================
# Admin Router -> Handles all admin-only API endpoints for stats, user management, credits, and call log CRUD.
# ||
# ||
# ||
# Functions/Methods -> get_stats()      -> Fetch platform-wide counts (users, calls, agents)
# ||                 | get_users()      -> Fetch all registered users
# ||                 | toggle_status()  -> Enable or disable a user account
# ||                 | add_credits()    -> Add credits to a specific user
# ||                 | get_calls()      -> Fetch latest 100 call logs with agent name
# ||                 | create_call()    -> Insert a new call log record
# ||                 | update_call()    -> Update status of an existing call log
# ||                 |
# ||                 |---> Logic Flow -> Request lifecycle:
# ||                                  |
# ||                                  |--- All routes -> Depend on require_admin -> Reject non-admins
# ||                                  |--- get_stats()
# ||                                  |    └── Query users, call_logs, agents -> Return counts
# ||                                  |--- get_users()
# ||                                  |    └── Query users table -> Return id, name, email, role, is_active
# ||                                  |--- toggle_status()
# ||                                  |    ├── Fetch current is_active for user_id
# ||                                  |    ├── IF user not found -> Raise 404
# ||                                  |    └── Flip is_active -> Commit -> Return new status
# ||                                  |--- add_credits()
# ||                                  |    ├── IF amount <= 0 -> Raise 400
# ||                                  |    └── COALESCE credits + amount -> Commit -> Return success
# ||                                  |--- get_calls()
# ||                                  |    └── JOIN call_logs + agents -> ORDER BY created_at DESC -> LIMIT 100
# ||                                  |--- create_call()
# ||                                  |    └── INSERT into call_logs -> RETURNING id -> Commit
# ||                                  |--- update_call()
# ||                                  |    └── UPDATE call_logs SET status -> Commit -> Return success
# ||
# ======================================================================

# ---------------------------------------------------------------
# SECTION: IMPORTS
# ---------------------------------------------------------------
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from deps import require_admin
from models.db import get_db

# ---------------------------------------------------------------
# SECTION: ROUTER INIT
# ---------------------------------------------------------------
router = APIRouter()


# ---------------------------------------------------------------
# SECTION: REQUEST MODELS
# ---------------------------------------------------------------

# CreditsRequest -> Validates incoming credit amount from request body
class CreditsRequest(BaseModel):
    amount: int


# ---------------------------------------------------------------
# SECTION: ROUTE HANDLERS
# ---------------------------------------------------------------

# get_stats -> Returns total counts for users, calls, and agents platform-wide
@router.get("/admin/stats")
def get_stats(user=Depends(require_admin)):
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Query -> COUNT all users
    cursor.execute("SELECT COUNT(*) as total FROM users")
    total_users = cursor.fetchone()["total"]

    # Query -> COUNT all call log entries
    cursor.execute("SELECT COUNT(*) as total FROM call_logs")
    total_calls = cursor.fetchone()["total"]

    # Query -> COUNT all agents
    cursor.execute("SELECT COUNT(*) as total FROM agents")
    total_agents = cursor.fetchone()["total"]

    cursor.close()
    conn.close()

    # creditsUsed -> Hardcoded 0 (billing not yet implemented)
    return {
        "totalUsers":  total_users,
        "totalCalls":  total_calls,
        "totalAgents": total_agents,
        "creditsUsed": 0,
    }


# get_users -> Returns all users with id, name, email, role, is_active ordered newest first
@router.get("/admin/users")
def get_users(user=Depends(require_admin)):
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Query -> Fetch all users -> ORDER BY id DESC (newest first)
    cursor.execute("SELECT id, name, email, role, is_active FROM users ORDER BY id DESC")
    users = cursor.fetchall()

    cursor.close()
    conn.close()
    return users


# toggle_status -> Flips is_active for a given user_id -> 404 if user not found
@router.put("/admin/users/{user_id}/status")
def toggle_status(user_id: int, user=Depends(require_admin)):
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Fetch -> Current is_active value for the target user
    cursor.execute("SELECT is_active FROM users WHERE id = %s", (user_id,))
    target = cursor.fetchone()

    # Guard -> Raise 404 if user does not exist
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Flip -> Invert current active status
    new_status = not target["is_active"]
    cursor.execute("UPDATE users SET is_active = %s WHERE id = %s", (new_status, user_id))
    conn.commit()
    cursor.close()
    conn.close()
    return {"success": True, "is_active": new_status}


# add_credits -> Adds a validated amount to user's existing credits -> 400 if amount invalid
@router.put("/admin/users/{user_id}/credits")
def add_credits(user_id: int, body: CreditsRequest, user=Depends(require_admin)):

    # Guard -> Reject non-positive credit amounts
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # COALESCE -> Treats NULL credits as 0 before adding new amount
    cursor.execute(
        "UPDATE users SET credits = COALESCE(credits, 0) + %s WHERE id = %s",
        (body.amount, user_id),
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"success": True}


# get_calls -> Fetches latest 100 call logs joined with agent name -> created_at cast to string
@router.get("/calls")
def get_calls(user=Depends(require_admin)):
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # JOIN -> call_logs LEFT JOIN agents to attach agent name to each call
    cursor.execute("""
        SELECT cl.id, cl.caller_name, cl.caller_number, cl.category,
               cl.sentiment, cl.status, cl.duration_seconds,
               cl.issue_summary, cl.created_at,
               a.name AS agent_name
        FROM call_logs cl
        LEFT JOIN agents a ON cl.agent_id = a.id
        ORDER BY cl.created_at DESC
        LIMIT 100
    """)
    calls = cursor.fetchall()

    # Serialize -> Convert datetime created_at to string for JSON response
    for call in calls:
        if call.get("created_at"):
            call["created_at"] = str(call["created_at"])

    cursor.close()
    conn.close()
    return calls


# create_call -> Inserts a new call log record -> Returns auto-generated id via RETURNING
@router.post("/calls")
def create_call(call: dict, user=Depends(require_admin)):
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Insert -> New call log -> RETURNING id (PostgreSQL, replaces cursor.lastrowid)
    cursor.execute("""
        INSERT INTO call_logs (caller_name, caller_number, category, status, issue_summary)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (
        call.get("caller_name"), call.get("caller_number"),
        call.get("category"), call.get("status", "unknown"),
        call.get("issue_summary"),
    ))
    new_id = cursor.fetchone()["id"]
    conn.commit()
    cursor.close()
    conn.close()
    return {"id": new_id}


# update_call -> Updates status field of a call log by call_id -> Returns success
@router.put("/calls/{call_id}")
def update_call(call_id: int, call: dict, user=Depends(require_admin)):
    conn   = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Update -> SET status only -> Partial update pattern
    cursor.execute(
        "UPDATE call_logs SET status=%s WHERE id=%s",
        (call.get("status"), call_id)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return {"success": True}