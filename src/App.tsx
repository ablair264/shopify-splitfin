import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import MasterLayout from './layouts/MasterLayout';
import ProgressLoader from './components/ProgressLoader';
import ChatbotWindow from './components/Chatbot/ChatbotWindow';
import { LoaderProvider, useLoader } from './contexts/LoaderContext';
import './App.css';

// Create chatbot context
const ChatbotContext = createContext<{
  showChatbot: boolean;
  toggleChatbot: () => void;
}>({
  showChatbot: false,
  toggleChatbot: () => {},
});

export const useChatbot = () => useContext(ChatbotContext);

function AppContent() {
  const { isLoading, progress, message, showLoader, hideLoader, setProgress } = useLoader();
  const [isAppInitialized, setIsAppInitialized] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  const toggleChatbot = () => {
    console.log('Toggling chatbot, current state:', showChatbot);
    setShowChatbot(!showChatbot);
  };

  // Handle initial app loading
  useEffect(() => {
    showLoader('Initializing Application...');
    
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 20 + 10;
      if (progress > 90) progress = 90;
      setProgress(progress);
    }, 100);

    const timer = setTimeout(() => {
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        hideLoader();
        setIsAppInitialized(true);
      }, 300);
    }, 800); // Initial app load time

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer);
    };
  }, []);

  // Don't render anything until app is initialized
  if (!isAppInitialized) {
    return (
      <ProgressLoader 
        isVisible={true} 
        progress={progress}
        message={message}
        fullscreen={true}
      />
    );
  }

  return (
    <ChatbotContext.Provider value={{ showChatbot, toggleChatbot }}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route 
          path="/*" 
          element={
            <PrivateRoute>
              <MasterLayout />
            </PrivateRoute>
          } 
        />
      </Routes>
      <ProgressLoader 
        isVisible={isLoading} 
        progress={progress}
        message={message}
        fullscreen={true}
      />
      <ChatbotWindow 
        isVisible={showChatbot} 
        onClose={() => setShowChatbot(false)} 
      />
    </ChatbotContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <LoaderProvider>
        <AppContent />
      </LoaderProvider>
    </Router>
  );
}

export default App;