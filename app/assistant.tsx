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
import { useEffect, useState, use } from "react";
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

// === Utility Functions ===
declare global {
  interface Window {
    Cookiebot?: any;
  }
}

const getOrCreateUserId = () => {
  let id = localStorage.getItem("userId1");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("userId1", id);
  }
  return id;
};

const getConversationHistory = () => {
  return JSON.parse(localStorage.getItem("chatHistory") || "[]");
};

const saveConversationToHistory = (id: string, title: string) => {
  const history = getConversationHistory();
  const exists = history.find((h) => h.id === id);
  if (!exists) {
    history.push({ id, title });
  } else if (title && !exists.title) {
    exists.title = title;
  }
  localStorage.setItem("chatHistory", JSON.stringify(history));
};

const saveMessages = (id: string, messages: any[]) => {
  localStorage.setItem(`conversation:${id}`, JSON.stringify(messages));
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
}: {
  initialConversationId: string | null;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
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
  
  // Log messages changes for debugging
  useEffect(() => {
    console.log("🟢 [Assistant] Messages state changed", {
      timestamp: Date.now(),
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1] ? {
        id: messages[messages.length - 1].id,
        role: messages[messages.length - 1].role,
        contentLength: messages[messages.length - 1].content?.[0]?.text?.length || 0,
        isOptimistic: String(messages[messages.length - 1].id).startsWith("__optimistic__")
      } : null,
      allMessageIds: messages.map(m => ({ id: m.id, role: m.role, isOptimistic: String(m.id).startsWith("__optimistic__") }))
    });
  }, [messages]);
  
  // Log isRunning changes for debugging
  useEffect(() => {
    console.log("🟡 [Assistant] isRunning state changed", {
      timestamp: Date.now(),
      isRunning,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1] ? {
        id: messages[messages.length - 1].id,
        role: messages[messages.length - 1].role
      } : null
    });
  }, [isRunning, messages.length]);
  const [config, setConfig] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [lastMessageResponse, setlastMessageResponse] = useState(null);
  const [openCookieModal, setOpenCookieModal] = useState(true);
  const [cookieLoading, setCookieLoading] = useState(false);
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

  console.log("🔴 [Assistant] Component render", {
    timestamp: Date.now(),
    initialConversationId,
    messageCount: messages.length,
    isRunning,
    lastMessage: messages[messages.length - 1] ? {
      id: messages[messages.length - 1].id,
      role: messages[messages.length - 1].role,
      isOptimistic: String(messages[messages.length - 1].id).startsWith("__optimistic__")
    } : null
  });
  
  const userId = getOrCreateUserId();
  const [modalOpen, setModalOpen] = useState(false);

  const handleModalOpen = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);

  // Step 1: Load config once on page load

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        // const cookieConsent = getCookie("cookieConsent");
        // if (cookieConsent) {
        //   setOpenCookieModal(false);
        // }
        fetch("/api/getip")
        .then((res) => res.json())
        .then((data) => {
          console.log("🚀 ~ useEffect ~ data:", data)
          setStateData({ ipAddress: data });
        })
        setConfig(data);
        initConversation(data);
        window?.Cookiebot?.renew?.();
        // call your logic here directly
      });
  }, []);

  useEffect(() => {
    const handleConsentUpdate = async (event) => {
      console.log("🚀 Cookiebot event:", event.type);
  
      // Wait until Cookiebot is fully ready
      if (!window.Cookiebot || !window.Cookiebot.consent) {
        console.log("⚠️ Cookiebot not ready yet");
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
        console.error("Invalid JSON in otpPhrase cookie", e);
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

    let ipInfo = 
    
    fetch('https://ipinfo.io/?callback=?',{
      method: "GET",
      headers: headers,
    }).then(res => res?.text()).then(data => {
      let ipInfo = data;
      console.log("🚀🚀🚀🚀 ~ useEffect ~ ipInfo:", ipInfo)
      fetch(`${config2.api.baseUrl}/conversation/${conversationId}/create?${params}`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(ipInfo),
      })
    }).catch(err => {
      console.log("🚀🚀🚀🚀 ~ useEffect ~ err:", err)
      
    });


      
        


    fetch(
      `${config2.api.baseUrl}/conversation/${conversationId}/view?${params}`,
      {
        method: "GET",
        headers: headers,
      }
    )
      .then((res) => {
        console.log("Status:", res.status);
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
                console.warn(
                  "Failed to parse user message text, using fallback:",
                  item.text
                );
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
          const autoMessage = {
            role: config2.chat.autoMessage.role,
            content: [{ ...config2.chat.autoMessage, type: "text", created_at: new Date() }],
            id: "user-message-" + conversationId,
            createdAt: new Date(),
            created_at: new Date(),
          };

          setMessages([autoMessage, ...converted]);
        } else {
          const existingMessage = JSON.parse(
            localStorage.getItem(`conversation:${conversationId}`) || "[]"
          );

          console.log("🚀 ~ existingMessage:", existingMessage);
          if (existingMessage.length > 1) {
            const parsedMessages = existingMessage.map((item) => ({
              role: item.role,
              content: [{ text: item.text, type: "text" }],
              id: "user-message-" + conversationId,
              createdAt: new Date(),
            }));
            setMessages(parsedMessages);
          } else {
            setMessages([
              {
                role: config2.chat.autoMessage.role,
                content: [{ ...config2.chat.autoMessage, type: "text", created_at: new Date() }],
                id: "user-message-" + conversationId,
                createdAt: new Date(),
              },
            ]);
          }
        }
      })
      .catch((e) => {
        setMessages([
          {
            role: config2.chat.autoMessage.role,
            content: [{ ...config2.chat.autoMessage, type: "text" }],
            id: "user-message-" + conversationId,
            createdAt: new Date(),
          },
        ]);
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
    const unsubscribe = chatService.onMessage((incoming) => {
      console.log("🟠 [WebSocket] Incoming message received", {
        timestamp: Date.now(),
        type: incoming?.type,
        hasText: !!incoming?.text,
        textLength: incoming?.text?.length || 0,
        pk: incoming?.pk,
        id: incoming?.id,
        fullIncoming: incoming
      });
      
      if (incoming?.type === "assistant" && incoming.text) {
        console.log("🟠 [WebSocket] Processing assistant message", {
          timestamp: Date.now(),
          pk: incoming.pk,
          id: incoming.id,
          textLength: incoming.text.length,
          textPreview: incoming.text.substring(0, 50)
        });
        const messageId = incoming.pk || `assistant-message-${Date.now()}`;
        console.log("🟠 [WebSocket] Generated messageId", {
          timestamp: Date.now(),
          messageId,
          fromPk: !!incoming.pk,
          fromId: !!incoming.id
        });
        
        const incRes: ThreadMessageLike = {
          role: incoming.type,
          content: [{ text: incoming.text, type: "text", created_at: incoming.created_at }],
          id: messageId,
          createdAt: new Date(),
        };
        
        // Update optimistic message or add new one
        // The library creates optimistic messages with IDs starting with '__optimistic__'
        // We should replace the last optimistic assistant message with the real one
        setMessages((currentConversation) => {
          console.log("🟠 [WebSocket] setMessages callback - checking for duplicates", {
            timestamp: Date.now(),
            conversationLength: currentConversation.length,
            incomingTextLength: incoming.text?.length || 0,
            incomingTextPreview: incoming.text?.substring(0, 50) || ''
          });
          
          // Check if message was already handled by API response
          // API response updates optimistic message, so if there's no optimistic message,
          // it means API already handled it
          const exists = currentConversation.some(msg => {
            // Check by content match (API response already updated the optimistic message)
            const matches = msg.role === "assistant" && 
                   Array.isArray(msg.content) && 
                   msg.content[0]?.text === incoming.text &&
                   !String(msg.id).startsWith("__optimistic__");
            if (matches) {
              console.log("🟠 [WebSocket] Found matching message (already handled by API)", {
                timestamp: Date.now(),
                existingMessageId: msg.id,
                existingContentLength: msg.content[0]?.text?.length || 0
              });
            }
            return matches;
          });
          
          if (exists) {
            console.log("🟠 [WebSocket] Message already handled by API, skipping WebSocket duplicate", {
              timestamp: Date.now(),
              messageId,
              action: "skipping and setting isRunning to false"
            });
            setIsRunning(false);
            return currentConversation;
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
          
          console.log("🟠 [WebSocket] Optimistic message search result", {
            timestamp: Date.now(),
            optimisticIndex,
            foundOptimistic: optimisticIndex !== -1,
            optimisticId: optimisticIndex !== -1 ? currentConversation[optimisticIndex].id : null
          });
          
          if (optimisticIndex !== -1) {
            // Update the optimistic message in place, keeping its ID but updating content
            // This preserves the stable ID reference that the component already has
            const optimisticId = currentConversation[optimisticIndex].id;
            const oldContent = currentConversation[optimisticIndex].content?.[0]?.text || '';
            
            console.log("🟠 [WebSocket] Updating optimistic message with real content from WebSocket", {
              timestamp: Date.now(),
              optimisticId: optimisticId,
              realId: messageId,
              oldContentLength: oldContent.length,
              newContentLength: incoming.text?.length || 0,
              contentChanged: oldContent !== incoming.text
            });
            
            const updated = [...currentConversation];
            updated[optimisticIndex] = {
              ...incRes,
              id: optimisticId, // Keep the optimistic ID
            };
            
            console.log("🟠 [WebSocket] Message updated, setting isRunning to false", {
              timestamp: Date.now(),
              updatedMessageId: updated[optimisticIndex].id,
              keptOptimisticId: updated[optimisticIndex].id === optimisticId,
              updatedContentLength: updated[optimisticIndex].content?.[0]?.text?.length || 0
            });
            
            setIsRunning(false);
            return updated;
          }
          
          // No optimistic message found - API already handled it, just update isRunning
          console.log("🟠 [WebSocket] No optimistic message found - API already handled it", {
            timestamp: Date.now(),
            messageId,
            action: "setting isRunning to false only"
          });
          
          setIsRunning(false);
          return currentConversation;
        });
      }
      if (incoming?.type === "event") {
        const action = incoming.event?.action;
        if (action === "open_url") {
          iframe.openIframe(incoming.event.url);
        } else if (action === "close_url") {
          iframe.closeIframe();
        } else if (action === "display_suggestions") {
          console.log("🚀 ~ unsubscribe ~ incoming.event:", incoming.event);
          setStateData({ suggestedMessages: incoming.event });
        }
      }
    });
    return () => {
      // chatService.disconnect();
      unsubscribe();
    };
  }, [conversationId]);

  // === Chat Handlers ===
  const createNewChat = () => {
    const newId = uuidv4();
    saveConversationToHistory(newId, ""); // title will be set on first user message
    setHistory(getConversationHistory());
    switchConversation(newId);
  };

  const switchConversation = (id: string) => {
    setStateData({ conversationId: id });
    // const data = loadMessages(id);
    // console.log("🚀 ~ switchConversation ~ data:", data);
    // setMessages(data);
    router.push(`/chat/${id}`, undefined, { shallow: true });
    localStorage.setItem(`my-convo-${id}`, "true");
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
      console.log("🔵 [onNew] Setting isRunning to true", {
        timestamp: Date.now(),
        conversationId,
        messageCount: messages.length,
        environment: process.env.NODE_ENV,
        note: "CRITICAL: In production, React batches more aggressively - need to add optimistic message atomically with isRunning"
      });
      
      // CRITICAL: Production vs Dev difference
      // In DEV: React's batching is more forgiving, runtime creates optimistic message and it syncs
      // In PROD: React batches more aggressively, causing timing issues where:
      //   1. Runtime creates optimistic message internally (not in our state)
      //   2. We search our state, don't find it, add new message with different ID
      //   3. Component locks onto runtime's ID, but we update different message = FLICKER
      // 
      // Solution: Set isRunning first, then wait a tick for runtime to create optimistic message
      // In production, we need explicit synchronization
      console.log("🔵 [onNew] Setting isRunning to true", {
        timestamp: Date.now(),
        environment: process.env.NODE_ENV,
        note: process.env.NODE_ENV === 'production' 
          ? "PROD: Need to wait for runtime to create optimistic message"
          : "DEV: React batching is more forgiving"
      });
      
      setIsRunning(true);
      
      // CRITICAL: Production vs Dev timing difference
      // In PROD: React batches more aggressively, runtime might not have added optimistic message yet
      // In DEV: React's batching is more forgiving, optimistic message appears faster
      // Solution: Wait for runtime to add optimistic message to our state before API call
      if (process.env.NODE_ENV === 'production') {
        // Wait for runtime to process isRunning=true and add optimistic message to our state
        // Use multiple requestAnimationFrame calls to ensure React has processed the state update
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve(undefined);
            });
          });
        });
        
        console.log("🔵 [onNew] After waiting for runtime in production", {
          timestamp: Date.now(),
          messageCount: messages.length,
          note: "Runtime should have added optimistic message by now"
        });
      }
      
      try {
        console.log("🔵 [onNew] Sending message to API", {
          timestamp: Date.now(),
          conversationId,
          userId,
          textLength: text.length
        });
        // Send message - response comes from API, not WebSocket
        const assistantResponse = await chatService.sendMessage(
          userAppendMessage,
          userId,
          conversationId!,
          resolvedSearchParams,
          ipAddress
        );
        
        console.log("🔵 [onNew] API response received", {
          timestamp: Date.now(),
          responseType: assistantResponse?.type,
          responseTextLength: assistantResponse?.text?.length || 0,
          responsePk: assistantResponse?.pk,
          responseId: assistantResponse?.id,
          hasText: !!assistantResponse?.text
        });
        
        // Update the optimistic message with the real response
        // The library creates optimistic messages with IDs starting with '__optimistic__'
        // CRITICAL: Update both messages and isRunning atomically in the same flushSync
        // This prevents the runtime from seeing an inconsistent state in production
        const messageId = assistantResponse?.pk || assistantResponse?.id || `assistant-message-${Date.now()}`;
        
        // CRITICAL: Don't use messages.length here - it's a stale closure value!
        // We'll check inside setMessages callback where we have the current state
        console.log("🔵 [onNew] Before flushSync - starting message update", {
          timestamp: Date.now(),
          messageId,
          isRunningBefore: true,
          note: "Will check messages inside setMessages callback to avoid stale closure"
        });
        
        flushSync(() => {
          console.log("🔵 [onNew] Inside flushSync - starting message update", {
            timestamp: Date.now(),
            messageId,
            isRunningBefore: true
          });
          
          setMessages((currentConversation) => {
            // CRITICAL: Use currentConversation (current state) not messages (stale closure)
            console.log("🔵 [onNew] setMessages callback - current conversation state", {
              timestamp: Date.now(),
              conversationLength: currentConversation.length,
              lastMessage: currentConversation[currentConversation.length - 1] ? {
                id: currentConversation[currentConversation.length - 1].id,
                role: currentConversation[currentConversation.length - 1].role,
                hasContent: !!currentConversation[currentConversation.length - 1].content?.[0]?.text,
                isOptimistic: String(currentConversation[currentConversation.length - 1].id).startsWith("__optimistic__")
              } : null,
              allMessageIds: currentConversation.map(m => ({ id: m.id, role: m.role, isOptimistic: String(m.id).startsWith("__optimistic__") })),
              optimisticMessages: currentConversation.filter(m => String(m.id).startsWith("__optimistic__")).map(m => ({
                id: m.id,
                role: m.role,
                hasContent: !!m.content?.[0]?.text
              }))
            });
            
            // Find the last optimistic assistant message (we manually added it when isRunning became true)
            let optimisticIndex = -1;
            for (let i = currentConversation.length - 1; i >= 0; i--) {
              const msg = currentConversation[i];
              if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                optimisticIndex = i;
                break;
              }
            }
            
            console.log("🔵 [onNew] Searching for optimistic message we added", {
              timestamp: Date.now(),
              optimisticIndex,
              foundOptimistic: optimisticIndex !== -1,
              optimisticId: optimisticIndex !== -1 ? currentConversation[optimisticIndex].id : null
            });
            
            if (optimisticIndex !== -1) {
              // Update the optimistic message in place, keeping its optimistic ID
              // This ensures useMessage returns a message with the optimistic ID,
              // which matches what the component's stable ID reference expects
              const optimisticId = currentConversation[optimisticIndex].id;
              const oldContent = currentConversation[optimisticIndex].content?.[0]?.text || '';
              
              console.log("🔵 [onNew] Updating optimistic message with API response (keeping optimistic ID):", {
                timestamp: Date.now(),
                optimisticId: optimisticId,
                realId: messageId,
                willKeepId: optimisticId,
                oldContentLength: oldContent.length,
                newContentLength: assistantResponse.text?.length || 0,
                contentChanged: oldContent !== assistantResponse.text
              });
              
              const updated = [...currentConversation];
              updated[optimisticIndex] = {
                role: assistantResponse.type,
                content: [{ text: assistantResponse.text, type: "text", created_at: assistantResponse.created_at }],
                id: optimisticId, // Keep the optimistic ID so component's stable ID matches
                createdAt: new Date(),
              };
              
              console.log("🔵 [onNew] Message updated, verifying ID:", {
                timestamp: Date.now(),
                updatedMessageId: updated[optimisticIndex].id,
                expectedId: optimisticId,
                match: updated[optimisticIndex].id === optimisticId,
                updatedContentLength: updated[optimisticIndex].content?.[0]?.text?.length || 0,
                updatedMessageRole: updated[optimisticIndex].role,
                updatedContentPreview: updated[optimisticIndex].content?.[0]?.text?.substring(0, 50) || ''
              });
              
              console.log("🔵 [onNew] Returning updated conversation", {
                timestamp: Date.now(),
                updatedLength: updated.length,
                updatedLastMessage: updated[updated.length - 1] ? {
                  id: updated[updated.length - 1].id,
                  role: updated[updated.length - 1].role,
                  contentLength: updated[updated.length - 1].content?.[0]?.text?.length || 0,
                  isOptimistic: String(updated[updated.length - 1].id).startsWith("__optimistic__")
                } : null,
                allUpdatedIds: updated.map(m => ({ id: m.id, role: m.role, isOptimistic: String(m.id).startsWith("__optimistic__") }))
              });
              
              return updated;
            }
            
            // No optimistic message found (shouldn't happen, but handle gracefully)
            console.log("🔵 [onNew] No optimistic message found, adding new message", {
              timestamp: Date.now(),
              messageId,
              conversationLength: currentConversation.length
            });
            
            const assRes: ThreadMessageLike = {
              role: assistantResponse.type,
              content: [{ text: assistantResponse.text, type: "text", created_at: assistantResponse.created_at }],
              id: messageId,
              createdAt: new Date(),
            };
            return [...currentConversation, assRes];
          });
          
          // CRITICAL: Set isRunning to false in the same flushSync to ensure atomic update
          console.log("🔵 [onNew] Setting isRunning to false inside flushSync", {
            timestamp: Date.now(),
            isRunningBefore: true,
            messageUpdateCommitted: true
          });
          setIsRunning(false);
          
          console.log("🔵 [onNew] flushSync complete - both updates committed atomically", {
            timestamp: Date.now(),
            isRunningSetToFalse: true,
            messageUpdateCommitted: true
          });
        });
        
        console.log("🔵 [onNew] After flushSync - state updates committed", {
          timestamp: Date.now(),
          messageId,
          nextTick: "React will process these updates"
        });
        
        setlastMessageResponse(assistantResponse);
      } catch (error) {
        setStateData({ error: error });
        console.error("Error communicating with backend:", error);
        // On error, stop the running state so optimistic message is removed
        setIsRunning(false);
      }
    },
    [chatService, setMessages, setIsRunning]
  );

  const deleteConversation = (id: string) => {
    const updated = history.filter((c) => c.id !== id);
    localStorage.setItem("chatHistory", JSON.stringify(updated));
    localStorage.removeItem(`conversation:${id}`);
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
  
  // Log runtime state changes for debugging
  useEffect(() => {
    console.log("🟣 [Assistant] Runtime state snapshot", {
      timestamp: Date.now(),
      isRunning,
      messageCount: messages.length,
      runtimeMessages: messages.map(m => ({
        id: m.id,
        role: m.role,
        isOptimistic: String(m.id).startsWith("__optimistic__"),
        contentLength: m.content?.[0]?.text?.length || 0,
        contentPreview: m.content?.[0]?.text?.substring(0, 30) || ''
      }))
    });
  }, [isRunning, messages]);

 
  if (!config) return <div>Loading config...</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
        {/* <CookiebotLoader config={config} /> */}
      {/* HEADER */}

      {/* MAIN LAYOUT */}
      <div className="flex flex-col h-[100dvh]">

<header
  className="sticky top-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 bg-blue-950 border-b dark:bg-zinc-900 dark:border-zinc-800 dark:text-white"
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

<main className="flex-1 overflow-y-auto" style={{ height: 'calc(100dvh - 4rem)' }}>
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
