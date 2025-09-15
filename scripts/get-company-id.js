const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

console.log('Testing Supabase connection...');
console.log('URL:', process.env.SUPABASE_URL);
console.log('Service role key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCompanyId() {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name')
      .limit(5);
    
    if (error) {
      console.error('Error fetching companies:', error);
      return;
    }
    
    if (companies.length === 0) {
      console.log('No companies found in the database');
      return;
    }
    
    console.log('Available companies:');
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
    // If there's only one company, show the ID to use
    if (companies.length === 1) {
      console.log('\n✅ Use this company ID in your .env.migration file:');
      console.log(`DEFAULT_COMPANY_ID=${companies[0].id}`);
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

getCompanyId();