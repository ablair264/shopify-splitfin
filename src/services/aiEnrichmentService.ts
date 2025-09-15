/**
 * AI Product Enrichment Service
 * Integrates with Python AI enrichment system
 */

import { supabase } from './supabaseService';

// External AI Provider Types
type AIProvider = 'local' | 'openai' | 'anthropic';

interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProductEnrichmentData {
  sku: string;
  original_name: string;
  enhanced_description: string;
  category_level_1: string;
  category_level_2: string;
  category_level_3: string;
  standardized_color: string;
  color_family: string;
  material: string;
  style: string;
  use_cases: string;
  target_audience: string;
  similar_products: string;
  seo_keywords: string;
  confidence_score: number;
  data_sources: string;
}

export interface EnrichmentProgress {
  total: number;
  processed: number;
  current_product: string;
  status: 'idle' | 'processing' | 'complete' | 'error';
  error?: string;
}

export interface EnrichmentOptions {
  use_web_enhancement: boolean;
  max_products?: number;
  brand_filter?: string;
  confidence_threshold?: number;
}

interface SupabaseProductRaw {
  sku: any;
  name: any;
  description: any;
  brand_id: any;
  category: any;
  colour: any;
  retail_price: any;
  material: any;
  dimensions: any;
  brands: {
    id: any;
    brand_name: any;
  }[];
}

interface SupabaseProduct {
  sku: string;
  name: string;
  description?: string;
  brand_id: string;
  category?: string;
  colour?: string;
  retail_price?: number;
  material?: string;
  dimensions?: string;
  brand: string; // Added after formatting
}

class AIEnrichmentService {
  private baseUrl: string;
  private apiKey: string;
  private aiConfig: AIConfig;
  private rateLimitDelay: number;
  private lastApiCall: number;

  constructor() {
    // These would typically come from environment variables
    this.baseUrl = process.env.REACT_APP_AI_ENRICHMENT_URL || 'http://localhost:8000';
    this.apiKey = process.env.REACT_APP_AI_ENRICHMENT_KEY || '';
    
    // Configure AI provider based on environment
    this.aiConfig = {
      provider: (process.env.REACT_APP_AI_PROVIDER as AIProvider) || 'local',
      apiKey: process.env.REACT_APP_OPENAI_API_KEY || process.env.REACT_APP_ANTHROPIC_API_KEY || '',
      model: process.env.REACT_APP_AI_MODEL || 'gpt-4-turbo-preview',
      temperature: parseFloat(process.env.REACT_APP_AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.REACT_APP_AI_MAX_TOKENS || '1000')
    };
    
    // Rate limiting: delay between API calls in milliseconds
    // OpenAI: ~3 requests per second, Anthropic: ~5 requests per second
    this.rateLimitDelay = this.aiConfig.provider === 'openai' ? 350 : 200;
    this.lastApiCall = 0;
  }

  /**
   * Enrich products from Supabase items table
   */
  async enrichProductsFromSupabase(
    companyId: string,
    options: EnrichmentOptions = { use_web_enhancement: false }
  ): Promise<ProductEnrichmentData[]> {
    try {
      // Get products from Supabase
      const products = await this.getProductsFromSupabase(companyId, options.brand_filter);
      
      if (products.length === 0) {
        throw new Error('No products found for enrichment');
      }

      // Enrich products using local AI system
      const enrichedProducts = await this.enrichProductsLocally(products, options);
      
      return enrichedProducts;
    } catch (error) {
      console.error('Error enriching products:', error);
      throw error;
    }
  }

