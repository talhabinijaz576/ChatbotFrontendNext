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
  useAssistantRuntime,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import GithubButton from "../mem0/github-button";
import Link from "next/link";
import { ScrollArea } from "../ui/scroll-area";
import MarkdownRenderer from "../mem0/markdown";
import type { ThreadMessageLike } from "@assistant-ui/react";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "../attachment";

interface ThreadProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
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
}

export const Thread: FC<ThreadProps> = ({
  sidebarOpen,
  setSidebarOpen,
  onResetUserId,
  isDarkMode,
  toggleDarkMode,
  defaultTitle,
  disclaimer,
  colors,
  messages,
  config,
  suggestedMessages,
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
      className="bg-[#f8fafc] dark:bg-zinc-900 box-border flex flex-col relative h-[calc(100svh-4rem)] pb-4 md:h-full justify-end"
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
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      <ScrollArea
        className="flex-0 md:flex-1 w-full overflow-y-auto"
        style={{ maxHeight: "80svh" }}
      >
        <div className="flex flex-col w-full items-center px-4 pt-8 justify-end">
          {!messages.length && (
            <Loader />
          )}
          <ThreadPrimitive.Messages
            components={{
              UserMessage: (props) => <UserMessage {...props} colors={colors} />,
              EditComposer: EditComposer,
              AssistantMessage: AssistantMessage,
            }}
          />

          <ThreadPrimitive.If empty={false}>
            <div className="min-h-8 flex-grow" ref={bottomRef} />
          </ThreadPrimitive.If>
        </div>
      </ScrollArea>
      <div className="flex flex-col w-full items-center justify-center mt-16 mb-16 ">
          <ThreadWelcomeSuggestions composerInputRef={composerInputRef} suggestedMessages={suggestedMessages} config={config} />
        </div>
      <div className="sticky bottom-0 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit px-4 md:pb-4 mx-auto">
      <ThreadScrollToBottom />
        <Composer
          composerInputRef={
            composerInputRef as React.RefObject<HTMLTextAreaElement>
          }
          config={config}
        />
      </div>

    </ThreadPrimitive.Root>
  );
};

