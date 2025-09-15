import { createChatBotMessage } from 'react-chatbot-kit';
import { chatbotService } from '../../services/chatbotService';
import { authService } from '../../services/authService';
import { openaiService } from '../../services/openaiService';
import { supabase } from '../../services/supabaseService';

class ActionProvider {
  constructor(createChatBotMessage, setStateFunc) {
    this.createChatBotMessage = createChatBotMessage;
    this.setState = setStateFunc;
    this.userCompanyId = null;
    this.sessionId = this.generateSessionId();
    this.conversationHistory = [];
    this.businessContext = null;
    this.initializeUser();
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async initializeUser() {
    try {
      const user = await authService.getCurrentUser();
      if (user && user.email) {
        console.log('Chatbot: Initializing for user:', user.email);
        
        // Get the user's company_id from the users table using auth_user_id instead of email
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('company_id, first_name, last_name')
          .eq('auth_user_id', user.id)
          .single();

        if (!userError && userData?.company_id) {
          this.userCompanyId = userData.company_id;
          console.log('Chatbot: Found company ID:', this.userCompanyId);
          await this.loadBusinessContext();
        } else {
          console.warn('Chatbot: No company_id found for user:', user.email, userError);
          
          // Fallback: try to find by email
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('users')
            .select('company_id, first_name, last_name')
            .eq('email', user.email)
            .single();
            
          if (!fallbackError && fallbackData?.company_id) {
            this.userCompanyId = fallbackData.company_id;
            console.log('Chatbot: Found company ID via email fallback:', this.userCompanyId);
            await this.loadBusinessContext();
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize chatbot user:', error);
    }
  }

  async loadBusinessContext() {
    if (!this.userCompanyId) {
      console.warn('Chatbot: No company ID available for loading business context');
      return;
    }
    
    console.log('Chatbot: Loading business context for company:', this.userCompanyId);
    
    try {
      // Load each metric individually with better error handling
      let customerCount = 0;
      let orderCount = 0;
      let productCount = 0;
      let recentOrders = [];
      let topProducts = [];

      try {
        customerCount = await chatbotService.getCustomerCount(this.userCompanyId);
        console.log('Chatbot: Customer count loaded:', customerCount);
      } catch (error) {
        console.error('Chatbot: Failed to load customer count:', error);
      }

      try {
        orderCount = await chatbotService.getOrderCount(this.userCompanyId);
        console.log('Chatbot: Order count loaded:', orderCount);
      } catch (error) {
        console.error('Chatbot: Failed to load order count:', error);
      }

      try {
        productCount = await chatbotService.getProductCount(this.userCompanyId);
        console.log('Chatbot: Product count loaded:', productCount);
      } catch (error) {
        console.error('Chatbot: Failed to load product count:', error);
      }

      try {
        recentOrders = await chatbotService.getRecentOrders(this.userCompanyId, 5);
        console.log('Chatbot: Recent orders loaded:', recentOrders?.length || 0);
      } catch (error) {
        console.error('Chatbot: Failed to load recent orders:', error);
      }

      try {
        topProducts = await chatbotService.getTopProducts(this.userCompanyId, 5);
        console.log('Chatbot: Top products loaded:', topProducts?.length || 0);
      } catch (error) {
        console.error('Chatbot: Failed to load top products:', error);
      }

      this.businessContext = {
        customerCount,
        orderCount,
        productCount,
        recentOrders,
        topProducts,
        companyId: this.userCompanyId
      };
      
      console.log('Chatbot: Business context loaded successfully:', this.businessContext);
    } catch (error) {
      console.error('Chatbot: Critical error loading business context:', error);
      this.businessContext = {
        customerCount: 0,
        orderCount: 0,
        productCount: 0,
        recentOrders: [],
        topProducts: [],
        companyId: this.userCompanyId
      };
    }
  }

  addToConversationHistory(userMessage, botResponse) {
    this.conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: botResponse }
    );
    // Keep only last 10 messages to manage context size
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  }

  async logConversation(message, response) {
    if (!this.userCompanyId) return;
    
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        await chatbotService.logConversation({
          user_id: user.id,
          message,
          response,
          session_id: this.sessionId,
          company_id: this.userCompanyId
        });
      }
    } catch (error) {
      console.error('Failed to log conversation:', error);
    }
  }

  handleHello = async () => {
    const response = 'Hello! How can I help?';
    const botMessage = this.createChatBotMessage(response, {
      widget: "quickActions",
    });
    this.updateChatbotState(botMessage);
    await this.logConversation('hello', response);
  };

