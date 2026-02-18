"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  AppendMessage,
  ThreadMessageLike,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState, use, useRef } from "react";
import { flushSync } from "react-dom";
import {
  Thread,
} from "@/components/assistant-ui/thread";
import ThemeAwareLogo from "@/components/mem0/theme-aware-logo";
import ActionModal from "@/components/mem0/ActionModal";
import { useIframe } from "./hooks/useIframe";
import { chatService } from "./services/chatService";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { SimplePdfAttachmentAdapter } from "./services/SimplePdfAttachmentAdapter";
import { OtpModal } from "@/components/assistant-ui/otpModal";
import { Box, Button, Modal, Typography } from "@mui/material";
import { getCookie, setCookie } from "cookies-next";
import { handleSelection } from "./utils/addOtpPhrase";
import { useBindReducer } from "./utils/useThunkReducer";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import CookiebotLoader from "@/components/CookiebotLoader";
import { getClientIp } from "./utils/get-ip";
import { keepInputFocused } from "./utils/deviceDetection";
import { WebSocketLoadingOverlay } from "@/components/websocket-loading-overlay";

// === Utility Functions ===
declare global {
  interface Window {
    Cookiebot?: any;
  }
}

const getOrCreateUserId = () => {
  if (typeof window === 'undefined') return uuidv4();
  let id = localStorage.getItem("userId1");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("userId1", id);
  }
  return id;
};

const getConversationHistory = () => {
  if (typeof window === 'undefined') return [];
  try {
  return JSON.parse(localStorage.getItem("chatHistory") || "[]");
  } catch (e) {
    return [];
  }
};

