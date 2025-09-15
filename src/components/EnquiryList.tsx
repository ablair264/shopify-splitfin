import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  User, 
  Eye, 
  Calendar, 
  Star, 
  TrendingUp, 
  Users, 
  Mail, 
  Phone,
  Building,
  Clock,
  Filter,
  Grid,
  List,
  Download,
  ChevronRight,
  AlertCircle,
  Target,
  DollarSign,
  Edit,
  MoreVertical,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseService';
import MetricCard from './analytics/shared/MetricCard';
import { ColorProvider } from './analytics/shared/ColorProvider';
import { useComponentLoader } from '../hoc/withLoader';
import styles from './EnquiryList.module.css';

// Types based on enquiries schema
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
  // Joined user data
  assigned_to_name?: string;
  created_by_name?: string;
}

interface EnquiryMetrics {
  totalEnquiries: number;
  newEnquiries: number;
  activeEnquiries: number;
  totalEstimatedValue: number;
  conversionRate: number;
  averageResponseTime: number;
}

type SortBy = 'date' | 'priority' | 'value' | 'status' | 'followup';
type ViewMode = 'list' | 'grid';
type FilterStatus = 'all' | 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost';
type FilterPriority = 'all' | 'urgent' | 'high' | 'medium' | 'low';

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
  urgent: { color: '#ef4444', icon: AlertCircle },
  high: { color: '#f59e0b', icon: AlertCircle },
  medium: { color: '#3b82f6', icon: Clock },
  low: { color: '#6b7280', icon: Clock }
};

