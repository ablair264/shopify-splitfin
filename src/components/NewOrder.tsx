import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Plus, User, Building, Mail, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { withLoader } from '../hoc/withLoader';
import styles from './NewOrder.module.css';

interface Customer {
  id: string;
  display_name: string;
  trading_name: string;
  email?: string;
  phone?: string;
  logo_url?: string;
  billing_address_1?: string;
  billing_city_town?: string;
  billing_postcode?: string;
  linked_company: string;
  is_active: boolean;
  // From joined customer_users
  primary_contact_name?: string;
  primary_contact_email?: string;
}

interface CustomerWithUsers extends Customer {
  customer_users?: Array<{
    name: string;
    email: string;
    primary_contact: boolean;
  }>;
}

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface Brand {
  id: string;
  brand_name: string;
  brand_normalized: string;
  logo_url?: string;
  company_id: string;
  is_active: boolean;
}

function NewOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithUsers[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Check if coming from CustomerDetail page
  const fromCustomerDetail = location.state?.fromCustomerDetail;
  const preSelectedCustomer = location.state?.customer;

  useEffect(() => {
    if (preSelectedCustomer) {
      setSelectedCustomer(preSelectedCustomer);
    }
  }, [preSelectedCustomer]);

  // Load brands from Supabase
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const { data: brandsData, error } = await supabase
          .from('brands')
          .select('*')
          .eq('is_active', true)
          .not('brand_normalized', 'in', '(gefu,blomus)')
          .order('brand_name');

        if (error) {
          console.error('Error fetching brands:', error);
          return;
        }

        setBrands(brandsData || []);
      } catch (error) {
        console.error('Error loading brands:', error);
      }
    };

    loadBrands();
  }, []);

  // Search customers
  useEffect(() => {
    const searchCustomers = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        // Get current user's company
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('auth_user_id', user.id)
          .single();

        if (!userData?.company_id) return;

        // Search customers with simpler query structure
        const searchPattern = `%${debouncedSearch}%`;
        
        // First get customers that match the search
        const { data: customersData, error: customersError } = await supabase
          .from('customers')
          .select('*')
          .eq('linked_company', userData.company_id)
          .eq('is_active', true)
          .or(`display_name.ilike.${searchPattern},trading_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(10);

        if (customersError) {
          console.error('Error searching customers:', customersError);
          return;
        }

        // Then get customer users for found customers and also search by user fields
        const customerIds = customersData?.map(c => c.id) || [];
        
        const { data: allUsersData, error: usersError } = await supabase
          .from('customer_users')
          .select('*')
          .eq('is_active', true)
          .or(`linked_customer.in.(${customerIds.join(',')}),name.ilike.${searchPattern},email.ilike.${searchPattern}`)
          .limit(50);

        if (usersError) {
          console.error('Error fetching customer users:', usersError);
          // Still continue with just the customers data
          const results = customersData?.map(customer => ({
            ...customer,
            customer_users: []
          })) || [];
          setSearchResults(results);
          return;
        }

        // If we found users by search that aren't linked to customers we already have
        const additionalCustomerIds = allUsersData
          ?.filter(user => !customerIds.includes(user.linked_customer))
          ?.map(user => user.linked_customer) || [];

        let additionalCustomers: any[] = [];
        if (additionalCustomerIds.length > 0) {
          const { data: additionalCustomersData } = await supabase
            .from('customers')
            .select('*')
            .eq('linked_company', userData.company_id)
            .eq('is_active', true)
            .in('id', additionalCustomerIds);
          
          additionalCustomers = additionalCustomersData || [];
        }

        // Combine all customers
        const allCustomers = [...(customersData || []), ...additionalCustomers];
        
        // Map customers with their users
        const results: CustomerWithUsers[] = allCustomers.map(customer => ({
          ...customer,
          customer_users: allUsersData?.filter(user => user.linked_customer === customer.id) || []
        }));
        
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching customers:', error);
      } finally {
        setLoading(false);
      }
    };

    searchCustomers();
  }, [debouncedSearch]);

  // Fetch customer logo
  const fetchCustomerLogo = useCallback(async (customer: Customer) => {
    if (customer.logo_url) return customer.logo_url;

    // Try to get logo from company domain
    const primaryEmail = customer.email || customer.primary_contact_email;
    if (primaryEmail) {
      const domain = primaryEmail.split('@')[1];
      if (domain) {
        // Check if it's not a generic email provider
        const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        if (!genericDomains.includes(domain.toLowerCase())) {
          return `https://logo.clearbit.com/${domain}`;
        }
      }
    }
    
    return null;
  }, []);

  const handleSelectCustomer = (customer: CustomerWithUsers) => {
    // Extract primary contact info if available
    const primaryContact = customer.customer_users?.find(u => u.primary_contact);
    const enhancedCustomer: Customer = {
      ...customer,
      primary_contact_name: primaryContact?.name,
      primary_contact_email: primaryContact?.email || customer.email
    };
    
    setSelectedCustomer(enhancedCustomer);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBrandSelect = (brand: Brand) => {
    if (!selectedCustomer) return;
    
    navigate(`/products/${selectedCustomer.id}/${brand.brand_normalized}`, {
      state: {
        selectedCustomer: {
          id: selectedCustomer.id,
          display_name: selectedCustomer.display_name || selectedCustomer.trading_name,
          trading_name: selectedCustomer.trading_name,
          email: selectedCustomer.primary_contact_email || selectedCustomer.email,
          phone: selectedCustomer.phone,
          billing_address_1: selectedCustomer.billing_address_1,
          billing_city_town: selectedCustomer.billing_city_town,
          billing_postcode: selectedCustomer.billing_postcode,
          linked_company: selectedCustomer.linked_company,
          is_active: selectedCustomer.is_active,
          logo_url: selectedCustomer.logo_url
        },
        fromCustomerList: true
      }
    });
  };

  const handleCreateNewCustomer = () => {
    navigate('/customers/new');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index} className={styles.highlight}>{part}</mark> : part
    );
  };

  return (
    <div className={styles.newOrderContainer}>
      <div className={styles.header}>
        <h1>Start New Order</h1>
        <p className={styles.subtitle}>Search for an existing customer or create a new one</p>
      </div>

      <div className={styles.mainContent}>
        {!fromCustomerDetail && !selectedCustomer && (
          <div className={styles.searchSection}>
            <div className={styles.searchInputWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by company name, contact name, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                autoFocus
              />
              {loading && <div className={styles.spinner} />}
            </div>

            {searchResults.length > 0 && (
              <div className={styles.searchResults}>
                {searchResults.map((customer) => (
                  <div
                    key={customer.id}
                    className={styles.customerResult}
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className={styles.customerInfo}>
                      <div className={styles.customerMain}>
                        <h3>{highlightMatch(customer.display_name || customer.trading_name, searchQuery)}</h3>
                        <p className={styles.customerMeta}>
                          {customer.customer_users?.[0] && (
                            <>
                              <User size={14} />
                              {highlightMatch(customer.customer_users[0].name, searchQuery)}
                            </>
                          )}
                          {customer.primary_contact_email && (
                            <>
                              <Mail size={14} />
                              {highlightMatch(customer.primary_contact_email, searchQuery)}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={styles.selectIcon} />
                  </div>
                ))}
              </div>
            )}

            {debouncedSearch.length >= 2 && searchResults.length === 0 && !loading && (
              <div className={styles.noResults}>
                <p>No customers found matching "{debouncedSearch}"</p>
                <button
                  className={styles.createNewBtn}
                  onClick={handleCreateNewCustomer}
                >
                  <Plus size={16} />
                  Create New Customer
                </button>
              </div>
            )}
          </div>
        )}

        {(selectedCustomer || preSelectedCustomer) && (
          <>
            <div className={styles.selectedCustomerSection}>
              <h2>Selected Customer</h2>
              <div className={styles.selectedCustomerCard}>
                <CustomerLogo customer={selectedCustomer || preSelectedCustomer} fetchLogo={fetchCustomerLogo} />
                <div className={styles.selectedCustomerInfo}>
                  <h3>{selectedCustomer?.display_name || selectedCustomer?.trading_name}</h3>
                  {selectedCustomer?.primary_contact_name && (
                    <p><User size={14} /> {selectedCustomer.primary_contact_name}</p>
                  )}
                  {selectedCustomer?.primary_contact_email && (
                    <p><Mail size={14} /> {selectedCustomer.primary_contact_email}</p>
                  )}
                  {selectedCustomer?.billing_address_1 && (
                    <p className={styles.address}>
                      <Building size={14} />
                      {selectedCustomer.billing_address_1}, {selectedCustomer.billing_city_town} {selectedCustomer.billing_postcode}
                    </p>
                  )}
                </div>
                {!fromCustomerDetail && (
                  <button
                    className={styles.changeCustomerBtn}
                    onClick={() => {
                      setSelectedCustomer(null);
                      setSearchQuery('');
                    }}
                  >
                    Change
                  </button>
                )}
              </div>

              <div className={styles.brandSelectionSection}>
                <h3>Select Brand to Continue</h3>
                <div className={styles.brandLogos}>
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      className={styles.brandLogoButton}
                      onClick={() => handleBrandSelect(brand)}
                      title={brand.brand_name}
                    >
                      {brand.logo_url ? (
                        <img
                          src={brand.logo_url}
                          alt={brand.brand_name}
                          className={styles.brandLogo}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="${styles.brandLogoFallback}">${brand.brand_name.charAt(0)}</div>`;
                            }
                          }}
                        />
                      ) : (
                        <div className={styles.brandLogoFallback}>
                          {brand.brand_name.charAt(0)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default withLoader(NewOrder);

// Customer Logo Component
function CustomerLogo({ customer, fetchLogo }: { customer: Customer | null; fetchLogo: (customer: Customer) => Promise<string | null> }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (!customer) return;
    
    const loadLogo = async () => {
      const url = await fetchLogo(customer);
      if (url) {
        setLogoUrl(url);
      }
    };
    
    loadLogo();
  }, [customer, fetchLogo]);

  if (logoError || !logoUrl) {
    return (
      <div className={styles.logoPlaceholder}>
        {customer?.display_name?.charAt(0).toUpperCase() || 'C'}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={customer?.display_name}
      className={styles.customerLogo}
      onError={() => setLogoError(true)}
    />
  );
}