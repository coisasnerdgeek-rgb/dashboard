-- Create marketplace_fees table
CREATE TABLE IF NOT EXISTS marketplace_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    marketplace VARCHAR(255) NOT NULL UNIQUE, -- Code: SH, ML, AM, etc.
    name VARCHAR(255) NOT NULL, -- Display Name: Shopee, Mercado Livre
    commission_percent NUMERIC DEFAULT 0, -- Direct 0.14 for 14%
    fixed_fee NUMERIC DEFAULT 0, -- Base fixed fee
    tax_rate NUMERIC DEFAULT 0.06, -- Default tax rate for invoices
    is_active BOOLEAN DEFAULT TRUE,
    rules_json JSONB DEFAULT '{}'::jsonb, -- Store complex rules like tiers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policy to allow read/write (adjust as needed for RLS)
ALTER TABLE marketplace_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON marketplace_fees FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON marketplace_fees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON marketplace_fees FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated delete" ON marketplace_fees FOR DELETE USING (true);
