'use client';

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Assistant } from "@/app/assistant";
import { ThreadMessageLike } from "@assistant-ui/react";
function isValidUUID(id: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
  }
  
  // 👇 Helper to convert raw API messages
  function convertApiMessages(apiMessages: any[]): ThreadMessageLike[] {
    return apiMessages.map((msg) => ({
      role: msg.type === "system" ? "system" : msg.type,
      content: [{ type: "text", text: msg.text }],
    }));
  }
  
  export default function ChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
    const { conversationId } = use(params);
    console.log("Con ID", conversationId)    
    const router = useRouter();
  
    const [messages, setMessages] = useState<ThreadMessageLike[] | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
        if (!isValidUUID(conversationId)) {
          router.replace("/?model=auto");
          return;
        }
    
        const isMine = typeof window !== "undefined" && localStorage.getItem(`my-convo-${conversationId}`) === "true";
        console.log("🚀 ~ useEffect ~ isMine:", isMine)
    
        // ✅ if it's YOUR OWN convo, skip fetch
        if (isMine) {
        //   setMessages([]);
          setLoading(false);
          return;
        }
    
        // ✅ Otherwise, try to fetch the shared conversation
        const fetchConversation = async () => {
          try {
            const res = await fetch(`/conversation/${conversationId}/view`);
            if (res.status === 404) {
              setMessages([]);
            } else {
              const data = await res.json();
              if (Array.isArray(data?.messages) && data.messages.length > 0) {
                setMessages(convertApiMessages(data.messages));
              } else {
                setNotFound(true);
              }
            }
          } catch (err) {
            console.error("Error loading conversation:", err);
            setMessages([]);
          } finally {
            setLoading(false);
          }
        };
    
        fetchConversation();
      }, [conversationId]);
    
  
    if (loading) return <div>Loading conversation...</div>;
    if (notFound) return <div className="text-center text-gray-500 mt-10">⚠️ Conversation found but has no messages.</div>;
  
    return (
      <Assistant
        initialConversationId={conversationId}
        initialMessages={messages ?? []}
      />
    );
  }