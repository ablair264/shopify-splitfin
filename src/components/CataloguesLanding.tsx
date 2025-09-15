// src/components/CataloguesLanding.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Download } from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { ProgressLoader } from './ProgressLoader';
import styles from './CataloguesLanding.module.css';

interface Catalogue {
  id: string;
  brand: string;
  year: string;
  pdf: string;
  logoUrl: string;
  color: string;
  needsInvert: boolean;
}

export default function CataloguesLanding() {
  const [catalogues, setCatalogues] = useState<Catalogue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCatalogues();
  }, []);

  const loadCatalogues = async () => {
    try {
      const catalogues: Catalogue[] = [
        // Elvang
        { 
          id: 'elvang',
          brand: 'Elvang', 
          year: '2025', 
          pdf: '/catalogues/Elvang/elvang_2025.pdf',
          logoUrl: '/logos/elvang.png',
          color: '#C4A274',
          needsInvert: false
        },
        // PPD
        { 
          id: 'ppd',
          brand: 'PPD', 
          year: '2025', 
          pdf: '/catalogues/PPD/ppd_2025.pdf',
          logoUrl: '/logos/ppd.png',
          color: '#8E24AA',
          needsInvert: false
        },
        // My Flame
        { 
          id: 'myflame-fw',
          brand: 'My Flame', 
          year: 'F/W 2025', 
          pdf: '/catalogues/My Flame/myflame_fw.pdf',
          logoUrl: '/logos/myflame.png',
          color: '#F4A460',
          needsInvert: false
        },
        { 
          id: 'myflame-ss',
          brand: 'My Flame', 
          year: 'S/S 2025', 
          pdf: '/catalogues/My Flame/myflame_ss.pdf',
          logoUrl: '/logos/myflame.png',
          color: '#FFB74D',
          needsInvert: false
        },
        // Räder
        { 
          id: 'rader-easter',
          brand: 'Räder', 
          year: 'Easter 2025', 
          pdf: '/catalogues/Rader/easter_2025.pdf',
          logoUrl: '/logos/rader.png',
          color: '#8B6DB5',
          needsInvert: false
        },
        { 
          id: 'rader-everyday',
          brand: 'Räder', 
          year: 'Everyday 2025', 
          pdf: '/catalogues/Rader/everyday_2025.pdf',
          logoUrl: '/logos/rader.png',
          color: '#9575CD',
          needsInvert: false
        },
        { 
          id: 'rader-novelties',
          brand: 'Räder', 
          year: 'Novelties 2025', 
          pdf: '/catalogues/Rader/novelties_2025.pdf',
          logoUrl: '/logos/rader.png',
          color: '#7E57C2',
          needsInvert: false
        },
        { 
          id: 'rader-trevoly',
          brand: 'Räder', 
          year: 'Trevoly 2025', 
          pdf: '/catalogues/Rader/trevoly_2025.pdf',
          logoUrl: '/logos/rader.png',
          color: '#673AB7',
          needsInvert: false
        },
        { 
          id: 'rader-xmas',
          brand: 'Räder', 
          year: 'Christmas 2025', 
          pdf: '/catalogues/Rader/xmas_2025.pdf',
          logoUrl: '/logos/rader.png',
          color: '#512DA8',
          needsInvert: false
        },
        // Relaxound
        { 
          id: 'relaxound',
          brand: 'Relaxound', 
          year: '2025', 
          pdf: '/catalogues/Relaxound/relaxound_2025.pdf',
          logoUrl: '/logos/relaxound.png',
          color: '#6FBE89',
          needsInvert: false
        },
        // Remember
        { 
          id: 'remember-main',
          brand: 'Remember', 
          year: '2025', 
          pdf: '/catalogues/Remember/remember_2025.pdf',
          logoUrl: '/logos/remember.png',
          color: '#E6A4C4',
          needsInvert: false
        },
        { 
          id: 'remember-aw',
          brand: 'Remember', 
          year: 'A/W 2025', 
          pdf: '/catalogues/Remember/remember_aw.pdf',
          logoUrl: '/logos/remember.png',
          color: '#D1879C',
          needsInvert: false
        }
      ];

      setCatalogues(catalogues);
    } catch (error) {
      console.error('Error loading catalogues:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ProgressLoader
        isVisible={true}
        message="Loading catalogues..."
        progress={50}
      />
    );
  }

  return (
    <div className={styles.cataloguesPage}>
      <div className={styles.gradientOverlay} />
      <div className={styles.floatingAccent} />
      
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.pageTitle}>Catalogue Library</h1>
          <p className={styles.pageSubtitle}>Browse our collection of brand catalogues and product guides</p>
        </div>
      </div>

      <div className={styles.bookcase}>
        {/* Group catalogues by brand */}
        {(() => {
          const groupedByBrand = catalogues.reduce((acc, catalogue) => {
            if (!acc[catalogue.brand]) {
              acc[catalogue.brand] = [];
            }
            acc[catalogue.brand].push(catalogue);
            return acc;
          }, {} as Record<string, Catalogue[]>);

          return Object.entries(groupedByBrand).map(([brand, brandCatalogues], shelfIndex) => (
            <div key={brand} className={styles.shelf}>
              <div className={styles.booksRow}>
                {brandCatalogues.map((catalogue, index) => (
                  <div
                    key={catalogue.id}
                    className={styles.book}
                    style={{
                      '--animation-delay': `${(shelfIndex * brandCatalogues.length + index) * 0.1}s`,
                      background: `linear-gradient(145deg, ${catalogue.color} 0%, ${catalogue.color}cc 100%)`
                    } as React.CSSProperties}
                  >
                    <div className={styles.bookSpine}>
                      <div className={styles.bookYear}>{catalogue.year}</div>
                      <img
                        src={catalogue.logoUrl}
                        alt={`${catalogue.brand} logo`}
                        className={catalogue.needsInvert ? styles.logoInverted : styles.logo}
                      />
                    </div>
                    
                    <div className={styles.bookCover}>
                      <div className={styles.bookActions}>
                        <button className={styles.quickAction} title="Quick View">
                          <Eye size={18} />
                        </button>
                        <button className={styles.quickAction} title="Download">
                          <Download size={18} />
                        </button>
                      </div>
                    </div>
                    
                    <div className={styles.pageTurn} />
                  </div>
                ))}
              </div>
              <div className={styles.shelfBoard} />
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
