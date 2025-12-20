import lightgbm as lgb
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .db import SessionLocal
from .routers import admin, forecast, lines, nowcast, reports, schedule, status, metro, traffic, capacity
from .services.store import FeatureStore
from .services.capacity_store import CapacityStore
from .services.route_service import route_service
from .utils.init_db import init_db
from .state import AppState
from .scheduler import start_scheduler, shutdown_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()

    # Load the LightGBM model and assign to AppState
    print("Loading model...")
    model_path = 'models/lgbm_transport_v6.txt'
    try:
        AppState.model = lgb.Booster(model_file=model_path)
        print("Model loaded successfully.")
    except lgb.basic.LightGBMError as e:
        print(f"Error loading model: {e}")
        AppState.model = None
    
    # Initialize the Feature Store and assign to AppState
    AppState.store = FeatureStore()

    # Initialize capacity artifacts store (parquet snapshots)
    AppState.capacity_store = CapacityStore()
    
    # Load route shapes into memory
    print("Loading route shape data...")
    route_service.load_data()
    print("✅ Route shapes ready")
    
    # Start the cron job scheduler
    print("Starting APScheduler for cron jobs...")
    start_scheduler()
    print("✅ Scheduler initialized")
    
    yield
    
    # Clean up on shutdown
    print("Shutting down scheduler...")
    shutdown_scheduler()
    print("Clearing model and feature store cache...")
    AppState.model = None
    AppState.store = None
    AppState.capacity_store = None

app = FastAPI(lifespan=lifespan)

# Add CORS middleware

default_cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://ibb-transport.vercel.app",
    "https://dolumu.app",
    "https://www.dolumu.app",
]

cors_origins_env = os.getenv("CORS_ALLOW_ORIGINS")
cors_origins = (
    [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
    if cors_origins_env
    else default_cors_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # Allow only this project's Vercel preview deployments (not every *.vercel.app origin).
    allow_origin_regex=r"^https://ibb-transport(-.*)?\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"An unexpected error occurred: {exc}")
    return JSONResponse(
        status_code=500,
        content={"message": "An internal server error occurred."},
    )

# Include routers
app.include_router(admin.router, prefix="/api")
app.include_router(forecast.router, prefix="/api")
app.include_router(lines.router, prefix="/api")
app.include_router(nowcast.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(metro.router, prefix="/api")  # Metro Istanbul integration
app.include_router(traffic.router, prefix="/api")
app.include_router(capacity.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Istanbul Transport Crowding API"}
