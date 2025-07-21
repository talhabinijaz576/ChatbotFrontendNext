'use client';

import { use } from "react";
import { Assistant } from "@/app/assistant";
import { TooltipProvider } from "@radix-ui/react-tooltip";


  
  export default function ChatPage({
    params,
    searchParams,
  }: {
    params: { conversationId: string };
    searchParams: { [key: string]: string | string[] | undefined };
  }) {
    console.log("Query params:", searchParams);
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