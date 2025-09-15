import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseService';
import './ThemeSelector.css';

interface Theme {
  id: string;
  name: string;
  type: 'light' | 'dark';
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  gradient: string[];
}

interface ThemeSelectorProps {
  isEmbedded?: boolean;
  onClose?: () => void;
}

const BUILTIN_THEMES: Theme[] = [
  {
    id: 'splitfin',
    name: 'Splitfin (Default)',
    type: 'dark',
    colors: {
      primary: '#1a1f2a',
      accent: '#79d5e9',
      background: '#0f1419',
      surface: '#1a1f2a',
      text: '#ffffff'
    },
    gradient: ['#34495d', '#2c3d50', '#1a1f2a']
  },
  {
    id: 'fire',
    name: 'Fire',
    type: 'dark',
    colors: {
      primary: '#66203b',
      accent: '#ff6b6b',
      background: '#2d1b1b',
      surface: '#66203b',
      text: '#ffffff'
    },
    gradient: ['#66203b', '#602031', '#5a1f26']
  },
  {
    id: 'forest',
    name: 'Forest',
    type: 'dark',
    colors: {
      primary: '#446455',
      accent: '#4caf50',
      background: '#1b2a1a',
      surface: '#446455',
      text: '#ffffff'
    },
    gradient: ['#446455', '#2b4231', '#1b2a1a']
  },
  {
    id: 'steel',
    name: 'Steel',
    type: 'dark',
    colors: {
      primary: '#373838',
      accent: '#90a4ae',
      background: '#1a1a1a',
      surface: '#373838',
      text: '#ffffff'
    },
    gradient: ['#373838', '#323232', '#2d2d2d']
  },
  {
    id: 'light',
    name: 'Light',
    type: 'light',
    colors: {
      primary: '#ebeeee',
      accent: '#1976d2',
      background: '#ffffff',
      surface: '#ebeeee',
      text: '#000000'
    },
    gradient: ['#ebeeee', '#f5f5f5', '#fdfbfb']
  },
  {
    id: 'aqua',
    name: 'Aqua',
    type: 'light',
    colors: {
      primary: '#d8fffe',
      accent: '#00bcd4',
      background: '#fefeff',
      surface: '#d8fffe',
      text: '#000000'
    },
    gradient: ['#d8fffe', '#eafffe', '#fefeff']
  }
];

export default function ThemeSelector({ isEmbedded = false, onClose }: ThemeSelectorProps) {
  const [selectedTheme, setSelectedTheme] = useState<string>('splitfin');
  const [companyTheme, setCompanyTheme] = useState<Theme | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem('selectedTheme') || 'splitfin';
    setSelectedTheme(savedTheme);
    
    // Load current user and their company theme
    loadUserAndCompanyTheme();
  }, []);

  const loadUserAndCompanyTheme = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Get user details
      const { data: userData } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('auth_user_id', authUser.id)
        .single();

      if (userData) {
        setUser(userData);
        
        // Create company theme if user has a company
        if (userData.companies) {
          const company = userData.companies;
          const companyTheme: Theme = {
            id: 'company',
            name: `${company.name} Theme`,
            type: 'dark', // Assume dark for now
            colors: {
              primary: company.brand_colors.primary,
              accent: company.brand_colors.primary,
              background: '#0f1419',
              surface: company.brand_colors.primary,
              text: '#ffffff'
            },
            gradient: company.brand_colors.gradient
          };
          setCompanyTheme(companyTheme);
        }
      }
    } catch (error) {
      console.error('Error loading user theme:', error);
    }
  };

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    // Apply CSS variables
    root.style.setProperty('--theme-name', theme.id);
    root.style.setProperty('--theme-type', theme.type);
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--bg-primary', theme.colors.background);
    root.style.setProperty('--bg-secondary', theme.colors.surface);
    root.style.setProperty('--text-primary', theme.colors.text);
    
    // Apply light theme specific overrides
    if (theme.type === 'light') {
      root.style.setProperty('--text-secondary', 'rgba(0, 0, 0, 0.7)');
      root.style.setProperty('--text-tertiary', 'rgba(0, 0, 0, 0.5)');
      root.style.setProperty('--text-muted', 'rgba(0, 0, 0, 0.4)');
      root.style.setProperty('--border-primary', 'rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--bg-hover', 'rgba(0, 0, 0, 0.05)');
      root.style.setProperty('--bg-active', `rgba(${theme.colors.accent.replace('#', '').match(/.{1,2}/g)?.map(hex => parseInt(hex, 16)).join(', ')}, 0.1)`);
    } else {
      // Reset to dark theme defaults
      root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.7)');
      root.style.setProperty('--text-tertiary', 'rgba(255, 255, 255, 0.5)');
      root.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.4)');
      root.style.setProperty('--border-primary', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--bg-hover', 'rgba(255, 255, 255, 0.05)');
      root.style.setProperty('--bg-active', 'rgba(121, 213, 233, 0.1)');
    }
    
    // Apply gradient
    root.style.setProperty('--sidebar-gradient', 
      `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]}, ${theme.gradient[2]})`);
    
    // Set logo based on theme type
    const logoPath = theme.type === 'light' ? '/logos/splitfin.svg' : '/logos/splitfinrow.png';
    root.style.setProperty('--logo-url', logoPath);
    
    // Update all logo images with requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      const logoImages = document.querySelectorAll('.master-logo-image, .master-mobile-logo');
      logoImages.forEach((img) => {
        if (img instanceof HTMLImageElement) {
          img.src = logoPath;
        }
      });
    });
  };

  const handleThemeSelect = (themeId: string) => {
    // DISABLED: Theme switching is temporarily disabled
    console.log('Theme switching disabled - would have selected:', themeId);
    
    // Still update visual selection for UI feedback
    setSelectedTheme(themeId);
    
    if (onClose && isEmbedded) {
      onClose();
    }
  };

  const availableThemes = [
    ...BUILTIN_THEMES,
    ...(companyTheme ? [companyTheme] : [])
  ];

  return (
    <div className={`theme-selector ${isEmbedded ? 'embedded' : 'standalone'}`}>
      <div className="theme-selector-header">
        <h3>Choose Theme</h3>
        {isEmbedded && onClose && (
          <button onClick={onClose} className="theme-close-btn">×</button>
        )}
      </div>
      
      <div className="theme-options">
        {availableThemes.map(theme => (
          <div 
            key={theme.id}
            className={`theme-option ${selectedTheme === theme.id ? 'selected' : ''}`}
            onClick={() => handleThemeSelect(theme.id)}
          >
            <div className="theme-preview">
              <div 
                className="theme-preview-gradient"
                style={{
                  background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]}, ${theme.gradient[2]})`
                }}
              />
              <div 
                className="theme-preview-accent"
                style={{ backgroundColor: theme.colors.accent }}
              />
            </div>
            <div className="theme-info">
              <h4>{theme.name}</h4>
              <p>{theme.type === 'light' ? 'Light Theme' : 'Dark Theme'}</p>
            </div>
            {selectedTheme === theme.id && (
              <div className="theme-selected-indicator">✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}