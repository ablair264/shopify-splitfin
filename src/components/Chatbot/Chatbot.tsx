import React, { useState } from 'react';
import ChatBot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import './Chatbot.css';

import config from './config';
import MessageParser from './MessageParser';
import ActionProvider from './ActionProvider';

const ChatbotComponent: React.FC = () => {
  const [showBot, setShowBot] = useState(false);

  const toggleBot = () => {
    setShowBot(!showBot);
  };

  return (
    <div className="chatbot-container">
      {showBot && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <span>Splitfin Assistant</span>
            <button className="close-btn" onClick={toggleBot}>
              ×
            </button>
          </div>
          <ChatBot
            config={config}
            messageParser={MessageParser}
            actionProvider={ActionProvider}
          />
        </div>
      )}
      <button className="chatbot-toggle" onClick={toggleBot}>
        {showBot ? '✕' : '💬'}
      </button>
    </div>
  );
};

export default ChatbotComponent;