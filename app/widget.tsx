"use client";
import {
  AppendMessage,
  AssistantRuntimeProvider,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  ThreadMessageLike,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState, useCallback, use } from "react";
import { useIframe } from "./hooks/useIframe";
import ActionModal from "@/components/mem0/ActionModal";
import { chatService } from "./services/chatService";
import { useSearchParams } from "next/navigation";
import { AssistantModal } from "@/components/assistant-modal";
import { useBindReducer } from "./utils/useThunkReducer";
import { getCookie, setCookie } from "cookies-next";
import { keepInputFocused } from "./utils/deviceDetection";

export default function Widget({ initialConfig }: { initialConfig?: any }) {
  const params = useSearchParams();

  // const parmsConversationId = params.get("conversationId");
  const [conversationId, setConversationId] = useState(() => {
    return params.get("conversationId") || uuidv4();
  });
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  // Use initialConfig if provided (from server), otherwise fallback to state for backward compatibility
  const [config, setConfig] = useState<any>(initialConfig);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userId, setUserId] = useState(uuidv4);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [
    {
      suggestedMessages,
    },
    setStateData,
  ] = useBindReducer({
    suggestedMessages: [],
  });

  const iframe = useIframe();
  

  useEffect(() => {
    // If config is already provided from server, use it immediately
    if (initialConfig) {
      setConfig(initialConfig);
      initConversation(initialConfig);
      return;
    }

    // Fallback: fetch config if not provided (for backward compatibility)
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        initConversation(data);
      });
  }, [initialConfig]);

  // Update document title and favicon from config
  useEffect(() => {
    if (config?.app?.title) {
      document.title = config.app.title;
    }
    
    if (config?.app?.icon) {
      let iconUrl = config.app.icon;
      console.log('Setting favicon from config:', iconUrl);
      
      // Normalize the icon URL
      // If it's a relative path and doesn't start with /, add it
      // If it's a relative path starting with /, it's already correct for public folder
      // If it's an absolute URL (http/https), use it as-is
      if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('/')) {
        iconUrl = '/' + iconUrl;
      }
      
      console.log('Normalized icon URL:', iconUrl);
      
      // Remove all existing favicon links first to avoid conflicts
      const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel*='Icon']");
      existingLinks.forEach(link => link.remove());
      
      // Create all favicon-related links
      const iconTypes = [
        { rel: "icon" },
        { rel: "shortcut icon" },
        { rel: "apple-touch-icon" },
        { rel: "mask-icon" }
      ];
      
      iconTypes.forEach(({ rel }) => {
        const newLink = document.createElement("link");
        newLink.rel = rel;
        newLink.href = iconUrl;
        
        // Set appropriate type based on file extension
        if (iconUrl.match(/\.svg$/i)) {
          newLink.type = "image/svg+xml";
        } else if (iconUrl.match(/\.png$/i)) {
          newLink.type = "image/png";
        } else if (iconUrl.match(/\.ico$/i)) {
          newLink.type = "image/x-icon";
        } else if (iconUrl.match(/\.jpg$/i) || iconUrl.match(/\.jpeg$/i)) {
          newLink.type = "image/jpeg";
        }
        
        document.head.appendChild(newLink);
        console.log(`Added favicon link: ${rel} -> ${iconUrl}`);
      });
    }
  }, [config]);

  const initConversation = (config2) => {
    // ✅ Get cookie
    const lastMessageCookie = getCookie("lastMessage");
  
    let selectedConversationId = conversationId; // fallback default
  
    try {
      if (lastMessageCookie) {
        const parsed = JSON.parse(lastMessageCookie);
        console.log("🚀 ~ initConversation ~ parsed:", parsed)
  
        // ✅ Check if content.conversationId exists
        if (parsed?.conversationId) {
          selectedConversationId = parsed.conversationId;
        }
      }
    } catch (err) {
      console.error("❌ Failed to parse lastMessage cookie:", err);
    }

    // Get initial_state from URL parameters
    const initialState = params?.get("initial_state");
    
    // Parse initial_state - it might be a JSON object like {"nome": "John", "telefono": "3981235564"}
    // Extract the key from the JSON object to use as the autoMessage key, and get all variables for template replacement
    let autoMessageKey: string | null = null;
    let templateVariables: Record<string, any> = {};
    if (initialState) {
      let parsed: any = null;
      let decodedValue = String(initialState);
      
      // First, try to parse as-is (in case Next.js already decoded it)
      try {
        parsed = JSON.parse(decodedValue);
      } catch (e) {
        // If parsing fails, try decoding URL-encoded characters
        try {
          // Check if it contains URL-encoded characters (like %7B, %3A, etc.)
          if (decodedValue.includes('%')) {
            decodedValue = decodeURIComponent(decodedValue);
          }
          parsed = JSON.parse(decodedValue);
        } catch (e2) {
          // If still fails, try one more time with aggressive decoding
          try {
            // Sometimes the entire string might be double-encoded or have special characters
            decodedValue = decodeURIComponent(decodeURIComponent(decodedValue));
            parsed = JSON.parse(decodedValue);
          } catch (e3) {
            console.warn('Failed to parse initial_state after multiple attempts:', e3, 'Original value:', initialState);
            // If all parsing attempts fail, treat it as a plain string key
            autoMessageKey = initialState;
          }
        }
      }
      
      // If we successfully parsed the JSON
      if (parsed && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Store all variables for template replacement
        templateVariables = parsed;
        
        // Find the first key in initial_state that exists in chat.autoMessage (excluding "default")
        const keys = Object.keys(parsed);
        for (const key of keys) {
          if (key !== 'default' && config2.chat.autoMessage[key]) {
            autoMessageKey = key;
            break;
          }
        }
      } else if (parsed === null && autoMessageKey === null) {
        // If parsing resulted in null or we couldn't parse, use the decoded value as key
        autoMessageKey = decodedValue;
      }
    }
    
    // Select autoMessage based on initial_state
    // If a matching field exists in chat.autoMessage, use it; otherwise use default
    let selectedAutoMessage = config2.chat.autoMessage.default;
    if (autoMessageKey && config2.chat.autoMessage[autoMessageKey]) {
      selectedAutoMessage = config2.chat.autoMessage[autoMessageKey];
    }
    
    // Replace template variables in the message text (e.g., {{nome}}, {{telefono}})
    let messageText = selectedAutoMessage?.text || '';
    if (messageText && Object.keys(templateVariables).length > 0) {
      messageText = messageText.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
        return templateVariables[key] !== undefined ? String(templateVariables[key]) : match;
      });
    }
    
    // Use the role from the selected message, or fallback to default role
    const autoMessageRole = selectedAutoMessage?.role || config2.chat.autoMessage.role;

    // Display the first message immediately without waiting for API calls
    const autoMessage = {
      role: autoMessageRole,
      content: [{ ...selectedAutoMessage, text: messageText, type: "text", created_at: new Date() }],
      id: "user-message-" + selectedConversationId,
      createdAt: new Date(),
      created_at: new Date(),
    };
    setMessages([autoMessage]);
  
    // Fetch conversation history in background - non-blocking
    // This will update messages if there are existing messages, but won't block the initial display
    fetch(`${config2.api.baseUrl}/conversation/${selectedConversationId}/view`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          console.log("🚀 ~ initConversation ~ data.messages:", data.messages);
          const converted = data.messages.map((item) => {
            let contentArray;
  
            if (item.type === "user") {
              try {
                const normalized = item.text.replace(/'/g, '"');
                const parsed = JSON.parse(normalized);
                contentArray = Array.isArray(parsed)
                  ? parsed
                  : [{ type: "text", text: item.text, created_at: item.created_at }];
              } catch (err) {
                contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
              }
            } else {
              contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
            }
  
            return {
              role: item.type,
              content: contentArray,
              id: `${item.type}-message-${item.id}`,
              createdAt: new Date(),
            };
          });
  
          // Update messages with history if available, but keep autoMessage at the start
          setMessages([autoMessage, ...converted]);
        } else {
          const existingMessage = typeof window !== 'undefined' 
            ? JSON.parse(localStorage.getItem(`conversation:${selectedConversationId}`) || "[]")
            : [];

          if (existingMessage.length > 1) {
            const parsedMessages = existingMessage.map((item) => ({
              role: item.role,
              content: [{ text: item.text, type: "text" }],
              id: "user-message-" + selectedConversationId,
              createdAt: new Date(),
            }));
            setMessages(parsedMessages);
          }
          // If no existing messages, keep the autoMessage that was already set
        }
      })
      .catch((e) => {
        console.error("Error loading conversation history:", e);
        // If view fails, keep the autoMessage that was already displayed
        // Check localStorage as fallback
        const existingMessage = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem(`conversation:${selectedConversationId}`) || "[]")
          : [];

        if (existingMessage.length > 1) {
          setMessages(existingMessage);
        }
        // Otherwise keep the autoMessage that was already set
      });
  };

  useEffect(() => {
    if (config?.chat?.isDark) setIsDarkMode(true);
  }, [config]);

  useEffect(() => {
    chatService.initializeConnection(conversationId);
    
    // Subscribe to connection status changes
    const unsubscribeStatus = chatService.onConnectionStatusChange((isConnected) => {
      console.log(`📡 [Widget] Connection status changed: ${isConnected}`);
      setIsWebSocketConnected(isConnected);
    });
    
    const unsubscribe = chatService.onMessage((incoming) => {
      console.log("🚀 ~ unsubscribe ~ incoming:", incoming);
      if (incoming?.type === "assistant" && incoming.text) {
        const incRes: ThreadMessageLike = {
          role: incoming.type,
          content: [{ text: incoming.text, type: "text" }],
          id: incoming.pk,
          createdAt: new Date(),
        };
        setMessages((currentConversation) => [...currentConversation, incRes]);
      }
      if (incoming?.type === "event") {
        const action = incoming.event?.action;
        
        if (action === "open_url" || action === "on_open") {
          iframe.openIframe(incoming.event.url);
          // Keep input focused when opening iframe (but only if no suggestions)
          if (!suggestedMessages?.buttons?.length) {
            keepInputFocused();
          }
        } else if (action === "close_url" || action === "on_close") {
          iframe.closeIframe();
          // Keep input focused when closing iframe (but only if no suggestions)
          if (!suggestedMessages?.buttons?.length) {
            keepInputFocused();
          }
        } else if (action === "display_suggestions") {
          // When displaying suggestions, keep keyboard open but disable send button
          console.log("🚀 ~ unsubscribe ~ incoming.event:", incoming.event)
          setStateData({ suggestedMessages: incoming.event });
          // Keep keyboard open - don't blur the input
        }
      }
    });
    return () => {
      chatService.disconnect();
      unsubscribe();
      unsubscribeStatus();
    };
  }, [conversationId]);

  // Focus input after 1 second if no suggestions and iframe is closed
  useEffect(() => {
    const hasSuggestions = suggestedMessages?.buttons?.length > 0;
    const isIframeOpen = iframe.showIframe;
    
    // Only focus if there are no suggestions and iframe is closed
    if (!hasSuggestions && !isIframeOpen) {
      const timeout = setTimeout(() => {
        // Double-check conditions haven't changed before focusing
        const stillNoSuggestions = !suggestedMessages?.buttons?.length;
        const stillNoIframe = !iframe.showIframe;
        
        if (stillNoSuggestions && stillNoIframe) {
          // Focus the input to open keyboard
          keepInputFocused();
        }
      }, 1000); // Wait 1 second
      
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [suggestedMessages, iframe.showIframe]);

  const onNew = useCallback(
    async (userAppendMessage: AppendMessage) => {
      if (suggestedMessages?.buttons?.length > 0 && suggestedMessages?.close_on_ignore === true) {
        setStateData({suggestedMessages: []});
      }
      const userMessage: ThreadMessageLike = {
        role: "user",
        content: userAppendMessage.content,
        id: `user-message-${Date.now()}`,
        createdAt: new Date(),
        attachments: userAppendMessage.attachments,
      };
      setMessages((currentConversation) => [
        ...currentConversation,
        userMessage,
      ]);
      setIsRunning(true);
      try {
        const assistantResponse = await chatService.sendMessage(
          userAppendMessage,
          userId,
          conversationId!,
          params
        );
        const assRes: ThreadMessageLike = {
          role: assistantResponse.type,
          content: [{ text: assistantResponse.text, type: "text", created_at: assistantResponse.created_at }],
          id: `user-message-${Date.now()}`,
          createdAt: new Date(),
        };
        setMessages((currentConversation) => [...currentConversation, assRes]);
        setCookie(
          "lastMessage",
          JSON.stringify({
            assRes,
            conversationId: conversationId
          }),
          { maxAge: 60 * config?.app?.time || 60 } // expires after 3 minutes (180 seconds)
        );        
      } catch (error) {
        console.error("Error communicating with backend:", error);
      } finally {
        setIsRunning(false);
      }
    },
    [chatService, setMessages, setIsRunning]
  );

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage: (m: any) => m,
    onNew,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    },
  });
  

  if (!config) return <div>Loading config...</div>;
  return (
    <AssistantRuntimeProvider runtime={runtime} options={{ 
      threadVisibility: "hidden",
      eventPointers: config.chat.isWidgetOpen ? "auto" : "none" // Dynamic based on widget state
    }}>
      <AssistantModal config={config} suggestedMessages={suggestedMessages} onNew={onNew} messages={messages} setStateData={setStateData} />

      <ActionModal
          config={config}
          open={iframe.showIframe}
          url={iframe.iframeUrl}
          iframeError={iframe.iframeError}
          onClose={iframe.closeIframe}
          onIframeError={iframe.onIframeError}
          onIframeLoad={iframe.onIframeLoad}
        />
    </AssistantRuntimeProvider>
  );
}
