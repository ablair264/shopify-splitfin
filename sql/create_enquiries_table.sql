-- Create sequence for enquiry numbers FIRST
CREATE SEQUENCE IF NOT EXISTS enquiry_sequence START 1;

-- Create enquiries table for Splitfin App
-- This mirrors the customer creation pattern but for tracking sales enquiries

CREATE TABLE IF NOT EXISTS enquiries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- Basic Information
  enquiry_number VARCHAR(50) UNIQUE NOT NULL DEFAULT 'ENQ-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('enquiry_sequence')::TEXT, 6, '0'),
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'negotiating', 'won', 'lost', 'cancelled')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Contact Details
  contact_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  
  -- Address Information (optional for enquiries)
  address_1 VARCHAR(255),
  address_2 VARCHAR(255),
  city_town VARCHAR(100),
  county VARCHAR(100),
  postcode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United Kingdom',
  
  -- Enquiry Details
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  product_interest TEXT,
  estimated_value DECIMAL(15,2),
  estimated_quantity INTEGER,
  expected_decision_date DATE,
  
  -- Source and Lead Information
  lead_source VARCHAR(100) DEFAULT 'website' CHECK (lead_source IN ('website', 'email', 'phone', 'referral', 'social_media', 'trade_show', 'advertisement', 'other')),
  referral_source VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Follow-up Information
  next_follow_up_date DATE,
  follow_up_notes TEXT,
  
  -- System Fields
  company_id UUID NOT NULL REFERENCES companies(id),
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  
  -- Conversion Tracking
  converted_to_customer BOOLEAN DEFAULT FALSE,
  converted_customer_id UUID REFERENCES customers(id),
  conversion_date TIMESTAMP WITH TIME ZONE,
  
  -- Additional Metadata
  tags TEXT[],
  custom_fields JSONB,
  notes TEXT,
  
  -- Soft Delete
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_priority ON enquiries(priority);
CREATE INDEX IF NOT EXISTS idx_enquiries_company_id ON enquiries(company_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_assigned_to ON enquiries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_by ON enquiries(created_by);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_email ON enquiries(email);
CREATE INDEX IF NOT EXISTS idx_enquiries_lead_source ON enquiries(lead_source);
CREATE INDEX IF NOT EXISTS idx_enquiries_next_follow_up ON enquiries(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_active ON enquiries(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_enquiries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_enquiries_updated_at
    BEFORE UPDATE ON enquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_enquiries_updated_at();

-- Row Level Security (RLS) Policies
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Users can only see enquiries from their company
CREATE POLICY "enquiries_select_policy" ON enquiries
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Policy for INSERT: Users can only create enquiries for their company
CREATE POLICY "enquiries_insert_policy" ON enquiries
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Policy for UPDATE: Users can only update enquiries from their company
CREATE POLICY "enquiries_update_policy" ON enquiries
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Policy for DELETE: Users can only delete enquiries from their company
CREATE POLICY "enquiries_delete_policy" ON enquiries
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE auth_user_id = auth.uid()
        )
    );

-- Create view for active enquiries with user details
CREATE OR REPLACE VIEW active_enquiries AS
SELECT 
    e.*,
    u.first_name || ' ' || u.last_name AS assigned_to_name,
    c.first_name || ' ' || c.last_name AS created_by_name,
    comp.name AS company_name_full
FROM enquiries e
LEFT JOIN users u ON e.assigned_to = u.id
LEFT JOIN users c ON e.created_by = c.id
LEFT JOIN companies comp ON e.company_id = comp.id
WHERE e.is_active = TRUE
ORDER BY e.created_at DESC;

-- Grant permissions to authenticated users
GRANT ALL ON enquiries TO authenticated;
GRANT ALL ON active_enquiries TO authenticated;
GRANT USAGE, SELECT ON enquiry_sequence TO authenticated;

COMMENT ON TABLE enquiries IS 'Table for storing sales enquiries and lead management';
COMMENT ON COLUMN enquiries.enquiry_number IS 'Auto-generated unique enquiry reference number';
COMMENT ON COLUMN enquiries.status IS 'Current status of the enquiry in the sales pipeline';
COMMENT ON COLUMN enquiries.priority IS 'Priority level for follow-up activities';
COMMENT ON COLUMN enquiries.estimated_value IS 'Estimated potential value of the enquiry';
COMMENT ON COLUMN enquiries.lead_source IS 'Source of the lead/enquiry';
COMMENT ON COLUMN enquiries.converted_to_customer IS 'Flag indicating if enquiry resulted in a customer';
COMMENT ON COLUMN enquiries.custom_fields IS 'JSON field for storing additional custom data';