
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

class ChatService {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: any) => void)[] = [];
  private lastMessageId: number | null = null;
  private currentUserId: string | null = null;
  private isIntentionalDisconnect: boolean = false;
  private pendingResolve: ((response: any) => void) | null = null;
  private config: any = null;

  constructor() {
    // Initial connection will be made when first chat is loaded
  }

  public async initializeConnection(userId: string) {
    if (!this.ws || this.currentUserId !== userId) {
      this.config = await this.fetchConfig();
      this.connect(userId);
    }
  }

  private async fetchConfig(): Promise<any> {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) {
        throw new Error("Failed to fetch config");
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching config:", error);
      return null;
    }
  }

  private connect(userId: string) {
    if (this.ws) {
      this.isIntentionalDisconnect = true;
      this.ws.close();
    }
  
    this.currentUserId = userId;
    this.ws = new WebSocket(`${this.config.websocket.baseUrl}/ws/user/${userId}/`);
  
    this.ws.onopen = () => {
      console.log('WebSocket Connected');
      this.isIntentionalDisconnect = false;
    };
  
    this.ws.onmessage = (event) => {
      try {
        const data1 = JSON.parse(event.data);
        console.log("🚀 ~ ChatService ~ connect ~ data1:", data1)
        const data = JSON.parse(data1.event);
        console.log("📩 Incoming WebSocket Message:", data);
        this.handleIncomingMessage([data]);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  
    this.ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };
  
    this.ws.onclose = () => {
      console.log('WebSocket Disconnected');
      if (!this.isIntentionalDisconnect) {
        setTimeout(() => this.connect(userId), this.config.websocket.reconnectInterval);
      }
    };
  }
  
  public async sendMessage(message: string, userId: string, conversationId: string, searchParams?: { [key: string]: string | string[] | undefined }): Promise<any> {
    console.log("🚀 ~ ChatService ~ sendMessage ~ searchParams:", searchParams)
    // Ensure WebSocket is connected
    this.initializeConnection(conversationId);
    const payload = {
      message: {
        content: message.content[0]?.text || "",
        attachments: (message.attachments || []).map(att => {
          const base64Content =
            att.content?.[0]?.image || // for images
            att.content?.[0]?.file ||  // for PDFs, DOCs, etc.
            att.content?.[0]?.text ||  // for PDFs, DOCs, etc.
            ""; // fallback
    
          return {
            type: att.type, // e.g. 'image', 'pdf', 'doc', 'video', etc.
            name: att.name,
            base64_content: base64Content,
          };
        }),
      },
    };
    
    try {
      // Send via API
      const params = new URLSearchParams(searchParams).toString();
      const response = await fetch(`${this.config.api.baseUrl}/conversation/${conversationId}/message?${params}`, {
        method: 'POST',
        headers: this.config.api.headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse[] = await response.json();
      // const res = this.proccessIncommingMessage(data)
      // this.handleIncomingMessage(data); 
      return data[0];
      // Process the response and notify handlers
      
    } catch (error) {
      console.error('API Error:', error);
      // Notify handlers of the error
    }

    // Also send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
  
  public handleIncomingMessage(data: any) {
    console.log("🚀 ~ Haris Data:", data);
  
    for (const d of data || []) {
      console.log("Message Type", d.type);
  
      // Always notify listeners first
      this.messageHandlers.forEach((h) => h(d));
  
      if (d.type === "event") {
        this.runActions?.(d); // ✅ Don't return
      } else if (d.type === "assistant") {
        this.processMessage(d); // ✅ Don't return
      }
    }
  }
  
  
  
  

  private runActions(data: any) {
    return {
      threadId: data.conversation_id || "unknown",
      messageId: data.pk?.toString() || Date.now().toString(),
      content: [{ type: data.type, text: data.text, ...data }],
    };

    // const event = data.event;
    // console.log("🚀 ~ ChatService ~ runActions ~ event:", event)
    // if (event?.type === 'action' && event?.action === 'open_url' && event.url) {
    //   window.open(event.url, '_blank');
    // } else if (event?.type === 'action' && event?.action === 'close_url') {
    //   console.log("🔒 Close URL action received");
    //   // Custom logic for closing iframe or modal
    // }
  }
  
  public processMessage = (message: any) => {
  console.log("🚀 ~ ChatService ~ data:", message)
  return {
    threadId: message.conversation_id || "unknown",
    messageId: message.pk?.toString() || Date.now().toString(),
    content: [{ type: message.type, text: message.text, ...message }],
  };
    // if (typeof message.text === "string" && message.text.trim()) {
    
    //   const formattedMessage = {
    //     threadId: message.conversation?.conversation_id || "unknown",
    //     messageId: message.id?.toString() || Date.now().toString(),
    //     content: [{ type: "text", text: message.text }],
    //   };
  
    //   // ✅ Notify all subscribed handlers (e.g., adapter.run)
    //   this.messageHandlers.forEach((handler) =>
    //     handler({ message: formattedMessage })
    //   );
    // }
  };
  
  

  public async sendMessageAndWait(
    message: string,
    userId: string,
    conversationId: string,
    abortSignal?: AbortSignal
  ): Promise<any> {
    // Listen for response BEFORE sending
    const responsePromise = new Promise((resolve, reject) => {
      const unsubscribe = chatService.onMessage((incoming) => {
        console.log("📥 Incoming message:", incoming);
        if (typeof incoming.text === "string" && incoming.text.trim()) {
          const formatted = {
            threadId: conversationId,
            messageId: Date.now().toString(),
            content: [{ ...incoming, type: incoming.type, text: incoming.text }],
          };
          console.log("✅ Reply:", formatted);
          resolve(formatted);
          unsubscribe();
        }
      });
  
      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          unsubscribe();
          reject(new Error("Aborted by user"));
        });
      }
    });
    console.log("🚀 ~ ChatService ~ responsePromise ~ responsePromise:", responsePromise)
  
    // Send the message
    await this.sendMessage(message, userId, conversationId);
  
    // Wait for WebSocket to respond
    return await responsePromise;
  }
  
  

  

  // public proccessIncommingMessage (data: any){
  //   console.log('API Response:', data);

  //   if (data && data.length > 0) {
  //     const lastMessage = data[data.length - 1];
  //     console.log("🚀 ~ ChatService ~ sendMessage ~ lastMessage:", lastMessage)
  //     this.lastMessageId = lastMessage.id;
      
  //     // Check for action="open_url" in the response data
  //     let action: string | undefined;
  //     let url: string | undefined;
      
  //     // Function to recursively search for action and url in any object
  //     const findActionAndUrl = (obj: any): { action?: string; url?: string } => {
  //       if (!obj || typeof obj !== 'object') return {};
        
  //       // Check if this object has action and url
  //       if (obj.action && obj.url) {
  //         return { action: obj.action, url: obj.url };
  //       }
        
  //       // Check for action="open_url" or action="close_url" format in text
  //       if (typeof obj === 'string' && obj.includes('action=')) {
  //         const actionMatch = obj.match(/action="?([^"\s]+)"?/);
  //         const urlMatch = obj.match(/url="?([^"\s]+)"?/);
  //         if (actionMatch) {
  //           return { action: actionMatch[1], url: urlMatch ? urlMatch[1] : undefined };
  //         }
  //       }
        
  //       // Recursively search in all properties
  //       for (const key in obj) {
  //         if (obj.hasOwnProperty(key)) {
  //           const result = findActionAndUrl(obj[key]);
  //           if (result.action) {
  //             return result;
  //           }
  //         }
  //       }
        
  //       return {};
  //     };
      
  //     // Search for action and url in the entire response
  //     const actionData = findActionAndUrl(data);
  //     action = actionData.action;
  //     url = actionData.url;
      
  //     // Also check in the text content for action format
  //     if (lastMessage.text && lastMessage.text.includes('action=')) {
  //       const actionMatch = lastMessage.text.match(/action="?([^"\s]+)"?/);
  //       const urlMatch = lastMessage.text.match(/url="?([^"\s]+)"?/);
  //       if (actionMatch) {
  //         action = actionMatch[1];
  //         url = urlMatch ? urlMatch[1] : undefined;
  //       }
  //     }
      
  //     // Only send the message if it has content
  //     if (lastMessage.text && lastMessage.type === 'assistant') {
  //       const messagePayload = {
  //         message: {
  //           content: lastMessage.text + " hello my name is talha",
  //           type: 'assistant',
  //           conversation: lastMessage.conversation?.conversation_id || null,
  //           action,
  //           url
  //         }
  //       };
  //       console.log("✅ Emitting assistant response to listeners:", messagePayload);
  //       this.messageHandlers.forEach(handler => handler(messagePayload));
        
  //     }
      
  //   }
  // }

  public onMessage(handler: (message: any) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }
  
  public disconnect() {
    if (this.ws) {
      this.isIntentionalDisconnect = true;
      this.ws.close();
      this.ws = null;
      this.currentUserId = null;
    }
  }



}


export const chatService = new ChatService(); 