  /**
   * Get products from Supabase
   */
  private async getProductsFromSupabase(companyId: string, brandFilter?: string): Promise<SupabaseProduct[]> {
    let query = supabase
      .from('items')
      .select(`
        sku,
        name,
        description,
        brand_id,
        category,
        colour,
        retail_price,
        brands!inner (
          id,
          brand_name
        )
      `)
      .eq('brands.company_id', companyId)
      .eq('status', 'active')
      .not('name', 'is', null);

    if (brandFilter) {
      query = query.eq('brand_id', brandFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    // Format the data to include brand_name
    const formattedData: SupabaseProduct[] = data?.map((item: any) => ({
      sku: String(item.sku || ''),
      name: String(item.name || ''),
      description: item.description || undefined,
      brand_id: String(item.brand_id || ''),
      category: item.category || undefined,
      colour: item.colour || undefined,
      retail_price: item.retail_price ? Number(item.retail_price) : undefined,
      brand: item.brands?.brand_name || 'Unknown'
    })) || [];

    return formattedData;
  }

  /**
   * Enrich products using the local AI system
   */
  private async enrichProductsLocally(
    products: SupabaseProduct[],
    options: EnrichmentOptions
  ): Promise<ProductEnrichmentData[]> {
    const enrichedProducts: ProductEnrichmentData[] = [];

    // Import the AI enrichment logic (this would need to be adapted for browser)
    // For now, we'll simulate the enrichment process
    for (let i = 0; i < Math.min(products.length, options.max_products || 50); i++) {
      const product = products[i];
      
      // Simulate enrichment process
      const enrichedProduct = await this.enrichSingleProduct(product, options);
      enrichedProducts.push(enrichedProduct);

      // Emit progress event
      this.emitProgressEvent({
        total: Math.min(products.length, options.max_products || 50),
        processed: i + 1,
        current_product: product.name,
        status: 'processing'
      });
    }

    return enrichedProducts;
  }

  /**
   * Apply rate limiting for API calls
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    
    if (timeSinceLastCall < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastApiCall = Date.now();
  }

  /**
   * Call external AI API for product enrichment
   */
  private async callExternalAI(product: SupabaseProduct): Promise<Partial<ProductEnrichmentData>> {
    if (!this.aiConfig.apiKey) {
      throw new Error('AI API key not configured');
    }

    // Apply rate limiting
    await this.applyRateLimit();

    const prompt = this.buildEnrichmentPrompt(product);
    
    switch (this.aiConfig.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      default:
        throw new Error(`Unsupported AI provider: ${this.aiConfig.provider}`);
    }
  }

  /**
   * Build a structured prompt for AI enrichment
   */
  private buildEnrichmentPrompt(product: SupabaseProduct): string {
    return `Analyze this product and provide structured enrichment data:

Product: ${product.name}
Brand: ${product.brand}
Current Description: ${product.description || 'None'}
SKU: ${product.sku}
Price: ${product.retail_price ? `$${product.retail_price}` : 'Unknown'}
${product.material ? `Material: ${product.material}` : ''}
${product.dimensions ? `Dimensions: ${product.dimensions}` : ''}

Please provide:
1. An enhanced product description (2-3 sentences, highlight key features and benefits)
2. Category hierarchy (3 levels, e.g., "Home & Garden > Outdoor Living > Garden Furniture")
3. Primary color and color family
4. Main material (if identifiable)
5. Style/aesthetic (e.g., modern, rustic, minimalist)
6. Target audience
7. 3-5 use cases
8. 5-8 SEO keywords

Format your response as JSON with these keys:
enhanced_description, category_level_1, category_level_2, category_level_3,
standardized_color, color_family, material, style, target_audience,
use_cases (array), seo_keywords (array)`;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<Partial<ProductEnrichmentData>> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: this.aiConfig.model || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a product data enrichment specialist. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.aiConfig.temperature,
          max_tokens: this.aiConfig.maxTokens,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const enrichment = JSON.parse(data.choices[0].message.content);
      
      return {
        enhanced_description: enrichment.enhanced_description,
        category_level_1: enrichment.category_level_1,
        category_level_2: enrichment.category_level_2,
        category_level_3: enrichment.category_level_3,
        standardized_color: enrichment.standardized_color,
        color_family: enrichment.color_family,
        material: enrichment.material,
        style: enrichment.style,
        target_audience: enrichment.target_audience,
        use_cases: Array.isArray(enrichment.use_cases) ? enrichment.use_cases.join('; ') : enrichment.use_cases,
        seo_keywords: Array.isArray(enrichment.seo_keywords) ? enrichment.seo_keywords.join('; ') : enrichment.seo_keywords,
        confidence_score: 0.95
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<Partial<ProductEnrichmentData>> {
    try {
      if (!this.aiConfig.apiKey) {
        throw new Error('Anthropic API key is required');
      }
      
      // Use local proxy endpoint for development, or Netlify function in production
      const apiEndpoint = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:8889/.netlify/functions/anthropic-proxy'
        : '/api/anthropic-proxy';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.aiConfig.model || 'claude-3-opus-20240229',
          max_tokens: this.aiConfig.maxTokens,
          temperature: this.aiConfig.temperature,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nPlease respond with only valid JSON, no additional text.`
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Anthropic response received:', JSON.stringify(data).substring(0, 200));
      
      // Check if we have an error response
      if (data.error) {
        throw new Error(`Anthropic API returned error: ${JSON.stringify(data.error)}`);
      }
      
      const enrichment = JSON.parse(data.content[0].text);
      console.log('Parsed enrichment:', enrichment);
      
      return {
        enhanced_description: enrichment.enhanced_description,
        category_level_1: enrichment.category_level_1,
        category_level_2: enrichment.category_level_2,
        category_level_3: enrichment.category_level_3,
        standardized_color: enrichment.standardized_color,
        color_family: enrichment.color_family,
        material: enrichment.material,
        style: enrichment.style,
        target_audience: enrichment.target_audience,
        use_cases: Array.isArray(enrichment.use_cases) ? enrichment.use_cases.join('; ') : enrichment.use_cases,
        seo_keywords: Array.isArray(enrichment.seo_keywords) ? enrichment.seo_keywords.join('; ') : enrichment.seo_keywords,
        confidence_score: 0.95
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  /**
   * Enrich a single product
   */
  private async enrichSingleProduct(
    product: SupabaseProduct,
    options: EnrichmentOptions
  ): Promise<ProductEnrichmentData> {
    const brand = product.brand || 'Unknown';
    let enrichmentData: Partial<ProductEnrichmentData> = {};
    let dataSources: string[] = [];

    // Check if external AI should be used
    const useExternalAI = options.use_web_enhancement && this.aiConfig.provider !== 'local' && this.aiConfig.apiKey;
    
    if (useExternalAI) {
      try {
        // Use external AI for enrichment
        enrichmentData = await this.callExternalAI(product);
        dataSources.push(this.aiConfig.provider === 'openai' ? 'OpenAI GPT-4' : 'Anthropic Claude');
      } catch (error) {
        console.error('External AI failed, falling back to local processing:', error);
        // Fall back to local processing if external AI fails
      }
    }
    
    // If no external AI or it failed, use local processing
    if (!enrichmentData.enhanced_description) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
      
      const category = this.categorizeProduct(product.name, brand);
      const colorInfo = this.extractColorInfo(product.name + ' ' + (product.description || ''));
      const seoKeywords = this.generateSEOKeywords(product.name, brand, category);
      
      enrichmentData = {
        enhanced_description: this.generateEnhancedDescription(product, brand, category, colorInfo),
        category_level_1: category.level1,
        category_level_2: category.level2,
        category_level_3: category.level3,
        standardized_color: colorInfo.standardized,
        color_family: colorInfo.family,
        material: this.extractMaterial(product.name + ' ' + (product.description || '')),
        style: this.getBrandStyle(brand),
        use_cases: category.useCases.join('; '),
        target_audience: this.getBrandTargetAudience(brand),
        seo_keywords: seoKeywords.join('; '),
        confidence_score: this.calculateConfidenceScore(product, brand),
      };
      dataSources.push('Local AI Logic', 'Brand Context');
    }

    return {
      sku: product.sku,
      original_name: product.name,
      enhanced_description: enrichmentData.enhanced_description || '',
      category_level_1: enrichmentData.category_level_1 || 'General',
      category_level_2: enrichmentData.category_level_2 || 'Products',
      category_level_3: enrichmentData.category_level_3 || 'Miscellaneous',
      standardized_color: enrichmentData.standardized_color || '',
      color_family: enrichmentData.color_family || '',
      material: enrichmentData.material || '',
      style: enrichmentData.style || this.getBrandStyle(brand),
      use_cases: enrichmentData.use_cases || '',
      target_audience: enrichmentData.target_audience || this.getBrandTargetAudience(brand),
      similar_products: enrichmentData.similar_products || '',
      seo_keywords: enrichmentData.seo_keywords || '',
      confidence_score: enrichmentData.confidence_score || 0.85,
      data_sources: dataSources.join('; ')
    };
  }

  /**
   * Categorize product using simple logic
   */
  private categorizeProduct(name: string, brand: string) {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('candle') || nameLower.includes('scented')) {
      return {
        level1: 'Home & Garden',
        level2: 'Home Fragrance',
        level3: 'Candles & Wax Melts',
        useCases: ['aromatherapy', 'ambiance', 'decoration']
      };
    }
    
    if (nameLower.includes('throw') || nameLower.includes('cushion') || nameLower.includes('pillow')) {
      return {
        level1: 'Home & Garden',
        level2: 'Home Decor',
        level3: 'Textiles & Soft Furnishings',
        useCases: ['comfort', 'decoration', 'warmth']
      };
    }
    
    if (nameLower.includes('kitchen') || nameLower.includes('cooking')) {
      return {
        level1: 'Home & Kitchen',
        level2: 'Kitchen & Dining',
        level3: 'Kitchen Tools & Gadgets',
        useCases: ['cooking', 'food preparation', 'serving']
      };
    }

    return {
      level1: 'Home & Garden',
      level2: 'Home Decor',
      level3: 'General Merchandise',
      useCases: ['decoration', 'home improvement', 'lifestyle']
    };
  }

  /**
   * Extract color information
   */
  private extractColorInfo(text: string) {
    const colorMappings: { [key: string]: { standardized: string; family: string } } = {
      'grey': { standardized: 'Gray', family: 'Neutral' },
      'gray': { standardized: 'Gray', family: 'Neutral' },
      'white': { standardized: 'White', family: 'Neutral' },
      'black': { standardized: 'Black', family: 'Neutral' },
      'red': { standardized: 'Red', family: 'Warm' },
      'blue': { standardized: 'Blue', family: 'Cool' },
      'green': { standardized: 'Green', family: 'Cool' },
      'natural': { standardized: 'Natural', family: 'Earth' }
    };

    const textLower = text.toLowerCase();
    
    for (const [color, mapping] of Object.entries(colorMappings)) {
      if (textLower.includes(color)) {
        return mapping;
      }
    }

    return { standardized: 'Unspecified', family: 'Unknown' };
  }

  /**
   * Extract material information
   */
  private extractMaterial(text: string): string {
    const materials = ['cotton', 'wool', 'wood', 'metal', 'glass', 'ceramic', 'plastic'];
    const textLower = text.toLowerCase();
    
    for (const material of materials) {
      if (textLower.includes(material)) {
        return material.charAt(0).toUpperCase() + material.slice(1);
      }
    }

    return 'Mixed Materials';
  }

  /**
   * Get brand style
   */
  private getBrandStyle(brand: string): string {
    const brandStyles: { [key: string]: string } = {
      'MyFlame': 'modern, lifestyle-focused',
      'Elvang': 'luxury, natural materials',
      'GEFU': 'functional, high-quality',
      'Rader': 'contemporary, decorative',
      'Relaxound': 'minimalist, wellness-focused',
      'Remember': 'playful, giftable'
    };

    return brandStyles[brand] || 'contemporary';
  }

  /**
   * Get brand target audience
   */
  private getBrandTargetAudience(brand: string): string {
    const brandTargets: { [key: string]: string } = {
      'MyFlame': 'home fragrance enthusiasts',
      'Elvang': 'luxury home market',
      'GEFU': 'cooking enthusiasts',
      'Rader': 'home decorators',
      'Relaxound': 'wellness enthusiasts',
      'Remember': 'gift buyers'
    };

    return brandTargets[brand] || 'general consumers';
  }

  /**
   * Generate SEO keywords
   */
  private generateSEOKeywords(name: string, brand: string, category: any): string[] {
    const keywords = [];
    
    // Add brand
    keywords.push(brand.toLowerCase());
    
    // Add name words
    const nameWords = name.toLowerCase().split(' ').filter(word => word.length > 2);
    keywords.push(...nameWords);
    
    // Add category words
    const categoryWords = [
      ...category.level1.toLowerCase().split(' '),
      ...category.level2.toLowerCase().split(' '),
      ...category.level3.toLowerCase().split(' ')
    ].filter(word => word.length > 2 && word !== '&' && word !== 'and');
    keywords.push(...categoryWords);
    
    // Remove duplicates and return top 10
    return Array.from(new Set(keywords)).slice(0, 10);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(product: any, brand: string): number {
    let score = 0.3; // Base score
    
    if (product.name && product.name.length > 10) score += 0.2;
    if (product.description && product.description.length > 20) score += 0.2;
    if (brand && brand !== 'Unknown') score += 0.2;
    if (product.category) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Generate enhanced description
   */
  private generateEnhancedDescription(product: any, brand: string, category: any, colorInfo: any): string {
    const parts = [];
    
    parts.push(`This ${this.getBrandStyle(brand)} ${product.name} from ${brand}`);
    parts.push(`is perfect for ${category.useCases[0] || 'everyday use'}`);
    
    if (colorInfo.standardized !== 'Unspecified') {
      parts.push(`featuring a ${colorInfo.standardized.toLowerCase()} finish`);
    }
    
    parts.push(`Ideal for ${this.getBrandTargetAudience(brand)}`);
    
    const description = parts.join('. ') + '.';
    
    if (product.description) {
      return description + ' ' + product.description;
    }
    
    return description;
  }

  /**
   * Save enriched products to Supabase
   */
  async saveEnrichedProducts(
    companyId: string,
    enrichedProducts: ProductEnrichmentData[]
  ): Promise<void> {
    try {
      // Update items in batches
      const batchSize = 10;
      
      for (let i = 0; i < enrichedProducts.length; i += batchSize) {
        const batch = enrichedProducts.slice(i, i + batchSize);
        
        for (const product of batch) {
          console.log(`💾 Saving enriched product: ${product.sku}`);
          console.log(`📝 Enhanced description: "${product.enhanced_description}"`);
          console.log(`🏷️ Category: "${product.category_level_3}"`);
          console.log(`🎨 Color: "${product.standardized_color}"`);
          
          // For now, update basic fields - enrichment_data will be added once column exists
          const updateData: any = {
            description: product.enhanced_description,
            category: product.category_level_3,
            colour: product.standardized_color
          };
          
          // Add material field only if it exists in the items table
          if (product.material) {
            updateData.material = product.material;
          }
          
          console.log(`📦 Update data:`, updateData);
          
          // Update through brand relationship since items doesn't have company_id
          const { data: item, error: findError } = await supabase
            .from('items')
            .select('id, sku, description, category, colour, brands!inner(company_id)')
            .eq('sku', product.sku)
            .eq('brands.company_id', companyId)
            .single();
            
          if (findError) {
            console.error(`❌ Could not find item ${product.sku}:`, findError);
            continue;
          }
          
          console.log(`📊 Before update - SKU: ${item.sku}, Description: "${item.description}", Category: "${item.category}", Colour: "${item.colour}"`);
          
          console.log(`🔑 Attempting update for item ID: ${item.id}`);
          
          const { data: updateResult, error: updateError, count } = await supabase
            .from('items')
            .update(updateData)
            .eq('id', item.id)
            .select('id, description, category, colour');
            
          console.log(`📊 Update result - Count: ${count}, Data length: ${updateResult?.length}, Error: ${updateError}`);
            
          if (updateError) {
            console.error(`❌ Failed to update item ${product.sku}:`, updateError);
          } else if (!updateResult || updateResult.length === 0) {
            console.error(`❌ RLS POLICY BLOCKING UPDATE for item ${product.sku} - 0 rows affected despite 204 response`);
            console.error(`🔒 Check RLS policies on items table for UPDATE operations`);
          } else {
            console.log(`✅ Successfully updated item ${product.sku}`);
            
            // Verify the update worked
            const { data: updatedItem } = await supabase
              .from('items')
              .select('description, category, colour')
              .eq('id', item.id)
              .single();
              
            console.log(`🔍 After update - Description: "${updatedItem?.description}", Category: "${updatedItem?.category}", Colour: "${updatedItem?.colour}"`);
          }
        }
      }
    } catch (error) {
      console.error('Error saving enriched products:', error);
      throw error;
    }
  }

  /**
   * Emit progress events
   */
  private emitProgressEvent(progress: EnrichmentProgress) {
    // Dispatch custom event for progress tracking
    window.dispatchEvent(new CustomEvent('ai-enrichment-progress', { detail: progress }));
  }

  /**
   * Get count of products that would be processed with given options
   */
  async getProcessableProductCount(companyId: string, brandFilter?: string): Promise<number> {
    try {
      let query = supabase
        .from('items')
        .select('sku, brands!inner(id)', { count: 'exact', head: true })
        .eq('brands.company_id', companyId)
        .eq('status', 'active')
        .not('name', 'is', null);

      if (brandFilter) {
        query = query.eq('brand_id', brandFilter);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error getting product count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error getting processable product count:', error);
      return 0;
    }
  }

  /**
   * Get available brands for the company
   */
  async getAvailableBrands(companyId: string): Promise<{ id: string; brand_name: string }[]> {
    try {
      console.log('🔍 AIEnrichmentService: Fetching brands for companyId:', companyId);
      
      // First, let's see all brands in the database (for debugging)
      const { data: allBrands, error: allError } = await supabase
        .from('brands')
        .select('id, brand_name, company_id, is_active')
        .limit(10);
      
      console.log('🗂️ All brands in database (first 10):', allBrands);
      
      // Now get brands for this company
      const { data, error } = await supabase
        .from('brands')
        .select('id, brand_name')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('brand_name');

      console.log('📊 AIEnrichmentService: Brands query result:', { data, error });

      if (error) {
        console.error('❌ Error fetching brands:', error);
        return [];
      }

      console.log(`✅ AIEnrichmentService: Found ${data?.length || 0} brands for company ${companyId}`);
      return data || [];
    } catch (error) {
      console.error('❌ Error getting available brands:', error);
      return [];
    }
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(companyId: string): Promise<{
    total_products: number;
    enriched_products: number;
    average_confidence: number;
    last_enriched: string | null;
  }> {
    try {
      console.log('📊 AIEnrichmentService: Getting enrichment stats for companyId:', companyId);
      
      // For now, let's get basic stats without enrichment_data column
      // Once the column is added to the database, this can be enhanced
      const { data: allProducts, error: allError } = await supabase
        .from('items')
        .select('sku, brands!inner(company_id)')
        .eq('brands.company_id', companyId)
        .eq('status', 'active');

      console.log('📊 Stats query result:', { data: allProducts, error: allError });

      if (allError) throw allError;

      const total = allProducts?.length || 0;
      
      // For now, return basic stats - enrichment tracking will work once column is added
      return {
        total_products: total,
        enriched_products: 0, // Will be accurate once enrichment_data column exists
        average_confidence: 0,
        last_enriched: null
      };
    } catch (error) {
      console.error('Error getting enrichment stats:', error);
      throw error;
    }
  }
}

export const aiEnrichmentService = new AIEnrichmentService();