const ThreadScrollToBottom: FC = () => {
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

interface ThreadWelcomeProps {
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
  defaultTitle?: string;
  disclaimer?: string;
}

const ThreadWelcome: FC<ThreadWelcomeProps> = ({
  composerInputRef,
  defaultTitle,
  disclaimer,
}) => {
  return (
      <div className="flex w-full flex-grow flex-col mt-8 md:h-[calc(100vh-15rem)]">
        <div className="flex w-full flex-grow flex-col items-center justify-start">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-[2rem] leading-[1] tracking-[-0.02em] md:text-4xl font-bold text-[#1e293b] dark:text-white mb-2 text-center md:w-full w-5/6">
              {defaultTitle} {/* || "Mem0 - ChatGPT with memory" */}
            </div>
            <p className="text-center text-md text-[#1e293b] dark:text-white mb-2 md:w-3/4 w-5/6">
              {disclaimer ||
                "A personalized AI chat app powered by Mem0 that remembers your preferences, facts, and memories."}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center mt-16">
          <p className="mt-4 font-medium text-[#1e293b] dark:text-white">
            How can I help you today?
          </p>
          <ThreadWelcomeSuggestions composerInputRef={composerInputRef} />
        </div>
      </div>
  );
};

interface ThreadWelcomeSuggestionsProps {
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
  suggestedMessages: any;
  config: any;
}

const ThreadWelcomeSuggestions: FC<ThreadWelcomeSuggestionsProps> = ({
  composerInputRef,
  suggestedMessages,
  config,
}) => {
  const runtime = useAssistantRuntime();

  const handleSuggestionClick = async (message: any) => {
    // Create a structured message with keyword and additional fields
    const structuredMessage = {
      content: message.message,
      attachments: [],
      keyword: message.keyword || message.label, // Use keyword from config or fallback to label
      ...message.additionalFields, // Spread any additional fields from the message config
    };

    // Create an AppendMessage-like object
    const appendMessage = {
      content: [{ type: "text", text: structuredMessage.content }],
      attachments: structuredMessage.attachments,
      metadata: {
        keyword: structuredMessage.keyword,
        ...structuredMessage.additionalFields,
      },
    };

    // Use the assistant runtime to append the message
    if (runtime) {
      await runtime.append(appendMessage);
    }
  };

  return (
    <div className="mt-3 flex flex-col md:flex-row w-full md:items-stretch justify-center gap-4 dark:text-white items-center">
      {suggestedMessages?.buttons?.map((message: any) => (
        <button
          key={message.label}
          className="hover:bg-[#eef2ff] w-full dark:hover:bg-zinc-800 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-[2rem] border border-[#e2e8f0] dark:border-zinc-700 p-3 transition-colors ease-in"
          onClick={() => handleSuggestionClick(message)}
        >
          <span className="line-clamp-2 text-ellipsis text-sm font-semibold">
            {message.message}
          </span>
        </button>
      ))}
    </div>
  );
};

interface ComposerProps {
  composerInputRef: React.RefObject<HTMLTextAreaElement>;
}

const Composer: FC<ComposerProps> = ({ composerInputRef, config }) => {
  return (
    <ComposerPrimitive.Root className="focus-within:border-[#4f46e5]/20 dark:focus-within:border-[#6366f1]/20 flex w-full flex-wrap items-end rounded-full border border-[#e2e8f0] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 shadow-sm transition-colors ease-in">
      <ComposerAttachments />
      <ComposerAddAttachment />
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder={config.app.name || "..."}
        className="placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed text-[#1e293b] dark:text-zinc-200"
        ref={composerInputRef}
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
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

const UserMessage: FC = ({ colors }) => {
  return (
    <MessagePrimitive.Root className="grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 [&:where(>*)]:col-start-2 w-full max-w-[var(--thread-max-width)] py-4">
      {/* <UserActionBar /> */}
      <UserMessageAttachments />
      <div
        style={{
          backgroundColor: colors?.userMessage?.background ?? "#10101a",
          color: colors?.userMessage?.text ?? "#ffffff",
        }}
        className="bg-[#4f46e5] text-sm dark:bg-[#6366f1] text-white max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2"
      >
        <MessagePrimitive.Content />
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end col-start-1 row-start-2 mr-3 mt-2.5"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton
          tooltip="Edit"
          className="text-[#475569] dark:text-zinc-300 hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-800"
        >
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
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

const AssistantMessage: FC = () => {
  const content = useMessage((m) => m.content);
  const markdownText = React.useMemo(() => {
    if (!content) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content) && content.length > 0 && "text" in content[0]) {
      return content[0].text || "";
    }
    return "";
  }, [content]);

  return (
    <MessagePrimitive.Root className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words leading-7 col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <MemoryUI />
        <MarkdownRenderer
          markdownText={markdownText}
          showCopyButton={true}
          isDarkMode={document.documentElement.classList.contains("dark")}
        />
      </div>

      {/* <AssistantActionBar /> */}

      <BranchPicker className="col-start-2 row-start-2 -ml-2 mr-2" />
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohideFloat="single-branch"
      className="text-[#475569] dark:text-zinc-300 flex gap-1 col-start-3 row-start-2 ml-1 data-[floating]:bg-white data-[floating]:dark:bg-zinc-800 data-[floating]:absolute data-[floating]:rounded-md data-[floating]:border data-[floating]:border-[#e2e8f0] data-[floating]:dark:border-zinc-700 data-[floating]:p-1 data-[floating]:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton
          tooltip="Copy"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton
          tooltip="Refresh"
          className="hover:text-[#4f46e5] dark:hover:text-[#6366f1] hover:bg-[#eef2ff] dark:hover:bg-zinc-700"
        >
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
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

// Component for reuse in mobile drawer
const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className="data-[active]:bg-[#eef2ff] hover:bg-[#eef2ff] dark:hover:bg-zinc-800 dark:data-[active]:bg-zinc-800 focus-visible:bg-[#eef2ff] dark:focus-visible:bg-zinc-800 focus-visible:ring-[#4f46e5] flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2">
      <ThreadListItemPrimitive.Trigger className="flex-grow px-3 py-2 text-start">
        <p className="text-sm">
          <ThreadListItemPrimitive.Title fallback="New Chat" />
        </p>
      </ThreadListItemPrimitive.Trigger>
      <ThreadListItemPrimitive.Archive asChild>
        <TooltipIconButton
          className="hover:text-[#4f46e5] text-[#475569] dark:text-zinc-300 dark:hover:text-[#6366f1] ml-auto mr-3 size-4 p-0"
          variant="ghost"
          tooltip="Archive thread"
        >
          <ArchiveIcon />
        </TooltipIconButton>
      </ThreadListItemPrimitive.Archive>
    </ThreadListItemPrimitive.Root>
  );
};
