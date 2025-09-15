import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCompanyByEmail, Company } from '../services/supabaseService';
import './Login.css';

const defaultCompany: Company = {
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
};

const getCompanyLogo = (companyName: string, companyReference: string) => {
  const logoMap: { [key: string]: string } = {
    'splitfin': '/logos/splitfinrow.png',
    'dmbrands': '/logos/dmbrands-logo.png',
    'dm brands': '/logos/dmbrands-logo.png',
    'techcorp': '/logos/techcorp-logo.png',
    'techcorp industries': '/logos/techcorp-logo.png',
    'global': '/logos/global-logo.png',
    'global ltd': '/logos/global-logo.png',
    'acme': '/logos/acme-logo.png',
    'acme corporation': '/logos/acme-logo.png'
  };

  const key = companyName.toLowerCase();
  const refKey = companyReference.toLowerCase();
  
  return logoMap[key] || logoMap[refKey] || '/logos/splitfinrow.png';
};

// Function to calculate relative luminance
const getLuminance = (color: string): number => {
  // Convert hex to RGB
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  // Convert to sRGB
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  // Calculate relative luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
};

// Function to determine if text should be white or black
const getContrastTextColor = (backgroundColor: string): string => {
  const luminance = getLuminance(backgroundColor);
  // Use white text for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#0f1419' : '#ffffff';
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<Company>(defaultCompany);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Email validation regex
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  useEffect(() => {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Only proceed if email looks valid
    if (email && isValidEmail(email)) {
      // Debounce the API call by 300ms (reduced for better UX)
      const timer = setTimeout(async () => {
        try {
          const companyData = await getCompanyByEmail(email);
          if (companyData) {
            setCompany(companyData);
          } else {
            setCompany(defaultCompany);
          }
        } catch (error) {
          console.warn('Failed to fetch company data:', error);
          setCompany(defaultCompany);
        }
      }, 300);

      setDebounceTimer(timer);
    } else if (!email) {
      // Reset to default when email is empty
      setCompany(defaultCompany);
    }

    // Cleanup function
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (data.session) {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const companyLogo = getCompanyLogo(company.name, company.company_reference);
  const isDefaultCompany = company.id === 'default';
  
  // Calculate button text color based on primary color
  const buttonTextColor = isDefaultCompany 
    ? '#0f1419' // Default dark text for Splitfin's light blue button
    : getContrastTextColor(company.brand_colors.primary);

  // Only apply dynamic styles if not the default company
  const dynamicStyles = isDefaultCompany ? {} : {
    '--login-accent': company.brand_colors.primary,
    '--login-accent-hover': company.brand_colors.secondary,
    '--login-accent-light': company.brand_colors.gradient[2] || company.brand_colors.primary,
    '--login-gradient-from': company.brand_colors.gradient[0] || company.brand_colors.primary,
    '--login-gradient-to': company.brand_colors.gradient[1] || company.brand_colors.secondary,
    '--login-gradient-end': company.brand_colors.gradient[2] || company.brand_colors.primary,
    '--login-dynamic-gradient': `linear-gradient(
      45deg,
      rgba(15, 20, 25, 0.9) 0%,
      ${company.brand_colors.gradient[0] || company.brand_colors.primary}26 20%,
      rgba(26, 31, 42, 0.95) 40%,
      ${company.brand_colors.gradient[1] || company.brand_colors.secondary}1A 60%,
      rgba(44, 62, 80, 0.9) 80%,
      ${company.brand_colors.gradient[2] || company.brand_colors.primary}1A 100%
    )`,
    '--login-overlay-gradient': `radial-gradient(
      ellipse at 30% 40%,
      ${company.brand_colors.primary}1F 0%,
      transparent 40%
    ),
    radial-gradient(
      ellipse at 70% 60%,
      ${company.brand_colors.secondary}14 0%,
      transparent 50%
    )`,
    '--login-floating-gradient': `radial-gradient(
      circle,
      ${company.brand_colors.primary}1A 0%,
      ${company.brand_colors.primary}0D 50%,
      transparent 100%
    )`,
    '--login-button-text': buttonTextColor
  };

  return (
    <div 
      className="login-page"
      style={dynamicStyles as React.CSSProperties}
    >
      {/* Gradient overlay for animated background */}
      <div className="gradient-overlay"></div>
      
      {/* Single optimized floating accent element */}
      <div className="floating-accent"></div>
      
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="logo-container">
              <img 
                src={companyLogo} 
                alt={company.name} 
                className="logo-image"
                onError={(e) => {
                  e.currentTarget.src = '/logos/splitfinrow.png';
                }}
              />
            </div>
            <p className="login-subtitle">Access your dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="error-message">
                <div className="error-icon">⚠️</div>
                <span>{error}</span>
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email Address</label>
              <div className="input-container">
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="input-container">
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="button-loader">
                    <span>⟳</span>
                  </div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <svg className="button-arrow" viewBox="0 0 24 24" fill={buttonTextColor}>
                    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="help-text">
              Need help? Contact your administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}