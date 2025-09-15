import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { Save, Mail, Phone, User, Building, Star } from 'lucide-react';
import styles from './NewEnquiry.module.css';

const DM_BRANDS_ID = '87dcc6db-2e24-46fb-9a12-7886f690a326';

interface EnquiryFormData {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  brands_interest: string[];
  lead_source: string;
  salesperson: string;
  notes: string;
}

interface Brand {
  id: string;
  brand_name: string;
  brand_normalized: string;
  logo_url?: string;
  company_id: string;
  is_active: boolean;
}

export default function NewEnquiry() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<EnquiryFormData>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    brands_interest: [],
    lead_source: 'Website',
    salesperson: '',
    notes: '',
  });

  useEffect(() => {
    checkAuth();
    loadBrands();
    loadUsers();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/');
        return;
      }
      
      // Get user details from users table
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single();
      
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
      navigate('/');
    }
  };

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

  const loadUsers = async () => {
    try {
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('is_active', true)
        .order('first_name');

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const sendNotificationToSalesAgent = async (salesAgentId: string, enquiryData: any, creatorData: any) => {
    try {
      console.log('Attempting to send notification with data:', {
        company_id: creatorData.company_id,
        user_id: salesAgentId,
        creator: `${creatorData.first_name} ${creatorData.last_name}`
      });

      const notificationData = {
        company_id: creatorData.company_id,
        user_id: salesAgentId,
        notification_type: 'system',
        title: 'New Enquiry Assigned',
        message: `You have been assigned a new enquiry from ${enquiryData.company_name} by ${creatorData.first_name} ${creatorData.last_name}`,
        related_entity_type: 'enquiry',
        related_entity_id: enquiryData.id,
        action_url: `/enquiries/${enquiryData.id}`,
        priority: 'medium',
        read: false
      };

      console.log('Full notification data:', notificationData);

      const { data: insertResult, error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select();

      if (notificationError) {
        console.error('Detailed notification error:', notificationError);
        console.error('Error details:', {
          code: notificationError.code,
          message: notificationError.message,
          details: notificationError.details,
          hint: notificationError.hint
        });
        // Don't throw error here as the main enquiry was created successfully
      } else {
        console.log('Notification sent successfully:', insertResult);
      }
    } catch (error) {
      console.error('Error sending notification (catch block):', error);
      // Don't throw error here as the main enquiry was created successfully
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBrandToggle = (brandId: string) => {
    setFormData(prev => ({
      ...prev,
      brands_interest: prev.brands_interest.includes(brandId)
        ? prev.brands_interest.filter(id => id !== brandId)
        : [...prev.brands_interest, brandId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.company_name.trim()) {
        throw new Error('Company name is required');
      }
      
      if (!formData.contact_name.trim()) {
        throw new Error('Contact name is required');
      }
      
      if (!formData.email.trim()) {
        throw new Error('Email address is required');
      }
      
      if (formData.brands_interest.length === 0) {
        throw new Error('Please select at least one brand of interest');
      }

      // Get current user and their user record
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Get the user record from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, company_id, first_name, last_name')
        .eq('auth_user_id', authUser.id)
        .single();

      if (userError || !userData) {
        throw new Error('Unable to find user record. Please contact support.');
      }

      // Get brand names for product_interest
      const selectedBrandNames = brands
        .filter(brand => formData.brands_interest.includes(brand.id))
        .map(brand => brand.brand_name)
        .join(', ');

      // Prepare enquiry data according to schema
      const enquiryData = {
        contact_name: formData.contact_name,
        company_name: formData.company_name,
        email: formData.email,
        phone: formData.phone || null,
        subject: `Enquiry from ${formData.company_name}`,
        description: formData.notes || `New enquiry from ${formData.company_name} interested in: ${selectedBrandNames}`,
        product_interest: selectedBrandNames,
        lead_source: formData.lead_source.toLowerCase().replace(' ', '_'),
        company_id: userData.company_id,
        assigned_to: formData.salesperson || userData.id,
        created_by: userData.id,
        status: 'new',
        priority: 'medium'
      };

      // Insert enquiry into Supabase
      const { data, error: insertError } = await supabase
        .from('enquiries')
        .insert([enquiryData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log('Enquiry created successfully:', data);
      
      // Send notification to assigned sales agent if different from creator
      if (formData.salesperson && formData.salesperson !== userData.id) {
        // Get the assigned user's details first
        const { data: assignedUser } = await supabase
          .from('users')
          .select('id, first_name, last_name, company_id')
          .eq('id', formData.salesperson)
          .single();
        
        if (assignedUser) {
          await sendNotificationToSalesAgent(formData.salesperson, data, userData);
        }
      }
      
      // Navigate to enquiries list
      navigate('/enquiries');
      
    } catch (err: any) {
      console.error('Error creating enquiry:', err);
      setError(err.message || 'Failed to create enquiry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.newEnquiryContainer}>
      <div className={styles.newEnquiryCard}>
        <form onSubmit={handleSubmit} className={styles.newEnquiryForm}>
          {error && (
            <div className={styles.errorAlert}>
              <span>{error}</span>
            </div>
          )}

          <div className={styles.formSections}>
            {/* Company & Contact Information */}
            <div className={styles.section}>
              <h3>
                <Building size={20} />
                Company & Contact Information
              </h3>
              
              <div className={styles.formGroup}>
                <label htmlFor="company_name">Company Name *</label>
                <input
                  type="text"
                  id="company_name"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter company name"
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="contact_name">Contact Name *</label>
                  <input
                    type="text"
                    id="contact_name"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter contact person's name"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="contact@example.com"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
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
            </div>

            {/* Brands of Interest */}
            <div className={styles.section}>
              <h3>
                <Star size={20} />
                Brands of Interest *
              </h3>
              
              <div className={styles.brandGrid}>
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    className={`${styles.brandButton} ${formData.brands_interest.includes(brand.id) ? styles.selected : ''}`}
                    onClick={() => handleBrandToggle(brand.id)}
                  >
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.brand_name}
                        className={styles.brandLogo}
                      />
                    ) : (
                      <div className={styles.brandLogoFallback}>
                        {brand.brand_name.charAt(0)}
                      </div>
                    )}
                    <span className={styles.brandName}>{brand.brand_name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lead Information */}
            <div className={styles.section}>
              <h3>
                <User size={20} />
                Lead Information
              </h3>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="lead_source">Lead Source</label>
                  <select
                    id="lead_source"
                    name="lead_source"
                    value={formData.lead_source}
                    onChange={handleInputChange}
                  >
                    <option value="Website">Website</option>
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Referral">Referral</option>
                    <option value="Trade Show">Trade Show</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="salesperson">Salesperson</label>
                  <select
                    id="salesperson"
                    name="salesperson"
                    value={formData.salesperson}
                    onChange={handleInputChange}
                  >
                    <option value="">Assign to me</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Additional notes about this enquiry..."
                />
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => navigate('/enquiries')}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className={styles.spinner} />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Create Enquiry
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}