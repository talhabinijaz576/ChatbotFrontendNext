'use client';

import { use } from "react";
import { Assistant } from "@/app/assistant";
import { TooltipProvider } from "@radix-ui/react-tooltip";


  
  export default function ChatPage({
    params,
    searchParams,
  }: {
    params: Promise<{ conversationId: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }) {
    const { conversationId } = use(params);
    const newParams = use(searchParams); 
  
  
    return (
      <TooltipProvider>
      <Assistant
        initialConversationId={conversationId}
        searchParams={newParams} 
      />
       </TooltipProvider>
    );
  }