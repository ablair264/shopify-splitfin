import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dcgagukbbzfqaymlxnzw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZ2FndWtiYnpmcWF5bWx4bnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MDE3NDcsImV4cCI6MjA3MTk3Nzc0N30.i0EiHKdEWeJVw6RY3AUp-6aqv-ywunCOFe4_7cV2KmM';

// Validate configuration
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase configuration');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface Company {
  id: string;
  name: string;
  domain: string;
  company_reference: string;
  brand_colors: {
    primary: string;
    secondary: string;
    gradient: string[];
  };
  is_active: boolean;
}

// Cache to avoid repeated lookups
const domainCompanyCache = new Map<string, Company | null>();

// Fallback domain mappings for known companies (when database lookup fails)
const knownDomainMappings: Record<string, Company> = {
  'dmbrands.co.uk': {
    id: '87dcc6db-2e24-46fb-9a12-7886f690a326',
    name: 'DM Brands',
    domain: 'dmbrands.co.uk',
    company_reference: 'DMBRANDS',
    brand_colors: {
      primary: '#FF6B35',
      secondary: '#F7931E',
      gradient: ['#FF6B35', '#F7931E', '#FFB84C']
    },
    is_active: true
  },
  'splitfin.com': {
    id: 'default',
    name: 'Splitfin',
    domain: 'splitfin.com',
    company_reference: 'SPLITFIN',
    brand_colors: {
      primary: '#79d5e9',
      secondary: '#6bc7db',
      gradient: ['#4daebc', '#79d5e9', '#89dce6']
    },
    is_active: true
  }
};

export async function getCompanyByEmail(email: string): Promise<Company | null> {
  try {
    // Validate email format first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      console.warn('Invalid email format:', email);
      return null;
    }

    // Extract domain from email
    const domain = email.split('@')[1].toLowerCase();
    
    // Check cache first
    if (domainCompanyCache.has(domain)) {
      return domainCompanyCache.get(domain) || null;
    }

    // Try to get company by domain directly (this should work for anonymous users)
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('domain', domain)
      .eq('is_active', true)
      .single();

    if (!companyError && companyData) {
      // Cache the result
      domainCompanyCache.set(domain, companyData);
      return companyData;
    }

    // If direct domain lookup failed, try the user/customer lookup
    // But handle RLS errors gracefully
    try {
      // First, find the user by email in the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('email', email)
        .single();

      if (!userError && userData?.company_id) {
        // Get company details for regular user
        const { data: userCompanyData, error: userCompanyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', userData.company_id)
          .eq('is_active', true)
          .single();

        if (!userCompanyError && userCompanyData) {
          domainCompanyCache.set(domain, userCompanyData);
          return userCompanyData;
        }
      }

      // Try customer_users table
      const { data: customerUserData, error: customerUserError } = await supabase
        .from('customer_users')
        .select('linked_customer')
        .eq('email', email)
        .single();

      if (!customerUserError && customerUserData?.linked_customer) {
        // Get the customer's company
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .select('linked_company')
          .eq('id', customerUserData.linked_customer)
          .single();

        if (!customerError && customerData?.linked_company) {
          // Get company details
          const { data: customerCompanyData, error: customerCompanyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', customerData.linked_company)
            .eq('is_active', true)
            .single();

          if (!customerCompanyError && customerCompanyData) {
            domainCompanyCache.set(domain, customerCompanyData);
            return customerCompanyData;
          }
        }
      }
    } catch (rlsError) {
      console.warn('RLS access denied for user lookup, falling back to domain-based detection:', rlsError);
    }

    // Final fallback: check known domain mappings
    if (knownDomainMappings[domain]) {
      const fallbackCompany = knownDomainMappings[domain];
      domainCompanyCache.set(domain, fallbackCompany);
      console.log(`Using fallback company data for domain: ${domain}`);
      return fallbackCompany;
    }

    // Cache negative result to avoid repeated lookups
    domainCompanyCache.set(domain, null);
    return null;
  } catch (error) {
    console.error('Error fetching company by email:', {
      email,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Check if it's a Supabase API key error
    if (error instanceof Error && error.message.includes('No API key found')) {
      console.error('Supabase API key missing! Check client configuration.');
    }
    
    return null;
  }
}

// Helper function to clear domain cache (useful for testing)
export function clearDomainCache(): void {
  domainCompanyCache.clear();
  console.log('Domain company cache cleared');
}