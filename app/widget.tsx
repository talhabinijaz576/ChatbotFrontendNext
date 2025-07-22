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
import { AssistantModal } from "@assistant-ui/react-ui";
import ActionModal from "@/components/mem0/ActionModal";
import { chatService } from "./services/chatService";
import { useSearchParams } from "next/navigation";

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
    fetch(`${config2.api.baseUrl}/conversation/${conversationId}/view`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          console.log("🚀 ~ initConversation ~ data.messages:", data.messages);
          const converted = data.messages.map((item) => {
            let contentArray;
          
            if (item.type === "user") {
              try {
                // Try to parse the text as JSON (handles "[{'type': 'text', 'text': 'Hello'}]" format)
                const normalized = item.text.replace(/'/g, '"'); // Replace single quotes with double quotes
                const parsed = JSON.parse(normalized);
                contentArray = Array.isArray(parsed) ? parsed : [{ type: "text", text: item.text }];
              } catch (err) {
                // If parsing fails, use the text as is
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
              createdAt: new Date(),
            };
          });
          const autoMessage = {
            role: config2.chat.autoMessage.role,
            content: [{ ...config2.chat.autoMessage, type: "text" }],
            id: "user-message-" + conversationId,
            createdAt: new Date(),
          };
console.log("converted", converted)
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
        console.log("🚀 ~ e:", e);
        const existingMessage = JSON.parse(
          localStorage.getItem(`conversation:${conversationId}`) || "[]"
        );
        if (existingMessage.length > 1) {
          setMessages(existingMessage);
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
      });
  };

  useEffect(() => {
    if (config?.chat?.isDark) setIsDarkMode(true);
  }, [config]);

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
      <AssistantModal confif={config} />

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
