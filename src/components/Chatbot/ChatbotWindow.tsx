import React from 'react';
import ChatBot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import './Chatbot.css';
import { X } from 'lucide-react';

import config from './config';
import MessageParser from './MessageParser';
import ActionProvider from './ActionProvider';

interface ChatbotWindowProps {
  isVisible: boolean;
  onClose: () => void;
}

const ChatbotWindow: React.FC<ChatbotWindowProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="external-chatbot-window">
      <div className="external-chatbot-header">
        <span>Splitfin AI Assistant</span>
        <button className="external-close-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="external-chatbot-content">
        <ChatBot
          config={config}
          messageParser={MessageParser}
          actionProvider={ActionProvider}
        />
      </div>
    </div>
  );
};

export default ChatbotWindow;