  handleHelp = async () => {
    const response = 'I can help you with:\n• Product and inventory management\n• Orders and enquiries\n• Customer information\n• Analytics and dashboard\n• Navigation assistance\n\nJust ask me about any of these topics!';
    const botMessage = this.createChatBotMessage(response, {
      widget: "quickActions",
    });
    this.updateChatbotState(botMessage);
    await this.logConversation('help', response);
  };

  handleBusinessStats = async () => {
    console.log('Chatbot: handleBusinessStats called directly');
    try {
      if (!this.userCompanyId) {
        const errorMessage = 'Please log in to view your business statistics.';
        const botMessage = this.createChatBotMessage(errorMessage);
        this.updateChatbotState(botMessage);
        return;
      }

      const [customerCount, orderCountThisWeek, orderCountThisMonth, productCount, recentOrdersThisWeek, recentOrdersThisMonth] = await Promise.all([
        chatbotService.getCustomerCount(this.userCompanyId),
        chatbotService.getOrderCountThisWeek(this.userCompanyId),
        chatbotService.getOrderCountThisMonth(this.userCompanyId),
        chatbotService.getProductCount(this.userCompanyId),
        chatbotService.getRecentOrdersThisWeek(this.userCompanyId, 3),
        chatbotService.getRecentOrdersThisMonth(this.userCompanyId, 3)
      ]);

      console.log('Chatbot: Direct handleBusinessStats data:');
      console.log('- customerCount:', customerCount);
      console.log('- orderCountThisWeek:', orderCountThisWeek);
      console.log('- orderCountThisMonth:', orderCountThisMonth);
      console.log('- productCount:', productCount);

      const response = `Here's your business performance overview:`;
      const widgetProps = { 
        customerCount, 
        orderCountThisWeek,
        orderCountThisMonth,
        productCount,
        recentOrdersThisWeek,
        recentOrdersThisMonth,
        topProducts: this.businessContext?.topProducts || []
      };
      console.log('Chatbot: Creating widget with props:', widgetProps);
      const botMessage = this.createChatBotMessage(response, {
        widget: "businessStats",
        props: widgetProps
      });
      this.updateChatbotState(botMessage);
      await this.logConversation('business stats', response);
    } catch (error) {
      console.error('Error fetching business stats:', error);
      const errorMessage = 'Sorry, I had trouble fetching your business statistics. Please try again.';
      const botMessage = this.createChatBotMessage(errorMessage);
      this.updateChatbotState(botMessage);
    }
  };

  handleProducts = async (originalMessage) => {
    // Use OpenAI-powered response for all product queries
    return this.handleOpenAIResponse(originalMessage);
  };

  handleOrders = async (originalMessage) => {
    // Use OpenAI-powered response for all order queries
    return this.handleOpenAIResponse(originalMessage);
  };

  handleCustomers = async (originalMessage) => {
    // Use OpenAI-powered response for all customer queries
    return this.handleOpenAIResponse(originalMessage);
  };

  handleAnalytics = async (originalMessage = 'analytics') => {
    // Use OpenAI-powered response for all analytics queries
    return this.handleOpenAIResponse(originalMessage);
  };

  handleNavigation = async (originalMessage) => {
    // Use OpenAI-powered response for all navigation queries
    return this.handleOpenAIResponse(originalMessage);
  };

  handleQuickActions = async () => {
    const response = 'Here are some quick actions you can take:';
    const botMessage = this.createChatBotMessage(response, {
      widget: "quickActions",
    });
    this.updateChatbotState(botMessage);
    await this.logConversation('quick actions', response);
  };

  handleQuickAction = async (action) => {
    // Map actions to more natural questions for OpenAI
    const actionQueries = {
      'create-customer': 'How do I create a new customer in Splitfin?',
      'add-product': 'How do I add a new product to my inventory?',
      'new-order': 'How do I create a new order in Splitfin?',
      'analytics': 'How do I view analytics and reports?'
    };
    
    const query = actionQueries[action];
    if (query) {
      // Use OpenAI to provide a more accurate response
      await this.handleOpenAIResponse(query);
    } else {
      const fallbackResponse = 'I can help you with that task. Please let me know what specific help you need.';
      const botMessage = this.createChatBotMessage(fallbackResponse);
      this.updateChatbotState(botMessage);
      await this.logConversation(`quick action: ${action}`, fallbackResponse);
    }
  };

