const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTableSchema() {
  console.log('Checking order_line_items table schema...\n');
  
  try {
    // Get a sample record to see the column structure
    const { data, error } = await supabase
      .from('order_line_items')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching sample record:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Available columns:');
      Object.keys(data[0]).forEach(column => {
        console.log(`- ${column}`);
      });
    } else {
      console.log('No records found in order_line_items table');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkTableSchema();