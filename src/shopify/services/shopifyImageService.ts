import { shopifyApiService } from './shopifyApiService';
import { imageProcessingService } from '../../services/imageProcessingService';
import { aiEnrichmentService } from '../../services/aiEnrichmentService';
import { SHOPIFY_CONFIG } from '../config';
import { ShopifyProduct, ShopifyImage } from '../types';

interface ImageUploadResult {
  productId: string;
  sku: string;
  images: ShopifyImage[];
  errors?: string[];
}

interface ImageMatchResult {
  sku: string;
  matchedImages: Array<{
    imageUrl: string;
    confidence: number;
    matchType: 'exact' | 'fuzzy' | 'ai';
  }>;
}

interface BatchImageUploadResult {
  successful: number;
  failed: number;
  results: ImageUploadResult[];
}

class ShopifyImageService {
  // Upload images for a single product
  public async uploadProductImages(
    productId: string,
    imageUrls: string[]
  ): Promise<ImageUploadResult> {
    const result: ImageUploadResult = {
      productId,
      sku: '',
      images: [],
      errors: [],
    };

    try {
      // Get product details
      const { product } = await shopifyApiService.getProduct(productId);
      result.sku = product.variants[0]?.sku || '';

      // Upload images in batches
      const batchSize = SHOPIFY_CONFIG.IMAGE_PROCESSING.BATCH_SIZE;
      
      for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        const uploadPromises = batch.map(url => this.uploadSingleImage(productId, url));
        
        try {
          const batchResults = await Promise.all(uploadPromises);
          result.images.push(...batchResults.filter(img => img !== null) as ShopifyImage[]);
        } catch (error: any) {
          result.errors?.push(`Batch upload error: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors?.push(`Product fetch error: ${error.message}`);
    }

    return result;
  }

  // Upload single image
  private async uploadSingleImage(
    productId: string,
    imageUrl: string
  ): Promise<ShopifyImage | null> {
    try {
      const response = await shopifyApiService.makeRequest<{ image: ShopifyImage }>(
        `products/${productId}/images.json`,
        {
          method: 'POST',
          body: JSON.stringify({
            image: {
              src: imageUrl,
            },
          }),
        }
      );

      return response.image;
    } catch (error) {
      console.error(`Error uploading image for product ${productId}:`, error);
      return null;
    }
  }

  // Match images to products using AI
  public async matchImagesToProducts(
    images: Array<{ url: string; filename: string }>,
    products: Array<{ id: string; sku: string; title: string }>
  ): Promise<ImageMatchResult[]> {
    const results: ImageMatchResult[] = [];

    // Create SKU map for quick lookup
    const skuMap = new Map(products.map(p => [p.sku.toLowerCase(), p]));

    for (const image of images) {
      const matchResult: ImageMatchResult = {
        sku: '',
        matchedImages: [],
      };

      // Try exact SKU match from filename
      const filenameParts = image.filename.toLowerCase().split(/[-_.\s]/);
      let exactMatch = false;

      for (const part of filenameParts) {
        if (skuMap.has(part)) {
          matchResult.sku = skuMap.get(part)!.sku;
          matchResult.matchedImages.push({
            imageUrl: image.url,
            confidence: 1.0,
            matchType: 'exact',
          });
          exactMatch = true;
          break;
        }
      }

      // If no exact match, try fuzzy matching
      if (!exactMatch) {
        const fuzzyMatch = this.fuzzyMatchSKU(image.filename, products);
        if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
          matchResult.sku = fuzzyMatch.sku;
          matchResult.matchedImages.push({
            imageUrl: image.url,
            confidence: fuzzyMatch.confidence,
            matchType: 'fuzzy',
          });
        }
      }

      // If still no match, use AI to analyze image content
      if (!matchResult.sku && aiEnrichmentService) {
        try {
          const aiMatch = await this.aiMatchImage(image.url, products);
          if (aiMatch && aiMatch.confidence > 0.6) {
            matchResult.sku = aiMatch.sku;
            matchResult.matchedImages.push({
              imageUrl: image.url,
              confidence: aiMatch.confidence,
              matchType: 'ai',
            });
          }
        } catch (error) {
          console.error('AI matching error:', error);
        }
      }

      if (matchResult.sku) {
        results.push(matchResult);
      }
    }

    return results;
  }

  // Fuzzy match SKU
  private fuzzyMatchSKU(
    filename: string,
    products: Array<{ sku: string; title: string }>
  ): { sku: string; confidence: number } | null {
    let bestMatch: { sku: string; confidence: number } | null = null;
    const cleanFilename = filename.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const product of products) {
      const cleanSku = product.sku.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Calculate similarity
      const similarity = this.calculateSimilarity(cleanFilename, cleanSku);
      
      if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.confidence)) {
        bestMatch = {
          sku: product.sku,
          confidence: similarity,
        };
      }
    }

    return bestMatch;
  }

  // Calculate string similarity
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Levenshtein distance algorithm
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // AI-based image matching
  private async aiMatchImage(
    imageUrl: string,
    products: Array<{ id: string; sku: string; title: string }>
  ): Promise<{ sku: string; confidence: number } | null> {
    try {
      // Use AI to analyze image and extract product information
      const imageAnalysis = await aiEnrichmentService.analyzeProductImage(imageUrl);
      
      if (!imageAnalysis || !imageAnalysis.productInfo) {
        return null;
      }

      // Match extracted info with products
      let bestMatch: { sku: string; confidence: number } | null = null;
      
      for (const product of products) {
        let score = 0;
        let factors = 0;

        // Match by detected text/SKU
        if (imageAnalysis.detectedText) {
          const textSimilarity = this.calculateSimilarity(
            imageAnalysis.detectedText.toLowerCase(),
            product.sku.toLowerCase()
          );
          if (textSimilarity > 0.5) {
            score += textSimilarity;
            factors++;
          }
        }

        // Match by product type/category
        if (imageAnalysis.productInfo.category) {
          const titleMatch = product.title.toLowerCase().includes(
            imageAnalysis.productInfo.category.toLowerCase()
          );
          if (titleMatch) {
            score += 0.7;
            factors++;
          }
        }

        // Match by color
        if (imageAnalysis.productInfo.color) {
          const colorMatch = product.title.toLowerCase().includes(
            imageAnalysis.productInfo.color.toLowerCase()
          );
          if (colorMatch) {
            score += 0.3;
            factors++;
          }
        }

        if (factors > 0) {
          const confidence = score / factors;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = {
              sku: product.sku,
              confidence,
            };
          }
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error in AI image matching:', error);
      return null;
    }
  }

  // Batch upload images with automatic matching
  public async batchUploadWithMatching(
    images: Array<{ url: string; filename: string }>,
    options: {
      autoMatch?: boolean;
      requireConfirmation?: boolean;
    } = {}
  ): Promise<BatchImageUploadResult> {
    const result: BatchImageUploadResult = {
      successful: 0,
      failed: 0,
      results: [],
    };

    try {
      // Get all products for matching
      const { products } = await shopifyApiService.getProducts({ limit: 250 });
      const productMap = products.map(p => ({
        id: p.id,
        sku: p.variants[0]?.sku || '',
        title: p.title,
      }));

      // Match images to products
      const matches = await this.matchImagesToProducts(images, productMap);

      // Upload matched images
      for (const match of matches) {
        if (!match.sku) continue;

        const product = productMap.find(p => p.sku === match.sku);
        if (!product) continue;

        try {
          const uploadResult = await this.uploadProductImages(
            product.id,
            match.matchedImages.map(m => m.imageUrl)
          );

          result.results.push(uploadResult);
          result.successful += uploadResult.images.length;
        } catch (error) {
          result.failed++;
        }
      }
    } catch (error) {
      console.error('Batch upload error:', error);
    }

    return result;
  }

  // Optimize images before upload
  public async optimizeAndUploadImages(
    productId: string,
    images: File[]
  ): Promise<ImageUploadResult> {
    const optimizedUrls: string[] = [];

    try {
      // Process and optimize images
      for (const image of images) {
        const optimized = await imageProcessingService.optimizeImage(image, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.9,
          format: 'webp',
        });

        // Upload to CDN and get URL
        const url = await imageProcessingService.uploadToCDN(optimized);
        optimizedUrls.push(url);
      }

      // Upload to Shopify
      return await this.uploadProductImages(productId, optimizedUrls);
    } catch (error) {
      console.error('Error optimizing images:', error);
      throw error;
    }
  }

  // Generate alt text for images using AI
  public async generateAltText(productId: string): Promise<void> {
    try {
      const { product } = await shopifyApiService.getProduct(productId);
      
      for (const image of product.images) {
        if (!image.alt) {
          // Generate alt text using AI
          const altText = await aiEnrichmentService.generateImageAltText(
            image.src,
            {
              productName: product.title,
              productType: product.product_type,
              vendor: product.vendor,
            }
          );

          // Update image with alt text
          await shopifyApiService.makeRequest(
            `products/${productId}/images/${image.id}.json`,
            {
              method: 'PUT',
              body: JSON.stringify({
                image: {
                  alt: altText,
                },
              }),
            }
          );
        }
      }
    } catch (error) {
      console.error('Error generating alt text:', error);
      throw error;
    }
  }

  // Reorder product images
  public async reorderImages(
    productId: string,
    imageIds: string[]
  ): Promise<void> {
    try {
      for (let i = 0; i < imageIds.length; i++) {
        await shopifyApiService.makeRequest(
          `products/${productId}/images/${imageIds[i]}.json`,
          {
            method: 'PUT',
            body: JSON.stringify({
              image: {
                position: i + 1,
              },
            }),
          }
        );
      }
    } catch (error) {
      console.error('Error reordering images:', error);
      throw error;
    }
  }

  // Remove background from images
  public async removeBackgrounds(
    productId: string,
    imageIds?: string[]
  ): Promise<ImageUploadResult> {
    try {
      const { product } = await shopifyApiService.getProduct(productId);
      const imagesToProcess = imageIds 
        ? product.images.filter(img => imageIds.includes(img.id))
        : product.images;

      const processedUrls: string[] = [];

      for (const image of imagesToProcess) {
        try {
          // Use AI service to remove background
          const processedUrl = await aiEnrichmentService.removeImageBackground(image.src);
          processedUrls.push(processedUrl);
        } catch (error) {
          console.error(`Error processing image ${image.id}:`, error);
        }
      }

      // Upload processed images
      return await this.uploadProductImages(productId, processedUrls);
    } catch (error) {
      console.error('Error removing backgrounds:', error);
      throw error;
    }
  }
}

export const shopifyImageService = new ShopifyImageService();