  // Main OpenAI-powered response handler
  handleOpenAIResponse = async (originalMessage) => {
    if (!this.businessContext) {
      await this.loadBusinessContext();
    }
    
    // If still no business context after loading, create a default one
    if (!this.businessContext) {
      this.businessContext = {
        customerCount: 0,
        orderCount: 0,
        productCount: 0,
        recentOrders: [],
        topProducts: [],
        companyId: this.userCompanyId || ''
      };
    }

    try {
      // Show typing indicator
      const typingMessage = this.createChatBotMessage("🤔 Thinking...");
      this.updateChatbotState(typingMessage);

      const isOpenAIAvailable = await openaiService.isOpenAIAvailable();
      let response;

      if (isOpenAIAvailable) {
        response = await openaiService.generateResponse(
          originalMessage, 
          this.businessContext, 
          this.conversationHistory
        );
      } else {
        // Fallback to knowledge base search
        response = await this.handleKnowledgeSearchFallback(originalMessage);
      }

      // Remove typing indicator and add real response
      this.setState((prevState) => ({
        ...prevState,
        messages: prevState.messages.slice(0, -1), // Remove typing message
      }));

      // Check if response suggests using a widget
      let widget = null;
      let props = null;

      if (response.includes('Business Overview') || response.includes('📊') || originalMessage.toLowerCase().includes('stats') || originalMessage.toLowerCase().includes('overview') || originalMessage.toLowerCase().includes('business')) {
        console.log('Chatbot: Triggering business stats widget with context:', this.businessContext);
        widget = "businessStats";
        props = {
          customerCount: this.businessContext?.customerCount || 0,
          orderCountThisWeek: 0, // Will be loaded separately
          orderCountThisMonth: 0, // Will be loaded separately
          productCount: this.businessContext?.productCount || 0,
          recentOrdersThisWeek: [],
          recentOrdersThisMonth: [],
          topProducts: this.businessContext?.topProducts || []
        };
        console.log('Chatbot: Widget props:', props);
      } else if (response.includes('Recent Orders') || originalMessage.toLowerCase().includes('recent orders') || originalMessage.toLowerCase().includes('recent') || originalMessage.toLowerCase().includes('orders')) {
        widget = "recentOrders";
        props = { orders: this.businessContext.recentOrders };
      }

      const botMessage = this.createChatBotMessage(response, widget ? { widget, props } : {});
      this.updateChatbotState(botMessage);
      
      this.addToConversationHistory(originalMessage, response);
      await this.logConversation(originalMessage, response);

    } catch (error) {
      console.error('Error generating OpenAI response:', error);
      
      // Remove typing indicator
      this.setState((prevState) => ({
        ...prevState,
        messages: prevState.messages.slice(0, -1),
      }));
      
      const fallbackResponse = await this.handleKnowledgeSearchFallback(originalMessage);
      const botMessage = this.createChatBotMessage(fallbackResponse);
      this.updateChatbotState(botMessage);
    }
  };

  handleKnowledgeSearch = async (originalMessage) => {
    // Use OpenAI-powered response as primary method
    return this.handleOpenAIResponse(originalMessage);
  };

  async handleKnowledgeSearchFallback(originalMessage) {
    try {
      console.log('Chatbot: handleKnowledgeSearchFallback called for:', originalMessage);
      
      // Check if this is a business overview request
      const lowerMessage = originalMessage.toLowerCase();
      if (lowerMessage.includes('business') || lowerMessage.includes('overview') || lowerMessage.includes('stats')) {
        console.log('Chatbot: Detected business overview request, redirecting to handleBusinessStats');
        await this.handleBusinessStats();
        return; // Don't return a text response since widget is shown
      }
      
      const knowledgeResults = await chatbotService.searchKnowledge(originalMessage, this.userCompanyId);
      
      if (knowledgeResults.length > 0) {
        return knowledgeResults[0].answer;
      } else {
        return "I'm not sure I understand. I can help you with:\n• Business statistics and overview\n• Product and inventory questions\n• Order and enquiry management\n• Customer information\n• Navigation assistance\n\nTry asking about one of these topics!";
      }
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return "I'm having trouble understanding your question. Can you try rephrasing it or ask about products, orders, customers, or analytics?";
    }
  }

  updateChatbotState(message) {
    this.setState((prevState) => ({
      ...prevState,
      messages: [...prevState.messages, message],
    }));
  }
}

export default ActionProvider;