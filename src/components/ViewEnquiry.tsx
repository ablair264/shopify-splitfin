import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseService';
import { withLoader } from '../hoc/withLoader';
import { 
  MessageSquare, 
  User, 
  Mail, 
  Phone,
  Calendar,
  Clock,
  ChevronDown,
  Building,
  Target,
  DollarSign,
  Edit,
  Trash,
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Send,
  Tag,
  MapPin,
  UserPlus,
  TrendingUp,
  Star,
  Package
} from 'lucide-react';
import styles from './ViewEnquiry.module.css';

// Types
interface Enquiry {
  id: string;
  enquiry_number: string;
  status: string;
  priority: string;
  contact_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  subject: string;
  description: string;
  product_interest?: string;
  estimated_value?: number;
  estimated_quantity?: number;
  expected_decision_date?: string;
  lead_source: string;
  referral_source?: string;
  next_follow_up_date?: string;
  follow_up_notes?: string;
  company_id: string;
  assigned_to?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  last_contacted_at?: string;
  converted_to_customer: boolean;
  converted_customer_id?: string;
  conversion_date?: string;
  is_active: boolean;
  // Joined data
  assigned_to_user?: {
    first_name: string;
    last_name: string;
  };
  created_by_user?: {
    first_name: string;
    last_name: string;
  };
  customers?: {
    display_name: string;
    trading_name?: string;
  };
}

interface EnquiryActivity {
  id: string;
  enquiry_id: string;
  activity_type: string;
  description: string;
  created_by: string;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

const statusConfig = {
  new: { color: '#3b82f6', icon: Plus, label: 'New' },
  contacted: { color: '#8b5cf6', icon: Phone, label: 'Contacted' },
  quoted: { color: '#f59e0b', icon: DollarSign, label: 'Quoted' },
  negotiating: { color: '#10b981', icon: Target, label: 'Negotiating' },
  won: { color: '#22c55e', icon: CheckCircle, label: 'Won' },
  lost: { color: '#ef4444', icon: AlertCircle, label: 'Lost' },
  cancelled: { color: '#6b7280', icon: AlertCircle, label: 'Cancelled' }
};

const priorityConfig = {
  urgent: { color: '#ef4444', label: 'Urgent' },
  high: { color: '#f59e0b', label: 'High' },
  medium: { color: '#3b82f6', label: 'Medium' },
  low: { color: '#6b7280', label: 'Low' }
};

const enquiryStages = [
  { key: 'new', label: 'New Enquiry', icon: MessageSquare },
  { key: 'contacted', label: 'Contacted', icon: Phone },
  { key: 'quoted', label: 'Quoted', icon: FileText },
  { key: 'negotiating', label: 'Negotiating', icon: Target },
  { key: 'won', label: 'Closed Won', icon: CheckCircle }
];

function ViewEnquiry() {
  const { enquiryId } = useParams<{ enquiryId: string }>();
  const navigate = useNavigate();
  
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [activities, setActivities] = useState<EnquiryActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  const fetchEnquiryDetails = useCallback(async () => {
    if (!enquiryId) return;

    setLoading(true);
    try {
      // Get current user's company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) {
        throw new Error('User company not found');
      }

      // Fetch enquiry with related data
      const { data: enquiryData, error: enquiryError } = await supabase
        .from('enquiries')
        .select(`
          *,
          assigned_to_user:assigned_to(first_name, last_name),
          created_by_user:created_by(first_name, last_name),
          customers:converted_customer_id(display_name, trading_name)
        `)
        .eq('id', enquiryId)
        .eq('company_id', userData.company_id)
        .single();

      if (enquiryError) {
        throw new Error(`Failed to fetch enquiry: ${enquiryError.message}`);
      }

      if (!enquiryData) {
        throw new Error('Enquiry not found');
      }

      setEnquiry(enquiryData);

      // Fetch activities (mock for now - you'd need to create this table)
      // For now, we'll just set empty activities
      setActivities([]);

    } catch (err) {
      console.error('Error fetching enquiry details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch enquiry details');
    } finally {
      setLoading(false);
    }
  }, [enquiryId]);

  useEffect(() => {
    fetchEnquiryDetails();
    loadUsers();
  }, [fetchEnquiryDetails]);

