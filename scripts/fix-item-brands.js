const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.migration' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

async function fixAllItemBrands() {
  console.log('🔧 Fixing all item brand assignments...\n');
  
  // 1. Load Firebase data
  const firebaseItems = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../firebase-export/items_data.json'), 'utf8')
  );
  
  console.log(`📦 Loaded ${firebaseItems.length} items from Firebase`);
  
  // 2. Get brands from Supabase
  const { data: brands } = await supabase
    .from('brands')
    .select('id, brand_name, brand_normalized')
    .eq('company_id', DM_BRANDS_ID);
    
  console.log(`🏷️  Found ${brands?.length || 0} brands in Supabase:`);
  brands?.forEach(b => console.log(`   - ${b.brand_name} (${b.brand_normalized})`));
  
  // Create brand lookup maps
  const brandByNormalized = new Map(brands?.map(b => [b.brand_normalized.toLowerCase(), b.id]) || []);
  const brandByName = new Map(brands?.map(b => [b.brand_name.toLowerCase(), b.id]) || []);
  
  // Add variations for matching
  brandByNormalized.set('my flame lifestyle', brandByNormalized.get('my flame lifestyle'));
  brandByNormalized.set('my-flame-lifestyle', brandByNormalized.get('my flame lifestyle'));
  brandByNormalized.set('rader', brandByNormalized.get('rader'));
  brandByNormalized.set('räder', brandByNormalized.get('rader'));
  brandByNormalized.set('r-der', brandByNormalized.get('rader'));
  
  // 3. Get all items from Supabase
  console.log('\n🔄 Fetching all items from Supabase...');
  const allItems = [];
  let start = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('items')
      .select('id, legacy_item_id, name')
      .range(start, start + limit - 1);
      
    if (error || !data || data.length === 0) break;
    allItems.push(...data);
    if (data.length < limit) break;
    start += limit;
  }
  
  console.log(`📋 Found ${allItems.length} items in Supabase`);
  
  // Create item lookup
  const itemMap = new Map(allItems.map(i => [i.legacy_item_id, i.id]));
  
  // 4. Process updates in batches
  let processedCount = 0;
  let updatedCount = 0;
  let matchedBrandCount = 0;
  const batchSize = 100;
  
  console.log('\n🔄 Processing brand assignments in batches...');
  
  for (let i = 0; i < firebaseItems.length; i += batchSize) {
    const batch = firebaseItems.slice(i, i + batchSize);
    const updates = [];
    
    // Prepare all updates for this batch
    for (const fbItem of batch) {
      processedCount++;
      
      const supabaseItemId = itemMap.get(fbItem.id);
      if (!supabaseItemId) continue;
      
      // Extract brand information from Firebase
      let manufacturer = '';
      let brandId = null;
      
      // Try multiple fields in order of preference
      const brandSources = [
        fbItem.brand_normalized,
        fbItem.brand,
        fbItem.manufacturer, 
        fbItem.Manufacturer
      ];
      
      for (const source of brandSources) {
        if (source && source.trim()) {
          manufacturer = source.trim();
          break;
        }
      }
      
      if (manufacturer) {
        // Normalize for matching
        const normalizedManufacturer = manufacturer.toLowerCase()
          .replace(/ä/g, 'a')
          .replace(/ö/g, 'o')
          .replace(/ü/g, 'u')
          .replace(/my-flame-lifestyle/g, 'my flame lifestyle')
          .trim();
        
        // Try to match brand
        brandId = brandByNormalized.get(normalizedManufacturer) || 
                  brandByName.get(normalizedManufacturer);
        
        // Partial matching
        if (!brandId) {
          for (const [brandName, id] of brandByNormalized) {
            if (normalizedManufacturer.includes(brandName) || brandName.includes(normalizedManufacturer)) {
              brandId = id;
              break;
            }
          }
        }
        
        if (brandId) matchedBrandCount++;
      }
      
      updates.push({
        itemId: supabaseItemId,
        manufacturer: manufacturer || null,
        brand_id: brandId,
        cost_price: parseFloat(fbItem.purchase_rate) || null,
        purchase_price: parseFloat(fbItem.selling_price) || null,
        retail_price: parseFloat(fbItem.rate) || parseFloat(fbItem.sales_rate) || null
      });
    }
    
    // Execute all updates in parallel
    const updatePromises = updates.map(update => 
      supabase
        .from('items')
        .update({
          manufacturer: update.manufacturer,
          brand_id: update.brand_id,
          cost_price: update.cost_price,
          purchase_price: update.purchase_price,
          retail_price: update.retail_price
        })
        .eq('id', update.itemId)
    );
    
    const results = await Promise.allSettled(updatePromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    updatedCount += successCount;
    
    console.log(`   📊 Batch ${Math.floor(i/batchSize) + 1}: processed ${batch.length}, updated ${successCount}, matched brands so far: ${matchedBrandCount}`);
  }
  
  console.log(`\n✅ Final Results:`);
  console.log(`   📦 Total items processed: ${processedCount}`);
  console.log(`   ✏️  Items updated: ${updatedCount}`);
  console.log(`   🏷️  Brand matches found: ${matchedBrandCount}`);
  
  // 5. Verification - check how many items now have brands
  console.log('\n🔍 Verification:');
  
  for (const brand of brands || []) {
    const { count } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brand.id);
      
    console.log(`   ${brand.brand_name}: ${count || 0} items`);
  }
  
  const { count: noBrandCount } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .is('brand_id', null);
    
  console.log(`   No brand assigned: ${noBrandCount || 0} items`);
}

if (require.main === module) {
  fixAllItemBrands();
}