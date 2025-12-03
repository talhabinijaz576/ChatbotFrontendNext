"use client";

import dynamic from "next/dynamic";
import { TooltipProvider } from "@radix-ui/react-tooltip";

const Assistant = dynamic(() => import("@/app/assistant").then(m => m.Assistant), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen text-lg">
      Loading chat…
    </div>
  ),
});

export default function ChatPage({ params, searchParams }: any) {
  return (
    <TooltipProvider>
      <Assistant
        initialConversationId={params.conversationId}
        searchParams={searchParams}
      />
    </TooltipProvider>
  );
}
