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
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sun, Moon, AlignJustify } from "lucide-react";
import { Composer, Thread, ThreadScrollToBottom } from "@/components/assistant-ui/thread";
import ThemeAwareLogo from "@/components/mem0/theme-aware-logo";
import ActionModal from "@/components/mem0/ActionModal";
import { useIframe } from "./hooks/useIframe";
import { chatService } from "./services/chatService";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { SimplePdfAttachmentAdapter } from "./services/SimplePdfAttachmentAdapter";
import { OtpModal } from "@/components/assistant-ui/otpModal";
import { Box, Button, Modal, Typography } from "@mui/material";
import { getCookie, setCookie } from "cookies-next";
import { handleSelection } from "./utils/addOtpPhrase";
import { useBindReducer } from "./utils/useThunkReducer";
import { ThreadList } from "@/components/assistant-ui/thread-list";

// === Utility Functions ===

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
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const router = useRouter();
  const iframe = useIframe();

  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [history, setHistory] = useState(() => getConversationHistory());
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [lastMessageResponse, setlastMessageResponse] = useState(null);
  const [openCookieModal, setOpenCookieModal] = useState(true);
  const [cookieLoading, setCookieLoading] = useState(false);
  const [
    {
      error,
      suggestedMessages,
      conversationId,
      sidebarOpen
    },
    setStateData,
  ] = useBindReducer({
    error: null,
    suggestedMessages: [],
    conversationId: initialConversationId,
    sidebarOpen: true,
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
        const cookieConsent = getCookie("cookieConsent");
        if (cookieConsent) {
          setOpenCookieModal(false);
        }
        setConfig(data);
        initConversation(data);
        // call your logic here directly
      });
  }, []);

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
    const params = new URLSearchParams(searchParams).toString();
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
                contentArray = [{ type: "text", text: item.text }];
              } catch (err) {
                console.warn(
                  "Failed to parse user message text, using fallback:",
                  item.text
                );
                contentArray = [{ type: "text", text: item.text }];
              }
            } else {
              // Assistant messages are plain text
              contentArray = [{ type: "text", text: item.text }];
            }

            return {
              role: item.type, // "user" or "assistant"
              content: contentArray,
              id: `${item.type}-message-${item.id}`,
              createdAt: new Date(), // You can use item.timestamp if available
            };
          });
          const autoMessage = {
            role: config2.chat.autoMessage.role,
            content: [{ ...config2.chat.autoMessage, type: "text" }],
            id: "user-message-" + conversationId,
            createdAt: new Date(),
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
                content: [{ ...config2.chat.autoMessage, type: "text" }],
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
        if (action === "open_url") {
          iframe.openIframe(incoming.event.url);
        } else if (action === "close_url") {
          iframe.closeIframe();
        } else if (action === "display_suggestions") {
          console.log("🚀 ~ unsubscribe ~ incoming.event:", incoming.event)
          setStateData({ suggestedMessages: incoming.event });
        }
      }
    });
    return () => {
      chatService.disconnect();
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
    setStateData({conversationId: id});
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
      if (suggestedMessages?.buttons?.length > 0 && suggestedMessages?.close_on_ignore === true) {
        setStateData({suggestedMessages: []});
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
      setIsRunning(true);
      try {
        const assistantResponse = await chatService.sendMessage(
          userAppendMessage,
          userId,
          conversationId!,
          searchParams
        );
        const assRes: ThreadMessageLike = {
          role: assistantResponse.type,
          content: [{ text: assistantResponse.text, type: "text" }],
          id: `user-message-${Date.now()}`,
          createdAt: new Date(),
        };
        setMessages((currentConversation) => [...currentConversation, assRes]);
        setlastMessageResponse(assistantResponse);
      } catch (error) {
        setStateData({ error: error });
        console.error("Error communicating with backend:", error);
      } finally {
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

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage: (m: any) => m,
    onNew,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new SimplePdfAttachmentAdapter(),
      ]),
    },
  });
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Detect visual viewport changes when keyboard opens
    const viewport = window.visualViewport;

    if (!viewport) return;

    const handleResize = () => {
      const bottomOffset = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(bottomOffset > 0 ? bottomOffset : 0);
    };

    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleResize);

    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleResize);
    };
  }, []);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  if (!config) return <div>Loading config...</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
        {/* HEADER */}
    

        {/* MAIN LAYOUT */}
        <div
      className="flex flex-col bg-gray-50"
      style={{
        ["--thread-max-width" as string]: "42rem",
        height: "100dvh", // dynamic viewport height (supports keyboard)
        overflow: "hidden",
      }}
    >
      {/* 🔸 Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 bg-blue-950 border-b dark:bg-zinc-900 dark:border-zinc-800 dark:text-white">
      <ThemeAwareLogo
      width={180}
      height={30}
      isDarkMode={isDarkMode}
      config={config}
    />
    <button
      onClick={() => window?.Cookiebot?.renew?.()}
      className="mt-2 px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800"
    >
      R
    </button>
      </header>

      {/* 🔸 Scrollable Messages */}
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

      {/* 🔸 Fixed Bottom Input (moves with keyboard) */}
      <div
        className="fixed left-0 right-0 z-50 transition-transform duration-200"
        style={{
          bottom: keyboardHeight,
        }}
      >
        <div className="sticky bottom-0 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit px-4 md:pb-4 mx-auto">
        <ThreadScrollToBottom />
        <Composer
          composerInputRef={
            composerInputRef as React.RefObject<HTMLTextAreaElement>
          }
          config={config}
          suggestedMessages={suggestedMessages}
        />
        </div>
      </div>
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

      <Modal open={openCookieModal}>
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
      </Modal>
    </AssistantRuntimeProvider>
  );
}
