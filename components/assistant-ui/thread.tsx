"use client";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useMessage,
  useThreadRuntime,
} from "@assistant-ui/react";
import type { FC } from "react";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  ArchiveIcon,
  PlusIcon,
  Sun,
  Moon,
  SaveIcon,
  LoaderCircle,
  Loader,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dispatch, SetStateAction, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { MemoryUI } from "./memory-ui";
import React from "react";
import Link from "next/link";
import { ScrollArea } from "../ui/scroll-area";
import MarkdownRenderer from "../mem0/markdown";
import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "../attachment";
import Image from "next/image";

interface ThreadProps {
  sidebarOpen: boolean;
  setStateData: Dispatch<SetStateAction<any>>;
  onResetUserId?: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  defaultTitle?: string;
  disclaimer?: string;
  colors?: {
    userMessage?: {
      background?: string;
      text?: string;
    };
    assistantMessage?: {
      background?: string;
      text?: string;
    };
  };
  messages: ThreadMessageLike[];
  config: any;
  suggestedMessages: any;
  runtime: any;
  onNew: (message: AppendMessage) => void;
}

export const Thread: FC<ThreadProps> = ({
  sidebarOpen,
  setStateData,
  onResetUserId,
  isDarkMode,
  toggleDarkMode,
  defaultTitle,
  disclaimer,
  colors,
  onNew,
  messages,
  config,
  suggestedMessages,
  runtime,
}) => {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [messages.length]);

  return (
    <ThreadPrimitive.Root
      className="bg-[#f8fafc] dark:bg-zinc-900 box-border flex flex-col relative pb-4 md:h-full justify-end"
      style={{
        ["--thread-max-width" as string]: "42rem",
        overscrollBehavior: "none",
        touchAction: "manipulation",
        height: "100%",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="relative inset-0 bg-black/40 -z-1 md:hidden"
          onClick={() => setStateData({ sidebarOpen: false })}
        ></div>
      )}

      <ScrollArea
        className="flex-0 md:flex-1 w-full overflow-y-auto"
        style={{ maxHeight: "90svh" }}
      >
        <div className="flex flex-col w-full items-center px-4 pt-4 pb-4 justify-end">
          {!messages.length && <Loader />}
          <ThreadPrimitive.Messages
          components={{
            UserMessage: (props) => (
              <UserMessage {...props} colors={colors} />
            ),
            EditComposer: EditComposer,
            AssistantMessage: (props) => <AssistantMessage {...props} config={config} />,
          }}
        />  
          
          {suggestedMessages?.buttons?.length > 0 && (
        <div className="flex flex-col w-full items-center justify-center mt-2 mb-8 ">
          <ThreadWelcomeSuggestions
            composerInputRef={composerInputRef}
            suggestedMessages={suggestedMessages}
            config={config}
            runtime={runtime}
            onNew={onNew}
            messages={messages}
            setStateData={setStateData}
          />
        </div>
      )}

          <ThreadPrimitive.If empty={false}>
            <div className="min-h-8 flex-grow" ref={bottomRef} />
          </ThreadPrimitive.If>
        </div>
      </ScrollArea>
      
      <div className="sticky bottom-0 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit px-4 md:pb-4 mx-auto">
        <ThreadScrollToBottom />
        <Composer
          composerInputRef={
            composerInputRef as React.RefObject<HTMLTextAreaElement>
          }
          config={config}
          suggestedMessages={suggestedMessages}
        />
      </div>
    </ThreadPrimitive.Root>
  );
};

