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
import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { Sun, Moon, AlignJustify } from "lucide-react";
import { Thread } from "@/components/assistant-ui/thread";
import ThemeAwareLogo from "@/components/mem0/theme-aware-logo";
import ActionModal from "@/components/mem0/ActionModal";
import { useIframe } from "./hooks/useIframe";
import { chatService } from "./services/chatService";
import { useRouter } from "next/navigation";
import { normalizeMessages } from "./utils/idGenerator";
import { useCallback } from "react";

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

const loadMessages = (id: string) => {
  return JSON.parse(localStorage.getItem(`conversation:${id}`) || "[]");
};

// === Main Component ===

export function Assistant({
  initialConversationId,
  initialMessages = [],
}: {
  initialConversationId: string | null;
  initialMessages?: any[];
}) {
  const router = useRouter();
  const iframe = useIframe();

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  console.log("🚀 ~ messages:", messages);
  const [history, setHistory] = useState(() => getConversationHistory());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [open, setOpen] = useState(false);
  const userId = getOrCreateUserId();

  // === Effects ===
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then(setConfig);
  }, []);

  useEffect(() => {
    if (config?.chat?.isDark) setIsDarkMode(true);
  }, [config]);



  useEffect(() => {
    if (conversationId) saveMessages(conversationId, messages);
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
        incoming.event?.action === "open_url"
          ? iframe.openIframe(incoming.event.url)
          : iframe.closeIframe();
      }
    });
    return () => {
      chatService.disconnect();
      unsubscribe();
    };
  }, [conversationId]);

  useLayoutEffect(() => {
    const existingMessage = JSON.parse(localStorage.getItem(`conversation:${conversationId}`) || "[]");
  
    if (existingMessage.length > 0) {
      setMessages(existingMessage);
    } else if (config?.chat?.autoMessage?.role) {
      const autoMess = {
        role: config.chat.autoMessage.role,
        content: [{ ...config.chat.autoMessage, type: "text" }],
        id: "user-message-" + conversationId,
        createdAt: new Date(),
      };
      setMessages([autoMess]);
    }
  }, [config, conversationId]);
  
  
  

  // === Chat Handlers ===
  const createNewChat = () => {
    const newId = uuidv4();
    saveConversationToHistory(newId, ""); // title will be set on first user message
    setHistory(getConversationHistory());
    switchConversation(newId);
  };

  const switchConversation = (id: string) => {
    setConversationId(id);
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

  //   const onNew = useCallback( async (message: AppendMessage) => {
  //     const text = message.content.find((c) => c.type === "text")?.text ?? "";
  //     const attachments = message.attachments ?? [];

  //     if (!text && attachments.length === 0) return;

  //     const userMessage = {
  //       role: "user",
  //       text,
  //       attachments,
  //     };

  //     // Start new conversation if needed
  //     if (!conversationId) {
  //       const newId = uuidv4();
  //       setConversationId(newId);
  //       saveConversationToHistory(newId, ""); // temporary title
  //       setHistory(getConversationHistory());
  //       router.push(`/chat/${newId}`, undefined, { shallow: true });
  //     }

  //     setMessages((prev) => [...prev, userMessage]);
  //     updateTitleIfNeeded(text);
  //     setIsRunning(true);

  //     const assistantMessage = await chatService.sendMessage(text, userId, conversationId!, attachments);
  //     setMessages((prev) => [...prev, { role: assistantMessage.type, ...assistantMessage }]);
  //     setIsRunning(false);
  //   },[chatService, setMessages, setIsRunning]
  // );

  const onNew = useCallback(
    async (userAppendMessage: AppendMessage) => {
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
          userAppendMessage.content,
          userId,
          conversationId!
        );
        const assRes: ThreadMessageLike = {
          role: assistantResponse.type,
          content: [{ text: assistantResponse.text, type: "text" }],
          id: `user-message-${Date.now()}`,
          createdAt: new Date(),
        };
        setMessages((currentConversation) => [...currentConversation, assRes]);
      } catch (error) {
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
      ]),
    },
  });

  if (!config) return <div>Loading config...</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        className={`bg-[#f8fafc] dark:bg-zinc-900 relative ${
          isDarkMode ? "dark" : ""
        }`}
      >
        {/* HEADER */}
        <header className="h-16 border-b flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-white">
          <Link href="/" className="flex items-center">
            <ThemeAwareLogo width={120} height={40} isDarkMode={isDarkMode} />
          </Link>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#475569] dark:text-zinc-300 md:hidden"
          >
            <AlignJustify size={24} />
          </button>
          <div className="md:flex items-center hidden">
            <button
              onClick={() => {
                setIsDarkMode(!isDarkMode);
                document.documentElement.classList.toggle("dark", !isDarkMode);
              }}
              className="p-2 rounded-full hover:bg-[#eef2ff] dark:hover:bg-zinc-800"
            >
              {isDarkMode ? (
                <Sun className="w-6 h-6" />
              ) : (
                <Moon className="w-6 h-6" />
              )}
            </button>
          </div>
        </header>

        {/* MAIN LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] h-[calc(100dvh-4rem)]">
          {/* SIDEBAR */}
          <aside
            className={`fixed md:static top-0 left-0 z-50 h-full w-64 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }`}
          >
            <div className="h-16 px-4 flex items-center justify-between border-b dark:border-zinc-800 md:hidden">
              <span className="font-semibold text-lg tracking-wide">
                Conversations
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-600 dark:text-gray-300 hover:text-red-500"
              >
                ✖
              </button>
            </div>
            <div className="p-4 space-y-4">
              <button
                onClick={createNewChat}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-600 transition"
              >
                ➕ New Chat
              </button>
              <ul className="space-y-1">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className={`group flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer ${
                      item.id === conversationId
                        ? "bg-blue-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span
                      onClick={() => {
                        switchConversation(item.id);
                        setSidebarOpen(false);
                      }}
                      className="truncate flex-1 text-sm font-medium"
                    >
                      {item.title || "Untitled Chat"}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(item.id);
                      }}
                      className="text-red-500 opacity-0 group-hover:opacity-100 ml-2 transition"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* MAIN CHAT UI */}
          <main>
            <Thread
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              onResetUserId={() => {}}
              isDarkMode={isDarkMode}
              toggleDarkMode={() => {
                setIsDarkMode((prev) => !prev);
                document.documentElement.classList.toggle("dark", !isDarkMode);
              }}
              defaultTitle={config.app.title || "Mem0 Assistant"}
              disclaimer={config.app.disclaimer}
              colors={config.chat?.colors}
              messages={messages}
            />
          </main>
        </div>

        {/* JSON Viewer Modal */}
        <ActionModal
          open={iframe.showIframe}
          url={iframe.iframeUrl}
          iframeError={iframe.iframeError}
          onClose={iframe.closeIframe}
          onIframeError={iframe.onIframeError}
          onIframeLoad={iframe.onIframeLoad}
        />
        {open && (
          <div className="fixed top-1/2 left-1/2 bg-white p-4 border shadow-lg z-50 w-[60vw] max-h-[70vh] overflow-y-auto transform -translate-x-1/2 -translate-y-1/2">
            <pre>{JSON.stringify(messages, null, 2)}</pre>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        )}
      </div>
    </AssistantRuntimeProvider>
  );
}
