import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, Search, Phone, Video, MoreVertical, Paperclip } from 'lucide-react';
import { supabase } from '../../services/supabaseService';
import styles from './Messaging.module.css';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  company_id: string;
  avatar_url?: string;
  is_online?: boolean;
  last_seen?: string;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  read_at?: string;
  message_type: 'text' | 'image' | 'file';
  sender?: User;
}

interface Conversation {
  user: User;
  lastMessage?: Message;
  unreadCount: number;
}

const Messaging: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeMessaging();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  // Set up real-time subscription for messages
  useEffect(() => {
    if (!currentUser || !selectedConversation) return;

    const subscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${currentUser.id},recipient_id.eq.${selectedConversation.id}),and(sender_id.eq.${selectedConversation.id},recipient_id.eq.${currentUser.id}))`
        },
        async (payload) => {
          console.log('New message received:', payload);
          
          // Get the full message data with sender info
          const { data: newMessageData } = await supabase
            .from('messages_with_users')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (newMessageData) {
            const formattedMessage: Message = {
              id: newMessageData.id,
              content: newMessageData.content,
              sender_id: newMessageData.sender_id,
              recipient_id: newMessageData.recipient_id,
              created_at: newMessageData.created_at,
              read_at: newMessageData.read_at,
              message_type: newMessageData.message_type,
              sender: {
                id: newMessageData.sender_id,
                first_name: newMessageData.sender_first_name,
                last_name: newMessageData.sender_last_name,
                email: newMessageData.sender_email,
                role: '',
                company_id: newMessageData.company_id || '',
                avatar_url: newMessageData.sender_avatar_url
              }
            };

            // Only add if it's not from the current user (to avoid duplicates)
            if (newMessageData.sender_id !== currentUser.id) {
              setMessages(prev => [...prev, formattedMessage]);
              // Mark as read if conversation is active
              await markMessagesAsRead(newMessageData.sender_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUser, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeMessaging = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Get current user details
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, company_id, is_active, last_login')
        .eq('auth_user_id', authUser.id)
        .single();

      if (userData) {
        setCurrentUser(userData);
        await loadCompanyUsers(userData.company_id);
      }
    } catch (error) {
      console.error('Error initializing messaging:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyUsers = async (companyId: string) => {
    try {
      console.log('Loading users for company:', companyId);
      console.log('Current user:', currentUser);
      
      const { data: users, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, company_id, is_active, last_login')
        .eq('company_id', companyId)
        .eq('is_active', true);

      console.log('All users query result:', { users, error });

      if (error) {
        console.error('Error querying users:', error);
        return;
      }

      if (users) {
        // Filter out current user
        const filteredUsers = users.filter(user => user.id !== currentUser?.id);
        console.log('Filtered users (excluding current):', filteredUsers);
        
        // Create conversations from company users
        const convos: Conversation[] = filteredUsers.map(user => ({
          user,
          unreadCount: 0 // TODO: Calculate actual unread count
        }));
        
        console.log('Created conversations:', convos);
        setConversations(convos);
      }
    } catch (error) {
      console.error('Error loading company users:', error);
    }
  };

  const markMessagesAsRead = async (senderId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', senderId)
        .eq('recipient_id', currentUser.id)
        .is('read_at', null);

      if (error) {
        console.error('Error marking messages as read:', error);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadMessages = async (recipientId: string) => {
    if (!currentUser) return;

    try {
      console.log('Loading messages between:', currentUser.id, 'and', recipientId);
      
      const { data: messagesData, error } = await supabase
        .from('messages_with_users')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      console.log('Loaded messages:', messagesData);
      
      if (messagesData) {
        const formattedMessages: Message[] = messagesData.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender_id: msg.sender_id,
          recipient_id: msg.recipient_id,
          created_at: msg.created_at,
          read_at: msg.read_at,
          message_type: msg.message_type,
          sender: {
            id: msg.sender_id,
            first_name: msg.sender_first_name,
            last_name: msg.sender_last_name,
            email: msg.sender_email,
            role: '', // Not included in view, but not needed for display
            company_id: msg.company_id || '',
            avatar_url: msg.sender_avatar_url
          }
        }));
        
        setMessages(formattedMessages);
        
        // Mark messages as read
        await markMessagesAsRead(recipientId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      // Create the message object to insert
      const messageToSend = {
        content: messageContent,
        sender_id: currentUser.id,
        recipient_id: selectedConversation.id,
        company_id: currentUser.company_id,
        message_type: 'text' as const
      };

      console.log('Sending message:', messageToSend);

      // Insert into database
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert([messageToSend])
        .select(`
          *,
          sender:users!sender_id(id, first_name, last_name, email, avatar_url)
        `)
        .single();

      if (error) {
        console.error('Error sending message:', error);
        // Restore the message in input if failed
        setNewMessage(messageContent);
        return;
      }

      console.log('Message sent successfully:', insertedMessage);

      // Add the message to local state
      if (insertedMessage) {
        const formattedMessage: Message = {
          id: insertedMessage.id,
          content: insertedMessage.content,
          sender_id: insertedMessage.sender_id,
          recipient_id: insertedMessage.recipient_id,
          created_at: insertedMessage.created_at,
          read_at: insertedMessage.read_at,
          message_type: insertedMessage.message_type,
          sender: insertedMessage.sender
        };

        setMessages(prev => [...prev, formattedMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restore message on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className={styles.messagingContainer}>
      {/* Sidebar - Conversations List */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.headerTitle}>
            <Users size={20} />
            <h2>Messages</h2>
          </div>
        </div>

        <div className={styles.searchContainer}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.conversationsList}>
          {filteredConversations.map(conversation => (
            <div
              key={conversation.user.id}
              className={`${styles.conversationItem} ${
                selectedConversation?.id === conversation.user.id ? styles.active : ''
              }`}
              onClick={() => setSelectedConversation(conversation.user)}
            >
              <div className={styles.avatar}>
                {conversation.user.avatar_url ? (
                  <img src={conversation.user.avatar_url} alt="Avatar" />
                ) : (
                  <span>{getInitials(conversation.user.first_name, conversation.user.last_name)}</span>
                )}
                <div className={`${styles.onlineStatus} ${conversation.user.is_online ? styles.online : styles.offline}`}></div>
              </div>
              
              <div className={styles.conversationContent}>
                <div className={styles.conversationHeader}>
                  <h4>{conversation.user.first_name} {conversation.user.last_name}</h4>
                  <span className={styles.role}>{conversation.user.role}</span>
                </div>
                {conversation.lastMessage && (
                  <p className={styles.lastMessage}>{conversation.lastMessage.content}</p>
                )}
              </div>

              {conversation.unreadCount > 0 && (
                <div className={styles.unreadBadge}>
                  {conversation.unreadCount}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.chatArea}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className={styles.chatHeader}>
              <div className={styles.chatUserInfo}>
                <div className={styles.avatar}>
                  {selectedConversation.avatar_url ? (
                    <img src={selectedConversation.avatar_url} alt="Avatar" />
                  ) : (
                    <span>{getInitials(selectedConversation.first_name, selectedConversation.last_name)}</span>
                  )}
                  <div className={`${styles.onlineStatus} ${selectedConversation.is_online ? styles.online : styles.offline}`}></div>
                </div>
                <div>
                  <h3>{selectedConversation.first_name} {selectedConversation.last_name}</h3>
                  <p className={styles.userStatus}>
                    {selectedConversation.is_online ? 'Online' : 'Last seen recently'}
                  </p>
                </div>
              </div>
              
              <div className={styles.chatActions}>
                <button className={styles.actionButton}>
                  <Phone size={18} />
                </button>
                <button className={styles.actionButton}>
                  <Video size={18} />
                </button>
                <button className={styles.actionButton}>
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className={styles.messagesContainer}>
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`${styles.messageWrapper} ${
                    message.sender_id === currentUser?.id ? styles.sent : styles.received
                  }`}
                >
                  <div className={styles.message}>
                    <p>{message.content}</p>
                    <span className={styles.messageTime}>
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className={styles.messageInput}>
              <button className={styles.attachButton}>
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className={styles.textInput}
              />
              <button 
                className={styles.sendButton}
                onClick={sendMessage}
                disabled={!newMessage.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <Users size={64} />
            <h3>Select a conversation</h3>
            <p>Choose a team member to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messaging;