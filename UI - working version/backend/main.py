# ======================== Main ========================
# Main -> FastAPI app entry point. Registers CORS middleware and mounts all route modules under /api.
# ||
# ||
# ||
# Functions/Methods -> root()   -> Health check on base route "/"
# ||                 | health() -> Health check on "/api/health"
# ||                 |
# ||                 |---> Logic Flow -> App startup sequence:
# ||                                  |
# ||                                  |--- sys.path.insert() -> Add backend dir to Python path
# ||                                  |--- FastAPI()         -> Init app with title + version
# ||                                  |--- CORSMiddleware    -> Allow localhost 5173 + 5174
# ||                                  |--- include_router()  -> Mount auth, admin, superuser,
# ||                                  |                         home, analytics, user, agent
# ||                                  |--- root()   -> GET /        -> Return running status
# ||                                  |--- health() -> GET /api/health -> Return ok status
# ||
# ======================================================================

# ---------------------------------------------------------------
# SECTION: IMPORTS
# ---------------------------------------------------------------
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # Add backend dir to path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, admin, superuser, home, analytics, user, agent
from routes.agent import router as agent_router

# ---------------------------------------------------------------
# SECTION: APP INIT
# ---------------------------------------------------------------
app = FastAPI(title="SR Comsoft AI API", version="2.0.0")

# ---------------------------------------------------------------
# SECTION: MIDDLEWARE
# ---------------------------------------------------------------

# CORS -> Allow Vite dev servers on 5173 + 5174
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------
# SECTION: ROUTERS
# ---------------------------------------------------------------
app.include_router(auth.router,       prefix="/api")  # /api/register, /api/login
app.include_router(admin.router,      prefix="/api")  # /api/admin/*, /api/calls
app.include_router(superuser.router,  prefix="/api")  # /api/agents, /api/sankey, /api/stats
app.include_router(home.router,       prefix="/api")  # /api/home/*
app.include_router(analytics.router,  prefix="/api")  # /api/analytics/*
app.include_router(user.router,       prefix="/api")  # /api/call-logs
app.include_router(agent_router)                      # /api/agent/* (prefix set in router)

# ---------------------------------------------------------------
# SECTION: BASE ROUTES
# ---------------------------------------------------------------

# root -> Confirm API is running
@app.get("/")
def root():
    return {"status": "SR Comsoft AI API running ✓"}

# health -> Lightweight health check for monitoring
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "SR Comsoft AI API"}