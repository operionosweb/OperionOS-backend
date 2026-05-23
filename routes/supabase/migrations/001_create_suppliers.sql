CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    industry TEXT,

    country TEXT,

    risk_score NUMERIC DEFAULT 0,

    total_contracts INTEGER DEFAULT 0,

    total_exposure NUMERIC DEFAULT 0,

    operational_burden_score NUMERIC DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name
ON suppliers(name);

CREATE INDEX IF NOT EXISTS idx_suppliers_risk_score
ON suppliers(risk_score);
