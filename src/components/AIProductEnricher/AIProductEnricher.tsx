import React, { useState, useEffect } from 'react';
import { 
  aiEnrichmentService, 
  ProductEnrichmentData, 
  EnrichmentProgress, 
  EnrichmentOptions 
} from '../../services/aiEnrichmentService';
import { supabase } from '../../services/supabaseService';
import './AIProductEnricher.css';

interface AIProductEnricherProps {
  companyId: string;
  onClose: () => void;
  onComplete?: (results: ProductEnrichmentData[]) => void;
}

const AIProductEnricher: React.FC<AIProductEnricherProps> = ({
  companyId,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<'configure' | 'processing' | 'results'>('configure');
  const [options, setOptions] = useState<EnrichmentOptions>({
    use_web_enhancement: true, // Default to true when AI provider is configured
    max_products: 50,
    confidence_threshold: 0.5
  });
  const [progress, setProgress] = useState<EnrichmentProgress>({
    total: 0,
    processed: 0,
    current_product: '',
    status: 'idle'
  });
  const [results, setResults] = useState<ProductEnrichmentData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [brands, setBrands] = useState<{ id: string; brand_name: string }[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [previewCount, setPreviewCount] = useState<number>(0);

  useEffect(() => {
    loadInitialData();
    
    // Listen for progress events
    const handleProgress = (event: CustomEvent<EnrichmentProgress>) => {
      setProgress(event.detail);
    };

    window.addEventListener('ai-enrichment-progress', handleProgress as EventListener);
    
    return () => {
      window.removeEventListener('ai-enrichment-progress', handleProgress as EventListener);
    };
  }, [companyId]);

  const loadInitialData = async () => {
    try {
      console.log('🚀 AIProductEnricher: Loading data for companyId:', companyId);
      
      // Load enrichment stats
      const enrichmentStats = await aiEnrichmentService.getEnrichmentStats(companyId);
      setStats(enrichmentStats);
      console.log('📈 AIProductEnricher: Stats loaded:', enrichmentStats);
      
      // Load available brands from service
      const brandsData = await aiEnrichmentService.getAvailableBrands(companyId);
      setBrands(brandsData);
      console.log('🏷️ AIProductEnricher: Brands loaded:', brandsData);
      
      // Load initial product count
      updatePreviewCount();
    } catch (err) {
      console.error('❌ AIProductEnricher: Error loading initial data:', err);
    }
  };

  const updatePreviewCount = async () => {
    try {
      const count = await aiEnrichmentService.getProcessableProductCount(
        companyId, 
        options.brand_filter
      );
      setPreviewCount(count);
    } catch (err) {
      console.error('Error updating preview count:', err);
      setPreviewCount(0);
    }
  };

  // Update preview count when options change
  useEffect(() => {
    if (companyId) {
      updatePreviewCount();
    }
  }, [companyId, options.brand_filter, options.max_products]);

  const handleStartEnrichment = async () => {
    setStep('processing');
    setError(null);
    setProgress({ total: 0, processed: 0, current_product: '', status: 'processing' });

    try {
      const enrichedProducts = await aiEnrichmentService.enrichProductsFromSupabase(
        companyId,
        options
      );

      // Save results to Supabase
      await aiEnrichmentService.saveEnrichedProducts(companyId, enrichedProducts);

      setResults(enrichedProducts);
      setStep('results');
      setProgress(prev => ({ ...prev, status: 'complete' }));
      
      if (onComplete) {
        onComplete(enrichedProducts);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setProgress(prev => ({ ...prev, status: 'error', error: errorMessage }));
    }
  };

  const renderConfigurationStep = () => (
    <div className="ai-enricher-step ai-enricher-configure">
      <div className="ai-enricher-header">
        <h2>🤖 AI Product Enrichment</h2>
        <p>Enhance your products with AI-generated descriptions, categories, and insights</p>
      </div>

      {stats && (
        <div className="ai-enricher-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.total_products}</span>
            <span className="stat-label">Total Products</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.enriched_products}</span>
            <span className="stat-label">Already Enriched</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{(stats.average_confidence * 100).toFixed(0)}%</span>
            <span className="stat-label">Avg Confidence</span>
          </div>
          <div className="stat-card preview-card">
            <span className="stat-value">{Math.min(previewCount, options.max_products || 50)}</span>
            <span className="stat-label">Will Process</span>
          </div>
        </div>
      )}

      <div className="ai-enricher-options">
        <div className="option-group">
          <label className="option-label">Max Products to Process</label>
          <input
            type="number"
            min="1"
            max="500"
            value={options.max_products || 50}
            onChange={(e) => setOptions(prev => ({
              ...prev,
              max_products: parseInt(e.target.value) || 50
            }))}
            className="option-input"
          />
          <span className="option-hint">Recommended: 50-100 for testing</span>
        </div>

        <div className="option-group">
          <label className="option-label">Brand Filter (Optional)</label>
          <select
            value={options.brand_filter || ''}
            onChange={(e) => setOptions(prev => ({
              ...prev,
              brand_filter: e.target.value || undefined
            }))}
            className="option-select"
          >
            <option value="">All Brands</option>
            {brands.length === 0 ? (
              <option value="" disabled>No brands found - check brand setup</option>
            ) : (
              brands.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.brand_name}</option>
              ))
            )}
          </select>
          {brands.length === 0 && (
            <span className="option-hint">
              No active brands found. Please ensure brands are set up in your inventory system.
            </span>
          )}
        </div>

        <div className="option-group">
          <label className="option-label">Confidence Threshold</label>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={options.confidence_threshold || 0.5}
            onChange={(e) => setOptions(prev => ({
              ...prev,
              confidence_threshold: parseFloat(e.target.value)
            }))}
            className="option-range"
          />
          <span className="option-value">{((options.confidence_threshold || 0.5) * 100).toFixed(0)}%</span>
        </div>

        <div className="option-group">
          <label className="option-checkbox">
            <input
              type="checkbox"
              checked={options.use_web_enhancement}
              onChange={(e) => setOptions(prev => ({
                ...prev,
                use_web_enhancement: e.target.checked
              }))}
            />
            <span className="checkbox-label">
              Enable Web Enhancement
              <small>Uses web data for richer descriptions (slower)</small>
            </span>
          </label>
        </div>
      </div>

      <div className="ai-enricher-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button 
          className="btn btn-primary"
          onClick={handleStartEnrichment}
          disabled={!stats || stats.total_products === 0}
        >
          🚀 Start AI Enrichment
        </button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="ai-enricher-step ai-enricher-processing">
      <div className="ai-enricher-header">
        <h2>🤖 AI Processing in Progress</h2>
        <p>Please wait while we enhance your products...</p>
      </div>

      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(progress.processed / (progress.total || 1)) * 100}%` }}
          />
        </div>
        
        <div className="progress-stats">
          <span>{progress.processed} / {progress.total} products processed</span>
          <span>{Math.round((progress.processed / (progress.total || 1)) * 100)}%</span>
        </div>

        {progress.current_product && (
          <div className="current-product">
            <span>Currently processing: <strong>{progress.current_product}</strong></span>
          </div>
        )}

        <div className="processing-features">
          <div className="feature-item">
            <span className="feature-icon">📝</span>
            <span>Generating enhanced descriptions</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span>Categorizing products</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🎨</span>
            <span>Standardizing colors</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔗</span>
            <span>Finding similar products</span>
          </div>
          {options.use_web_enhancement && (
            <div className="feature-item">
              <span className="feature-icon">🌐</span>
              <span>Enhancing with web data</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  const renderResultsStep = () => (
    <div className="ai-enricher-step ai-enricher-results">
      <div className="ai-enricher-header">
        <h2>✅ AI Enrichment Complete!</h2>
        <p>Successfully processed {results.length} products</p>
      </div>

      <div className="results-summary">
        <div className="summary-stat">
          <span className="stat-value">{results.length}</span>
          <span className="stat-label">Products Enhanced</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">
            {(results.reduce((sum, p) => sum + p.confidence_score, 0) / results.length * 100).toFixed(0)}%
          </span>
          <span className="stat-label">Avg Confidence</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">
            {new Set(results.map(p => p.category_level_1)).size}
          </span>
          <span className="stat-label">Categories</span>
        </div>
      </div>

      <div className="results-preview">
        <h3>Sample Enhanced Products:</h3>
        <div className="results-list">
          {results.slice(0, 3).map((product, index) => (
            <div key={product.sku} className="result-item">
              <div className="result-header">
                <span className="result-sku">{product.sku}</span>
                <span className="result-confidence">{(product.confidence_score * 100).toFixed(0)}%</span>
              </div>
              <div className="result-name">{product.original_name}</div>
              <div className="result-category">
                {product.category_level_1} › {product.category_level_2} › {product.category_level_3}
              </div>
              <div className="result-description">
                {product.enhanced_description.substring(0, 150)}...
              </div>
              <div className="result-meta">
                <span className="meta-item">🎨 {product.standardized_color}</span>
                <span className="meta-item">🧾 {product.material}</span>
                <span className="meta-item">🏷️ {product.seo_keywords.split(';').length} keywords</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ai-enricher-actions">
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
        <button 
          className="btn btn-primary"
          onClick={() => {
            // TODO: Navigate to inventory view to see results
            onClose();
          }}
        >
          View Updated Inventory
        </button>
      </div>
    </div>
  );

  return (
    <div className="ai-enricher-modal">
      <div className="ai-enricher-overlay" onClick={onClose} />
      <div className="ai-enricher-content">
        <button className="close-button" onClick={onClose}>×</button>
        
        {step === 'configure' && renderConfigurationStep()}
        {step === 'processing' && renderProcessingStep()}
        {step === 'results' && renderResultsStep()}
      </div>
    </div>
  );
};

export default AIProductEnricher;