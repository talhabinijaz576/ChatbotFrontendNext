
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
  private reconnectDelay: number = 750; // Retry every 0.75 seconds
  private connectionStatusHandlers: ((isConnected: boolean) => void)[] = [];
  private isConnectedState: boolean = false;
  private isConnecting: boolean = false; // Track if we're actively connecting

  constructor() {
    // Initial connection will be made when first chat is loaded
  }

  public async initializeConnection(userId: string) {
    console.log(`🚀 [InitializeConnection] Called for userId: ${userId}`);
    console.log(`🚀 [InitializeConnection] Current WebSocket: ${this.ws ? `exists (readyState: ${this.ws.readyState})` : 'null'}`);
    console.log(`🚀 [InitializeConnection] Current userId: ${this.currentUserId}`);
    console.log(`🚀 [InitializeConnection] Reconnect delay: ${this.reconnectDelay}ms (${(this.reconnectDelay / 1000).toFixed(2)}s)`);
    
    if (!this.ws || this.currentUserId !== userId) {
      console.log(`🚀 [InitializeConnection] Need to connect - fetching config...`);
      this.config = await this.fetchConfig();
      console.log(`🚀 [InitializeConnection] Config fetched, calling connect()...`);
      this.connect(userId);
    } else {
      console.log(`🚀 [InitializeConnection] WebSocket already exists for this userId, skipping connection`);
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
    console.log(`🔌 [Connect] Starting connection attempt for userId: ${userId}`);
    console.log(`🔌 [Connect] Current WebSocket state: ${this.ws ? `exists (readyState: ${this.ws.readyState})` : 'null'}`);
    console.log(`🔌 [Connect] Reconnect attempts so far: ${this.reconnectAttempts}`);
    console.log(`🔌 [Connect] isConnecting flag: ${this.isConnecting}`);
    
    // Set flag to indicate we're actively connecting
    this.isConnecting = true;
    
    if (this.ws) {
      console.log(`🔌 [Connect] Closing existing WebSocket before creating new one`);
      // Don't set isIntentionalDisconnect here - we're replacing the connection, not intentionally disconnecting
      // The old connection will close, but we're already creating a new one, so we don't want it to trigger reconnect
      const oldWs = this.ws;
      this.ws = null; // Clear reference before closing to prevent onclose from triggering reconnect
      oldWs.onclose = null; // Remove onclose handler to prevent it from triggering reconnect
      oldWs.close();
    }

    if (this.reconnectTimeout) {
      console.log(`🔌 [Connect] Clearing reconnect timeout`);
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  

    this.currentUserId = userId;
    this.setConnectionStatus(false); // Set to disconnected initially
    const wsUrl = `${this.config.websocket.baseUrl}/ws/user/${userId}/`;
    console.log(`🔌 [Connect] Creating new WebSocket connection to: ${wsUrl}`);
    this.ws = new WebSocket(wsUrl);
    console.log(`🔌 [Connect] WebSocket created, initial readyState: ${this.ws.readyState} (CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)`);
  
    this.ws.onopen = () => {
      console.log('✅ [Connect] WebSocket Connected successfully!');
      console.log(`✅ [Connect] Resetting reconnect attempts (was: ${this.reconnectAttempts})`);
      this.isIntentionalDisconnect = false;
      this.isConnecting = false; // Clear connecting flag
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      this.setConnectionStatus(true);
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
              // If parsing fails, keep data1 with the event string intact
              // handleIncomingMessage will try to parse it again with better error handling
              console.log("🟢 [ChatService] Event string parse failed, keeping data1 with event string for handleIncomingMessage", {
                timestamp: Date.now(),
                parseError: parseError instanceof Error ? parseError.message : String(parseError),
                eventStringPreview: data1.event?.substring(0, 100)
              });
              // Keep data1 with the event string - handleIncomingMessage will handle it
              data = data1;
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
      console.error("⚠️ [OnError] WebSocket Error occurred");
      console.error("⚠️ [OnError] Error details:", error);
      console.error("⚠️ [OnError] WebSocket readyState:", this.ws?.readyState);
      // Don't reconnect on error - let onclose handle it
      // This prevents double reconnection attempts
    };

  
    this.ws.onclose = (event) => {
      console.log(`🔌 [OnClose] WebSocket Disconnected`);
      console.log(`🔌 [OnClose] Close code: ${event.code}, reason: ${event.reason || 'none'}, wasClean: ${event.wasClean}`);
      console.log(`🔌 [OnClose] isIntentionalDisconnect: ${this.isIntentionalDisconnect}`);
      console.log(`🔌 [OnClose] isConnecting: ${this.isConnecting}`);
      console.log(`🔌 [OnClose] Current reconnect attempts: ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      console.log(`🔌 [OnClose] Current WebSocket reference: ${this.ws ? 'exists' : 'null'}`);
      
      // Reset connecting flag since connection closed (whether successful or not)
      const wasConnecting = this.isConnecting;
      this.isConnecting = false;
      
      this.setConnectionStatus(false);
      
      // Only skip reconnection if it was a truly intentional disconnect (like cleanup on unmount)
      if (this.isIntentionalDisconnect) {
        // Truly intentional disconnect (like component unmount) - don't reconnect
        console.log(`🔌 [OnClose] Intentional disconnect, NOT reconnecting`);
        this.reconnectAttempts = 0;
        this.isIntentionalDisconnect = false; // Reset flag after handling
      } else {
        // Unexpected disconnect - ALWAYS try to reconnect
        console.log(`🔄 [OnClose] Unexpected disconnect, will ALWAYS try to reconnect`);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`🔄 [OnClose] Scheduling reconnect (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
          this.scheduleReconnect(userId);
        } else {
          console.warn(`⚠️ [OnClose] Max reconnect attempts (${this.maxReconnectAttempts}) reached, but will retry after longer delay...`);
          // Even if max attempts reached, we should still try to reconnect after a longer delay
          // This ensures the app always tries to maintain connection
          setTimeout(() => {
            console.log(`🔄 [OnClose] Retrying after max attempts reached, resetting attempt counter`);
            this.reconnectAttempts = 0; // Reset and try again
            this.scheduleReconnect(userId);
          }, 5000); // Wait 5 seconds before retrying after max attempts
        }
      }
    };
  }

  private scheduleReconnect(userId: string) {
    if (this.reconnectTimeout) {
      console.log(`🔄 [Reconnect] Clearing existing reconnect timeout before scheduling new one`);
      clearTimeout(this.reconnectTimeout);
    }

    // Don't schedule if we're already connecting AND we have an active WebSocket
    if (this.isConnecting && this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log(`🔄 [Reconnect] Already connecting with active WebSocket, skipping schedule to avoid duplicate attempts`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay; // 0.75 seconds (750ms)

    console.log(`⏳ [Reconnect] Scheduling reconnect in ${(delay / 1000).toFixed(2)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    console.log(`⏳ [Reconnect] Current userId: ${userId}, Current time: ${new Date().toISOString()}`);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log(`🔄 [Reconnect] Timeout fired! Attempting to reconnect now (attempt ${this.reconnectAttempts})`);
      console.log(`🔄 [Reconnect] Calling connect() for userId: ${userId}`);
      this.connect(userId);
    }, delay);
    
    console.log(`⏳ [Reconnect] Reconnect timeout scheduled with ID: ${this.reconnectTimeout}`);
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
      
      // Normalize message format:
      // Backend sometimes sends: { type: "message", event: "<json string with assistant message>" }
      // Example:
      // {
      //   "type": "message",
      //   "event": "{\"pk\": 20013, \"conversation_id\": \"...\", \"type\": \"assistant\", \"text\": \"...\", ...}"
      // }
      // In this case we want to treat it as a normal assistant message so that
      // downstream handlers (and the UI) see a consistent shape.
      let normalized = d;
      if (d.type === "message" && typeof d.event === "string") {
        try {
          const parsed = JSON.parse(d.event);
          // Prefer inner fields (pk, type=assistant, text, etc.) but keep outer
          // properties like original type/event if needed.
          normalized = {
            ...d,
            ...parsed,
          };
        } catch (e) {
          console.error("🟢 [ChatService] Failed to parse nested event payload", {
            timestamp: Date.now(),
            error: e instanceof Error ? e.message : String(e),
            rawEvent: d.event,
          });
          // If parsing fails, try to extract the inner JSON by removing outer quotes/escaping
          // The event string might be double-encoded or have extra escaping
          try {
            // Try unescaping common JSON escape sequences
            let unescaped = d.event
              .replace(/\\"/g, '"')
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\\\/g, '\\');
            // Try parsing the unescaped version
            const parsed = JSON.parse(unescaped);
            normalized = {
              ...d,
              ...parsed,
            };
          } catch (e2) {
            // If unescaping also fails, keep the original (will be skipped by handler)
          }
        }
      }

      console.log("🟢 [ChatService] Processing message", {
        timestamp: Date.now(),
        type: normalized.type,
        pk: normalized.pk,
        id: normalized.id,
        hasText: !!normalized.text,
        textLength: normalized.text?.length || 0,
        handlerCount: this.messageHandlers.length
      });

      // Always notify listeners first - this is what triggers the UI updates
      this.messageHandlers.forEach((h, index) => {
        try {
          console.log("🟢 [ChatService] Calling handler", {
            timestamp: Date.now(),
            handlerIndex: index,
            messageType: normalized.type,
            messagePk: normalized.pk
          });
          h(normalized);
          console.log("🟢 [ChatService] Handler completed", {
            timestamp: Date.now(),
            handlerIndex: index,
            messageType: normalized.type
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

      if (normalized.type === "event") {
        console.log("🟢 [ChatService] Message is event type, calling runActions", {
          timestamp: Date.now(),
          action: normalized.event?.action
        });
        this.runActions?.(normalized);
      } else if (normalized.type === "assistant") {
        console.log("🟢 [ChatService] Message is assistant type, calling processMessage", {
          timestamp: Date.now(),
          pk: normalized.pk,
          textLength: normalized.text?.length || 0
        });
        this.processMessage(normalized);
      } else {
        console.log("🟢 [ChatService] Message type not recognized", {
          timestamp: Date.now(),
          type: normalized.type
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
    console.log(`🔌 [Disconnect] Intentional disconnect called`);
    this.isIntentionalDisconnect = true;
    this.isConnecting = false; // Reset connecting flag
    if (this.ws) {
      console.log(`🔌 [Disconnect] Closing WebSocket and preventing reconnection`);
      this.ws.close();
      this.ws = null;
      this.currentUserId = null;
      this.reconnectAttempts = 0; // Reset attempts on intentional disconnect
      this.setConnectionStatus(false);
    }
    if (this.reconnectTimeout) {
      console.log(`🔌 [Disconnect] Clearing reconnect timeout`);
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private setConnectionStatus(isConnected: boolean) {
    if (this.isConnectedState !== isConnected) {
      console.log(`📡 [ConnectionStatus] Status changed: ${this.isConnectedState} -> ${isConnected}`);
      this.isConnectedState = isConnected;
      console.log(`📡 [ConnectionStatus] Notifying ${this.connectionStatusHandlers.length} handler(s)`);
      this.connectionStatusHandlers.forEach((handler, index) => {
        try {
          console.log(`📡 [ConnectionStatus] Calling handler ${index + 1} with status: ${isConnected}`);
          handler(isConnected);
        } catch (error) {
          console.error("Error in connection status handler:", error);
        }
      });
    } else {
      console.log(`📡 [ConnectionStatus] Status unchanged: ${isConnected} (no notification needed)`);
    }
  }

  public onConnectionStatusChange(handler: (isConnected: boolean) => void) {
    console.log(`📡 [ConnectionStatus] New handler subscribed. Current status: ${this.isConnectedState}`);
    this.connectionStatusHandlers.push(handler);
    // Immediately call with current status
    console.log(`📡 [ConnectionStatus] Immediately calling handler with current status: ${this.isConnectedState}`);
    handler(this.isConnectedState);
    return () => {
      console.log(`📡 [ConnectionStatus] Handler unsubscribed`);
      this.connectionStatusHandlers = this.connectionStatusHandlers.filter((h) => h !== handler);
    };
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }



}


export const chatService = new ChatService(); 

