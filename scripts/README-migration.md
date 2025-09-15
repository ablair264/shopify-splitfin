# Firebase to Supabase Migration Guide

## Prerequisites

1. **Install dependencies**:
   ```bash
   npm install @supabase/supabase-js dotenv
   ```

2. **Set up environment variables**:
   - Copy `.env.example` to `.env`
   - Fill in your Supabase URL and service role key
   - Set your default company ID from the companies table

3. **Run the Supabase schema**:
   - Execute `supabase-schema.sql` in your Supabase SQL editor first

## Migration Process

### Step 1: Get Your Company ID
```sql
SELECT id, name FROM companies;
```
Copy the UUID and set it as `DEFAULT_COMPANY_ID` in your `.env` file.

### Step 2: Run Migration
```bash
node firebase-to-supabase-migration.js
```

## What Gets Migrated

### ✅ Supported Collections
- **Brands** → `brands` table
- **Items Data** → `items` table  
- **Sales Orders** → `orders` + `order_line_items` tables
- **Invoices** → `invoices` table
- **Purchase Orders** → `purchase_orders` table
- **Notifications** → `notifications` table

### 🔄 Data Transformations
- Firebase timestamps → ISO strings
- Status values → normalized enums
- Brand references → proper foreign keys
- Order line items → separate table with relationships

### ⚠️ Important Notes
- Migration starts with limited records (50-100 per collection) for testing
- Customers must exist before migrating orders
- Items must be migrated before orders (for line item relationships)
- Some fields may need manual mapping (addresses, complex objects)

## Post-Migration Steps

1. **Verify data integrity**:
   ```sql
   SELECT COUNT(*) FROM brands;
   SELECT COUNT(*) FROM items;
   SELECT COUNT(*) FROM orders;
   SELECT COUNT(*) FROM order_line_items;
   ```

2. **Update RLS policies** if needed for your specific auth setup

3. **Test the analytics components** with the new data structure

## Troubleshooting

- If migration fails, check the console output for specific error messages
- Ensure your Firebase data has been properly exported
- Verify foreign key relationships (customers, users, etc.) exist
- Check that enum values match the defined constraints

## Next Steps

After successful migration:
1. Update your analytics components to use new table structure
2. Test all functionality with real data
3. Adjust any queries that reference the old Firebase structure
4. Set up proper RLS policies for your application