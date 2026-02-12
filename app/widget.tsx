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
import { WebSocketLoadingOverlay } from "@/components/websocket-loading-overlay";

export default function Widget({  }) {
  const params = useSearchParams();

  // const parmsConversationId = params.get("conversationId");
  const [conversationId, setConversationId] = useState(() => {
    return params.get("conversationId") || uuidv4();
  });
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<any>();
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
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        initConversation(data);
        // call your logic here directly
      });
  }, []);

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
  
    // ✅ Use the selected conversationId
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
  
          const autoMessage = {
            role: config2.chat.autoMessage.role,
            content: [{ ...config2.chat.autoMessage, type: "text", created_at: new Date() }],
            id: "user-message-" + selectedConversationId,
            createdAt: new Date(),
            created_at: new Date(),
          };
  
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
          } else {
            setMessages([
              {
                role: config2.chat.autoMessage.role,
                content: [{ ...config2.chat.autoMessage, type: "text", created_at: new Date() }],
                id: "user-message-" + selectedConversationId,
                createdAt: new Date(),
              },
            ]);
          }
        }
      })
      .catch((e) => {
        console.log("🚀 ~ e:", e);
        const existingMessage = JSON.parse(
          localStorage.getItem(`conversation:${selectedConversationId}`) || "[]"
        );
  
        if (existingMessage.length > 1) {
          setMessages(existingMessage);
        } else {
          setMessages([
            {
              role: config2.chat.autoMessage.role,
              content: [{ ...config2.chat.autoMessage, type: "text" }],
              id: "user-message-" + selectedConversationId,
              createdAt: new Date(),
            },
          ]);
        }
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
          // When displaying suggestions, blur input to close keyboard
          console.log("🚀 ~ unsubscribe ~ incoming.event:", incoming.event)
          setStateData({ suggestedMessages: incoming.event });
          // Close keyboard by blurring the input
          const input = document.querySelector('textarea[placeholder], textarea[data-composer-input]') as HTMLTextAreaElement | null;
          if (input && document.activeElement === input) {
            input.blur();
          }
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
      <WebSocketLoadingOverlay isVisible={!isWebSocketConnected} />
      <AssistantModal config={config} suggestedMessages={suggestedMessages} onNew={onNew} messages={messages} setStateData={setStateData} />

      <ActionModal
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
