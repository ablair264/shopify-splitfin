# Shopify App Setup Guide

This document outlines how to set up and configure the Shopify integration for your Splitfin application.

## Overview

The Shopify integration provides:
- **AI-Enhanced Product Upload**: Upload and optimize product data with AI descriptions, categories, and SEO
- **Intelligent Image Management**: Automatic image matching and product association
- **Advanced Analytics**: Comprehensive store analytics with AI insights
- **Streamlined Order & Customer Management**: Better designed interfaces for managing orders and customers
- **AI-Generated Marketing Materials**: Create social media posts, emails, ads, and more

## Prerequisites

1. **Shopify Partner Account**: You need a Shopify Partner account to create apps
2. **Node.js & React**: The app is built on React with TypeScript
3. **API Keys**: OpenAI API key for AI features
4. **Hosting**: Secure HTTPS hosting for webhooks and OAuth

## Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Shopify App Configuration
REACT_APP_SHOPIFY_API_KEY=your_shopify_api_key
REACT_APP_SHOPIFY_API_SECRET_KEY=your_shopify_api_secret_key
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
REACT_APP_HOST=https://your-netlify-site.netlify.app
REACT_APP_SHOPIFY_REDIRECT_URI=https://your-netlify-site.netlify.app/auth/callback

# OpenAI Configuration (for AI features)
REACT_APP_OPENAI_API_KEY=your_openai_api_key
REACT_APP_OPENAI_MODEL=gpt-4

# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# CDN Configuration (optional)
REACT_APP_CDN_URL=https://your-cdn-domain.com
```

## Shopify App Setup

### 1. Create a Shopify App

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Click "Apps" → "Create app"
3. Choose "Public app" (for app store distribution) or "Custom app" (for specific stores)
4. Fill in app details:
   - **App name**: Your app name
   - **App URL**: `https://your-domain.com`
   - **Allowed redirection URL(s)**: `https://your-domain.com/auth/callback`

### 2. Configure App Permissions

In your app settings, request the following scopes:

**Required Scopes:**
- `read_products, write_products` - Product management
- `read_inventory, write_inventory` - Inventory management
- `read_orders, write_orders` - Order management
- `read_customers, write_customers` - Customer management

**Optional Scopes:**
- `read_analytics` - Analytics data
- `read_reports` - Reporting
- `read_marketing_events, write_marketing_events` - Marketing campaigns
- `read_price_rules, write_price_rules` - Discount management

### 3. Database Setup

Create the following tables in your Supabase database:

```sql
-- Shopify shops table
CREATE TABLE shopify_shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  shop_name TEXT,
  email TEXT,
  shop_owner TEXT,
  timezone TEXT,
  currency TEXT,
  country_code TEXT,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uninstalled_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'uninstalled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-shop relationships
CREATE TABLE user_shops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain TEXT REFERENCES shopify_shops(shop_domain) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, shop_domain)
);

-- Export logs for tracking
CREATE TABLE export_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain TEXT REFERENCES shopify_shops(shop_domain),
  system TEXT NOT NULL,
  type TEXT NOT NULL,
  record_count INTEGER,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'ready',
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Webhook Endpoints

Set up the following webhook endpoints in your application:

```typescript
// In your Express.js or Next.js API routes
app.post('/webhooks/app-uninstalled', (req, res) => {
  // Handle app uninstallation
  const shop = req.get('X-Shopify-Shop-Domain');
  shopifyAuthService.uninstallShop(shop);
  res.status(200).send('OK');
});

app.post('/webhooks/products-create', (req, res) => {
  // Handle new product creation
  const product = req.body;
  // Sync with your internal systems
  res.status(200).send('OK');
});

app.post('/webhooks/orders-create', (req, res) => {
  // Handle new order creation
  const order = req.body;
  // Update analytics, trigger workflows
  res.status(200).send('OK');
});
```

## Usage

### 1. Basic Setup

```typescript
import { ShopifyDashboard } from './shopify';

function App() {
  return (
    <div className="App">
      <ShopifyDashboard />
    </div>
  );
}
```

### 2. Using Hooks

```typescript
import { useShopifyAuth, useShopifyProducts } from './shopify';

function ProductUpload() {
  const { isConnected } = useShopifyAuth();
  const { uploadProducts, isUploading, uploadProgress } = useShopifyProducts();

  const handleFileUpload = async (file: File) => {
    if (!isConnected) return;
    
    try {
      const result = await uploadProducts(file, {
        enableAI: true,
        enhanceDescriptions: true,
        generateSEO: true,
      });
      
      console.log('Upload result:', result);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      {isUploading && <ProgressBar progress={uploadProgress} />}
      <input type="file" onChange={(e) => handleFileUpload(e.target.files[0])} />
    </div>
  );
}
```

### 3. Direct Service Usage

```typescript
import { shopifyService } from './shopify';

// Initialize connection
await shopifyService.initialize('your-shop.myshopify.com');

// Upload products
const result = await shopifyService.uploadProducts(file, {
  enableAI: true,
  enhanceDescriptions: true,
});

// Get analytics
const dashboard = await shopifyService.getStoreDashboard();

// Generate marketing content
const materials = await shopifyService.generateMarketingContent('social', {
  platform: 'instagram',
  tone: 'casual',
});
```

## Features

### Product Management
- Import products from Excel/CSV files
- AI-enhanced product descriptions
- SEO optimization
- Category suggestions
- Bulk product updates

### Image Management
- Automatic image-to-product matching
- Bulk image uploads
- Image optimization
- Alt text generation

### Analytics
- Sales performance tracking
- Customer insights
- Product analytics
- AI-powered recommendations

### Marketing
- Social media post generation
- Email campaign creation
- Ad copy generation
- Blog post outlines
- SMS campaigns

## Development

### Running Locally

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see above)

3. Start development server:
```bash
npm start
```

4. Use ngrok for HTTPS tunnel (required for Shopify):
```bash
ngrok http 3000
```

5. Update your Shopify app URLs to use the ngrok URL

### Testing

```bash
# Run tests
npm test

# Test Shopify connection
npm run test:shopify

# Test AI features
npm run test:ai
```

## Deployment

### Production Checklist

- [ ] Set up production environment variables
- [ ] Configure HTTPS hosting
- [ ] Set up proper webhook endpoints
- [ ] Configure CORS for Shopify domains
- [ ] Set up monitoring and logging
- [ ] Test OAuth flow
- [ ] Verify webhook handling
- [ ] Test all features end-to-end

### Security Considerations

1. **Webhook Verification**: Always verify webhook HMAC signatures
2. **OAuth Security**: Validate OAuth state parameters
3. **Access Token Storage**: Encrypt access tokens in database
4. **Rate Limiting**: Implement proper rate limiting
5. **Error Handling**: Don't expose sensitive errors to users

## Troubleshooting

### Common Issues

1. **OAuth Redirect Mismatch**
   - Ensure redirect URI matches exactly in Shopify app settings
   - Check for trailing slashes and protocol (https vs http)

2. **Webhook Not Receiving**
   - Verify webhook URL is accessible via HTTPS
   - Check webhook signature verification
   - Ensure endpoint returns 200 status

3. **API Rate Limiting**
   - Implement exponential backoff
   - Use GraphQL for complex queries
   - Monitor API call limits

4. **Permission Errors**
   - Verify all required scopes are requested
   - Check if permissions were granted during installation

### Support

For issues and questions:
1. Check the [Shopify API documentation](https://shopify.dev/api)
2. Review the troubleshooting guide above
3. Check application logs for detailed error messages
4. Contact support with specific error details

## License

This Shopify integration is part of the Splitfin application and follows the same license terms.
