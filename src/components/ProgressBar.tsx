// src/components/ProgressBar.tsx
import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  currentStep: number;
  theme?: 'light' | 'dark';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, theme = 'dark' }) => {
  const steps = [
    { id: 1, label: 'Select Brand' },
    { id: 2, label: 'Browse Items' },
    { id: 3, label: 'Review Order' },
    { id: 4, label: 'Place Order' },
    { id: 5, label: 'Order Confirmed' },
  ];

  const getStepStatus = (stepId: number): 'completed' | 'active' | 'pending' => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'active';
    return 'pending';
  };

  const getStepSubLabel = (stepId: number): string => {
    const status = getStepStatus(stepId);
    if (status === 'completed') return 'Completed';
    if (status === 'active') return 'In Progress';
    return 'Pending';
  };

  return (
    <div className={`${styles.progressBarWrapper} ${styles[theme]}`}>
      <div className={styles.progressBar}>
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className={`${styles.progressStep} ${styles[getStepStatus(step.id)]}`}>
              <div className={styles.stepIndicator}>
                {getStepStatus(step.id) === 'completed' ? (
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <path 
                      d="M1 5L5 9L13 1" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className={styles.stepNumber}>{step.id}</span>
                )}
              </div>
              <div className={styles.stepContent}>
                <span className={styles.stepLabel}>{step.label}</span>
                <span className={styles.stepSubLabel}>{getStepSubLabel(step.id)}</span>
              </div>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`${styles.progressConnector} ${
                getStepStatus(steps[index + 1].id) !== 'pending' ? styles.completed : ''
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};