"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  AppendMessage,
  ThreadMessageLike,
} from "@assistant-ui/react";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, Moon, AlignJustify } from "lucide-react";
import { Thread } from "@/components/assistant-ui/thread";
import ThemeAwareLogo from "@/components/mem0/theme-aware-logo";
import ActionModal from "@/components/mem0/ActionModal";
import { useIframe } from "./hooks/useIframe";
import { chatService } from "./services/chatService";
import { useRouter } from "next/navigation";
import { normalizeMessages } from "./utils/idGenerator";
import { AssistantModal } from "@assistant-ui/react-ui";

export function Assistant({
  initialConversationId,
  initialMessages = [],
}: {
  initialConversationId: string | null;
  initialMessages?: any[];
}) {
  console.log("🚀 ~ initialMessages:", initialMessages);

  const router = useRouter();
  const iframe = useIframe();

  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );

  const convertedInitialMessages: ThreadMessageLike[] = initialMessages.map(
    (msg: any) => ({
      role: msg.type === "system" ? "system" : msg.type, // ensure it's a valid role
      content: [{ type: "text", text: msg.text }],
    })
  );

  const [messages, setMessages] = useState<ThreadMessageLike[]>(
    convertedInitialMessages
  );
  console.log("🚀 ~ messages:", messages);
  const [config, setConfig] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
      });
  }, []);
  const [history, setHistory] = useState(() => getConversationHistory());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(config?.chat?.isDark);
  const [isRunning, setIsRunning] = useState(false);
  const userId = getOrCreateUserId();

  // Message helpers
  const convertMessage = (message: any) => ({
    role: message.role,
    content: [{ type: "text", text: message.text }],
  });

  const onNew = async (message: AppendMessage) => {
    const input = message.content[0]?.text;
    if (!input) return;

    const newUserMessage = { role: "user", text: input };

    // If first message, generate new chatId and redirect
    if (!conversationId) {
      const newId = uuidv4();
      setConversationId(newId);
      setMessages([newUserMessage]);
      saveConversationToHistory(newId, `Chat ${history.length + 1}`);
      router.push(`/chat/${newId}`);
      return;
    }

    // Else append as usual
    setMessages((prev) => [...prev, newUserMessage]);
    setIsRunning(true);

    const assistantMessage = await chatService.sendMessage(
      input,
      userId,
      conversationId
    );
    console.log("🚀 ~ onNew ~ assistantMessage:", assistantMessage);

    setMessages((prev) => [
      ...prev,
      { role: assistantMessage.type, ...assistantMessage },
    ]);
    setIsRunning(false);
  };

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    threadId: conversationId ?? undefined,
  });

  // WebSocket setup
  useEffect(() => {
    chatService.initializeConnection(userId);
    const unsubscribe = chatService.onMessage((incoming) => {
      console.log("🚀 ~ unsubscribe ~ incoming:", incoming);
      if (incoming?.type === "assistant" && incoming.text) {
        setMessages((prev) => [...prev, { role: "assistant", ...incoming }]);
      }
      if (incoming?.type === "event") {
        if (incoming.event?.action === "open_url" && incoming.event.url) {
          iframe.openIframe(incoming.event.url);
        } else if (incoming.event?.action === "close_url") {
          iframe.closeIframe();
        }
      }
    });

    return () => {
      chatService.disconnect();
      unsubscribe();
    };
  }, [userId, conversationId]);

  // LocalStorage syncing
  useEffect(() => {
    saveMessages(conversationId, messages);
  }, [messages]);

  // Routing and conversation handling
  const switchConversation = (id: string) => {
    setConversationId(id);
    const mess = loadMessages(id);
    const converted = normalizeMessages(mess);
    console.log("🚀 ~ switchConversation ~ converted:", converted);
    setMessages(converted);
    setMessages((prev) => [
      ...prev,
      { role: assistantMessage.type, ...assistantMessage },
    ]);
    if (id) {
      localStorage.setItem(`my-convo-${id}`, "true");
      router.push(`/chat/${id}`);
    }
  };

  const createNewChat = () => {
    const newId = uuidv4();
    saveConversationToHistory(newId, `Chat ${history.length + 1}`);
    setHistory(getConversationHistory());
    switchConversation(newId);
  };

  const deleteConversation = (id: string) => {
    const updated = history.filter((c) => c.id !== id);
    localStorage.setItem("chatHistory", JSON.stringify(updated));
    localStorage.removeItem(`conversation:${id}`);
    setHistory(updated);

    if (conversationId === id) {
      const fallback = updated[0];
      if (fallback) switchConversation(fallback.id);
      else createNewChat();
    }
  };
  if (!config) return <div>Loading config...</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div
        className={`bg-[#f8fafc] dark:bg-zinc-900 relative ${isDarkMode ? "dark" : ""}`}
      >
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

        {/* SIDEBAR + THREAD VIEW */}
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] h-[calc(100dvh-4rem)]">
          {/* Sidebar */}
          <aside
            className={`fixed md:static top-0 left-0 z-50 h-full w-64 bg-white dark:bg-zinc-900 border-r dark:border-zinc-800 transform transition-transform duration-300 ease-in-out ${
              sidebarOpen
                ? "translate-x-0"
                : "-translate-x-full md:translate-x-0"
            }`}
          >
            <div className="h-16 px-4 flex items-center justify-between border-b dark:border-zinc-800 md:hidden">
              <span className="font-bold text-lg">Chats</span>
              <button onClick={() => setSidebarOpen(false)}>✖</button>
            </div>
            <div className="p-4 space-y-4">
              <button
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={createNewChat}
              >
                ➕ New Chat
              </button>
              <ul className="space-y-1">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className={`group flex items-center justify-between rounded px-3 py-2 cursor-pointer ${
                      item.id === conversationId
                        ? "bg-blue-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <span
                      className="truncate flex-1"
                      onClick={() => {
                        switchConversation(item.id);
                        setSidebarOpen(false);
                      }}
                    >
                      {item.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(item.id);
                      }}
                      className="text-red-500 opacity-0 group-hover:opacity-100 ml-2"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Thread UI */}
          <main className="overflow-y-auto">
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

        <ActionModal
          open={iframe.showIframe}
          url={iframe.iframeUrl}
          iframeError={iframe.iframeError}
          onClose={iframe.closeIframe}
          onIframeError={iframe.onIframeError}
          onIframeLoad={iframe.onIframeLoad}
        />
        <div className="absolute right-2 bottom-5">
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Show JSON
          </button>

          {open && (
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                background: "white",
                padding: 20,
                border: "1px solid black",
                zIndex: 1000,
                maxHeight: "70vh",
                overflowY: "auto",
                width: "60vw",
              }}
            >
              <pre>{JSON.stringify(messages, null, 2)}</pre>
              <button onClick={() => setOpen(false)}>Close</button>
            </div>
          )}
        </div>
      </div>
      <AssistantModal />
    </AssistantRuntimeProvider>
  );
}

// === LocalStorage Helpers ===
const getOrCreateUserId = () => {
  let id = localStorage.getItem("userId1");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("userId1", id);
  }
  return id;
};

const saveConversationToHistory = (id: string, title: string) => {
  const history = getConversationHistory();
  if (!history.find((h) => h.id === id)) {
    history.push({ id, title });
    localStorage.setItem("chatHistory", JSON.stringify(history));
  }
};

const getConversationHistory = () => {
  return JSON.parse(localStorage.getItem("chatHistory") || "[]");
};

const saveMessages = (id: string, messages: any[]) => {
  localStorage.setItem(`conversation:${id}`, JSON.stringify(messages));
};

const loadMessages = (id: string) => {
  return JSON.parse(localStorage.getItem(`conversation:${id}`) || "[]");
};
