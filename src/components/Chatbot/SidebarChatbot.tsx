import React from 'react';
import { HelpCircle } from 'lucide-react';
import './Chatbot.css';

interface SidebarChatbotProps {
  onToggle: () => void;
}

const SidebarChatbot: React.FC<SidebarChatbotProps> = ({ onToggle }) => {
  return (
    <div className="sidebar-chatbot">
      <button className="sidebar-chatbot-toggle" onClick={onToggle}>
        <HelpCircle size={20} />
      </button>
    </div>
  );
};

export default SidebarChatbot;