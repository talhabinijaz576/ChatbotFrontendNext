// lib/MyModelAdapterFactory.ts
import { chatService } from "@/app/services/chatService";
import { ChatModelAdapter } from "@assistant-ui/react";

export function createModelAdapter(
    userId: string,
    conversationId: string,
    iframe?: {
      openIframe: (url: string) => void;
      closeIframe: () => void;
    }
  ): ChatModelAdapter {
    return {
      async run({ messages, abortSignal }) {
        const lastMessage = messages[messages.length - 1];
        const userText = lastMessage?.content
          ?.filter((part) => part.type === "text")
          ?.map((part) => (part as any).text)
          ?.join("\n");
  
        if (!userText) throw new Error("❌ No text to send");
  
        // Send message and get response directly from API
        // const apiResponse = await chatService.sendMessage(userText, userId, conversationId); // ← expect it to return the API response
  
        // // Assuming sendMessage returns parsed JSON (array of messages)
        // const assistantReply = chatService.handleIncomingMessage(apiResponse)
        // console.log("🚀 ~ run ~ assistantReply:", assistantReply)
        const assistantReply = await chatService.sendMessageAndWait(userText, userId, conversationId, abortSignal);
        return assistantReply;
        // if (!assistantReply || !assistantReply.text) {
        //   throw new Error("❌ Assistant response not found");
        // }
  
      },
    };
  }
  