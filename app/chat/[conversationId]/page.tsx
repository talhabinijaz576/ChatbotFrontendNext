'use client';

import { use } from "react";
import { Assistant } from "@/app/assistant";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import CookiebotLoader from "@/components/CookiebotLoader";


  
  export default function ChatPage({
    params,
    searchParams,
  }: {
    params: { conversationId: string };
    searchParams: { [key: string]: string | string[] | undefined };
  }) {
    const { conversationId } = use(params);
    const newParams = use(searchParams); 
  
  
    return (
      <TooltipProvider>
        <CookiebotLoader />
      <Assistant
        initialConversationId={conversationId}
        searchParams={newParams} 
      />
       </TooltipProvider>
    );
  }