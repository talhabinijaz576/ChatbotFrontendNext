"use client";

import dynamic from "next/dynamic";

const Assistant = dynamic(
  () => import("@/app/assistant").then(m => m.Assistant),
  {
    ssr: false,
    loading: () => <div className="h-screen flex items-center justify-center">Loading chat…</div>,
  }
);

export default function AssistantLoader({ conversationId, searchParams }: any) {
  return (
    <Assistant
      initialConversationId={conversationId}
      searchParams={searchParams}
    />
  );
}
