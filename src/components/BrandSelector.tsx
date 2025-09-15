// src/components/BrandSelector.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Lottie from 'lottie-react';
import loaderAnimation from '../loader.json';
import { supabase } from '../services/supabaseService';
import './BrandSelector.css';
import { ProgressBar } from './ProgressBar';

const LOADER_SRC = 'https://lottie.host/83bc32e5-8bd1-468d-8dc6-8aae7c529ade/eEUoZnLTlp.lottie';

interface Brand {
  id: string;
  brand_name: string;
  brand_normalized: string;
  logo_url?: string;
  company_id: string;
  is_active: boolean;
  productCount?: number;
  lastOrdered?: string;
}

interface Customer {
  id: string;
  display_name: string;
  trading_name: string;
  email?: string;
  phone?: string;
  billing_address_1?: string;
  billing_address_2?: string;
  billing_city_town?: string;
  billing_county?: string;
  billing_postcode?: string;
  linked_sales_user?: string;
  linked_company: string;
  is_active: boolean;
  [key: string]: any;
}

const PROGRESS_STEPS = [
  { id: 1, label: 'Select Brand', active: true },
  { id: 2, label: 'Browse Items', active: false },
  { id: 3, label: 'Review Order', active: false },
  { id: 4, label: 'Place Order', active: false },
  { id: 5, label: 'Order Confirmed', active: false },
];

// Removed Clearbit logo function to prevent unnecessary requests

