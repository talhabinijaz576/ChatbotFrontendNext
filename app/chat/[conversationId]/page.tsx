export const dynamic = "force-dynamic";

import AssistantLoader from "./assistant-loader";

export default function Page({ params, searchParams }: any) {
  return (
    <AssistantLoader
      conversationId={params.conversationId}
      searchParams={searchParams}
    />
  );
}