function EnquiryList() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataProcessing, setDataProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [userRole, setUserRole] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [enquiryMetrics, setEnquiryMetrics] = useState<EnquiryMetrics>({
    totalEnquiries: 0,
    newEnquiries: 0,
    activeEnquiries: 0,
    totalEstimatedValue: 0,
    conversionRate: 0,
    averageResponseTime: 0
  });

  const enquiriesPerPage = viewMode === 'grid' ? 12 : 20;
  const navigate = useNavigate();
  const { showLoader, hideLoader, setProgress } = useComponentLoader();

  useEffect(() => {
    fetchEnquiries();
    loadUsers();
  }, []);

  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      setDataProcessing(true);
      showLoader('Fetching Enquiry Data...');
      setProgress(10);
      
      // Get current user's company context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        setDataProcessing(false);
        setLoading(false);
        hideLoader();
        return;
      }

      // Get user's company information
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id, role, permissions')
        .eq('auth_user_id', user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        setDataProcessing(false);
        setLoading(false);
        hideLoader();
        return;
      }

      if (!userData?.company_id) {
        console.error('No company found for user');
        setEnquiries([]);
        calculateMetrics([]);
        setDataProcessing(false);
        setLoading(false);
        hideLoader();
        return;
      }

      // Set user role for permission checking
      setUserRole(userData.role || '');

      setProgress(30);

      // Fetch enquiries with user details
      const { data: enquiriesData, error: enquiriesError } = await supabase
        .from('enquiries')
        .select(`
          *,
          assigned_to_user:assigned_to(first_name, last_name),
          created_by_user:created_by(first_name, last_name)
        `)
        .eq('company_id', userData.company_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (enquiriesError) {
        console.error('Error fetching enquiries:', enquiriesError);
        throw enquiriesError;
      }

      setProgress(70);

      // Process enquiries data - add user names
      const enhancedEnquiries = (enquiriesData || []).map((enquiry: any) => ({
        ...enquiry,
        assigned_to_name: enquiry.assigned_to_user ? 
          `${enquiry.assigned_to_user.first_name} ${enquiry.assigned_to_user.last_name}`.trim() : null,
        created_by_name: enquiry.created_by_user ? 
          `${enquiry.created_by_user.first_name} ${enquiry.created_by_user.last_name}`.trim() : 'Unknown'
      }));

      console.log('Fetched enquiries from Supabase:', enhancedEnquiries?.length || 0);
      
      setProgress(90);
      
      // Process enquiries data
      setEnquiries(enhancedEnquiries);
      calculateMetrics(enhancedEnquiries);
      
      setProgress(100);
      
      // Wait a moment to ensure all state updates are complete
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (err) {
      console.error('Error in fetchEnquiries:', err);
    } finally {
      setDataProcessing(false);
      setLoading(false);
      hideLoader();
    }
  };

  const calculateMetrics = (enquiriesData: Enquiry[]) => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    const totalEnquiries = enquiriesData.length;
    
    const newEnquiries = enquiriesData.filter(enquiry => {
      const createdDate = new Date(enquiry.created_at);
      return createdDate >= oneWeekAgo;
    }).length;
    
    const activeEnquiries = enquiriesData.filter(enquiry => 
      ['new', 'contacted', 'quoted', 'negotiating'].includes(enquiry.status)
    ).length;

    const totalEstimatedValue = enquiriesData.reduce((sum, enquiry) => 
      sum + (enquiry.estimated_value || 0), 0
    );
    
    const convertedEnquiries = enquiriesData.filter(enquiry => 
      enquiry.converted_to_customer
    ).length;
    
    const conversionRate = totalEnquiries > 0 ? (convertedEnquiries / totalEnquiries) * 100 : 0;
    
    // Calculate average response time (mock data for now)
    const averageResponseTime = 2.5; // days

    setEnquiryMetrics({
      totalEnquiries,
      newEnquiries,
      activeEnquiries,
      totalEstimatedValue,
      conversionRate,
      averageResponseTime
    });
  };

  const loadUsers = async () => {
    try {
      // Get current user's company context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userError || !userData?.company_id) return;

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

  const handleAssignEnquiry = (enquiry: Enquiry) => {
    setSelectedEnquiry(enquiry);
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (assignToUserId: string) => {
    if (!selectedEnquiry) return;

    setAssignLoading(true);
    try {
      const { error } = await supabase
        .from('enquiries')
        .update({ 
          assigned_to: assignToUserId,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEnquiry.id);

      if (error) {
        console.error('Error assigning enquiry:', error);
        return;
      }

      // Refresh the enquiries list
      await fetchEnquiries();
      setShowAssignModal(false);
      setSelectedEnquiry(null);
    } catch (error) {
      console.error('Error in handleAssignSubmit:', error);
    } finally {
      setAssignLoading(false);
    }
  };

  // Filter and sort enquiries
  const filteredEnquiries = useMemo(() => {
    let filtered = enquiries.filter(enquiry => {
      const searchTerm = search.toLowerCase();
      const matchesSearch = !search || (
        enquiry.contact_name.toLowerCase().includes(searchTerm) ||
        (enquiry.company_name && enquiry.company_name.toLowerCase().includes(searchTerm)) ||
        enquiry.email.toLowerCase().includes(searchTerm) ||
        enquiry.subject.toLowerCase().includes(searchTerm) ||
        enquiry.enquiry_number.toLowerCase().includes(searchTerm)
      );

      const matchesStatus = filterStatus === 'all' || enquiry.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || enquiry.priority === filterPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    // Sort enquiries
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
        case 'value':
          return (b.estimated_value || 0) - (a.estimated_value || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'followup':
          if (!a.next_follow_up_date) return 1;
          if (!b.next_follow_up_date) return -1;
          return new Date(a.next_follow_up_date).getTime() - new Date(b.next_follow_up_date).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [enquiries, search, sortBy, filterStatus, filterPriority]);

  // Pagination
  const totalPages = Math.ceil(filteredEnquiries.length / enquiriesPerPage);
  const paginatedEnquiries = filteredEnquiries.slice(
    (currentPage - 1) * enquiriesPerPage,
    currentPage * enquiriesPerPage
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

  const handleExportEnquiries = () => {
    try {
      // Prepare CSV headers
      const headers = [
        'Enquiry Number',
        'Status',
        'Priority',
        'Contact Name',
        'Company Name',
        'Email',
        'Phone',
        'Subject',
        'Description',
        'Estimated Value',
        'Estimated Quantity',
        'Lead Source',
        'Assigned To',
        'Created By',
        'Created Date',
        'Next Follow Up',
        'Last Contacted'
      ];

      // Prepare CSV rows
      const csvRows = [headers.join(',')];
      
      filteredEnquiries.forEach(enquiry => {
        const row = [
          `"${enquiry.enquiry_number}"`,
          `"${enquiry.status}"`,
          `"${enquiry.priority}"`,
          `"${enquiry.contact_name}"`,
          `"${enquiry.company_name || ''}"`,
          `"${enquiry.email}"`,
          `"${enquiry.phone || ''}"`,
          `"${enquiry.subject.replace(/"/g, '""')}"`,
          `"${enquiry.description.replace(/"/g, '""')}"`,
          `"${enquiry.estimated_value || ''}"`,
          `"${enquiry.estimated_quantity || ''}"`,
          `"${enquiry.lead_source}"`,
          `"${enquiry.assigned_to_name || ''}"`,
          `"${enquiry.created_by_name || ''}"`,
          `"${formatDate(enquiry.created_at)}"`,
          `"${enquiry.next_follow_up_date ? formatDate(enquiry.next_follow_up_date) : ''}"`,
          `"${enquiry.last_contacted_at ? formatDate(enquiry.last_contacted_at) : ''}"`
        ];
        csvRows.push(row.join(','));
      });

      // Create and download CSV
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const today = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `enquiries_export_${today}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting enquiries:', error);
    }
  };

  return (
    <ColorProvider barChartColors="multicolored" graphColors={{ primary: '#79d5e9', secondary: '#4daeac', tertiary: '#f77d11' }}>
      <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.titleSection}>
                <h1 className={styles.pageTitle}>
                  <MessageSquare className={styles.titleIcon} />
                  Enquiries
                </h1>
                <p className={styles.pageSubtitle}>Manage and track your sales pipeline</p>
              </div>
            </div>
            
            <div className={styles.headerActions}>
              <button 
                className={styles.exportButton}
                onClick={handleExportEnquiries}
                title="Export enquiries"
              >
                <Download size={18} />
                <span className={styles.buttonText}>Export</span>
              </button>
              <button 
                className={styles.createButton}
                onClick={() => navigate('/enquiries/new')}
              >
                <Plus size={18} />
                <span className={styles.buttonText}>New Enquiry</span>
              </button>
            </div>
          </div>


        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.searchSection}>
            <div className={styles.searchBox}>
              <Search className={styles.searchIcon} size={20} />
              <input
                type="text"
                placeholder="Search by name, company, email, or enquiry number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.filterSection}>
            <div className={styles.filterGroup}>
              <Filter size={16} className={styles.filterIcon} />
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as FilterStatus);
                  setCurrentPage(1);
                }}
                className={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="quoted">Quoted</option>
                <option value="negotiating">Negotiating</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>

              <select
                value={filterPriority}
                onChange={(e) => {
                  setFilterPriority(e.target.value as FilterPriority);
                  setCurrentPage(1);
                }}
                className={styles.filterSelect}
              >
                <option value="all">All Priority</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className={styles.filterSelect}
              >
                <option value="date">Sort by Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="value">Sort by Value</option>
                <option value="status">Sort by Status</option>
                <option value="followup">Sort by Follow-up</option>
              </select>
            </div>

            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => {
                  setViewMode('grid');
                  setCurrentPage(1);
                }}
                title="Grid view"
              >
                <Grid size={18} />
              </button>
              <button
                className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                onClick={() => {
                  setViewMode('list');
                  setCurrentPage(1);
                }}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Enquiries Content */}
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <p>Loading enquiries...</p>
          </div>
        ) : filteredEnquiries.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageSquare size={48} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>No enquiries found</h3>
            <p className={styles.emptyDescription}>
              {search || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'Try adjusting your filters or search criteria'
                : 'Start by creating your first enquiry'}
            </p>
            {!search && filterStatus === 'all' && filterPriority === 'all' && (
              <button 
                className={styles.createButton}
                onClick={() => navigate('/enquiries/new')}
              >
                <Plus size={18} />
                Create First Enquiry
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.enquiriesGrid}>
            {paginatedEnquiries.map((enquiry) => {
              const statusInfo = getStatusConfig(enquiry.status);
              const priorityInfo = getPriorityConfig(enquiry.priority);
              const StatusIcon = statusInfo.icon;
              const PriorityIcon = priorityInfo.icon;
              const daysUntilFollowUp = enquiry.next_follow_up_date ? getDaysUntilFollowUp(enquiry.next_follow_up_date) : null;

              return (
                <div 
                  key={enquiry.id} 
                  className={styles.enquiryCard}
                  onClick={() => navigate(`/enquiries/${enquiry.id}`)}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderLeft}>
                      <span className={styles.enquiryNumber}>#{enquiry.enquiry_number}</span>
                      <div className={styles.badges}>
                        <span 
                          className={styles.statusBadge}
                          style={{ 
                            backgroundColor: `${statusInfo.color}20`, 
                            color: statusInfo.color,
                            border: `1px solid ${statusInfo.color}40`
                          }}
                        >
                          <StatusIcon size={12} />
                          {statusInfo.label}
                        </span>
                        <span 
                          className={styles.priorityBadge}
                          style={{ 
                            backgroundColor: `${priorityInfo.color}20`, 
                            color: priorityInfo.color,
                            border: `1px solid ${priorityInfo.color}40`
                          }}
                        >
                          <PriorityIcon size={12} />
                          {enquiry.priority}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardActions}>
                      {canAssignEnquiries() && (
                        <button 
                          className={styles.assignButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignEnquiry(enquiry);
                          }}
                          title="Assign to salesperson"
                        >
                          <User size={16} />
                        </button>
                      )}
                      <button 
                        className={styles.moreButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Show menu
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <h3 className={styles.enquirySubject}>{enquiry.subject}</h3>
                    
                    <div className={styles.contactInfo}>
                      <div className={styles.contactName}>
                        <User size={14} />
                        <span>{enquiry.contact_name}</span>
                      </div>
                      {enquiry.company_name && (
                        <div className={styles.companyName}>
                          <Building size={14} />
                          <span>{enquiry.company_name}</span>
                        </div>
                      )}
                    </div>

                    <p className={styles.description}>
                      {enquiry.description.length > 120 
                        ? enquiry.description.substring(0, 120) + '...' 
                        : enquiry.description
                      }
                    </p>

                    {enquiry.estimated_value && (
                      <div className={styles.valueInfo}>
                        <DollarSign size={14} />
                        <span>{formatCurrency(enquiry.estimated_value)}</span>
                        {enquiry.estimated_quantity && (
                          <span className={styles.quantity}>• {enquiry.estimated_quantity} units</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles.cardFooter}>
                    <div className={styles.footerInfo}>
                      <div className={styles.dateInfo}>
                        <Calendar size={12} />
                        <span>{formatDate(enquiry.created_at)}</span>
                      </div>
                      {daysUntilFollowUp !== null && (
                        <div className={`${styles.followUpInfo} ${daysUntilFollowUp < 0 ? styles.overdue : daysUntilFollowUp <= 2 ? styles.urgent : ''}`}>
                          <Clock size={12} />
                          <span>
                            {daysUntilFollowUp < 0 
                              ? `${Math.abs(daysUntilFollowUp)} days overdue`
                              : daysUntilFollowUp === 0 
                              ? 'Follow up today'
                              : `Follow up in ${daysUntilFollowUp} days`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className={styles.arrowIcon} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.listContainer}>
            <div className={styles.listHeader}>
              <div className={styles.listCol}>Contact</div>
              <div className={styles.listCol}>Subject</div>
              <div className={styles.listCol}>Status</div>
              <div className={styles.listCol}>Priority</div>
              <div className={styles.listCol}>Value</div>
              <div className={styles.listCol}>Follow-up</div>
              <div className={styles.listCol}>Created</div>
              <div className={styles.listCol}>Actions</div>
            </div>
            <div className={styles.listBody}>
              {paginatedEnquiries.map((enquiry) => {
                const statusInfo = getStatusConfig(enquiry.status);
                const priorityInfo = getPriorityConfig(enquiry.priority);
                const StatusIcon = statusInfo.icon;
                const PriorityIcon = priorityInfo.icon;
                const daysUntilFollowUp = enquiry.next_follow_up_date ? getDaysUntilFollowUp(enquiry.next_follow_up_date) : null;

                return (
                  <div 
                    key={enquiry.id} 
                    className={styles.listRow}
                    onClick={() => navigate(`/enquiries/${enquiry.id}`)}
                  >
                    <div className={styles.listCol}>
                      <div className={styles.contactCell}>
                        <div className={styles.contactMain}>
                          <span className={styles.contactName}>{enquiry.contact_name}</span>
                          {enquiry.company_name && (
                            <span className={styles.companyName}>{enquiry.company_name}</span>
                          )}
                        </div>
                        <div className={styles.contactDetails}>
                          <Mail size={12} />
                          <span>{enquiry.email}</span>
                          {enquiry.phone && (
                            <>
                              <Phone size={12} />
                              <span>{enquiry.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.listCol}>
                      <div className={styles.subjectCell}>
                        <span className={styles.enquiryNumber}>#{enquiry.enquiry_number}</span>
                        <span className={styles.subjectText}>{enquiry.subject}</span>
                      </div>
                    </div>
                    <div className={styles.listCol}>
                      <span 
                        className={styles.statusBadge}
                        style={{ 
                          backgroundColor: `${statusInfo.color}20`, 
                          color: statusInfo.color,
                          border: `1px solid ${statusInfo.color}40`
                        }}
                      >
                        <StatusIcon size={12} />
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className={styles.listCol}>
                      <span 
                        className={styles.priorityBadge}
                        style={{ 
                          backgroundColor: `${priorityInfo.color}20`, 
                          color: priorityInfo.color,
                          border: `1px solid ${priorityInfo.color}40`
                        }}
                      >
                        <PriorityIcon size={12} />
                        {enquiry.priority}
                      </span>
                    </div>
                    <div className={styles.listCol}>
                      {enquiry.estimated_value ? (
                        <span className={styles.valueText}>{formatCurrency(enquiry.estimated_value)}</span>
                      ) : (
                        <span className={styles.emptyValue}>—</span>
                      )}
                    </div>
                    <div className={styles.listCol}>
                      {daysUntilFollowUp !== null ? (
                        <div className={`${styles.followUpInfo} ${daysUntilFollowUp < 0 ? styles.overdue : daysUntilFollowUp <= 2 ? styles.urgent : ''}`}>
                          <Clock size={12} />
                          <span>
                            {daysUntilFollowUp < 0 
                              ? `${Math.abs(daysUntilFollowUp)}d overdue`
                              : daysUntilFollowUp === 0 
                              ? 'Today'
                              : `${daysUntilFollowUp}d`
                            }
                          </span>
                        </div>
                      ) : (
                        <span className={styles.emptyValue}>—</span>
                      )}
                    </div>
                    <div className={styles.listCol}>
                      <span className={styles.dateText}>{formatDate(enquiry.created_at)}</span>
                    </div>
                    <div className={styles.listCol}>
                      <div className={styles.listActions}>
                        <button
                          className={styles.actionButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/enquiries/${enquiry.id}`);
                          }}
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className={styles.actionButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/enquiries/${enquiry.id}/edit`);
                          }}
                          title="Edit enquiry"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={styles.paginationButton}
            >
              Previous
            </button>
            
            <div className={styles.paginationInfo}>
              <span className={styles.paginationCurrent}>Page {currentPage} of {totalPages}</span>
              <span className={styles.paginationTotal}>({filteredEnquiries.length} enquiries)</span>
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={styles.paginationButton}
            >
              Next
            </button>
          </div>
        )}

        {/* Assignment Modal */}
        {showAssignModal && selectedEnquiry && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h3>Assign Enquiry</h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedEnquiry(null);
                  }}
                  className={styles.modalCloseButton}
                >
                  ×
                </button>
              </div>
              <div className={styles.modalBody}>
                <p>Assign enquiry <strong>#{selectedEnquiry.enquiry_number}</strong> to:</p>
                <div className={styles.assigneeList}>
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAssignSubmit(user.id)}
                      disabled={assignLoading}
                      className={`${styles.assigneeButton} ${selectedEnquiry.assigned_to === user.id ? styles.currentAssignee : ''}`}
                    >
                      <User size={16} />
                      <span>{user.first_name} {user.last_name}</span>
                      {selectedEnquiry.assigned_to === user.id && (
                        <span className={styles.currentBadge}>Current</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedEnquiry(null);
                  }}
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
    </ColorProvider>
  );
}

export default EnquiryList;