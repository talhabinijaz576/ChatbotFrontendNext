import { Assistant } from "@/app/assistant";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { loadExternalConfig } from "@/lib/config-loader";
import ClientPageWrapper from "./ClientPageWrapper";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Load config on server side - no API call needed
  const config = loadExternalConfig();
  const { conversationId } = await params;
  const newParams = await searchParams;

  return (
    <ClientPageWrapper
      conversationId={conversationId}
      searchParams={newParams}
      initialConfig={config}
    />
  );
}