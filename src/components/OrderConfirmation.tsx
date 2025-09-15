// src/components/OrderConfirmation.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ProgressBar } from './ProgressBar';
import { 
  CheckCircle, 
  Mail, 
  Clock,
  ArrowRight,
  Home
} from 'lucide-react';
import styles from './OrderConfirmation.module.css';
import { withLoader } from '../hoc/withLoader';

function OrderConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    if (location.state) {
      setOrderDetails(location.state);
    } else {
      navigate('/');
    }
  }, [location.state, navigate]);

  if (!orderDetails) {
    return null;
  }

  return (
    <div className={styles.orderConfirmationPage}>
      {/* Progress Bar */}
      <div className={styles.progressBarContainer}>
        <ProgressBar currentStep={5} theme="dark" />
      </div>
      
      <div className={styles.confirmationContainer}>
        <div className={styles.confirmationHero}>
          <div className={styles.successAnimation}>
            <div className={styles.successCircle}>
              <CheckCircle className={styles.checkIcon} />
            </div>
          </div>
          
          <h1>Order Successfully Placed!</h1>
          <p className={styles.heroSubtitle}>
            Thank you for your order. We've sent a confirmation email to {orderDetails.customer?.email || orderDetails.customer?.display_name}
          </p>
          
          <div className={styles.orderReference}>
            <span className={styles.orderLabel}>Order Number</span>
            <span className={styles.orderNumber}>{orderDetails.orderNumber}</span>
          </div>
        </div>

        <div className={styles.confirmationDetails}>
          <div className={styles.detailCard}>
            <h2>What Happens Next?</h2>
            <div className={styles.timeline}>
              <div className={`${styles.timelineItem} ${styles.active}`}>
                <CheckCircle size={20} />
                <div>
                  <h3>Order Received</h3>
                  <p>We've received your order and sent you a confirmation email</p>
                </div>
              </div>
              <div className={styles.timelineItem}>
                <Clock size={20} />
                <div>
                  <h3>Processing</h3>
                  <p>We're preparing your order for shipment</p>
                </div>
              </div>
              <div className={styles.timelineItem}>
                <Mail size={20} />
                <div>
                  <h3>Customer Account</h3>
                  <p>Check your email for login details to track your order</p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <button onClick={() => navigate('/')} className={styles.btnSecondary}>
              <Home size={18} />
              Back to Dashboard
            </button>
            <button onClick={() => navigate(`/select-brand/${orderDetails.customer?.id}`)} className={styles.btnPrimary}>
              Start New Order
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withLoader(OrderConfirmation);