-- Migration: Add end_date and job_metadata columns to job_executions table
-- Date: 2025-12-12
-- Description: Support multi-day forecast tracking and additional job metadata

-- Add end_date column to track date range for multi-day jobs
ALTER TABLE job_executions 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add job_metadata column to store additional job information as JSON
ALTER TABLE job_executions 
ADD COLUMN IF NOT EXISTS job_metadata JSONB;

-- Add comment to columns for documentation
COMMENT ON COLUMN job_executions.end_date IS 'End date for multi-day jobs (NULL for single-day jobs)';
COMMENT ON COLUMN job_executions.job_metadata IS 'Additional job metadata stored as JSON (e.g., num_days, days array, issues)';

-- Create index on job_metadata for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_job_executions_job_metadata ON job_executions USING gin(job_metadata);

-- Update existing records to have empty job_metadata
UPDATE job_executions 
SET job_metadata = '{}'::jsonb 
WHERE job_metadata IS NULL;