const saveConversationToHistory = (id: string, title: string) => {
  if (typeof window === 'undefined') return;
  const history = getConversationHistory();
  const exists = history.find((h) => h.id === id);
  if (!exists) {
    history.push({ id, title });
  } else if (title && !exists.title) {
    exists.title = title;
  }
  try {
  localStorage.setItem("chatHistory", JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save conversation history:", e);
  }
};

const saveMessages = (id: string, messages: any[]) => {
  if (typeof window === 'undefined') return;
  try {
  localStorage.setItem(`conversation:${id}`, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save messages:", e);
  }
};

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 1000,
  bgcolor: "background.paper",
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
  maxHeight: "80vh",
  overflowY: "auto",
};

// === Main Component ===

export function Assistant({
  initialConversationId,
  searchParams,
  initialConfig,
}: {
  initialConversationId: string | null;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
  initialConfig?: any;
}) {
  const router = useRouter();
  const iframe = useIframe();
  
  // Unwrap searchParams if it's a Promise (Next.js 15+)
  // Check if it's a Promise by checking for 'then' method (safer than instanceof)
  const resolvedSearchParams = searchParams && typeof (searchParams as any).then === 'function' 
    ? use(searchParams as Promise<{ [key: string]: string | string[] | undefined }>)
    : searchParams as { [key: string]: string | string[] | undefined };

  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [history, setHistory] = useState(() => getConversationHistory());
  const [isRunning, setIsRunning] = useState(false);
  const keyboardOpenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use initialConfig if provided (from server), otherwise fallback to state for backward compatibility
  const [config, setConfig] = useState<any>(initialConfig || null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [lastMessageResponse, setlastMessageResponse] = useState(null);
  const [openCookieModal, setOpenCookieModal] = useState(true);
  const [cookieLoading, setCookieLoading] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [
    { error, suggestedMessages, conversationId, sidebarOpen, ipAddress },
    setStateData,
  ] = useBindReducer({
    error: null,
    suggestedMessages: [],
    conversationId: initialConversationId,
    sidebarOpen: true,
    ipAddress: "",
  });

  
  const userId = getOrCreateUserId();
  const [modalOpen, setModalOpen] = useState(false);
  const createdConversationsRef = useRef<Set<string>>(new Set());

  const handleModalOpen = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);

  // Step 1: Load config once on page load

  // Monitor visual viewport height to adjust layout when keyboard opens
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      setVisualViewportHeight(window.innerHeight);
      return;
    }

    const visualViewport = window.visualViewport;
    
    const updateViewportHeight = () => {
      // Update height and trigger re-render to adjust header position
      setVisualViewportHeight(visualViewport.height);
      
      // Force header repositioning on mobile by updating transform
      // This ensures the header stays visible when keyboard opens
      const header = document.querySelector('header');
      if (header && visualViewport.offsetTop !== undefined) {
        header.style.transform = `translateY(${visualViewport.offsetTop}px)`;
      }
    };

    // Set initial height
    updateViewportHeight();

    // Listen for viewport changes (keyboard open/close)
    visualViewport.addEventListener('resize', updateViewportHeight);
    visualViewport.addEventListener('scroll', updateViewportHeight);

    return () => {
      visualViewport.removeEventListener('resize', updateViewportHeight);
      visualViewport.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    // If config is already provided from server, use it immediately
    if (initialConfig) {
      fetch("/api/getip")
        .then((res) => res.json())
        .then((data) => {
          setStateData({ ipAddress: data });
        });
      setConfig(initialConfig);
      initConversation(initialConfig);
      window?.Cookiebot?.renew?.();
      return;
    }

    // Fallback: fetch config if not provided (for backward compatibility)
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        fetch("/api/getip")
        .then((res) => res.json())
        .then((data) => {
          setStateData({ ipAddress: data });
        })
        setConfig(data);
        initConversation(data);
        window?.Cookiebot?.renew?.();
      });
  }, [initialConfig]);

  useEffect(() => {
    const handleConsentUpdate = async (event) => {
      // Wait until Cookiebot is fully ready
      if (!window.Cookiebot || !window.Cookiebot.consent) {
        return;
      }
  
      const consent = window.Cookiebot.consent;
      const consentData = {
        necessary: consent.necessary,
        preferences: consent.preferences,
        statistics: consent.statistics,
        marketing: consent.marketing,
        userId: conversationId,
        consentedAt: new Date().toISOString(),
      };
  
      await handleSelection(config, consentData, conversationId);
    };
  
    window.addEventListener("CookiebotOnAccept", handleConsentUpdate);
    window.addEventListener("CookiebotOnDecline", handleConsentUpdate);
  
    return () => {
      window.removeEventListener("CookiebotOnAccept", handleConsentUpdate);
      window.removeEventListener("CookiebotOnDecline", handleConsentUpdate);
    };
  }, [config, conversationId]);
  
  
  
  // Step 2: Load conversation/messages when config + conversationId are ready

  const initConversation = (config2: any) => {
    const otpPhrase = getCookie("otpPhrase");

    


    let parsedOtpPhrase = [];
    if (otpPhrase) {
      try {
        parsedOtpPhrase = JSON.parse(otpPhrase);
      } catch (e) {
        // Fail silently
      }
    }

    const otpPhraseArray = parsedOtpPhrase.find?.(
      (item) => item.conversationId === conversationId
    );

    const headers = new Headers({
      Accept: "*/*", // from browser or another config
    });
    if (otpPhraseArray?.passphrase) {
      headers.set("passphrase", otpPhraseArray.passphrase);
    }
    const params = new URLSearchParams(resolvedSearchParams).toString();

    // Display the first message immediately without waiting for API calls
    const autoMessage = {
      role: config2.chat.autoMessage.role,
      content: [{ ...config2.chat.autoMessage, type: "text", created_at: new Date() }],
      id: "user-message-" + conversationId,
      createdAt: new Date(),
      created_at: new Date(),
    };
    setMessages([autoMessage]);

    // Only call /create once per conversationId - run in background, non-blocking
    if (conversationId && !createdConversationsRef.current.has(conversationId)) {
      createdConversationsRef.current.add(conversationId);
      
      // Fire and forget - don't wait for this to complete
      fetch('https://ipinfo.io/?callback=?',{
        method: "GET",
        headers: headers,
      }).then(res => res?.text()).then(data => {
        let ipInfo = data;
        fetch(`${config2.api.baseUrl}/conversation/${conversationId}/create?${params}`, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(ipInfo),
        }).catch(() => {
          // Fail silently
        });
      }).catch(() => {
        // Fail silently
      });
    }

    // Fetch conversation history in background - non-blocking
    // This will update messages if there are existing messages, but won't block the initial display
    fetch(
      `${config2.api.baseUrl}/conversation/${conversationId}/view?${params}`,
      {
        method: "GET",
        headers: headers,
      }
    )
      .then((res) => {
        if (res.status === 403) {
          setOtpModalOpen(true);
          throw new Error("403 Forbidden - OTP required");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const converted = data.messages.map((item) => {
            let contentArray;
            if (item.type === "user") {
              try {
                // Replace single quotes with double quotes for valid JSON parsing
                // const normalized = item.text.replace(/'/g, '"');
                // const parsed = JSON.parse(normalized);
                contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
              } catch (err) {
                contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
              }
            } else {
              // Assistant messages are plain text
              contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
            }

            return {
              role: item.type, // "user" or "assistant"
              content: contentArray,
              id: `${item.type}-message-${item.id}`,
              createdAt: new Date(), // You can use item.timestamp if available
              created_at: item.created_at,
            };
          });

          // Update messages with history if available, but keep autoMessage at the start
          setMessages([autoMessage, ...converted]);
        } else {
          const existingMessage = typeof window !== 'undefined' 
            ? JSON.parse(localStorage.getItem(`conversation:${conversationId}`) || "[]")
            : [];

          if (existingMessage.length > 1) {
            const parsedMessages = existingMessage.map((item) => ({
              role: item.role,
              content: [{ text: item.text, type: "text" }],
              id: "user-message-" + conversationId,
              createdAt: new Date(),
            }));
            setMessages(parsedMessages);
          }
          // If no existing messages, keep the autoMessage that was already set
        }
      })
      .catch((e) => {
        // If view fails, keep the autoMessage that was already displayed
        // Only update if we need to show error state (currently just keeping autoMessage)
        console.error("Error loading conversation history:", e);
      });
  };

  useEffect(() => {
    if (config?.chat?.isDark) setIsDarkMode(true);
  }, [config]);

  useEffect(() => {
    // const updatedArray = messages.map(msg => {
    //   if (msg.attachments) {
    //     const newMsg = { ...msg };
    //     delete newMsg.attachments;
    //     return newMsg;
    //   }
    //   return msg;
    // });

    if (conversationId && messages.length > 1) {
      const updatedArray = messages.map(({ attachments, ...rest }) => rest);
      saveMessages(conversationId, updatedArray);
    }
  }, [messages]);

  useEffect(() => {
    chatService.initializeConnection(conversationId);
    
    // Subscribe to connection status changes
    const unsubscribeStatus = chatService.onConnectionStatusChange((isConnected) => {
      console.log(`📡 [Assistant] Connection status changed: ${isConnected}`);
      setIsWebSocketConnected(isConnected);
    });
    
    const unsubscribe = chatService.onMessage((incoming) => {
      console.log("🔵 [WebSocket Handler] Message received", {
        timestamp: Date.now(),
        hasIncoming: !!incoming,
        type: incoming?.type,
        hasText: !!incoming?.text,
        textLength: incoming?.text?.length || 0,
        pk: incoming?.pk,
        id: incoming?.id,
        fullIncoming: incoming
      });
      
      // Fail silently if incoming is undefined
      if (!incoming) {
        console.log("🔵 [WebSocket Handler] Incoming is undefined, returning");
        return;
      }
      
      // Handle event messages first (display_suggestions, open_url, close_url)
      if (incoming?.type === "event") {
        console.log("🔵 [WebSocket Handler] Processing event message", {
          timestamp: Date.now(),
          action: incoming.event?.action,
          event: incoming.event
        });
        const action = incoming.event?.action;
        
        if (action === "open_url" || action === "on_open") {
          // Cancel any pending keyboard open timeout since an action was received
          if (keyboardOpenTimeoutRef.current) {
            clearTimeout(keyboardOpenTimeoutRef.current);
            keyboardOpenTimeoutRef.current = null;
          }
          
          iframe.openIframe(incoming.event.url);
          // Keep input focused when opening iframe (but only if no suggestions)
          if (!suggestedMessages?.buttons?.length) {
            keepInputFocused();
          }
        } else if (action === "close_url" || action === "on_close") {
          // Cancel any pending keyboard open timeout since an action was received
          if (keyboardOpenTimeoutRef.current) {
            clearTimeout(keyboardOpenTimeoutRef.current);
            keyboardOpenTimeoutRef.current = null;
          }
          
          iframe.closeIframe();
          // Keep input focused when closing iframe (but only if no suggestions)
          if (!suggestedMessages?.buttons?.length) {
            keepInputFocused();
          }
        } else if (action === "display_suggestions") {
          // When displaying suggestions, blur input to close keyboard
          // CRITICAL: Cancel any pending keyboard open timeout since suggestions are appearing
          if (keyboardOpenTimeoutRef.current) {
            clearTimeout(keyboardOpenTimeoutRef.current);
            keyboardOpenTimeoutRef.current = null;
          }
          
          // CRITICAL: Delay suggestions display to ensure any pending message updates complete first
          // This prevents messages from disappearing when suggestions appear
          setTimeout(() => {
            flushSync(() => {
          setStateData({ suggestedMessages: incoming.event });
            });
            // Close keyboard by blurring the input
            const input = document.querySelector('textarea[placeholder], textarea[data-composer-input]') as HTMLTextAreaElement | null;
            if (input && document.activeElement === input) {
              input.blur();
            }
          }, 100); // Delay to ensure messages are fully rendered first
        }
        return;
      }
      
      // Handle assistant messages - be more lenient with text validation
      // Accept messages even if text is empty or whitespace (might be streaming or partial)
      if (incoming?.type === "assistant" && incoming.text !== undefined && incoming.text !== null) {
        console.log("🔵 [WebSocket Handler] Processing assistant message", {
          timestamp: Date.now(),
          pk: incoming.pk,
          id: incoming.id,
          textLength: incoming.text.length,
          textPreview: incoming.text.substring(0, 50)
        });
        
        // Use pk (primary key) if available, otherwise use id, otherwise generate one
        // CRITICAL: Use a stable ID format that won't be confused with optimistic messages
        // Include timestamp to ensure uniqueness, but make it clear it's a real message
        const messageId = incoming.pk 
          ? `ws-msg-${String(incoming.pk)}` 
          : incoming.id 
          ? `ws-msg-${String(incoming.id)}` 
          : `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        console.log("🔵 [WebSocket Handler] Generated messageId", {
          timestamp: Date.now(),
          messageId,
          fromPk: !!incoming.pk,
          fromId: !!incoming.id
        });
        
        // Ensure text is a string, even if empty
        const messageText = typeof incoming.text === 'string' ? incoming.text : String(incoming.text || '');
        
        const incRes: ThreadMessageLike = {
          role: incoming.type || "assistant",
          content: [{ text: messageText, type: "text", created_at: incoming.created_at }],
          id: messageId,
          createdAt: new Date(),
        };
        
        console.log("🔵 [WebSocket Handler] Created message object", {
          timestamp: Date.now(),
          messageId: incRes.id,
          role: incRes.role,
          contentLength: incRes.content[0]?.text?.length || 0
        });
        
        // Update optimistic message or add new one
        // Use flushSync to ensure the update is processed immediately
        // CRITICAL: Wrap in try-catch to ensure message is never lost
        try {
          flushSync(() => {
            setMessages((currentConversation) => {
            console.log("🔵 [WebSocket Handler] setMessages callback - current state", {
              timestamp: Date.now(),
              conversationLength: currentConversation.length,
              messageIds: currentConversation.map(m => ({ id: m.id, role: m.role })),
              searchingForId: messageId
            });
            
            // First, check if message already exists by ID (pk) - most reliable check
            // Also check for messages with the same pk/id even if the prefix differs
            const existingByIdIndex = currentConversation.findIndex(msg => {
              const msgIdStr = String(msg.id);
              const incomingPkStr = incoming.pk ? String(incoming.pk) : null;
              const incomingIdStr = incoming.id ? String(incoming.id) : null;
              
              // Check exact match
              if (msgIdStr === String(messageId)) return true;
              
              // Check if message ID contains the pk/id (handles both prefixed and non-prefixed)
              if (incomingPkStr && (msgIdStr.includes(incomingPkStr) || msgIdStr === incomingPkStr)) return true;
              if (incomingIdStr && (msgIdStr.includes(incomingIdStr) || msgIdStr === incomingIdStr)) return true;
              
              return false;
            });
            
            console.log("🔵 [WebSocket Handler] ID check result", {
              timestamp: Date.now(),
              existingByIdIndex,
              foundById: existingByIdIndex !== -1,
              messageId
            });
            
            if (existingByIdIndex !== -1) {
              // Message already exists with this ID - update it to ensure content is current
              console.log("🔵 [WebSocket Handler] Message exists by ID, updating", {
                timestamp: Date.now(),
                existingIndex: existingByIdIndex,
                existingId: currentConversation[existingByIdIndex].id,
                newId: messageId,
                existingContentLength: currentConversation[existingByIdIndex].content[0]?.text?.length || 0,
                newContentLength: incRes.content[0]?.text?.length || 0
              });
              const updated = [...currentConversation];
              // Only update if new content is longer or different (for streaming updates)
              const existingText = updated[existingByIdIndex].content[0]?.text || '';
              const newText = incRes.content[0]?.text || '';
              if (newText.length > existingText.length || newText !== existingText) {
                updated[existingByIdIndex] = incRes;
              }
              return updated;
            }
            
            // Find the last optimistic assistant message (created by the library)
            let optimisticIndex = -1;
            for (let i = currentConversation.length - 1; i >= 0; i--) {
              const msg = currentConversation[i];
              if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                optimisticIndex = i;
                break;
              }
            }
            
            console.log("🔵 [WebSocket Handler] Optimistic message check", {
              timestamp: Date.now(),
              optimisticIndex,
              foundOptimistic: optimisticIndex !== -1,
              optimisticId: optimisticIndex !== -1 ? currentConversation[optimisticIndex].id : null
            });
            
            if (optimisticIndex !== -1) {
              // Update the optimistic message in place, keeping its ID but updating content
              // This preserves the stable ID reference that the component already has
              const optimisticId = currentConversation[optimisticIndex].id;
              const existingText = currentConversation[optimisticIndex].content[0]?.text || '';
              const newText = incRes.content[0]?.text || '';
              
              console.log("🔵 [WebSocket Handler] Updating optimistic message", {
                timestamp: Date.now(),
                optimisticIndex,
                optimisticId,
                newMessageId: messageId,
                willKeepOptimisticId: true,
                existingTextLength: existingText.length,
                newTextLength: newText.length
              });
              
              // Only update if new content is longer or different (for streaming updates)
              if (newText.length > existingText.length || newText !== existingText) {
                const updated = [...currentConversation];
                updated[optimisticIndex] = {
                  ...incRes,
                  id: optimisticId, // Keep the optimistic ID
                };
                
                console.log("🔵 [WebSocket Handler] Returning updated conversation (optimistic)", {
                  timestamp: Date.now(),
                  updatedLength: updated.length,
                  updatedMessage: updated[optimisticIndex] ? {
                    id: updated[optimisticIndex].id,
                    role: updated[optimisticIndex].role,
                    contentLength: updated[optimisticIndex].content[0]?.text?.length || 0
                  } : null
                });
                
                return updated;
              } else {
                // Content hasn't changed, return current state
                console.log("🔵 [WebSocket Handler] Content unchanged, keeping existing message", {
                  timestamp: Date.now(),
                  optimisticIndex
                });
                return currentConversation;
              }
            }
            
            // No optimistic message found - add the new message
            // WebSocket messages should always be added if they don't exist by ID
            console.log("🔵 [WebSocket Handler] No optimistic message, adding new message", {
              timestamp: Date.now(),
              currentLength: currentConversation.length,
              newMessageId: messageId,
              newMessageRole: incRes.role,
              newMessageContentLength: incRes.content[0]?.text?.length || 0
            });
            
            // Always add the message - don't check for duplicate content
            // CRITICAL: Ensure the message has actual text content so it won't be filtered by runtime
            // The runtime may filter empty or incomplete messages when isRunning changes
            const messageToAdd = {
              ...incRes,
              // Ensure content is properly structured
              content: incRes.content && incRes.content.length > 0 
                ? incRes.content 
                : [{ text: messageText || '', type: "text", created_at: incoming.created_at }]
            };
            
            const newConversation = [...currentConversation, messageToAdd];
            
            console.log("🔵 [WebSocket Handler] Returning new conversation with added message", {
              timestamp: Date.now(),
              newLength: newConversation.length,
              lastMessage: newConversation[newConversation.length - 1] ? {
                id: newConversation[newConversation.length - 1].id,
                role: newConversation[newConversation.length - 1].role,
                contentLength: newConversation[newConversation.length - 1].content[0]?.text?.length || 0
              } : null,
              allMessageIds: newConversation.map(m => ({ id: m.id, role: m.role }))
            });
            
            return newConversation;
            });
          });
        } catch (error) {
          // If flushSync fails, try adding message directly as fallback
          console.error("🔵 [WebSocket Handler] Error in flushSync, using fallback", {
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error),
            messageId
          });
          
          setMessages((currentConversation) => {
            // Simple fallback: just add the message if it doesn't exist
            const exists = currentConversation.some(msg => String(msg.id) === String(messageId));
            if (!exists) {
              return [...currentConversation, incRes];
            }
            return currentConversation;
          });
        }
        
        console.log("🔵 [WebSocket Handler] After flushSync, setting isRunning to false", {
          timestamp: Date.now(),
          messageId
        });
        
        // Set isRunning to false after message is added
        // Use a longer delay to ensure message is fully rendered and persisted before changing isRunning
        // This prevents the runtime from filtering the message when suggestions appear
        // CRITICAL: Wait longer to ensure message is fully in the DOM and cached before allowing runtime to filter
        // Use multiple requestAnimationFrame to ensure React has fully processed the update
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              setIsRunning(false);
            }, 200); // Additional delay to ensure message is fully persisted
            });
        });
        
        // CRITICAL: Wait 2 seconds after message response, then open keyboard if no action was received
        // This is the safest way to avoid opening keyboard when suggestions are about to appear
        // Clear any existing timeout first
        if (keyboardOpenTimeoutRef.current) {
          clearTimeout(keyboardOpenTimeoutRef.current);
          keyboardOpenTimeoutRef.current = null;
        }
        
        // Set a 2-second timeout to open keyboard if no action is received
        keyboardOpenTimeoutRef.current = setTimeout(() => {
          // Double-check that no suggestions are visible before opening keyboard
          const hasSuggestions = suggestedMessages?.buttons?.length > 0;
          const suggestionBar = document.querySelector('[data-suggestion-bar]');
          const suggestionsVisible = suggestionBar && suggestionBar.getBoundingClientRect().height > 0;
          const isIframeOpen = iframe.showIframe;
          
          // Only open keyboard if no suggestions are visible and iframe is closed
          if (!hasSuggestions && !suggestionsVisible && !isIframeOpen) {
            keepInputFocused();
          }
          
          keyboardOpenTimeoutRef.current = null;
        }, 2000); // Wait 2 seconds
      } else {
        console.log("🔵 [WebSocket Handler] Message skipped - not assistant or invalid", {
          timestamp: Date.now(),
          type: incoming?.type,
          hasText: incoming?.text !== undefined && incoming?.text !== null,
          textType: typeof incoming?.text,
          textValue: incoming?.text,
          textLength: typeof incoming?.text === 'string' ? incoming.text.length : 0,
          textIsEmpty: typeof incoming?.text === 'string' ? incoming.text.trim().length === 0 : true
        });
      }
    });
    return () => {
      // chatService.disconnect();
      unsubscribe();
      unsubscribeStatus();
      // Clean up any pending keyboard open timeout
      if (keyboardOpenTimeoutRef.current) {
        clearTimeout(keyboardOpenTimeoutRef.current);
        keyboardOpenTimeoutRef.current = null;
      }
    };
  }, [conversationId, suggestedMessages?.buttons?.length, iframe.showIframe]);

  // NOTE: Keyboard opening is now handled by the 2-second timeout after message responses
  // This is safer as it waits to see if any actions (like display_suggestions) are received
  // The old 1-second timeout logic has been removed in favor of this approach

  // === Chat Handlers ===
  const createNewChat = () => {
    const newId = uuidv4();
    saveConversationToHistory(newId, ""); // title will be set on first user message
    setHistory(getConversationHistory());
    switchConversation(newId);
  };

  const switchConversation = (id: string) => {
    setStateData({ conversationId: id });
    router.push(`/chat/${id}`, undefined, { shallow: true });
    if (typeof window !== 'undefined') {
    localStorage.setItem(`my-convo-${id}`, "true");
    }
  };

  const updateTitleIfNeeded = (msgText: string) => {
    if (!conversationId) return;
    const current = getConversationHistory().find(
      (h) => h.id === conversationId
    );
    if (!current?.title) {
      const title =
        msgText.trim().split(/\s+/).slice(0, 3).join(" ") || "Untitled Chat";
      saveConversationToHistory(conversationId, title);
      setHistory(getConversationHistory());
    }
  };

  const onNew = useCallback(
    async (userAppendMessage: AppendMessage) => {
      if (
        suggestedMessages?.buttons?.length > 0 &&
        suggestedMessages?.close_on_ignore === true
      ) {
        setStateData({ suggestedMessages: [] });
      }
 
      const text =
        userAppendMessage.content.find((c) => c.type === "text")?.text ?? "";
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
      updateTitleIfNeeded(text);
      
      // CRITICAL: Production vs Dev difference
      // In DEV: React's batching is more forgiving, runtime creates optimistic message and it syncs
      // In PROD: React batches more aggressively, causing timing issues where:
      //   1. Runtime creates optimistic message internally (not in our state)
      //   2. We search our state, don't find it, add new message with different ID
      //   3. Component locks onto runtime's ID, but we update different message = FLICKER
      // 
      // Solution: Set isRunning first, then wait a tick for runtime to create optimistic message
      // In production, we need explicit synchronization
      
      // CRITICAL: The runtime creates optimistic messages internally but doesn't add them to our state
      // The component locks onto the optimistic ID, but we can't update it if it's not in our state
      // Solution: Manually add an optimistic message to our state so we can find and update it later
      const optimisticId = `__optimistic__${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const optimisticMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ text: "", type: "text" }],
        id: optimisticId,
        createdAt: new Date(),
      };
      
      // Add optimistic message and set isRunning atomically
      if (process.env.NODE_ENV === 'production') {
        // In production, use flushSync to ensure atomic update
        flushSync(() => {
          setMessages((currentConversation) => [...currentConversation, optimisticMessage]);
      setIsRunning(true);
        });
      } else {
        // In dev, regular batching is fine
        setMessages((currentConversation) => [...currentConversation, optimisticMessage]);
        setIsRunning(true);
      }
      
      try {
        // Send message - response comes from API, not WebSocket
        const assistantResponse = await chatService.sendMessage(
          userAppendMessage,
          userId,
          conversationId!,
          resolvedSearchParams,
          ipAddress
        );
        
        // Fail silently if response is empty, undefined, or invalid
        if (!assistantResponse || !assistantResponse.type || !assistantResponse.text) {
          // Remove optimistic message and stop running state
          flushSync(() => {
            setMessages((currentConversation) => {
              // Remove optimistic messages
              return currentConversation.filter((msg) => {
                if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                  return false;
                }
                return true;
              });
            });
          });
          setIsRunning(false);
          return;
        }
        
        // Update the optimistic message with the real response
        // The library creates optimistic messages with IDs starting with '__optimistic__'
        // CRITICAL: Update both messages and isRunning atomically in the same flushSync
        // This prevents the runtime from seeing an inconsistent state in production
        const messageId = assistantResponse?.pk || assistantResponse?.id || `assistant-message-${Date.now()}`;
        
        // CRITICAL: Don't use messages.length here - it's a stale closure value!
        // We'll check inside setMessages callback where we have the current state
        flushSync(() => {
          setMessages((currentConversation) => {
            // CRITICAL: Use currentConversation (current state) not messages (stale closure)
            
            // CRITICAL: The runtime creates optimistic messages internally (not in our state)
            // The component sees them via useMessage and locks onto their optimistic ID
            // Strategy: 
            // 1. First, try to find ANY optimistic message (runtime might have added it to our state)
            // 2. If not found, replace the LAST assistant message
            // This ensures we update the message the component is locked onto
            
            // First, search for optimistic messages (runtime might have added them to our state)
            let optimisticIndex = -1;
            for (let i = currentConversation.length - 1; i >= 0; i--) {
              const msg = currentConversation[i];
              if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                optimisticIndex = i;
                break;
              }
            }
            
            // If no optimistic message found, find the last assistant message
            let lastAssistantIndex = -1;
            if (optimisticIndex === -1) {
              for (let i = currentConversation.length - 1; i >= 0; i--) {
                if (currentConversation[i].role === "assistant") {
                  lastAssistantIndex = i;
                  break;
                }
              }
            }
            
            const targetIndex = optimisticIndex !== -1 ? optimisticIndex : lastAssistantIndex;
            
            // If we found a target message (optimistic or last assistant), replace it
            // This handles both cases: runtime added optimistic to state, or we need to update last assistant
            if (targetIndex !== -1) {
              // Update the target message in place, keeping its ID
              // This ensures useMessage returns a message with the same ID,
              // which matches what the component's stable ID reference expects
              const targetId = currentConversation[targetIndex].id;
              
              const updated = [...currentConversation];
              
              // CRITICAL: React 19 + Next.js 15.2 production has stricter automatic batching
              // The component locks onto the optimistic ID via stable ref
              // If we change the ID, useMessage might return a different message, causing unmount
              // Solution: Keep the optimistic ID so the component's stable ref continues to match
              // The message will have real content, so it won't be empty even if runtime filters optimistic messages
              // We'll delay setting isRunning=false to ensure the update renders first
              
              updated[targetIndex] = {
                role: assistantResponse.type || "assistant",
                content: [{ text: assistantResponse.text || "", type: "text", created_at: assistantResponse.created_at }],
                id: targetId, // CRITICAL: Keep the optimistic ID so component's stable ref matches
                createdAt: new Date(),
              };
              
              // CRITICAL: Remove any OTHER optimistic messages (old ones from previous messages)
              // This prevents multiple optimistic messages from accumulating
              const cleaned = updated.filter((msg, idx) => {
                if (idx === targetIndex) return true; // Keep the one we just updated
                // Remove other optimistic assistant messages
                if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                  return false;
                }
                return true;
              });
              
              if (cleaned.length !== updated.length) {
                return cleaned;
              }
              
              return updated;
            }
            
            // No optimistic message found (shouldn't happen, but handle gracefully)
            
        const assRes: ThreadMessageLike = {
              role: assistantResponse.type || "assistant",
              content: [{ text: assistantResponse.text || "", type: "text", created_at: assistantResponse.created_at }],
              id: messageId,
          createdAt: new Date(),
        };
            return [...currentConversation, assRes];
          });
          
          // CRITICAL: Don't set isRunning to false immediately
          // The runtime filters optimistic messages when isRunning=false, causing flicker
          // We'll set it to false after a delay to ensure the message update is fully rendered
          // In production, React's batching is stricter, so we need explicit timing
          
          // Set isRunning to false after the message update is rendered
          // This prevents the runtime from filtering the optimistic message before it's updated
          if (process.env.NODE_ENV === 'production') {
            // In production, use multiple requestAnimationFrame to ensure render completes
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setIsRunning(false);
              });
            });
          } else {
            // In dev, single frame is usually enough
            requestAnimationFrame(() => {
              setIsRunning(false);
            });
          }
        });
        
        setlastMessageResponse(assistantResponse);
      } catch (error) {
        // Fail silently - remove optimistic message and stop running state
        flushSync(() => {
          setMessages((currentConversation) => {
            // Remove optimistic messages
            return currentConversation.filter((msg) => {
              if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                return false;
              }
              return true;
            });
          });
        });
        setIsRunning(false);
      }
    },
    [chatService, setMessages, setIsRunning]
  );

  const deleteConversation = (id: string) => {
    const updated = history.filter((c) => c.id !== id);
      if (typeof window !== 'undefined') {
    localStorage.setItem("chatHistory", JSON.stringify(updated));
    localStorage.removeItem(`conversation:${id}`);
      }
    setHistory(updated);

    if (conversationId === id) {
      updated.length ? switchConversation(updated[0].id) : createNewChat();
    }
  };

  // Memoize adapters to prevent recreation on every render
  const adapters = useMemo(() => ({
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new SimplePdfAttachmentAdapter(),
      ]),
  }), []);

  // Memoize convertMessage to prevent runtime recreation
  const convertMessage = useCallback((m: any) => m, []);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    adapters,
  });
  

 
  if (!config) return <div>Loading config...</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <WebSocketLoadingOverlay isVisible={!isWebSocketConnected} />
        {/* <CookiebotLoader config={config} /> */}
      {/* HEADER */}

      {/* MAIN LAYOUT */}
      <div 
        className="flex flex-col relative"
        style={{
          height: visualViewportHeight ? `${visualViewportHeight}px` : '100dvh',
          maxHeight: visualViewportHeight ? `${visualViewportHeight}px` : '100dvh',
        }}
      >

