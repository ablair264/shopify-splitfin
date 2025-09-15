import { createChatBotMessage } from 'react-chatbot-kit';
import BusinessStatsWidget from './widgets/BusinessStatsWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import RecentOrdersWidget from './widgets/RecentOrdersWidget';

const config = {
  initialMessages: [
    createChatBotMessage(`Hello! I'm your Splitfin AI Assistant.`),
    createChatBotMessage(`Try asking:\n• "What's my sales performance?"\n• "Show overdue invoices"\n• "Any low stock items?"\n• "Find customer John Smith"`, {
      widget: "quickActions",
    })
  ],
  botName: "Splitfin Assistant",
  customStyles: {
    botMessageBox: {
      backgroundColor: "#376B7E",
    },
    chatButton: {
      backgroundColor: "#376B7E",
    },
  },
  widgets: [
    {
      widgetName: "businessStats",
      widgetFunc: (props) => {
        console.log('Config: BusinessStats widgetFunc called with props:', props);
        console.log('Config: Props keys:', Object.keys(props || {}));
        
        // Try to find the widget props in the current message
        let widgetProps = {};
        const messages = props?.state?.messages || [];
        const lastMessage = messages[messages.length - 1];
        console.log('Config: Last message:', lastMessage);
        console.log('Config: Last message props:', lastMessage?.props);
        
        if (lastMessage?.props) {
          widgetProps = lastMessage.props;
          console.log('Config: Found props in last message:', widgetProps);
        } else if (lastMessage?.widget?.props) {
          widgetProps = lastMessage.widget.props;
          console.log('Config: Found props in last message widget:', widgetProps);
        } else {
          // Fallback: try to get from the message that triggered this widget
          const businessMessage = messages.find(msg => 
            msg.widget === 'businessStats' && msg.props
          );
          if (businessMessage?.props) {
            widgetProps = businessMessage.props;
            console.log('Config: Found props in business message:', widgetProps);
          }
        }
        
        console.log('Config: Final widget props:', widgetProps);
        return <BusinessStatsWidget 
          customerCount={widgetProps.customerCount || 0}
          orderCount={widgetProps.orderCount || 0}
          productCount={widgetProps.productCount || 0}
        />;
      },
      props: {},
      mapStateToProps: ['messages']
    },
    {
      widgetName: "quickActions", 
      widgetFunc: (props) => <QuickActionsWidget {...props} />,
      props: {},
      mapStateToProps: []
    },
    {
      widgetName: "recentOrders",
      widgetFunc: (props) => <RecentOrdersWidget {...props} />,
      props: {},
      mapStateToProps: []
    }
  ],
};

export default config;