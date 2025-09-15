import { shopifyApiService } from './shopifyApiService';
import { shopifyAnalyticsService } from './shopifyAnalyticsService';
import { openaiService } from '../../services/openaiService';
import { aiEnrichmentService } from '../../services/aiEnrichmentService';
import { ShopifyProduct, ShopifyOrder, ShopifyCustomer } from '../types';

interface MarketingMaterial {
  id: string;
  type: 'email' | 'social' | 'ad' | 'product_description' | 'blog_post' | 'sms';
  title: string;
  content: string;
  images?: string[];
  targetAudience?: string;
  platform?: string;
  generatedAt: string;
  performance?: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    engagement?: number;
  };
}

interface CampaignTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  template: string;
  variables: string[];
  industryTags: string[];
  minDataRequired: {
    products?: number;
    customers?: number;
    orders?: number;
  };
}

interface SocialMediaPost {
  platform: 'instagram' | 'facebook' | 'twitter' | 'linkedin' | 'tiktok';
  content: string;
  hashtags: string[];
  imageUrl?: string;
  scheduledTime?: string;
  targetAudience?: string;
}

interface EmailCampaign {
  subject: string;
  previewText: string;
  htmlContent: string;
  textContent: string;
  targetSegment: string;
  personalization: {
    firstName: boolean;
    lastPurchase: boolean;
    recommendedProducts: boolean;
  };
}

interface AdCopy {
  platform: 'google' | 'facebook' | 'instagram' | 'twitter';
  headline: string;
  description: string;
  callToAction: string;
  keywords?: string[];
  targetAudience: string;
  budget?: number;
}

