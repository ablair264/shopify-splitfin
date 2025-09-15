import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { Save, X, Mail, Phone, User, Building, Map, Send, Loader } from 'lucide-react';
import styles from './CreateCustomer.module.css';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCtvRdpXyzAg2YTTf398JHSxGA1dmD4Doc';
const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

// Postcode lookup using postcodes.io (free UK postcode API)
const lookupPostcode = async (postcode: string) => {
  try {
    const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
    const response = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
    
    if (!response.ok) {
      throw new Error('Postcode not found');
    }
    
    const data = await response.json();
    
    if (data.status === 200 && data.result) {
      return {
        postcode: data.result.postcode,
        city: data.result.admin_district || data.result.parish || '',
        county: data.result.admin_county || data.result.region || '',
        country: data.result.country
      };
    }
    
    throw new Error('Invalid postcode');
  } catch (error) {
    console.error('Postcode lookup error:', error);
    throw error;
  }
};

interface CustomerFormData {
  contact_name: string;
  trading_name: string;
  email: string;
  phone: string;
  billing_address_1: string;
  billing_address_2: string;
  billing_city_town: string;
  billing_county: string;
  billing_postcode: string;
  shipping_address_1: string;
  shipping_address_2: string;
  shipping_city_town: string;
  shipping_county: string;
  shipping_postcode: string;
}

