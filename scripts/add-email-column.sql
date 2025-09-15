-- Add email column to customers table
ALTER TABLE customers 
ADD COLUMN email VARCHAR(255);

-- Add index for email lookups
CREATE INDEX idx_customers_email ON customers(email);

-- Add comment for documentation
COMMENT ON COLUMN customers.email IS 'Customer email address fetched from Zoho contacts';