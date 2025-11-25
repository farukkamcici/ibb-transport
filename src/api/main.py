import lightgbm as lgb
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .db import SessionLocal
from .routers import admin, forecast, lines
from .services.store import FeatureStore
from .utils.init_db import init_db
from .state import AppState

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
    
    yield
    
    # Clean up on shutdown
    print("Clearing model and feature store cache...")
    AppState.model = None
    AppState.store = None

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/")
def read_root():
    return {"message": "Istanbul Transport Crowding API"}