class ShopifyMarketingService {
  private templates: Map<string, CampaignTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates() {
    const defaultTemplates: CampaignTemplate[] = [
      {
        id: 'new-product-launch',
        name: 'New Product Launch',
        type: 'social',
        description: 'Announce new products to your audience',
        template: 'Introducing our latest {{productName}}! {{productDescription}} Shop now and get {{discount}}% off. #NewProduct #{{brandName}}',
        variables: ['productName', 'productDescription', 'discount', 'brandName'],
        industryTags: ['retail', 'fashion', 'home', 'beauty'],
        minDataRequired: { products: 1 },
      },
      {
        id: 'abandoned-cart-email',
        name: 'Abandoned Cart Recovery',
        type: 'email',
        description: 'Re-engage customers who left items in their cart',
        template: 'Hi {{firstName}}, You left some amazing items in your cart! Complete your purchase now and save {{discount}}%.',
        variables: ['firstName', 'cartItems', 'discount'],
        industryTags: ['ecommerce'],
        minDataRequired: { customers: 1 },
      },
      {
        id: 'seasonal-promotion',
        name: 'Seasonal Promotion',
        type: 'email',
        description: 'Promote seasonal sales and special offers',
        template: '{{seasonalGreeting}}! Enjoy {{discount}}% off on our {{category}} collection. Limited time offer!',
        variables: ['seasonalGreeting', 'discount', 'category'],
        industryTags: ['retail', 'fashion'],
        minDataRequired: { products: 5 },
      },
      {
        id: 'customer-testimonial',
        name: 'Customer Testimonial',
        type: 'social',
        description: 'Share customer reviews and testimonials',
        template: 'Our customers love us! "{{testimonial}}" - {{customerName}}. Experience the difference yourself. Shop now!',
        variables: ['testimonial', 'customerName'],
        industryTags: ['all'],
        minDataRequired: { orders: 10 },
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // Generate marketing materials based on Shopify data
  public async generateMarketingMaterials(
    type: MarketingMaterial['type'],
    options: {
      productIds?: string[];
      customerSegment?: string;
      campaign?: string;
      brand?: string;
      occasion?: string;
      tone?: 'professional' | 'casual' | 'playful' | 'urgent';
      platform?: string;
      maxLength?: number;
    } = {}
  ): Promise<MarketingMaterial[]> {
    try {
      // Get relevant data from Shopify
      const contextData = await this.gatherContextData(options);
      
      // Generate content based on type
      let materials: MarketingMaterial[] = [];
      
      switch (type) {
        case 'social':
          materials = await this.generateSocialMediaPosts(contextData, options);
          break;
        case 'email':
          materials = await this.generateEmailCampaigns(contextData, options);
          break;
        case 'ad':
          materials = await this.generateAdCopy(contextData, options);
          break;
        case 'product_description':
          materials = await this.generateProductDescriptions(contextData, options);
          break;
        case 'blog_post':
          materials = await this.generateBlogPosts(contextData, options);
          break;
        case 'sms':
          materials = await this.generateSMSCampaigns(contextData, options);
          break;
      }

      return materials;
    } catch (error) {
      console.error('Error generating marketing materials:', error);
      throw error;
    }
  }

  private async gatherContextData(options: any): Promise<any> {
    const contextData: any = {
      shop: {},
      products: [],
      customers: [],
      orders: [],
      analytics: {},
    };

    try {
      // Get shop info
      contextData.shop = await shopifyApiService.makeRequest('shop.json');

      // Get products if specified
      if (options.productIds && options.productIds.length > 0) {
        contextData.products = await Promise.all(
          options.productIds.map(id => 
            shopifyApiService.getProduct(id).then(r => r.product)
          )
        );
      } else {
        // Get top products
        const productsResponse = await shopifyApiService.getProducts({ limit: 10 });
        contextData.products = productsResponse.products;
      }

      // Get recent orders for trends
      const ordersResponse = await shopifyApiService.getOrders({ 
        limit: 50,
        status: 'any',
      });
      contextData.orders = ordersResponse.orders;

      // Get analytics for insights
      contextData.analytics = await shopifyAnalyticsService.getAnalyticsDashboard();

      return contextData;
    } catch (error) {
      console.error('Error gathering context data:', error);
      return contextData;
    }
  }

  private async generateSocialMediaPosts(
    contextData: any,
    options: any
  ): Promise<MarketingMaterial[]> {
    const posts: MarketingMaterial[] = [];
    
    try {
      for (const product of contextData.products.slice(0, 3)) {
        const prompt = `Create an engaging social media post for ${options.platform || 'Instagram'} to promote this product:

Product: ${product.title}
Description: ${product.body_html?.replace(/<[^>]*>/g, '').substring(0, 200) || 'No description'}
Vendor: ${product.vendor}
Price: $${product.variants[0]?.price || '0'}

Requirements:
- Tone: ${options.tone || 'professional'}
- Include relevant hashtags
- ${options.maxLength ? `Keep under ${options.maxLength} characters` : 'Optimal length for engagement'}
- Include a call-to-action
- Make it compelling and shareable

Brand voice should be consistent with a ${contextData.shop.shop?.name || 'modern retail'} brand.`;

        const response = await openaiService.generateText(prompt, {
          maxTokens: 300,
          temperature: 0.8,
        });

        if (response) {
          posts.push({
            id: `social_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'social',
            title: `Social Post - ${product.title}`,
            content: response,
            images: product.images.length > 0 ? [product.images[0].src] : undefined,
            targetAudience: options.customerSegment || 'General audience',
            platform: options.platform || 'Instagram',
            generatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error generating social media posts:', error);
    }

    return posts;
  }

  private async generateEmailCampaigns(
    contextData: any,
    options: any
  ): Promise<MarketingMaterial[]> {
    const campaigns: MarketingMaterial[] = [];

    try {
      // Determine campaign type based on analytics
      const topProducts = contextData.analytics.products?.topProducts?.slice(0, 5) || [];
      const salesTrend = contextData.analytics.sales?.totalSales?.trend || 'stable';

      let campaignType = 'general_promotion';
      if (salesTrend === 'down') {
        campaignType = 'win_back';
      } else if (topProducts.length > 0) {
        campaignType = 'best_sellers';
      }

      const prompt = `Create an email marketing campaign for an e-commerce store:

Store: ${contextData.shop.shop?.name || 'Our Store'}
Campaign Type: ${campaignType}
Customer Segment: ${options.customerSegment || 'All customers'}
Occasion: ${options.occasion || 'General promotion'}

Top Products:
${topProducts.map(p => `- ${p.title}: $${p.price || '0'}`).join('\n')}

Recent Performance:
- Sales trend: ${salesTrend}
- Top categories: ${contextData.products.map(p => p.product_type).slice(0, 3).join(', ')}

Create:
1. Subject line (compelling and not spammy)
2. Preview text
3. Email body (HTML structure with placeholders for personalization)
4. Call-to-action suggestions

Tone: ${options.tone || 'professional but friendly'}
Goal: Drive sales and engagement`;

      const response = await openaiService.generateText(prompt, {
        maxTokens: 800,
        temperature: 0.7,
      });

      if (response) {
        campaigns.push({
          id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'email',
          title: `Email Campaign - ${campaignType}`,
          content: response,
          targetAudience: options.customerSegment || 'All customers',
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error generating email campaigns:', error);
    }

    return campaigns;
  }

  private async generateAdCopy(
    contextData: any,
    options: any
  ): Promise<MarketingMaterial[]> {
    const ads: MarketingMaterial[] = [];

    try {
      const topProduct = contextData.products[0];
      if (!topProduct) return ads;

      const platforms = options.platform ? [options.platform] : ['google', 'facebook'];

      for (const platform of platforms) {
        const prompt = `Create compelling ad copy for ${platform} Ads:

Product: ${topProduct.title}
Description: ${topProduct.body_html?.replace(/<[^>]*>/g, '').substring(0, 150) || 'No description'}
Price: $${topProduct.variants[0]?.price || '0'}
Vendor: ${topProduct.vendor}

Store Context:
- Store name: ${contextData.shop.shop?.name || 'Our Store'}
- Recent sales trend: ${contextData.analytics.sales?.totalSales?.trend || 'stable'}

Requirements for ${platform}:
${platform === 'google' ? `
- Headlines (up to 30 characters each, provide 3 variations)
- Descriptions (up to 90 characters each, provide 2 variations)
- Keywords (relevant search terms)
` : `
- Primary text (engaging and emotional)
- Headline (clear value proposition)
- Description (supporting details)
`}

Tone: ${options.tone || 'persuasive'}
Target: People interested in ${topProduct.product_type || 'similar products'}
Goal: Drive clicks and conversions`;

        const response = await openaiService.generateText(prompt, {
          maxTokens: 500,
          temperature: 0.8,
        });

        if (response) {
          ads.push({
            id: `ad_${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'ad',
            title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Ad - ${topProduct.title}`,
            content: response,
            targetAudience: `${topProduct.product_type} shoppers`,
            platform: platform,
            generatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error generating ad copy:', error);
    }

    return ads;
  }

  private async generateProductDescriptions(
    contextData: any,
    options: any
  ): Promise<MarketingMaterial[]> {
    const descriptions: MarketingMaterial[] = [];

    try {
      for (const product of contextData.products.slice(0, 5)) {
        if (product.body_html && product.body_html.length > 50) {
          continue; // Skip products that already have good descriptions
        }

        const prompt = `Create an engaging product description for e-commerce:

Product: ${product.title}
Current Description: ${product.body_html?.replace(/<[^>]*>/g, '') || 'None'}
Vendor: ${product.vendor}
Product Type: ${product.product_type}
Price: $${product.variants[0]?.price || '0'}
Tags: ${product.tags}

Requirements:
- Compelling and benefit-focused
- SEO-friendly
- Include key features and benefits
- Address potential customer concerns
- Include emotional triggers
- Mention quality and value
- Call-to-action

Tone: ${options.tone || 'professional and persuasive'}
Length: 150-250 words`;

        const response = await openaiService.generateText(prompt, {
          maxTokens: 400,
          temperature: 0.7,
        });

        if (response) {
          descriptions.push({
            id: `desc_${product.id}_${Date.now()}`,
            type: 'product_description',
            title: `Enhanced Description - ${product.title}`,
            content: response,
            generatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error generating product descriptions:', error);
    }

    return descriptions;
  }

  private async generateBlogPosts(
    contextData: any,
    options: any
  ): Promise<MarketingMaterial[]> {
    const posts: MarketingMaterial[] = [];

    try {
      // Analyze products to suggest blog topics
      const categories = [...new Set(contextData.products.map(p => p.product_type))];
      const topCategory = categories[0];

      const prompt = `Create a blog post idea and outline for an e-commerce store:

Store: ${contextData.shop.shop?.name || 'Our Store'}
Main Product Category: ${topCategory}
Other Categories: ${categories.slice(1, 3).join(', ')}
Recent Sales Trend: ${contextData.analytics.sales?.totalSales?.trend || 'stable'}

Blog Post Requirements:
- SEO-friendly title
- Meta description
- Blog post outline with sections
- Key points for each section
- Target keywords
- Internal linking opportunities
- Call-to-action suggestions

Topic should be:
- Valuable to customers
- Related to our products
- Searchable/trending
- Educational or inspirational

Tone: ${options.tone || 'informative and engaging'}
Length: 1000-1500 words (provide outline)`;

      const response = await openaiService.generateText(prompt, {
        maxTokens: 600,
        temperature: 0.8,
      });

      if (response) {
        posts.push({
          id: `blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'blog_post',
          title: `Blog Post - ${topCategory} Guide`,
          content: response,
          targetAudience: `${topCategory} enthusiasts`,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error generating blog posts:', error);
    }

    return posts;
  }

  private async generateSMSCampaigns(
    contextData: any,
    options: any
  ): Promise<MarketingMaterial[]> {
    const sms: MarketingMaterial[] = [];

    try {
      const topProduct = contextData.products[0];
      if (!topProduct) return sms;

      const prompt = `Create SMS marketing messages for an e-commerce store:

Store: ${contextData.shop.shop?.name || 'Our Store'}
Featured Product: ${topProduct.title}
Price: $${topProduct.variants[0]?.price || '0'}
Occasion: ${options.occasion || 'General promotion'}

Create 3 different SMS messages:
1. Promotional/Sale announcement
2. New product alert  
3. Limited time offer

Requirements:
- Each message under 160 characters
- Include clear call-to-action
- Create urgency when appropriate
- Include opt-out instruction
- Professional but conversational tone
- Include store name

Target: Existing customers who opted in to SMS`;

      const response = await openaiService.generateText(prompt, {
        maxTokens: 300,
        temperature: 0.8,
      });

      if (response) {
        sms.push({
          id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'sms',
          title: `SMS Campaign - ${topProduct.title}`,
          content: response,
          targetAudience: 'SMS subscribers',
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error generating SMS campaigns:', error);
    }

    return sms;
  }

  // Generate seasonal content
  public async generateSeasonalContent(
    season: 'spring' | 'summer' | 'fall' | 'winter' | 'holiday',
    types: MarketingMaterial['type'][]
  ): Promise<MarketingMaterial[]> {
    const seasonalOptions = {
      occasion: season,
      tone: season === 'holiday' ? 'festive' : 'seasonal',
    };

    const allMaterials: MarketingMaterial[] = [];

    for (const type of types) {
      const materials = await this.generateMarketingMaterials(type, seasonalOptions);
      allMaterials.push(...materials);
    }

    return allMaterials;
  }

  // A/B test content variations
  public async generateContentVariations(
    materialId: string,
    variationCount: number = 3
  ): Promise<MarketingMaterial[]> {
    // This would generate variations of existing content
    // Implementation would depend on storing original materials
    return [];
  }

  // Generate content calendar
  public async generateContentCalendar(
    weeks: number = 4
  ): Promise<Array<{
    date: string;
    content: MarketingMaterial[];
    theme: string;
  }>> {
    const calendar: Array<{
      date: string;
      content: MarketingMaterial[];
      theme: string;
    }> = [];

    const themes = [
      'Product Spotlight',
      'Customer Stories',
      'Behind the Scenes',
      'Educational Content',
      'Seasonal Promotion',
    ];

    for (let week = 0; week < weeks; week++) {
      const date = new Date();
      date.setDate(date.getDate() + (week * 7));
      
      const theme = themes[week % themes.length];
      const content = await this.generateMarketingMaterials('social', {
        campaign: theme.toLowerCase().replace(' ', '_'),
        tone: 'casual',
      });

      calendar.push({
        date: date.toISOString().split('T')[0],
        content,
        theme,
      });
    }

    return calendar;
  }

  // Analytics for marketing materials
  public async trackMaterialPerformance(
    materialId: string,
    metrics: {
      impressions?: number;
      clicks?: number;
      conversions?: number;
      engagement?: number;
    }
  ): Promise<void> {
    // This would integrate with marketing platforms to track performance
    // Implementation would store performance data in database
  }

  // Get content recommendations
  public async getContentRecommendations(): Promise<Array<{
    type: MarketingMaterial['type'];
    priority: 'high' | 'medium' | 'low';
    reason: string;
    suggestedTiming: string;
  }>> {
    const recommendations = [];

    try {
      const analytics = await shopifyAnalyticsService.getAnalyticsDashboard();

      // Analyze trends and suggest content
      if (analytics.sales.totalSales.trend === 'down') {
        recommendations.push({
          type: 'email' as const,
          priority: 'high' as const,
          reason: 'Sales are declining - re-engage customers with promotional email',
          suggestedTiming: 'Within 24 hours',
        });
      }

      if (analytics.products.inventoryAlerts.length > 0) {
        recommendations.push({
          type: 'social' as const,
          priority: 'medium' as const,
          reason: 'Low inventory items could benefit from urgency marketing',
          suggestedTiming: 'This week',
        });
      }

      if (analytics.customers.newCustomers.changePercent > 20) {
        recommendations.push({
          type: 'email' as const,
          priority: 'medium' as const,
          reason: 'High new customer growth - create welcome series',
          suggestedTiming: 'Ongoing',
        });
      }

    } catch (error) {
      console.error('Error generating content recommendations:', error);
    }

    return recommendations;
  }
}

export const shopifyMarketingService = new ShopifyMarketingService();