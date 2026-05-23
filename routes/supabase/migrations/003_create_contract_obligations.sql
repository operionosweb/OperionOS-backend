CREATE TABLE IF NOT EXISTS contract_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    contract_id UUID NOT NULL,

    supplier_id UUID,

    obligation_type TEXT,

    title TEXT,

    description TEXT,

    severity TEXT,

    deadline TIMESTAMP,

    status TEXT DEFAULT 'Pending',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_obligations_contract_id
ON contract_obligations(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_obligations_deadline
ON contract_obligations(deadline);

CREATE INDEX IF NOT EXISTS idx_contract_obligations_status
ON contract_obligations(status);
