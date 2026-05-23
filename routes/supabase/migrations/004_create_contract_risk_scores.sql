CREATE TABLE IF NOT EXISTS contract_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    contract_id UUID NOT NULL,

    overall_risk_score NUMERIC DEFAULT 0,

    financial_risk_score NUMERIC DEFAULT 0,

    operational_risk_score NUMERIC DEFAULT 0,

    compliance_risk_score NUMERIC DEFAULT 0,

    supplier_risk_score NUMERIC DEFAULT 0,

    deviation_score NUMERIC DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_risk_scores_contract_id
ON contract_risk_scores(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_risk_scores_overall
ON contract_risk_scores(overall_risk_score);
