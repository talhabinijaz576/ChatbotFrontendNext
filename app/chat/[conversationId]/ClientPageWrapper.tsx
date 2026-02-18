'use client';

import { Assistant } from "@/app/assistant";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export default function ClientPageWrapper({
  conversationId,
  searchParams,
  initialConfig,
}: {
  conversationId: string;
  searchParams: { [key: string]: string | string[] | undefined };
  initialConfig: any;
}) {
  return (
    <TooltipProvider>
      <Assistant
        initialConversationId={conversationId}
        searchParams={searchParams}
        initialConfig={initialConfig}
      />
    </TooltipProvider>
  );
}