<header
  className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 bg-blue-950 border-b dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
  style={{
    // On mobile, position relative to visual viewport offset
    transform: typeof window !== 'undefined' && window.visualViewport 
      ? `translateY(${window.visualViewport.offsetTop}px)` 
      : undefined,
  }}
>
  <ThemeAwareLogo
    width={180}
    height={30}
    isDarkMode={isDarkMode}
    config={config}
  />
   {/* <button
      onClick={() => window?.Cookiebot?.renew?.()}
      className="mt-2 px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800"
    >
      R
    </button>  */}
</header>

<main 
  className="flex-1 overflow-y-auto" 
  style={{ 
    marginTop: '4rem', // Account for fixed header height
    height: visualViewportHeight ? `calc(${visualViewportHeight}px - 4rem)` : 'calc(100dvh - 4rem)',
    maxHeight: visualViewportHeight ? `calc(${visualViewportHeight}px - 4rem)` : 'calc(100dvh - 4rem)',
  }}
>
  <Thread
    sidebarOpen={sidebarOpen}
    setStateData={setStateData}
    onResetUserId={() => {}}
    isDarkMode={isDarkMode}
    toggleDarkMode={() => {
      setIsDarkMode((prev) => !prev);
      document.documentElement.classList.toggle("dark", !isDarkMode);
    }}
    defaultTitle={config.app.title || 'Mem0 Assistant'}
    disclaimer={config.app.disclaimer}
    colors={config.chat?.colors}
    onNew={onNew}
    messages={messages}
    config={config}
    suggestedMessages={suggestedMessages}
    runtime={runtime}
    isIframeOpen={iframe.showIframe}
  />
