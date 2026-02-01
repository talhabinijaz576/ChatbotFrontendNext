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
  private connectionStatusHandlers: ((isConnected: boolean) => void)[] = [];
  private isConnectedState: boolean = false;
  private isConnecting: boolean = false; // Track if we're actively connecting

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
    console.log('🔌 [WidgetService:Connect] Starting connection attempt for userId:', userId);
    console.log('🔌 [WidgetService:Connect] Current WebSocket state:', this.ws ? `exists (readyState: ${this.ws.readyState})` : 'null');
    console.log('🔌 [WidgetService:Connect] isConnecting flag:', this.isConnecting);
    
    // Set flag to indicate we're actively connecting
    this.isConnecting = true;
    
    if (this.ws) {
      console.log('🔌 [WidgetService:Connect] Closing existing WebSocket before creating new one');
      // Don't set isIntentionalDisconnect here - we're replacing the connection, not intentionally disconnecting
      // The old connection will close, but we're already creating a new one, so we don't want it to trigger reconnect
      const oldWs = this.ws;
      this.ws = null; // Clear reference before closing to prevent onclose from triggering reconnect
      oldWs.onclose = null; // Remove onclose handler to prevent it from triggering reconnect
      oldWs.close();
    }

    this.currentUserId = userId;
    this.setConnectionStatus(false); // Set to disconnected initially
    const wsUrl = `wss://leadgen-chatbot-v1.jazeeautomation.com/ws/user/${userId}/`;
    console.log('🔌 [WidgetService:Connect] Creating new WebSocket connection to:', wsUrl);
    this.ws = new WebSocket(wsUrl);
    console.log('🔌 [WidgetService:Connect] WebSocket created, initial readyState:', this.ws.readyState, '(CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)');

    this.ws.onopen = () => {
      console.log('✅ [WidgetService:Connect] WebSocket Connected successfully for userId:', userId);
      this.isIntentionalDisconnect = false;
      this.isConnecting = false; // Clear connecting flag
      this.setConnectionStatus(true);
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
      console.error('⚠️ [WidgetService:OnError] WebSocket Error occurred');
      console.error('⚠️ [WidgetService:OnError] Error details:', error);
      console.error('⚠️ [WidgetService:OnError] WebSocket readyState:', this.ws?.readyState);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 [WidgetService:OnClose] WebSocket Disconnected');
      console.log('🔌 [WidgetService:OnClose] Close code:', event.code, ', reason:', event.reason || 'none', ', wasClean:', event.wasClean);
      console.log('🔌 [WidgetService:OnClose] isIntentionalDisconnect:', this.isIntentionalDisconnect);
      console.log('🔌 [WidgetService:OnClose] isConnecting:', this.isConnecting);
      console.log('🔌 [WidgetService:OnClose] Current WebSocket reference:', this.ws ? 'exists' : 'null');
      
      // Reset connecting flag since connection closed (whether successful or not)
      this.isConnecting = false;
      
      this.setConnectionStatus(false);
      
      // Only skip reconnection if it was a truly intentional disconnect (like cleanup on unmount)
      if (this.isIntentionalDisconnect) {
        // Truly intentional disconnect (like component unmount) - don't reconnect
        console.log('🔌 [WidgetService:OnClose] Intentional disconnect, NOT reconnecting');
        this.isIntentionalDisconnect = false; // Reset flag after handling
      } else {
        // Unexpected disconnect - ALWAYS try to reconnect
        console.log('🔄 [WidgetService:OnClose] Unexpected disconnect, will ALWAYS try to reconnect');
        const delay = 750; // 0.75 seconds
        console.log(`⏳ [WidgetService:OnClose] Scheduling reconnect in ${(delay / 1000).toFixed(2)}s`);
        console.log(`⏳ [WidgetService:OnClose] Current userId: ${userId}, Current time: ${new Date().toISOString()}`);
        setTimeout(() => {
          console.log(`🔄 [WidgetService:OnClose] Reconnect timeout fired! Attempting to reconnect now`);
          console.log(`🔄 [WidgetService:OnClose] Calling connect() for userId: ${userId}`);
          this.connect(userId);
        }, delay);
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
    console.log('🔌 [WidgetService:Disconnect] Intentional disconnect called');
    this.isIntentionalDisconnect = true;
    this.isConnecting = false; // Reset connecting flag
    if (this.ws) {
      console.log('🔌 [WidgetService:Disconnect] Closing WebSocket and preventing reconnection');
      this.ws.close();
      this.ws = null;
      this.setConnectionStatus(false);
    }
    this.messageHandlers = [];
    this.currentUserId = null;
  }

  private setConnectionStatus(isConnected: boolean) {
    if (this.isConnectedState !== isConnected) {
      console.log(`📡 [WidgetService:ConnectionStatus] Status changed: ${this.isConnectedState} -> ${isConnected}`);
      this.isConnectedState = isConnected;
      console.log(`📡 [WidgetService:ConnectionStatus] Notifying ${this.connectionStatusHandlers.length} handler(s)`);
      this.connectionStatusHandlers.forEach((handler, index) => {
        try {
          console.log(`📡 [WidgetService:ConnectionStatus] Calling handler ${index + 1} with status: ${isConnected}`);
          handler(isConnected);
        } catch (error) {
          console.error("Error in connection status handler:", error);
        }
      });
    } else {
      console.log(`📡 [WidgetService:ConnectionStatus] Status unchanged: ${isConnected} (no notification needed)`);
    }
  }

  public onConnectionStatusChange(handler: (isConnected: boolean) => void) {
    console.log(`📡 [WidgetService:ConnectionStatus] New handler subscribed. Current status: ${this.isConnectedState}`);
    this.connectionStatusHandlers.push(handler);
    // Immediately call with current status
    console.log(`📡 [WidgetService:ConnectionStatus] Immediately calling handler with current status: ${this.isConnectedState}`);
    handler(this.isConnectedState);
    return () => {
      console.log(`📡 [WidgetService:ConnectionStatus] Handler unsubscribed`);
      this.connectionStatusHandlers = this.connectionStatusHandlers.filter((h) => h !== handler);
    };
  }

  public isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  public getUserId() {
    return this.currentUserId;
  }
}

export const widgetChatService = new WidgetChatService(); 