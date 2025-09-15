import React, { createContext, useContext, ReactNode } from 'react';

type ColorOption = 'primary' | 'secondary' | 'tertiary' | 'fourth' | 'fifth' | 'sixth' | 'seventh' | 'eighth' | 'ninth' | 'tenth' | 'eleventh' | 'multicolored';

interface ColorContextType {
  barChartColors: ColorOption;
  graphColors: { primary: string; secondary: string; tertiary: string };
  getChartColors: () => string[];
  getMetricCardColor: (index?: number) => string;
}

const ColorContext = createContext<ColorContextType | undefined>(undefined);

// Define all color options
const colorPalette = {
  primary: '#79d5e9',    // Light Blue
  secondary: '#799de9',  // Secondary Blue
  tertiary: '#79e9c5',   // Teal
  fourth: '#FF9F00',     // Orange
  fifth: '#C96868',      // Coral
  sixth: '#4daeac',      // Turquoise
  seventh: '#61bc8e',    // Green
  eighth: '#fbbf24',     // Yellow
  ninth: '#dc2626',      // Red
  tenth: '#8b5cf6',      // Purple
  eleventh: '#ec4899'    // Pink
};

export const useColors = () => {
  const context = useContext(ColorContext);
  if (!context) {
    // Return default values when used outside of ColorProvider
    console.warn('useColors used outside of ColorProvider, returning defaults');
    return {
      barChartColors: 'primary' as const,
      graphColors: {
        primary: '#79d5e9',
        secondary: '#4daeac',
        tertiary: '#f77d11'
      },
      getChartColors: () => ['#79d5e9'],
      getMetricCardColor: (index: number = 0) => '#79d5e9'
    };
  }
  return context;
};

interface ColorProviderProps {
  children: ReactNode;
  barChartColors: ColorOption;
  graphColors: { primary: string; secondary: string; tertiary: string };
}

export const ColorProvider: React.FC<ColorProviderProps> = ({
  children,
  barChartColors,
  graphColors
}) => {
  // Multicolored palette using all colors
  const multicoloredPalette = Object.values(colorPalette);

  const getChartColors = () => {
    if (barChartColors === 'multicolored') {
      return multicoloredPalette;
    }
    
    // For single color options, return the selected color
    return [colorPalette[barChartColors] || colorPalette.primary];
  };

  const getMetricCardColor = (index: number = 0) => {
    if (barChartColors === 'multicolored') {
      return multicoloredPalette[index % multicoloredPalette.length];
    }
    
    // For single color options, always return the selected color
    return colorPalette[barChartColors] || colorPalette.primary;
  };

  return (
    <ColorContext.Provider value={{
      barChartColors,
      graphColors,
      getChartColors,
      getMetricCardColor
    }}>
      {children}
    </ColorContext.Provider>
  );
};