</main>
</div>


      {/* <main className="flex-1 overflow-y-auto">
    <Thread
      sidebarOpen={sidebarOpen}
      setStateData={setStateData}
      onResetUserId={() => {}}
      isDarkMode={isDarkMode}
      toggleDarkMode={() => {
        setIsDarkMode((prev) => !prev);
        document.documentElement.classList.toggle("dark", !isDarkMode);
      }}
      defaultTitle={config.app.title || 'Mem0 Assistant'}
      disclaimer={config.app.disclaimer}
      colors={config.chat?.colors}
      onNew={onNew}
      messages={messages}
      config={config}
      suggestedMessages={suggestedMessages}
      runtime={runtime}
    />
  </main> */}

      {config.chat.isVisible && (
        <Button variant="contained" onClick={handleModalOpen}>
          Show JSON Message
        </Button>
      )}
      {/* JSON Viewer Modal */}
      <ActionModal
        config={config}
        open={iframe.showIframe}
        url={iframe.iframeUrl}
        iframeError={iframe.iframeError}
        onClose={iframe.closeIframe}
        onIframeError={iframe.onIframeError}
        onIframeLoad={iframe.onIframeLoad}
      />

      <OtpModal
        open={otpModalOpen}
        onOtpSuccess={() => {
          setOtpModalOpen(false);
          initConversation(config); // retry with new header
        }}
        conversationId={conversationId}
        config={config}
        // onVerify={(otp) => handleOtpVerification(otp)}
      />
      <Modal open={modalOpen} onClose={handleModalClose}>
        <Box sx={style}>
          <Typography variant="h6" mb={2}>
            JSON Response
          </Typography>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "10px",
              borderRadius: "4px",
            }}
          >
            {JSON.stringify(lastMessageResponse, null, 2)}
          </pre>
        </Box>
      </Modal>

      {/* <Modal open={openCookieModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "background.paper",
            p: 4,
            borderRadius: 2,
            boxShadow: 24,
            width: 400,
            textAlign: "",
          }}
        >
          <Typography variant="h6" gutterBottom>
            {config.cookie.header}
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            {config.cookie.description}
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "", gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              disabled={cookieLoading}
              onClick={() =>
                handleSelection(
                  config,
                  "accept",
                  conversationId,
                  setCookieLoading,
                  setOpenCookieModal
                )
              }
            >
              {config.cookie.acceptButton}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={cookieLoading}
              onClick={() =>
                handleSelection(
                  config,
                  "reject",
                  conversationId,
                  setCookieLoading,
                  setOpenCookieModal
                )
              }
            >
              {config.cookie.rejectButton}
            </Button>
          </Box>
        </Box>
      </Modal> */}
    </AssistantRuntimeProvider>
  );
}
