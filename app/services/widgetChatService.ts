import config from "../config/app.config";

interface Message {
  content: string;
}

interface ApiResponse {
  id: number;
  conversation: {
    id: number;
    conversation_id: string;
    status: string;
    slots: Record<string, any>;
  };
  type: string;
  text: string;
  cost: string;
  data: Record<string, any>;
}

class WidgetChatService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private lastMessageId: number | null = null;
  private currentUserId: string | null = null;
  private isIntentionalDisconnect: boolean = false;

  constructor() {
    // Initial connection will be made when widget is opened
  }

  public initializeConnection(userId: string) {
    console.log('WidgetService: Initializing connection for userId:', userId);
    if (!this.ws || this.currentUserId !== userId) {
      this.connect(userId);
    } else {
      console.log('WidgetService: Connection already exists for userId:', userId);
    }
  }

  private connect(userId: string) {
    console.log('WidgetService: Connecting to WebSocket for userId:', userId);
    if (this.ws) {
      this.isIntentionalDisconnect = true;
      this.ws.close();
    }

    this.currentUserId = userId;
    this.ws = new WebSocket(`wss://leadgen-chatbot-v1.jazeeautomation.com/ws/user/${userId}/`);

    this.ws.onopen = () => {
      console.log('WidgetService: WebSocket Connected for userId:', userId);
      this.isIntentionalDisconnect = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WidgetService: Received WebSocket data:", data)
        
        // Function to recursively search for action="open_url" in any object
        const findOpenUrlAction = (obj: any): { action?: string; url?: string } => {
          if (!obj || typeof obj !== 'object') return {};
          
          // Check if this object has action="open_url"
          if (obj.action === 'open_url' && obj.url) {
            return { action: obj.action, url: obj.url };
          }
          
          // Recursively search in all properties
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const result = findOpenUrlAction(obj[key]);
              if (result.action && result.url) {
                return result;
              }
            }
          }
          
          return {};
        };
        
        // Search for action="open_url" in the entire message
        const openUrlData = findOpenUrlAction(data);
        
        // Process all WebSocket messages including privacy consent
        if (data && data.event !== 'message') {
          const data1 = JSON.parse(data.event);
          console.log("🚀 ~ WidgetChatService ~ connect ~ data1:", data1)
          
          // Check for event.type === "action" and event.action === "open_url"
          let eventAction: string | undefined;
          let eventUrl: string | undefined;
          
          if (data1.event && data1.event.type === 'action' && data1.event.action === 'open_url') {
            eventAction = data1.event.action;
            eventUrl = data1.event.url;
          } else if (data1.event && data1.event.type === 'action' && data1.event.action === 'close_url') {
            eventAction = data1.event.action;
            // No URL needed for close_url action
          }
          
          // Filter out system messages that shouldn't be displayed
          const systemMessagesToFilter = [
            'Connection confirmed for webpage',
            'Connection established',
            'WebSocket connected',
            'Connection message'
          ];
          
          const shouldFilter = systemMessagesToFilter.some(filterText => 
            data1.text && data1.text.includes(filterText)
          );
          
          if (!shouldFilter && data1.text) {
            console.log('WidgetService: Processing message with content:', data1.text);
            this.messageHandlers.forEach(handler => handler({
              message: {
                content: data1.text,
                type: data1.type || 'system',
                conversation: data1.conversation_id,
                action: eventAction || openUrlData.action,
                url: eventUrl || openUrlData.url,
                eventType: data1.event?.type,
                eventAction: data1.event?.action
              }
            }));
          } else if (eventAction && eventUrl) {
            // Send action event even if there's no text content
            console.log('WidgetService: Processing action event:', eventAction, eventUrl);
            this.messageHandlers.forEach(handler => handler({
              message: {
                content: null,
                type: 'action',
                conversation: data1.conversation_id,
                action: eventAction,
                url: eventUrl,
                eventType: data1.event?.type,
                eventAction: data1.event?.action
              }
            }));
          } else if (eventAction === 'close_url') {
            // Send close_url action event
            console.log('WidgetService: Processing close_url action');
            this.messageHandlers.forEach(handler => handler({
              message: {
                content: null,
                type: 'action',
                conversation: data1.conversation_id,
                action: eventAction,
                url: undefined,
                eventType: data1.event?.type,
                eventAction: data1.event?.action
              }
            }));
          }
        } else if (data && data.type === 'message') {
          // Handle direct message type - filter out connection messages
          const messageContent = data.message || data.event || 'Connection message';
          
          // Filter out various system messages that shouldn't be displayed
          const systemMessagesToFilter = [
            'Connection confirmed for webpage',
            'Connection established',
            'WebSocket connected',
            'Connection message'
          ];
          
          const shouldFilter = systemMessagesToFilter.some(filterText => 
            messageContent.includes(filterText)
          );
          
          if (!shouldFilter) {
            console.log('WidgetService: Processing direct message:', messageContent);
            this.messageHandlers.forEach(handler => handler({
              message: {
                content: messageContent,
                type: 'system',
                conversation: null,
                action: openUrlData.action,
                url: openUrlData.url
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error parsing Widget WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Widget WebSocket Error:', error);
    };

    this.ws.onclose = () => {
      console.log('Widget WebSocket Disconnected');
      // Only attempt to reconnect if it wasn't an intentional disconnect
      if (!this.isIntentionalDisconnect) {
        setTimeout(() => this.connect(userId), config.websocket.reconnectInterval);
      }
    };
  }

  public async sendMessage(message: string, userId: string, conversationId: string): Promise<void> {
    console.log('WidgetService: Sending message:', { message, userId, conversationId });
    // Ensure WebSocket is connected
    this.initializeConnection(userId);

    const payload = {
      message: {
        content: message
      }
    };

    try {
      // Send via API
      const response = await fetch(`https://leadgen-chatbot-v1.jazeeautomation.com/conversation/${userId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse[] = await response.json();
      console.log('WidgetService: API Response:', data);

      // Process the response and notify handlers
      if (data && data.length > 0) {
        const lastMessage = data[data.length - 1];
        
        // Check for action="open_url" in the response data
        let action: string | undefined;
        let url: string | undefined;
        
        // Function to recursively search for action and url in any object
        const findActionAndUrl = (obj: any): { action?: string; url?: string } => {
          if (!obj || typeof obj !== 'object') return {};
          
          // Check if this object has action and url
          if (obj.action && obj.url) {
            return { action: obj.action, url: obj.url };
          }
          
          // Check for action="open_url" or action="close_url" format in text
          if (typeof obj === 'string' && obj.includes('action=')) {
            const actionMatch = obj.match(/action="?([^"\s]+)"?/);
            const urlMatch = obj.match(/url="?([^"\s]+)"?/);
            if (actionMatch) {
              return { action: actionMatch[1], url: urlMatch ? urlMatch[1] : undefined };
            }
          }
          
          // Recursively search in all properties
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const result = findActionAndUrl(obj[key]);
              if (result.action) {
                return result;
              }
            }
          }
          
          return {};
        };
        
        // Search for action and url in the entire response
        const actionData = findActionAndUrl(data);
        action = actionData.action;
        url = actionData.url;
        
        // Also check in the text content for action format
        if (lastMessage.text && lastMessage.text.includes('action=')) {
          const actionMatch = lastMessage.text.match(/action="?([^"\s]+)"?/);
          const urlMatch = lastMessage.text.match(/url="?([^"\s]+)"?/);
          if (actionMatch) {
            action = actionMatch[1];
            url = urlMatch ? urlMatch[1] : undefined;
          }
        }
        
        // Only send the message if it has content
        if (lastMessage.text) {
          console.log('WidgetService: Processing API response message:', lastMessage.text);
          this.messageHandlers.forEach(handler => handler({
            message: {
              content: lastMessage.text,
              type: lastMessage.type,
              conversation: lastMessage.conversation,
              action: action,
              url: url
            }
          }));
        }
      }
    } catch (error) {
      console.error('WidgetService: API Error:', error);
      // Notify handlers of the error
      this.messageHandlers.forEach(handler => handler({
        message: {
          content: 'Sorry, there was an error processing your message. Please try again.',
          type: 'error',
          conversation: null
        }
      }));
    }

    // Also send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WidgetService: Also sending via WebSocket');
      this.ws.send(JSON.stringify(payload));
    }
  }

  public onMessage(handler: (message: any) => void) {
    console.log('WidgetService: Registering message handler. Total handlers:', this.messageHandlers.length + 1);
    this.messageHandlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
        console.log('WidgetService: Unregistered message handler. Remaining handlers:', this.messageHandlers.length);
      }
    };
  }

  public disconnect() {
    if (this.ws) {
      this.isIntentionalDisconnect = true;
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers = [];
    this.currentUserId = null;
  }

  public isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getUserId() {
    return this.currentUserId;
  }
}

export const widgetChatService = new WidgetChatService(); 