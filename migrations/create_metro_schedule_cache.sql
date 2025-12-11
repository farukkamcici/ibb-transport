CREATE TABLE IF NOT EXISTS metro_schedules (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL,
    direction_id INTEGER NOT NULL,
    line_code VARCHAR(20),
    station_name VARCHAR(255),
    direction_name VARCHAR(255),
    valid_for DATE NOT NULL,
    payload JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    CONSTRAINT uq_station_direction_valid_date UNIQUE (station_id, direction_id, valid_for)
);

CREATE INDEX IF NOT EXISTS idx_metro_schedules_station_direction
    ON metro_schedules (station_id, direction_id);

CREATE INDEX IF NOT EXISTS idx_metro_schedules_valid_for
    ON metro_schedules (valid_for);

CREATE INDEX IF NOT EXISTS idx_metro_schedules_line_code
    ON metro_schedules (line_code);
