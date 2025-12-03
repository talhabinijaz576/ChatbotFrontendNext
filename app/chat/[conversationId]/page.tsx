
import { Assistant } from "@/app/assistant";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export default function ChatPage({ params, searchParams }) {
  const { conversationId } = params;

  return (
    <TooltipProvider>
      <Assistant
        initialConversationId={conversationId}
        searchParams={searchParams}
      />
    </TooltipProvider>
  );
}