  const loadUsers = async () => {
    try {
      // Get current user's company context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id, role')
        .eq('auth_user_id', user.id)
        .single();

      if (userError || !userData?.company_id) return;

      // Set user role for permission checking
      setUserRole(userData.role || '');

      // Fetch all users in the same company
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .eq('company_id', userData.company_id)
        .eq('is_active', true)
        .order('first_name');

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return;
      }

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const canAssignEnquiries = () => {
    return userRole === 'admin' || userRole === 'manager';
  };

  const handleAssignEnquiry = () => {
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (assignToUserId: string) => {
    if (!enquiry) return;

    setAssignLoading(true);
    try {
      const { error } = await supabase
        .from('enquiries')
        .update({ 
          assigned_to: assignToUserId,
          updated_at: new Date().toISOString()
        })
        .eq('id', enquiry.id);

      if (error) {
        console.error('Error assigning enquiry:', error);
        return;
      }

      // Refresh the enquiry data
      await fetchEnquiryDetails();
      setShowAssignModal(false);
    } catch (error) {
      console.error('Error in handleAssignSubmit:', error);
    } finally {
      setAssignLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilFollowUp = (date: string) => {
    const today = new Date();
    const followUpDate = new Date(date);
    const diffTime = followUpDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
  };

  const getPriorityConfig = (priority: string) => {
    return priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.low;
  };

  const getEnquiryProgress = () => {
    if (!enquiry) return 0;
    const currentStageIndex = enquiryStages.findIndex(stage => stage.key === enquiry.status);
    return currentStageIndex >= 0 ? currentStageIndex : 0;
  };

  const handleEditEnquiry = () => {
    if (enquiry) {
      setEditData({
        contact_name: enquiry.contact_name,
        company_name: enquiry.company_name || '',
        email: enquiry.email,
        phone: enquiry.phone || '',
        subject: enquiry.subject,
        description: enquiry.description,
        priority: enquiry.priority,
        lead_source: enquiry.lead_source,
        referral_source: enquiry.referral_source || '',
        product_interest: enquiry.product_interest || '',
        estimated_value: enquiry.estimated_value || '',
        estimated_quantity: enquiry.estimated_quantity || '',
        expected_decision_date: enquiry.expected_decision_date ? enquiry.expected_decision_date.split('T')[0] : '',
        next_follow_up_date: enquiry.next_follow_up_date ? enquiry.next_follow_up_date.split('T')[0] : '',
        follow_up_notes: enquiry.follow_up_notes || ''
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editData || !enquiry) return;

    try {
      const { error } = await supabase
        .from('enquiries')
        .update({
          contact_name: editData.contact_name,
          company_name: editData.company_name,
          email: editData.email,
          phone: editData.phone,
          subject: editData.subject,
          description: editData.description,
          priority: editData.priority,
          lead_source: editData.lead_source,
          referral_source: editData.referral_source,
          product_interest: editData.product_interest,
          estimated_value: editData.estimated_value ? parseFloat(editData.estimated_value) : null,
          estimated_quantity: editData.estimated_quantity ? parseInt(editData.estimated_quantity) : null,
          expected_decision_date: editData.expected_decision_date || null,
          next_follow_up_date: editData.next_follow_up_date || null,
          follow_up_notes: editData.follow_up_notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', enquiry.id);

      if (error) throw error;

      setIsEditing(false);
      setEditData(null);
      await fetchEnquiryDetails();
    } catch (err) {
      console.error('Error updating enquiry:', err);
      alert('Failed to update enquiry');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleDeleteEnquiry = async () => {
    if (!window.confirm('Are you sure you want to delete this enquiry?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('enquiries')
        .update({ is_active: false })
        .eq('id', enquiryId);

      if (error) throw error;
      navigate('/enquiries');
    } catch (err) {
      console.error('Error deleting enquiry:', err);
      alert('Failed to delete enquiry');
    }
  };

  const handleConvertToCustomer = () => {
    // TODO: Implement conversion to customer
    console.log('Convert to customer');
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || submittingNote || !enquiry) return;

    setSubmittingNote(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData) throw new Error('User data not found');

      // Create a new activity entry locally (since we don't have an activities table yet)
      const newActivity: EnquiryActivity = {
        id: Date.now().toString(), // Temporary ID
        enquiry_id: enquiry.id,
        activity_type: 'Note',
        description: newNote.trim(),
        created_by: userData.id,
        created_at: new Date().toISOString(),
        user: {
          first_name: userData.first_name,
          last_name: userData.last_name
        }
      };

      // Add to activities list
      setActivities(prev => [newActivity, ...prev]);
      
      // Clear the note
      setNewNote('');
      
      // TODO: Once activities table is created, save to database
      // const { error } = await supabase
      //   .from('enquiry_activities')
      //   .insert([{
      //     enquiry_id: enquiry.id,
      //     activity_type: 'Note',
      //     description: newNote.trim(),
      //     created_by: userData.id
      //   }]);
      
    } catch (err) {
      console.error('Error adding note:', err);
      alert('Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('enquiries')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', enquiryId);

      if (error) throw error;
      
      // Refresh enquiry data
      await fetchEnquiryDetails();
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  const handleCreateQuote = () => {
    // TODO: Implement quote creation
    alert('Create Quote functionality - to be implemented');
  };

  const handleSendEmail = () => {
    if (enquiry?.email) {
      window.location.href = `mailto:${enquiry.email}?subject=Re: ${enquiry.subject}`;
    }
  };

  const handleLogCall = () => {
    // TODO: Implement call logging
    alert('Log Call functionality - to be implemented');
  };

  if (loading) {
    return null; // Let the withLoader HOC handle the loading state
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <AlertCircle size={48} color="#ef4444" />
          <h2>Error Loading Enquiry</h2>
          <p>{error}</p>
          <div className={styles.errorActions}>
            <button onClick={fetchEnquiryDetails} className={styles.retryButton}>
              Retry
            </button>
            <button onClick={() => navigate('/enquiries')} className={styles.backButton}>
              Back to Enquiries
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <MessageSquare size={48} color="#9ca3af" />
          <h2>Enquiry Not Found</h2>
          <p>The requested enquiry could not be found.</p>
          <button onClick={() => navigate('/enquiries')} className={styles.backButton}>
            Back to Enquiries
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusConfig(enquiry.status);
  const priorityInfo = getPriorityConfig(enquiry.priority);
  const StatusIcon = statusInfo.icon;
  const progress = getEnquiryProgress();
  const daysUntilFollowUp = enquiry.next_follow_up_date ? getDaysUntilFollowUp(enquiry.next_follow_up_date) : null;

  return (
    <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button onClick={() => navigate('/enquiries')} className={styles.backButton}>
              <ChevronDown size={16} /> Back to Enquiries
            </button>
            <div className={styles.titleSection}>
              <h1>{enquiry.company_name || enquiry.contact_name}</h1>
              <div className={styles.badges}>
                <span 
                  className={styles.statusBadge}
                  style={{ 
                    background: `${statusInfo.color}20`,
                    color: statusInfo.color,
                    border: `1px solid ${statusInfo.color}40`
                  }}
                >
                  <StatusIcon size={14} />
                  {statusInfo.label}
                </span>
                <span 
                  className={styles.priorityBadge}
                  style={{ 
                    background: `${priorityInfo.color}20`,
                    color: priorityInfo.color,
                    border: `1px solid ${priorityInfo.color}40`
                  }}
                >
                  {priorityInfo.label}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            {canAssignEnquiries() && (
              <button onClick={handleAssignEnquiry} className={styles.assignButton}>
                <User size={16} /> Assign
              </button>
            )}
            <button onClick={isEditing ? handleSaveEdit : handleEditEnquiry} className={styles.primaryButton}>
              {isEditing ? (
                <>
                  <CheckCircle size={16} /> Save
                </>
              ) : (
                <>
                  <Edit size={16} /> Edit
                </>
              )}
            </button>
            {isEditing && (
              <button onClick={handleCancelEdit} className={styles.cancelButton}>
                Cancel
              </button>
            )}
            <button onClick={handleDeleteEnquiry} className={styles.deleteButton}>
              <Trash size={16} />
            </button>
          </div>
        </div>

      {/* Progress Steps */}
      <div className={styles.progressContainer}>
        <div className={styles.progressSteps}>
          {enquiryStages.map((stage, index) => {
            const isCompleted = index < progress;
            const isCurrent = index === progress;
            const Icon = stage.icon;
            
            return (
              <div key={stage.key} className={styles.progressStep}>
                <div className={`${styles.stepCircle} ${isCompleted ? styles.completed : ''} ${isCurrent ? styles.current : ''}`}>
                  <Icon size={20} />
                </div>
                <div className={styles.stepLabel}>{stage.label}</div>
              </div>
            );
          })}
        </div>
        <div className={styles.progressBarContainer}>
          <div 
            className={styles.progressBarFill} 
            style={{ width: `${(progress / (enquiryStages.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Left Column */}
        <div className={styles.leftColumn}>
          {/* Enquiry Details */}
          <div className={styles.card}>
            <h3>Enquiry Details</h3>
            {isEditing && editData ? (
              <div className={styles.editForm}>
                <div className={styles.formGroup}>
                  <label>Subject</label>
                  <input
                    type="text"
                    name="subject"
                    value={editData.subject}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Lead Source</label>
                  <select
                    name="lead_source"
                    value={editData.lead_source}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
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
                  <label>Product Interest</label>
                  <input
                    type="text"
                    name="product_interest"
                    value={editData.product_interest}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Referral Source</label>
                  <input
                    type="text"
                    name="referral_source"
                    value={editData.referral_source}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Priority</label>
                  <select
                    name="priority"
                    value={editData.priority}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={editData.description}
                    onChange={handleEditInputChange}
                    className={styles.formTextarea}
                    rows={4}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Subject</span>
                    <span className={styles.detailValue}>{enquiry.subject}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Lead Source</span>
                    <span className={styles.detailValue}>{enquiry.lead_source}</span>
                  </div>
                  {enquiry.product_interest && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Product Interest</span>
                      <span className={styles.detailValue}>{enquiry.product_interest}</span>
                    </div>
                  )}
                  {enquiry.referral_source && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Referral Source</span>
                      <span className={styles.detailValue}>{enquiry.referral_source}</span>
                    </div>
                  )}
                </div>

                <div className={styles.descriptionSection}>
                  <h4>Description</h4>
                  <p>{enquiry.description}</p>
                </div>
              </>
            )}
          </div>

          {/* Contact Information */}
          <div className={styles.card}>
            <h3>Contact Information</h3>
            {isEditing && editData ? (
              <div className={styles.editForm}>
                <div className={styles.formGroup}>
                  <label>Contact Name</label>
                  <input
                    type="text"
                    name="contact_name"
                    value={editData.contact_name}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Company Name</label>
                  <input
                    type="text"
                    name="company_name"
                    value={editData.company_name}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={editData.email}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editData.phone}
                    onChange={handleEditInputChange}
                    className={styles.formInput}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.contactGrid}>
                <div className={styles.contactItem}>
                  <User size={20} className={styles.contactIcon} />
                  <div>
                    <div className={styles.contactName}>{enquiry.contact_name}</div>
                    {enquiry.company_name && (
                      <div className={styles.companyName}>{enquiry.company_name}</div>
                    )}
                  </div>
                </div>
                <div className={styles.contactItem}>
                  <Mail size={20} className={styles.contactIcon} />
                  <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>
                </div>
                {enquiry.phone && (
                  <div className={styles.contactItem}>
                    <Phone size={20} className={styles.contactIcon} />
                    <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Value Information */}
          {(enquiry.estimated_value || enquiry.estimated_quantity || enquiry.expected_decision_date) && (
            <div className={styles.card}>
              <h3>Opportunity Details</h3>
              <div className={styles.opportunityGrid}>
                {enquiry.estimated_value && (
                  <div className={styles.opportunityItem}>
                    <DollarSign size={20} className={styles.opportunityIcon} />
                    <div>
                      <div className={styles.opportunityLabel}>Estimated Value</div>
                      <div className={styles.opportunityValue}>{formatCurrency(enquiry.estimated_value)}</div>
                    </div>
                  </div>
                )}
                {enquiry.estimated_quantity && (
                  <div className={styles.opportunityItem}>
                    <Package size={20} className={styles.opportunityIcon} />
                    <div>
                      <div className={styles.opportunityLabel}>Quantity</div>
                      <div className={styles.opportunityValue}>{enquiry.estimated_quantity} units</div>
                    </div>
                  </div>
                )}
                {enquiry.expected_decision_date && (
                  <div className={styles.opportunityItem}>
                    <Target size={20} className={styles.opportunityIcon} />
                    <div>
                      <div className={styles.opportunityLabel}>Expected Decision</div>
                      <div className={styles.opportunityValue}>{formatDate(enquiry.expected_decision_date)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Follow-up Information */}
          {(enquiry.next_follow_up_date || enquiry.follow_up_notes) && (
            <div className={styles.card}>
              <h3>Follow-up Information</h3>
              {enquiry.next_follow_up_date && daysUntilFollowUp !== null && (
                <div className={`${styles.followUpAlert} ${daysUntilFollowUp < 0 ? styles.overdue : daysUntilFollowUp <= 2 ? styles.urgent : styles.upcoming}`}>
                  <Clock size={20} />
                  <div>
                    <div className={styles.followUpDate}>
                      {daysUntilFollowUp < 0 
                        ? `Overdue by ${Math.abs(daysUntilFollowUp)} days`
                        : daysUntilFollowUp === 0 
                        ? 'Follow up today'
                        : `Follow up in ${daysUntilFollowUp} days`
                      }
                    </div>
                    <div className={styles.followUpDateText}>
                      {formatDate(enquiry.next_follow_up_date)}
                    </div>
                  </div>
                </div>
              )}
              {enquiry.follow_up_notes && (
                <div className={styles.followUpNotes}>
                  <h4>Notes</h4>
                  <p>{enquiry.follow_up_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className={styles.rightColumn}>
          {/* Quick Actions */}
          <div className={styles.card}>
            <h3>Quick Actions</h3>
            <div className={styles.quickActions}>
              <select 
                value={enquiry.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={styles.statusSelect}
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
              <button onClick={handleCreateQuote} className={styles.actionButton}>
                <FileText size={16} /> Create Quote
              </button>
              <button onClick={handleSendEmail} className={styles.actionButton}>
                <Send size={16} /> Send Email
              </button>
              <button onClick={handleLogCall} className={styles.actionButton}>
                <Phone size={16} /> Log Call
              </button>
            </div>
          </div>

          {/* Enquiry Activity */}
          <div className={styles.card}>
            <div className={styles.activityHeader}>
              <h3>Enquiry Activity</h3>
            </div>
            
            {/* Add Note */}
            <div className={styles.addNote}>
              <textarea
                placeholder="Add a note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className={styles.noteInput}
                rows={3}
              />
              <button 
                onClick={handleAddNote}
                disabled={!newNote.trim() || submittingNote}
                className={styles.sendButton}
              >
                <Send size={16} />
              </button>
            </div>

            {/* Activities List */}
            <div className={styles.activitiesList}>
              {/* Created Activity */}
              <div className={styles.activityItem}>
                <div className={styles.activityIcon}>
                  <Plus size={16} />
                </div>
                <div className={styles.activityContent}>
                  <div className={styles.activityTitle}>Enquiry Created</div>
                  <div className={styles.activityMeta}>
                    by {enquiry.created_by_user ? 
                      `${enquiry.created_by_user.first_name} ${enquiry.created_by_user.last_name}` : 
                      'Unknown'
                    } • {formatDateTime(enquiry.created_at)}
                  </div>
                </div>
              </div>

              {activities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    <MessageSquare size={16} />
                  </div>
                  <div className={styles.activityContent}>
                    <div className={styles.activityTitle}>{activity.activity_type}</div>
                    <div className={styles.activityDescription}>{activity.description}</div>
                    <div className={styles.activityMeta}>
                      by {activity.user ? 
                        `${activity.user.first_name} ${activity.user.last_name}` : 
                        'Unknown'
                      } • {formatDateTime(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta Information */}
          <div className={styles.card}>
            <h3>Information</h3>
            <div className={styles.metaInfo}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Created</span>
                <span className={styles.metaValue}>{formatDateTime(enquiry.created_at)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Last Updated</span>
                <span className={styles.metaValue}>{formatDateTime(enquiry.updated_at)}</span>
              </div>
              {enquiry.assigned_to_user && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Assigned To</span>
                  <span className={styles.metaValue}>
                    {enquiry.assigned_to_user.first_name} {enquiry.assigned_to_user.last_name}
                  </span>
                </div>
              )}
              {enquiry.last_contacted_at && (
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Last Contacted</span>
                  <span className={styles.metaValue}>{formatDateTime(enquiry.last_contacted_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && enquiry && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Assign Enquiry</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className={styles.modalCloseButton}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <p>Assign enquiry <strong>#{enquiry.enquiry_number}</strong> to:</p>
              <div className={styles.assigneeList}>
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAssignSubmit(user.id)}
                    disabled={assignLoading}
                    className={`${styles.assigneeButton} ${enquiry.assigned_to === user.id ? styles.currentAssignee : ''}`}
                  >
                    <User size={16} />
                    <span>{user.first_name} {user.last_name}</span>
                    {enquiry.assigned_to === user.id && (
                      <span className={styles.currentBadge}>Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={() => setShowAssignModal(false)}
                className={styles.cancelButton}
                disabled={assignLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withLoader(ViewEnquiry, { customMessage: 'Loading enquiry details...' });