export default function CreateCustomer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  
  const [formData, setFormData] = useState<CustomerFormData>({
    contact_name: '',
    trading_name: '',
    email: '',
    phone: '',
    billing_address_1: '',
    billing_address_2: '',
    billing_city_town: '',
    billing_county: '',
    billing_postcode: '',
    shipping_address_1: '',
    shipping_address_2: '',
    shipping_city_town: '',
    shipping_county: '',
    shipping_postcode: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If billing address changes and "same as billing" is checked, update shipping
    if (sameAsBilling && name.startsWith('billing_')) {
      const shippingField = name.replace('billing_', 'shipping_');
      setFormData(prev => ({ ...prev, [shippingField]: value }));
    }
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    setSameAsBilling(checked);
    
    if (checked) {
      setFormData(prev => ({
        ...prev,
        shipping_address_1: prev.billing_address_1,
        shipping_address_2: prev.billing_address_2,
        shipping_city_town: prev.billing_city_town,
        shipping_county: prev.billing_county,
        shipping_postcode: prev.billing_postcode,
      }));
    }
  };

  const handlePostcodeLookup = async (postcode: string, type: 'billing' | 'shipping') => {
    try {
      const result = await lookupPostcode(postcode);
      
      setFormData(prev => ({
        ...prev,
        [`${type}_postcode`]: result.postcode,
        [`${type}_city_town`]: result.city,
        [`${type}_county`]: result.county,
      }));
      
      // If same as billing is checked and we're updating billing, update shipping too
      if (sameAsBilling && type === 'billing') {
        setFormData(prev => ({
          ...prev,
          shipping_postcode: result.postcode,
          shipping_city_town: result.city,
          shipping_county: result.county,
        }));
      }
    } catch (error) {
      console.error('Postcode lookup failed:', error);
      // You could show a toast notification here
    }
  };

  const geocodeAddress = async (address: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return `(${lng},${lat})`; // Store as (longitude,latitude) to match existing format
      }
    } catch (error) {
      console.warn('Geocoding failed:', error);
    }
    return null;
  };

  // Zoho integration via Make.com webhook
  const createCustomerInZoho = async (customerData: any) => {
    try {
      console.log('Creating customer in Zoho via Make.com webhook...');
      
      // Prepare webhook data
      const webhookData = {
        action: 'sync_customer',
        customer_type: 'new', // This is always a new customer in CreateCustomer
        supabase_customer_id: customerData.id,
        zoho_customer_id: null, // New customers don't have a Zoho ID yet
        customer_data: {
          display_name: customerData.display_name,
          trading_name: customerData.trading_name,
          email: customerData.email,
          phone: customerData.phone,
          billing_address_1: customerData.billing_address_1,
          billing_address_2: customerData.billing_address_2,
          billing_city_town: customerData.billing_city_town,
          billing_county: customerData.billing_county,
          billing_postcode: customerData.billing_postcode,
          shipping_address_1: customerData.shipping_address_1,
          shipping_address_2: customerData.shipping_address_2,
          shipping_city_town: customerData.shipping_city_town,
          shipping_county: customerData.shipping_county,
          shipping_postcode: customerData.shipping_postcode,
          payment_terms: customerData.payment_terms,
          currency_code: customerData.currency_code,
        },
        timestamp: new Date().toISOString(),
        source: 'create_customer_page'
      };

      console.log('Sending customer to Make.com webhook:', webhookData);

      // Send to Make.com webhook
      const webhookUrl = process.env.REACT_APP_ORDER_WEBHOOK_URL || 'https://hook.eu2.make.com/ussc9u8m3bamb3epfx4u0o0ef8hy8b4n';
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed with status: ${response.status}`);
      }

      // Handle different response types from Make.com
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Handle plain text responses (like "Accepted")
        const textResult = await response.text();
        console.log('Webhook returned plain text:', textResult);
        result = { success: true, message: textResult };
      }
      
      console.log('Webhook response:', result);

      // Return the result in the expected format
      return { 
        success: true, 
        zoho_id: result.zoho_customer_id || null 
      };
      
    } catch (error) {
      console.error('Error creating customer in Zoho via webhook:', error);
      // Don't fail the customer creation if Zoho integration fails
      return { success: false, zoho_id: null };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.contact_name.trim()) {
        throw new Error('Contact name is required');
      }
      
      if (!formData.trading_name.trim()) {
        throw new Error('Company name is required');
      }
      
      if (!formData.email.trim()) {
        throw new Error('Email address is required');
      }

      // Validate required address fields
      if (!formData.billing_address_1.trim()) {
        throw new Error('Billing address line 1 is required');
      }
      
      if (!formData.billing_city_town.trim()) {
        throw new Error('Billing city/town is required');
      }
      
      if (!formData.billing_postcode.trim()) {
        throw new Error('Billing postcode is required');
      }
      
      if (!formData.shipping_address_1.trim()) {
        throw new Error('Shipping address line 1 is required');
      }
      
      if (!formData.shipping_city_town.trim()) {
        throw new Error('Shipping city/town is required');
      }
      
      if (!formData.shipping_postcode.trim()) {
        throw new Error('Shipping postcode is required');
      }

      // Build the full billing address for geocoding
      const billingAddress = [
        formData.billing_address_1,
        formData.billing_address_2,
        formData.billing_city_town,
        formData.billing_county,
        formData.billing_postcode,
        'UK'
      ].filter(Boolean).join(', ');

      // Try to geocode the address
      let coordinates = null;
      if (billingAddress.length > 10) {
        coordinates = await geocodeAddress(billingAddress);
      }

      // Prepare customer data
      const customerData = {
        // Map new field names to database fields
        display_name: formData.contact_name,
        trading_name: formData.trading_name,
        email: formData.email,
        phone: formData.phone,
        billing_address_1: formData.billing_address_1,
        billing_address_2: formData.billing_address_2,
        billing_city_town: formData.billing_city_town,
        billing_county: formData.billing_county,
        billing_postcode: formData.billing_postcode,
        shipping_address_1: formData.shipping_address_1,
        shipping_address_2: formData.shipping_address_2,
        shipping_city_town: formData.shipping_city_town,
        shipping_county: formData.shipping_county,
        shipping_postcode: formData.shipping_postcode,
        // Set default values for removed fields
        payment_terms: '30',
        currency_code: 'GBP',
        segment: 'New',
        // System fields
        linked_company: DM_BRANDS_ID,
        coordinates,
        total_spent: 0,
        total_paid: 0,
        average_order_value: 0,
        order_count: 0,
        invoice_count: 0,
        outstanding_receivable_amount: 0,
        unused_credits_receivable_amount: 0,
        payment_performance: 100,
        customer_lifetime_days: 0,
        first_order_date: null,
        last_order_date: null,
        migration_source: 'manual',
        is_active: true,
        created_date: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        // Generate a temporary fb_customer_id (this would normally come from Zoho)
        fb_customer_id: `MANUAL_${Date.now()}`,
        // Add user IDs from auth
        created_by: '',  // Will be set after auth check
        linked_sales_user: '',  // Will be set after auth check
      };

      // Get current user and their user record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get the user record from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Unable to find user record. Please contact support.');
      }

      // Update user IDs with correct user table IDs
      customerData.created_by = userData.id;
      customerData.linked_sales_user = userData.id;

      // Insert customer into Supabase
      const { data, error: insertError } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log('Customer created successfully in Supabase:', data);
      
      // Create customer in Zoho
      const zohoResult = await createCustomerInZoho(data);
      
      // If we got a Zoho customer ID, update the record
      if (zohoResult.success && zohoResult.zoho_id) {
        const { error: updateError } = await supabase
          .from('customers')
          .update({ legacy_customer_id: zohoResult.zoho_id })
          .eq('id', data.id);
          
        if (updateError) {
          console.warn('Failed to update legacy_customer_id:', updateError);
        } else {
          console.log('Customer synced with Zoho successfully');
        }
      }
      
      // Navigate to customer detail page
      navigate(`/customers/${data.id}`);
      
    } catch (err: any) {
      console.error('Error creating customer:', err);
      setError(err.message || 'Failed to create customer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.createCustomerContainer}>
      <div className={styles.createCustomerCard}>
        <form onSubmit={handleSubmit} className={styles.createCustomerForm}>
          {error && (
            <div className={styles.errorAlert}>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.createCustomerSections}>
            {/* Company Information */}
            <div className={styles.createCustomerSection}>
              <h3>
                <Building size={16} />
                Company Information
              </h3>
            
              <div className={styles.createCustomerRow}>
                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="contact_name">Contact Name *</label>
                  <input
                    type="text"
                    id="contact_name"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Primary contact name"
                  />
                </div>

                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="trading_name">Company Name *</label>
                  <input
                    type="text"
                    id="trading_name"
                    name="trading_name"
                    value={formData.trading_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className={styles.createCustomerRow}>
                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+44 123 456 7890"
                  />
                </div>

                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Billing Address */}
            <div className={styles.createCustomerSection}>
              <h3>
                <Building size={16} />
                Billing Address
              </h3>

              {/* Shipping same as billing checkbox */}
              <div className={styles.createCustomerCheckbox}>
                <input
                  type="checkbox"
                  id="sameAsBilling"
                  checked={sameAsBilling}
                  onChange={(e) => handleSameAsBillingChange(e.target.checked)}
                />
                <label htmlFor="sameAsBilling">Shipping address same as billing</label>
              </div>
              
              <div className={styles.createCustomerFormGroup}>
                <label htmlFor="billing_postcode">Postcode *</label>
                <div className={styles.createCustomerPostcodeGroup}>
                  <input
                    type="text"
                    id="billing_postcode"
                    name="billing_postcode"
                    value={formData.billing_postcode}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter postcode.."
                  />
                  <button
                    type="button"
                    className={styles.createCustomerLookupButton}
                    onClick={() => handlePostcodeLookup(formData.billing_postcode, 'billing')}
                    disabled={!formData.billing_postcode.trim()}
                  >
                    Lookup
                  </button>
                </div>
              </div>

              <div className={styles.createCustomerFormGroup}>
                <label htmlFor="billing_address_2">Building no. or name</label>
                <input
                  type="text"
                  id="billing_address_2"
                  name="billing_address_2"
                  value={formData.billing_address_2}
                  onChange={handleInputChange}
                  placeholder="Building no. or name"
                />
              </div>

              <div className={styles.createCustomerFormGroup}>
                <label htmlFor="billing_address_1">Street *</label>
                <input
                  type="text"
                  id="billing_address_1"
                  name="billing_address_1"
                  value={formData.billing_address_1}
                  onChange={handleInputChange}
                  required
                  placeholder="Street"
                />
              </div>

              <div className={styles.createCustomerRow}>
                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="billing_county">County</label>
                  <input
                    type="text"
                    id="billing_county"
                    name="billing_county"
                    value={formData.billing_county}
                    onChange={handleInputChange}
                    placeholder="County"
                  />
                </div>

                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="billing_city_town">Country</label>
                  <input
                    type="text"
                    id="billing_city_town"
                    name="billing_city_town"
                    value={formData.billing_city_town}
                    onChange={handleInputChange}
                    required
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address - Only show if different from billing */}
            {!sameAsBilling && (
              <div className={styles.createCustomerSection}>
                <h3>
                  <Map size={16} />
                  Shipping Address
                </h3>

                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="shipping_postcode">Postcode *</label>
                  <div className={styles.createCustomerPostcodeGroup}>
                    <input
                      type="text"
                      id="shipping_postcode"
                      name="shipping_postcode"
                      value={formData.shipping_postcode}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter postcode.."
                    />
                    <button
                      type="button"
                      className={styles.createCustomerLookupButton}
                      onClick={() => handlePostcodeLookup(formData.shipping_postcode, 'shipping')}
                      disabled={!formData.shipping_postcode.trim() || sameAsBilling}
                    >
                      Lookup
                    </button>
                  </div>
                </div>

                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="shipping_address_2">Building no. or name</label>
                  <input
                    type="text"
                    id="shipping_address_2"
                    name="shipping_address_2"
                    value={formData.shipping_address_2}
                    onChange={handleInputChange}
                    placeholder="Building no. or name"
                  />
                </div>

                <div className={styles.createCustomerFormGroup}>
                  <label htmlFor="shipping_address_1">Street *</label>
                  <input
                    type="text"
                    id="shipping_address_1"
                    name="shipping_address_1"
                    value={formData.shipping_address_1}
                    onChange={handleInputChange}
                    required
                    placeholder="Street"
                  />
                </div>

                <div className={styles.createCustomerRow}>
                  <div className={styles.createCustomerFormGroup}>
                    <label htmlFor="shipping_county">County</label>
                    <input
                      type="text"
                      id="shipping_county"
                      name="shipping_county"
                      value={formData.shipping_county}
                      onChange={handleInputChange}
                      placeholder="County"
                    />
                  </div>

                  <div className={styles.createCustomerFormGroup}>
                    <label htmlFor="shipping_city_town">Country</label>
                    <input
                      type="text"
                      id="shipping_city_town"
                      name="shipping_city_town"
                      value={formData.shipping_city_town}
                      onChange={handleInputChange}
                      required
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.createCustomerActions}>
            <button
              type="button"
              onClick={() => navigate('/customers')}
              className={styles.createCustomerCancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className={styles.createCustomerSubmitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className={styles.createCustomerSpinner} />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Create Customer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
);
}