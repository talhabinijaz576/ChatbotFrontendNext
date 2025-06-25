import { AppConfig } from "../config/app.config";

interface ApiResponse {
  id: number;
  conversation: { id: number; conversation_id: string; status: string; slots: Record<string, any> };
  type: string;
  text: string;
  cost: string;
  data: Record<string, any>;
}

class ChatService {
  private ws: WebSocket | null = null;
  private config: AppConfig;
  private messageHandlers: ((message: any) => void)[] = [];
  private lastMessageId: number | null = null;
  private currentUserId: string | null = null;
  private isIntentionalDisconnect = false;
  private pendingResolve: ((response: any) => void) | null = null;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public initializeConnection(userId: string) {
    if (!this.ws || this.currentUserId !== userId) {
      this.connect(userId);
    }
  }

  private connect(userId: string) {
    if (this.ws) {
      this.isIntentionalDisconnect = true;
      this.ws.close();
    }

    this.currentUserId = userId;
    this.ws = new WebSocket(`${this.config.websocket.baseUrl}`);

    this.ws.onopen = () => {
      console.log("✅ WebSocket Connected");
      this.isIntentionalDisconnect = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data1 = JSON.parse(event.data);
        const data = JSON.parse(data1.event);
        console.log("📩 WebSocket Message:", data);
        this.handleIncomingMessage([data]);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    this.ws.onclose = () => {
      console.log("❌ WebSocket Closed");
      if (!this.isIntentionalDisconnect) {
        setTimeout(() => this.connect(userId), this.config.websocket.reconnectInterval);
      }
    };
  }

  public async sendMessage(message: string, userId: string, conversationId: string): Promise<any> {
    this.initializeConnection(userId);

    const payload = { message: { content: message } };

    try {
      const response = await fetch(`${this.config.api.baseUrl}${this.config.api.endpoints.conversation}`, {
        method: "POST",
        headers: this.config.api.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data: ApiResponse[] = await response.json();
      return data[0];
    } catch (error) {
      console.error("API Error:", error);
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public handleIncomingMessage(data: any[]) {
    for (const d of data) {
      console.log("🔄 Incoming:", d);
      this.messageHandlers.forEach((handler) => handler(d));
    }
  }

  public onMessage(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
  }

  public disconnect() {
    this.isIntentionalDisconnect = true;
    this.ws?.close();
  }
}

export default ChatService;