export default function BrandSelector() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  useEffect(() => {
    async function initCustomer() {
      let customer: Customer | null = null;

      if (location.state?.selectedCustomer) {
        customer = location.state.selectedCustomer;
        localStorage.setItem('SELECTED_CUSTOMER', JSON.stringify(customer));
      } else {
        const stored = localStorage.getItem('SELECTED_CUSTOMER');
        if (stored) {
          try {
            customer = JSON.parse(stored);
          } catch {
            console.warn('Failed to parse stored customer');
          }
        }
      }

      if (customer) {
        setSelectedCustomer(customer);

        if (customerId) {
          try {
            const { data: customerData, error } = await supabase
              .from('customers')
              .select('*')
              .eq('id', customerId)
              .eq('is_active', true)
              .single();

            if (error) {
              console.error('Error fetching customer details:', error);
            } else if (customerData) {
              setCustomerDetails(customerData);
            }
          } catch (error) {
            console.error('Error fetching customer details:', error);
          }
        }
      }

      setLoading(false);
    }

    initCustomer();
  }, [location.state, customerId]);

  // Load brands from Supabase
  useEffect(() => {
    const loadBrands = async () => {
      try {
        // For now, get all active brands. In the future, you might want to filter by company
        const { data: brandsData, error } = await supabase
          .from('brands')
          .select('*')
          .eq('is_active', true)
          .order('brand_name');

        if (error) {
          console.error('Error fetching brands:', error);
          return;
        }

        console.log('Fetched brands from Supabase:', brandsData);

        // Add basic stats without heavy queries for now
        const brandsWithStats = (brandsData || []).map((brand) => ({
          ...brand,
          productCount: 0, // Will load on demand if needed
          lastOrdered: 'Available'
        }));

        console.log('Brands with stats:', brandsWithStats);
        setBrands(brandsWithStats);
      } catch (error) {
        console.error('Error loading brands:', error);
      }
    };

    loadBrands();
  }, []);
  
  const handleStartOrder = (brand: Brand) => {
    console.log('handleStartOrder called with brand:', brand);
    console.log('selectedCustomer:', selectedCustomer);
    console.log('customerId:', customerId);
    
    if (!selectedCustomer) {
      alert('No customer selected. Please go back and select a customer.');
      return;
    }

    if (!brand.brand_normalized) {
      alert('Brand normalization issue. Using brand name instead.');
      // Fallback to normalized brand name
      const normalizedName = brand.brand_name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/products/${customerId}/${normalizedName}`, {
        state: { 
          selectedCustomer,
          fromCustomerList: true
        }
      });
      return;
    }

    navigate(`/products/${customerId}/${brand.brand_normalized}`, {
      state: { 
        selectedCustomer,
        fromCustomerList: true
      }
    });
  };

  const handleViewCatalogue = (brand: Brand) => {
    navigate(`/catalogue/${brand.brand_normalized}`, {
      state: { selectedCustomer }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent, brand: Brand) => {
    if (e.key === 'Enter') {
      handleStartOrder(brand);
    }
  };

  if (loading) {
    return (
      <div className="loader-container">
        <Lottie
          animationData={loaderAnimation}
          loop
          autoplay
          className="loader-large"
        />
      </div>
    );
  }

  const customerData = customerDetails || selectedCustomer;
  const customerName = customerData?.display_name || customerData?.trading_name;
  const customerEmail = customerData?.email;

  return (
    <div className="brand-selector-page-list">
      {/* Header */}
      <header className="list-header">
        <div className="header-top">
          <button 
            onClick={() => navigate('/customers')}
            className="back-btn"
            aria-label="Back"
          >
            ← Back
          </button>
          
          <div className="header-center">
            <h1>Select Brand</h1>
          </div>

          <div className="header-spacer"></div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="progress-bar-container">
        <ProgressBar currentStep={1} theme="dark" />
      </div>

      {/* Customer Information Card */}
      <div className="customer-info-section">
        <div className="customer-info-card">
          <div className="customer-card-header">
            <h2>Customer Information</h2>
          </div>
          <div className="customer-card-content">
            <div className="company-logo-wrapper">
              <div className="company-logo-placeholder">
                {customerName?.charAt(0).toUpperCase() || 'C'}
              </div>
            </div>
            <div className="customer-details">
              <div className="customer-field">
                <span className="field-label">Name</span>
                <span className="field-value">{customerName || 'N/A'}</span>
              </div>
              <div className="customer-field">
                <span className="field-label">Email</span>
                <span className="field-value">{customerEmail || 'N/A'}</span>
              </div>
              <div className="customer-field">
                <span className="field-label">Phone</span>
                <span className="field-value">{customerData?.phone || 'N/A'}</span>
              </div>
              {customerData?.billing_address_1 && (
                <div className="customer-field address-field">
                  <span className="field-label">Billing Address</span>
                  <div className="field-value address-value">
                    <span>{customerData.billing_address_1}</span>
                    {customerData.billing_address_2 && <span>{customerData.billing_address_2}</span>}
                    <span>{customerData.billing_city_town}</span>
                    {customerData.billing_county && <span>{customerData.billing_county}</span>}
                    <span>{customerData.billing_postcode}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Brand List */}
      <div className="brands-list">
        {brands.map((brand) => (
          <div 
            key={brand.id}
            className={`brand-row ${expandedBrand === brand.id ? 'expanded' : ''}`}
            onClick={() => setExpandedBrand(expandedBrand === brand.id ? null : brand.id)}
            onKeyPress={(e) => handleKeyPress(e, brand)}
            tabIndex={0}
            role="button"
            aria-expanded={expandedBrand === brand.id}
          >
            <div className="brand-row-main">
              <div className="brand-row-left">
                {brand.logo_url ? (
                  <img 
                    src={brand.logo_url} 
                    alt={brand.brand_name}
                    className="brand-thumb"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`brand-logo-placeholder ${brand.logo_url ? 'hidden' : ''}`}>
                  {brand.brand_name.charAt(0).toUpperCase()}
                </div>
                <div className="brand-info">
                  <h3 className="brand-name">{brand.brand_name}</h3>
                  <p className="brand-meta">
                    Products available • Click to browse
                  </p>
                </div>
              </div>

              <div className="brand-row-actions">
                <button
                  className="quick-action-btn primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartOrder(brand);
                  }}
                  aria-label="Start order"
                >
                  <span className="btn-text">Order</span>
                  <span className="btn-icon">→</span>
                </button>
                <button
                  className="quick-action-btn secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewCatalogue(brand);
                  }}
                  aria-label="View catalogue"
                >
                  <span className="btn-text">Catalogue</span>
                  <span className="btn-icon">↗</span>
                </button>
                <button
                  className="expand-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedBrand(expandedBrand === brand.id ? null : brand.id);
                  }}
                  aria-label={expandedBrand === brand.id ? 'Collapse' : 'Expand'}
                >
                  <svg 
                    className={`chevron ${expandedBrand === brand.id ? 'rotated' : ''}`} 
                    width="20" 
                    height="20" 
                    viewBox="0 0 20 20" 
                    fill="none"
                  >
                    <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {expandedBrand === brand.id && (
              <div className="brand-row-expanded">
                <div className="expanded-content">
                  <div className="expanded-image">
                    <div className="brand-preview-placeholder">
                      {brand.brand_name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="expanded-details">
                    <p className="brand-description">
                      Explore our full range of {brand.brand_name} products with quality craftsmanship and innovative design.
                    </p>
                    <div className="expanded-actions">
                      <button
                        className="expanded-btn primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartOrder(brand);
                        }}
                      >
                        Start New Order
                      </button>
                      <button
                        className="expanded-btn secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewCatalogue(brand);
                        }}
                      >
                        Browse Full Catalogue
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}