export const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible bg-white dark:bg-zinc-800 border-[#e2e8f0] dark:border-zinc-700 hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
      >
        <ArrowDownIcon className="text-[#475569] dark:text-zinc-300" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

interface ThreadWelcomeSuggestionsProps {
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
  suggestedMessages: any;
  config: any;
  runtime: any;
  onNew: (message: AppendMessage) => void;
  messages: ThreadMessageLike[];
}

const ThreadWelcomeSuggestions: FC<ThreadWelcomeSuggestionsProps> = ({
  composerInputRef,
  suggestedMessages,
  config,
  runtime,
  onNew,
  messages,
  setStateData,
}) => {
  const handleSuggestionClick = async (
    message: any,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    setStateData({ suggestedMessages: [] });

    console.log("🚀 ~ handleSuggestionClick ~ message:", message);

    onNew({
      content: [{ type: "text", text: message.message }],
      attachments: [],
      metadata: { keyword: message.keyword || message.label },
      createdAt: new Date(),
      role: "user",
    });
  };

  return (
    <div className="mt-3 flex flex-col md:flex-row w-full md:items-stretch justify-center gap-4 dark:text-white items-center">
      {suggestedMessages?.buttons?.map((message: any) => (
        <button
          key={message.label}
          className="hover:bg-[#eef2ff] w-full dark:hover:bg-zinc-800 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-[2rem] border border-[#e2e8f0] dark:border-zinc-700 p-3 transition-colors ease-in"
          onClick={(e) => handleSuggestionClick(message, e)}
        >
          <span className="line-clamp-2 text-ellipsis text-sm font-semibold">
            {message.label}
          </span>
        </button>
      ))}
    </div>
  );
};

interface ComposerProps {
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
  suggestedMessages: any;
}

export const Composer: FC<ComposerProps> = ({
  composerInputRef,
  config,
  suggestedMessages,
}) => {
  return (
    <ComposerPrimitive.Root className="focus-within:border-[#4f46e5]/20 dark:focus-within:border-[#6366f1]/20 flex w-full flex-wrap items-end rounded-full border border-[#e2e8f0] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 shadow-sm transition-colors ease-in">
      <ComposerAttachments />
      <ComposerAddAttachment config={config} />
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        disabled={suggestedMessages?.disable_regular_message}
        placeholder={config.app.name || "..."}
        className="placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed text-[#1e293b] dark:text-zinc-200"
        ref={composerInputRef}
      />
      <ComposerAction config={config} />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = ({ config }) => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={config?.chat?.attachment?.btnSendTooltip}
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-full"
          >
            <SendHorizontalIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-full"
          >
            <CircleStopIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const UserMessage: FC = ({ colors}) => {
  const content = useMessage((m) => {
    return m;
  });
  const timestamp = content?.content[0]?.created_at 
  ? new Date(content.content[0].created_at).toLocaleString([], {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  : new Date(content.createdAt).toLocaleString([], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <MessagePrimitive.Root className="grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 [&:where(>*)]:col-start-2 w-full max-w-[var(--thread-max-width)] py-4">
      <UserMessageAttachments />
      <div
        style={{
          backgroundColor: colors?.userMessage?.background ?? "#10101a",
          color: colors?.userMessage?.text ?? "#ffffff",
        }}
        className="bg-[#4f46e5] text-sm dark:bg-[#6366f1] text-white max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2"
      >
        <MessagePrimitive.Content />
        <AssistantActionBar timestamp={timestamp} type="user" />
        </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <ComposerPrimitive.Root className="bg-[#eef2ff] dark:bg-zinc-800 my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl">
      <ComposerPrimitive.Input className="text-[#1e293b] dark:text-zinc-200 flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button
            variant="ghost"
            className="text-[#475569] dark:text-zinc-300 hover:bg-[#eef2ff]/50 dark:hover:bg-zinc-700/50"
          >
            Cancel
          </Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button className="bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-[2rem]">
            Send
          </Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

const AssistantMessage: FC = ({config}) => {
  const content = useMessage((m) => {
    return m;
  });
  const timestamp = content?.content[0]?.created_at 
  ? new Date(content.content[0].created_at).toLocaleString([], {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  : new Date(content.created_at).toLocaleString([], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const markdownText = React.useMemo(() => {
    if (!content.content) return "";
    if (typeof content.content === "string") return content.content;
    if (Array.isArray(content.content) && content.content.length > 0 && "text" in content.content[0]) {
      return content.content[0].text || "";
    }
    return "";
  }, [content.content]);
  const MemoMarkdown = React.memo(MarkdownRenderer);

  return (
    <MessagePrimitive.Root className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <MemoryUI />
        <MemoMarkdown
          markdownText={markdownText}
          showCopyButton={true}
          isDarkMode={document.documentElement.classList.contains("dark")}
        />
      <AssistantActionBar timestamp={timestamp} type="assistant" />
      </div>

      <div className="flex items-end justify-center col-start-1 row-start-1 mr-1 mb-1">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${config?.chat?.backgroundColor ?? "bg-blue-950"}`}>
        <Image
          src={config?.chat?.colors?.assistantMessage?.avatar ?? ""}
          alt="Assistant Avatar"
          width={20}
          height={20}
          className="invert brightness-0 saturate-0 contrast-200"
        />
      </div>

      </div>

      <BranchPicker className="col-start-2 row-start-2 -ml-2 mr-2" />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = ({ timestamp, type }) => {
  return (
    <ActionBarPrimitive.Root
      autohideFloat="single-branch"
      className="text-[#475569] dark:text-zinc-300 flex gap-1 col-start-3 row-start-2
        data-[floating]:bg-white data-[floating]:dark:bg-zinc-800
        data-[floating]:absolute data-[floating]:rounded-md
        data-[floating]:border data-[floating]:border-[#e2e8f0]
        data-[floating]:dark:border-zinc-700 data-[floating]:p-1
        data-[floating]:shadow-sm"
    >

      {/* Date + Time (Right aligned) */}
      {timestamp !== "Invalid Date" && <div
        className={`ml-auto text-[10px] px-1 
          ${
            type === "user"
              ? "text-white dark:text-white"
              : "text-gray-500 dark:text-gray-400"
          }`}
      >
        {timestamp}
      </div>}
    </ActionBarPrimitive.Root>
  );
};



const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "text-[#475569] dark:text-zinc-300 inline-flex items-center text-xs",
        className
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton
          tooltip="Previous"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton
          tooltip="Next"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="16"
      height="16"
    >
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};