-- Migration: Add target_date column to job_executions table
-- Date: 2025-11-29
-- Description: Tracks which date each forecast job was targeting

-- Add the column (allows NULL for backward compatibility with existing records)
ALTER TABLE job_executions 
ADD COLUMN IF NOT EXISTS target_date DATE;

-- Optional: Add index for faster queries by target date
CREATE INDEX IF NOT EXISTS idx_job_executions_target_date 
ON job_executions(target_date);

-- Optional: Add comment
COMMENT ON COLUMN job_executions.target_date IS 'The date for which the forecast was generated';
