const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkOrderStatuses() {
  console.log('Checking existing order statuses in database...\n');
  
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('order_status')
      .not('order_status', 'is', null);

    if (error) {
      console.error('Error fetching statuses:', error);
      return;
    }

    // Get unique statuses
    const uniqueStatuses = [...new Set(data.map(order => order.order_status))];
    
    console.log('Current order statuses in database:');
    uniqueStatuses.forEach(status => {
      console.log(`- ${status}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkOrderStatuses();