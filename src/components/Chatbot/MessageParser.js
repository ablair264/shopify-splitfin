class MessageParser {
  constructor(actionProvider) {
    this.actionProvider = actionProvider;
  }

  parse(message) {
    const lowerCaseMessage = message.toLowerCase();

    // Greeting patterns
    if (this.isGreeting(lowerCaseMessage)) {
      this.actionProvider.handleHello();
    }
    // Help patterns
    else if (this.isHelpRequest(lowerCaseMessage)) {
      this.actionProvider.handleHelp();
    }
    // Statistics and data queries
    else if (this.isStatsQuery(lowerCaseMessage)) {
      console.log('Chatbot: MessageParser routing to handleBusinessStats for:', message);
      this.actionProvider.handleBusinessStats();
    }
    // Product/Inventory related
    else if (this.isProductQuery(lowerCaseMessage)) {
      this.actionProvider.handleProducts(message);
    }
    // Order related
    else if (this.isOrderQuery(lowerCaseMessage)) {
      this.actionProvider.handleOrders(message);
    }
    // Customer related
    else if (this.isCustomerQuery(lowerCaseMessage)) {
      this.actionProvider.handleCustomers(message);
    }
    // Navigation help
    else if (this.isNavigationQuery(lowerCaseMessage)) {
      this.actionProvider.handleNavigation(message);
    }
    // Analytics/Dashboard
    else if (this.isAnalyticsQuery(lowerCaseMessage)) {
      this.actionProvider.handleAnalytics();
    }
    // Quick actions
    else if (this.isQuickActionQuery(lowerCaseMessage)) {
      this.actionProvider.handleQuickActions();
    }
    // General knowledge base search
    else {
      console.log('Chatbot: MessageParser routing to handleKnowledgeSearch for:', message);
      this.actionProvider.handleKnowledgeSearch(message);
    }
  }

  isGreeting(message) {
    const greetingPatterns = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    return greetingPatterns.some(pattern => message.includes(pattern));
  }

  isHelpRequest(message) {
    const helpPatterns = ['help', 'assist', 'support', 'what can you do', 'how do i'];
    return helpPatterns.some(pattern => message.includes(pattern));
  }

  isStatsQuery(message) {
    const statsPatterns = [
      'how many', 'total', 'count', 'statistics', 'stats', 'overview',
      'business summary', 'dashboard summary', 'performance'
    ];
    return statsPatterns.some(pattern => message.includes(pattern));
  }

  isProductQuery(message) {
    const productPatterns = [
      'product', 'inventory', 'stock', 'item', 'price', 'supplier',
      'add product', 'create product', 'product list', 'top products'
    ];
    return productPatterns.some(pattern => message.includes(pattern));
  }

  isOrderQuery(message) {
    const orderPatterns = [
      'order', 'enquiry', 'quote', 'sale', 'purchase', 'recent orders',
      'create order', 'new order', 'order status', 'order history'
    ];
    return orderPatterns.some(pattern => message.includes(pattern));
  }

  isCustomerQuery(message) {
    const customerPatterns = [
      'customer', 'client', 'company', 'contact', 'lead',
      'add customer', 'create customer', 'customer list'
    ];
    return customerPatterns.some(pattern => message.includes(pattern));
  }

  isNavigationQuery(message) {
    const navPatterns = [
      'how to navigate', 'where is', 'find', 'go to', 'open',
      'dashboard', 'analytics', 'inventory', 'customers', 'orders'
    ];
    return navPatterns.some(pattern => message.includes(pattern));
  }

  isAnalyticsQuery(message) {
    const analyticsPatterns = [
      'analytics', 'dashboard', 'reports', 'metrics', 'charts',
      'insights', 'data visualization', 'performance metrics'
    ];
    return analyticsPatterns.some(pattern => message.includes(pattern));
  }

  isQuickActionQuery(message) {
    const actionPatterns = [
      'quick action', 'shortcut', 'fast way', 'create', 'add', 'new'
    ];
    return actionPatterns.some(pattern => message.includes(pattern));
  }
}

export default MessageParser;