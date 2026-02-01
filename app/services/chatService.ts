
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
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 200; // Maximum number of reconnect attempts
  private reconnectDelay: number = 2000; // Retry every 2 seconds

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

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  

    this.currentUserId = userId;
    this.ws = new WebSocket(`${this.config.websocket.baseUrl}/ws/user/${userId}/`);
  
    this.ws.onopen = () => {
      console.log('✅ WebSocket Connected');
      this.isIntentionalDisconnect = false;
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    };
  
    this.ws.onmessage = (event) => {
      try {
        console.log("🟢 [ChatService] Raw WebSocket message received", {
          timestamp: Date.now(),
          rawData: event.data,
          dataType: typeof event.data
        });
        
        const data1 = JSON.parse(event.data);
        console.log("🟢 [ChatService] Parsed initial data", {
          timestamp: Date.now(),
          hasEvent: !!data1.event,
          eventType: typeof data1.event,
          data1Keys: Object.keys(data1),
          data1Type: data1.type,
          data1Pk: data1.pk,
          data1Id: data1.id,
          data1Text: data1.text?.substring(0, 50) || null,
          fullData1: data1
        });
        
        // Handle different message formats
        let data;
        if (data1.event) {
          // If event is already an object, use it directly
          if (typeof data1.event === 'object') {
            data = data1.event;
            console.log("🟢 [ChatService] Using event as object", {
              timestamp: Date.now(),
              eventKeys: Object.keys(data),
              eventType: data.type
            });
          } else if (typeof data1.event === 'string') {
            // If event is a string, try to parse it
            try {
              data = JSON.parse(data1.event);
              console.log("🟢 [ChatService] Parsed event string", {
                timestamp: Date.now(),
                parsedKeys: Object.keys(data),
                parsedType: data.type
              });
            } catch (parseError) {
              // If parsing fails, the event might be a plain string or invalid JSON
              // Use data1 directly as fallback
              data = data1;
              console.log("🟢 [ChatService] Event string parse failed, using data1", {
                timestamp: Date.now(),
                parseError: parseError instanceof Error ? parseError.message : String(parseError)
              });
            }
          } else {
            data = data1;
            console.log("🟢 [ChatService] Event is neither object nor string, using data1", {
              timestamp: Date.now()
            });
          }
        } else {
          // No event property, use data1 directly
          data = data1;
          console.log("🟢 [ChatService] No event property, using data1 directly", {
            timestamp: Date.now(),
            dataKeys: Object.keys(data),
            dataType: data.type
          });
        }
        
        console.log("🟢 [ChatService] Final data to process", {
          timestamp: Date.now(),
          hasData: !!data,
          dataType: data?.type,
          dataPk: data?.pk,
          dataId: data?.id,
          dataText: data?.text?.substring(0, 50) || null,
          fullData: data
        });
        
        // Process any valid data - let the handlers decide what to do with it
        if (data) {
          console.log("🟢 [ChatService] Calling handleIncomingMessage", {
            timestamp: Date.now(),
            dataType: data.type,
            dataPk: data.pk,
            handlerCount: this.messageHandlers.length
          });
          this.handleIncomingMessage([data]);
        } else {
          console.log("🟢 [ChatService] No data to process, skipping", {
            timestamp: Date.now()
          });
        }
      } catch (error) {
        // Fail silently on parse errors
        console.error("🟢 [ChatService] Error parsing WebSocket message", {
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          rawData: event.data
        });
      }
    };
  
    this.ws.onerror = (error) => {
      console.error("⚠️ WebSocket Error:", error);
      // Don't reconnect on error - let onclose handle it
      // This prevents double reconnection attempts
    };

  
    this.ws.onclose = (event) => {
      console.log(`🔌 WebSocket Disconnected (code: ${event.code})`);
      if (!this.isIntentionalDisconnect) {
        // Only reconnect if we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect(userId);
        } else {
          console.error(`❌ Max reconnect attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection.`);
        }
      } else {
        // Reset attempts on intentional disconnect
        this.reconnectAttempts = 0;
      }
    };
  }

  private scheduleReconnect(userId: string) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay; // Fixed 2 second delay

    console.log(`⏳ Reconnecting WebSocket in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect(userId);
    }, delay);
  }
  
  public async sendMessage(message: string, userId: string, conversationId: string, searchParams?: { [key: string]: string | string[] | undefined }, ipAddress?: string): Promise<any> {
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
        // Include metadata if present (for suggested messages with keywords)
        ...(message.metadata && {
          keyword: message.metadata.keyword,
          ...message.metadata
        }),
        user_ip: ipAddress || "",
      },
    };
    
    try {
      // Send via API
      const params = new URLSearchParams(searchParams).toString();
      const response = await fetch(`${this.config.api.baseUrl}/conversation/${conversationId}/message?${params}`, {
        method: 'POST',
        headers: {...this.config.api.headers},
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Fail silently - return null instead of throwing
        return null;
      }
      
      const data: ApiResponse[] = await response.json();
      // const res = this.proccessIncommingMessage(data)
      // this.handleIncomingMessage(data); 
      
      // Return null if response is empty array or first element is undefined
      if (!data || data.length === 0 || !data[0]) {
        return null;
      }
      
      return data[0];
      // Process the response and notify handlers
      
    } catch (error) {
      // Fail silently - return null instead of throwing
      return null;
    }

    // Also send via WebSocket if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }
  
  public handleIncomingMessage(data: any) {
    console.log("🟢 [ChatService] handleIncomingMessage called", {
      timestamp: Date.now(),
      dataType: typeof data,
      isArray: Array.isArray(data),
      dataLength: Array.isArray(data) ? data.length : 1,
      handlerCount: this.messageHandlers.length
    });
    
    // Ensure data is an array
    const messages = Array.isArray(data) ? data : [data];
    
    console.log("🟢 [ChatService] Processing messages array", {
      timestamp: Date.now(),
      messageCount: messages.length,
      messages: messages.map(m => ({
        type: m?.type,
        pk: m?.pk,
        id: m?.id,
        hasText: !!m?.text,
        textLength: m?.text?.length || 0
      }))
    });

    for (const d of messages) {
      if (!d) {
        console.log("🟢 [ChatService] Skipping null/undefined message", {
          timestamp: Date.now()
        });
        continue;
      }
      
      console.log("🟢 [ChatService] Processing message", {
        timestamp: Date.now(),
        type: d.type,
        pk: d.pk,
        id: d.id,
        hasText: !!d.text,
        textLength: d.text?.length || 0,
        handlerCount: this.messageHandlers.length
      });

      // Always notify listeners first - this is what triggers the UI updates
      this.messageHandlers.forEach((h, index) => {
        try {
          console.log("🟢 [ChatService] Calling handler", {
            timestamp: Date.now(),
            handlerIndex: index,
            messageType: d.type,
            messagePk: d.pk
          });
          h(d);
          console.log("🟢 [ChatService] Handler completed", {
            timestamp: Date.now(),
            handlerIndex: index,
            messageType: d.type
          });
        } catch (error) {
          // Fail silently if handler throws
          console.error("🟢 [ChatService] Handler error", {
            timestamp: Date.now(),
            handlerIndex: index,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
        }
      });

      if (d.type === "event") {
        console.log("🟢 [ChatService] Message is event type, calling runActions", {
          timestamp: Date.now(),
          action: d.event?.action
        });
        this.runActions?.(d);
      } else if (d.type === "assistant") {
        console.log("🟢 [ChatService] Message is assistant type, calling processMessage", {
          timestamp: Date.now(),
          pk: d.pk,
          textLength: d.text?.length || 0
        });
        this.processMessage(d);
      } else {
        console.log("🟢 [ChatService] Message type not recognized", {
          timestamp: Date.now(),
          type: d.type
        });
      }
    }
    
    console.log("🟢 [ChatService] handleIncomingMessage completed", {
      timestamp: Date.now(),
      processedCount: messages.length
    });
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
      this.reconnectAttempts = 0; // Reset attempts on intentional disconnect
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }



}


export const chatService = new ChatService(); 

