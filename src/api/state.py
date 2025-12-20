from .services.store import FeatureStore
from .services.capacity_store import CapacityStore
import lightgbm as lgb

class AppState:
    model: lgb.Booster = None
    store: FeatureStore = None
    capacity_store: CapacityStore = None

# Define the exact column order required by the LightGBM model
COLUMN_ORDER = [
    'line_name', 'hour_of_day', 'lag_24h', 'lag_48h', 'lag_168h', 
    'roll_mean_24h', 'roll_std_24h', 'temperature_2m', 'precipitation', 
    'wind_speed_10m', 'day_of_week', 'is_weekend', 'month', 'season', 
    'is_school_term', 'is_holiday', 'holiday_win_m1', 'holiday_win_p1'
]

def get_model() -> lgb.Booster:
    """Dependency to get the loaded LightGBM model."""
    if AppState.model is None:
        raise RuntimeError("Model is not loaded.")
    return AppState.model

def get_feature_store() -> FeatureStore:
    """Dependency to get the initialized FeatureStore."""
    if AppState.store is None:
        raise RuntimeError("Feature Store is not initialized.")
    return AppState.store


def get_capacity_store() -> CapacityStore:
    """Dependency to get the initialized CapacityStore."""
    if AppState.capacity_store is None:
        raise RuntimeError("Capacity store is not initialized.")
    return AppState.capacity_store
