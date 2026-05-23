CREATE TABLE IF NOT EXISTS contract_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    contract_id UUID NOT NULL,

    supplier_id UUID,

    clause_type TEXT,

    normalized_clause_type TEXT,

    risk_level TEXT,

    clause_text TEXT,

    semantic_tags JSONB DEFAULT '[]',

    embedding VECTOR(1536),

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_contract_id
ON contract_clauses(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_clause_type
ON contract_clauses(clause_type);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_normalized
ON contract_clauses(normalized_clause_type);

CREATE INDEX IF NOT EXISTS idx_contract_clauses_risk
ON contract_clauses(risk_level);
