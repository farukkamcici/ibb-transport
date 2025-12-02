CREATE TABLE IF NOT EXISTS user_reports (
    id SERIAL PRIMARY KEY,
    report_type VARCHAR(50) NOT NULL, -- 'bug', 'data', 'feature'
    line_code VARCHAR(50),
    description TEXT NOT NULL,
    contact_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'in_progress', 'resolved', 'ignored'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hızlı filtreleme için indeksler
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_type ON user_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_user_reports_line ON user_reports(line_code);