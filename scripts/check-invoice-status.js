const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

async function checkInvoiceStatus() {
  console.log('🔍 Checking current invoice status...\n');
  
  // Get total invoice count
  const { count: totalInvoices } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', DM_BRANDS_ID);
    
  console.log(`📊 Total invoices: ${totalInvoices || 0}`);
  
  // Check field completion rates
  const { count: withBrands } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', DM_BRANDS_ID)
    .not('brand_id', 'is', null);
    
  const { count: withSales } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', DM_BRANDS_ID)
    .not('sales_id', 'is', null);
    
  const { count: withAddresses } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', DM_BRANDS_ID)
    .not('billing_address_1', 'is', null);
  
  console.log('\n📋 Field Completion Status:');
  console.log(`   🏷️  With brand_id: ${withBrands || 0} (${((withBrands/totalInvoices)*100).toFixed(1)}%)`);
  console.log(`   👤 With sales_id: ${withSales || 0} (${((withSales/totalInvoices)*100).toFixed(1)}%)`);
  console.log(`   📍 With billing address: ${withAddresses || 0} (${((withAddresses/totalInvoices)*100).toFixed(1)}%)`);
  
  // Show sample invoices that need enhancement
  const { data: needsEnhancement } = await supabase
    .from('invoices')
    .select('id, invoice_date, total, brand_id, sales_id, billing_address_1')
    .eq('company_id', DM_BRANDS_ID)
    .or('brand_id.is.null,sales_id.is.null,billing_address_1.is.null')
    .limit(10);
    
  console.log(`\n🔧 Invoices needing enhancement: ${needsEnhancement?.length || 0}`);
  
  if (needsEnhancement?.length > 0) {
    console.log('\nSample invoices that need enhancement:');
    needsEnhancement.forEach((inv, i) => {
      console.log(`   ${i+1}. Date: ${inv.invoice_date}, Total: £${inv.total}`);
      console.log(`      Brand: ${inv.brand_id ? '✅' : '❌'}, Sales: ${inv.sales_id ? '✅' : '❌'}, Address: ${inv.billing_address_1 ? '✅' : '❌'}`);
    });
  }
  
  // Show sample complete invoices
  const { data: completeInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_date, total, brand_id, sales_id, billing_address_1, brands(brand_name), users(first_name, last_name)')
    .eq('company_id', DM_BRANDS_ID)
    .not('brand_id', 'is', null)
    .not('sales_id', 'is', null)
    .not('billing_address_1', 'is', null)
    .limit(5);
    
  if (completeInvoices?.length > 0) {
    console.log('\n✅ Sample fully enhanced invoices:');
    completeInvoices.forEach((inv, i) => {
      console.log(`   ${i+1}. Date: ${inv.invoice_date}, Total: £${inv.total}`);
      console.log(`      Brand: ${inv.brands?.brand_name}, Sales: ${inv.users?.first_name} ${inv.users?.last_name}`);
      console.log(`      Address: ${inv.billing_address_1?.substring(0, 30)}...`);
    });
  }
}

checkInvoiceStatus();