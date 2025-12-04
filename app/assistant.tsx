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
import { useEffect, useState } from "react";

import dynamic from "next/dynamic";


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
import { Loader } from "lucide-react"
import { Thread } from "@/components/assistant-ui/thread";
// const Thread = dynamic(() => import("@/components/assistant-ui/thread").then(m => m.Thread), {
//   ssr: false,
//   loading: () => (
//     <div className="flex items-center justify-center h-screen text-lg">
//       Please wait UI Loading…
//     </div>
//   ),
// });
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
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const iframe = useIframe();

  // ------------------ STATES ------------------ //
  const [config, setConfig] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState(getConversationHistory());
  const [isRunning, setIsRunning] = useState(false);
  const [suggestedMessages, setSuggestedMessages] = useState<any>([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const userId = getOrCreateUserId();

  // ===========================================================
  // 1. LOAD CONFIG (non-blocking + fast)
  // ===========================================================
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
    };
    if(!config){
      load();
    }
  }, []);

  // ===========================================================
  // 2. LOAD CONVERSATION WHEN CONFIG + ID READY
  // ===========================================================
  useEffect(() => {
    if (!config || !conversationId) return;

    const run = async () => {
      try {
        const params = new URLSearchParams(searchParams as any).toString();

        const viewRes = await fetch(
          `${config.api.baseUrl}/conversation/${conversationId}/view?${params}`,
          { method: "GET" }
        );

        if (viewRes.status === 403) {
          setOtpModalOpen(true);
          return;
        }

        const data = await viewRes.json();

        if (Array.isArray(data.messages)) {
          const converted = data.messages.map((msg: any) => ({
            role: msg.type,
            content: [
              { text: msg.text, type: "text", created_at: msg.created_at },
            ],
            id: `msg-${msg.id}`,
            createdAt: new Date(),
          }));

          const autoMsg = {
            role: config.chat.autoMessage.role,
            content: [
              {
                text: config.chat.autoMessage.text,
                type: "text",
                created_at: new Date(),
              },
            ],
            id: `auto-${conversationId}`,
            createdAt: new Date(),
          };

          setMessages([autoMsg, ...converted]);
        } else {
          // Local fallback
          setMessages([
            {
              role: config.chat.autoMessage.role,
              content: [{ text: config.chat.autoMessage.text, type: "text" }],
              id: "auto-local",
              createdAt: new Date(),
            },
          ]);
        }
      } catch (err) {
        console.error("Conversation load failed:", err);
      }
    };

    run();
  }, [config, conversationId]);

  // ===========================================================
  // 3. INIT WEBSOCKET LISTENERS
  // ===========================================================
  useEffect(() => {
    if (!conversationId) return;

    chatService.initializeConnection(conversationId);

    const unsubscribe = chatService.onMessage((incoming) => {
      if (incoming?.type === "assistant") {
        setMessages((prev) => [
          ...prev,
          {
            role: incoming.type,
            content: [{ text: incoming.text, type: "text" }],
            id: incoming.pk,
            createdAt: new Date(),
          },
        ]);
      }

      if (incoming?.type === "event") {
        const action = incoming.event?.action;
        if (action === "open_url") iframe.openIframe(incoming.event.url);
        if (action === "close_url") iframe.closeIframe();
        if (action === "display_suggestions")
          setSuggestedMessages(incoming.event);
      }
    });

    return () => unsubscribe();
  }, [conversationId]);

  // ===========================================================
  // Handle new user message
  // ===========================================================
  const onNew = useCallback(
    async (userAppendMessage) => {
      const text =
        userAppendMessage.content.find((c) => c.type === "text")?.text ?? "";

      const userMessage = {
        role: "user",
        content: userAppendMessage.content,
        id: `user-${Date.now()}`,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsRunning(true);

      try {
        const assistantResponse = await chatService.sendMessage(
          userAppendMessage,
          userId,
          conversationId!,
          searchParams
        );

        setMessages((prev) => [
          ...prev,
          {
            role: assistantResponse.type,
            content: [
              {
                text: assistantResponse.text,
                type: "text",
                created_at: assistantResponse.created_at,
              },
            ],
            id: `asst-${Date.now()}`,
            createdAt: new Date(),
          },
        ]);
      } catch (err) {
        console.error("Message send failed:", err);
      } finally {
        setIsRunning(false);
      }
    },
    [conversationId]
  );

  // ===========================================================
  // New chat
  // ===========================================================
  const createNewChat = () => {
    const id = uuidv4();
    saveConversationToHistory(id, "");
    setHistory(getConversationHistory());
    setConversationId(id);
    router.push(`/chat/${id}`, { shallow: true });
  };

  // ===========================================================
  // Runtime for assistant-ui
  // ===========================================================
  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage: (m) => m,
    onNew,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new SimplePdfAttachmentAdapter(),
      ]),
    },
  });

  // ===========================================================
  // UI
  // ===========================================================
  if (!config) return <div className="p-6">Loading config…</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 bg-blue-950 border-b dark:bg-zinc-900 dark:border-zinc-800 dark:text-white">
          {" "}
         <ThemeAwareLogo
            width={180}
            height={30}
            isDarkMode={isDarkMode}
            config={config}
          />{" "}
          {/* <button onClick={() => window?.Cookiebot?.renew?.()} className="mt-2 px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800" > R </button> */}{" "}
        </header>

        {/* Chat */}
        <main className="flex-1 overflow-y-auto">
            <Thread
              messages={messages}
              onNew={onNew}
              suggestedMessages={suggestedMessages}
              sidebarOpen={true}
              config={config}
              isDarkMode={isDarkMode}
              toggleDarkMode={() => {
                setIsDarkMode((p) => !p);
                document.documentElement.classList.toggle("dark");
              }}
              defaultTitle={config.app.title}
            />
        </main>
      </div>
    </AssistantRuntimeProvider>
  );
}
