-- Migration: Add trips_per_hour and vehicle_capacity columns to daily_forecasts table
-- Purpose: Store actual schedule data to improve capacity calculations and UI display
-- Date: 2025-01-22

-- Add new columns (nullable to avoid breaking existing data)
ALTER TABLE daily_forecasts 
ADD COLUMN IF NOT EXISTS trips_per_hour INTEGER,
ADD COLUMN IF NOT EXISTS vehicle_capacity INTEGER;

-- Create index for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_daily_forecasts_trips 
ON daily_forecasts(trips_per_hour) 
WHERE trips_per_hour IS NOT NULL;

-- Add comment to document the columns
COMMENT ON COLUMN daily_forecasts.trips_per_hour IS 'Combined scheduled trips per hour (G+D directions) from bus schedule cache';
COMMENT ON COLUMN daily_forecasts.vehicle_capacity IS 'Expected per-vehicle capacity from capacity artifacts';

-- Verify columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'daily_forecasts' 
  AND column_name IN ('trips_per_hour', 'vehicle_capacity');
