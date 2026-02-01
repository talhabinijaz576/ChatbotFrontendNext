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
import MarkdownRenderer from "../mem0/markdown";
import type { AppendMessage, ThreadMessageLike } from "@assistant-ui/react";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "../attachment";
import Image from "next/image";

// CRITICAL: Module-level refs - these are updated but the components object never changes
let globalConfigRef: { current: any } = { current: null };
let globalColorsRef: { current: any } = { current: null };

// CRITICAL: Module-level cache for message content - persists across component instances
// Key: stable message ID, Value: { messageId, markdownText, timestamp, isInitialized }
const messageContentCache = new Map<string, {
  messageId: string;
  markdownText: string;
  timestamp: string;
  isInitialized: boolean;
}>();

// CRITICAL: Module-level cache for rendered content - persists across component instances
// Key: stable message ID, Value: { markdownText, messageId, content }
const renderedContentCache = new Map<string, {
  markdownText: string;
  messageId: string;
  content: React.ReactNode;
}>();

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
  isIframeOpen?: boolean;
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
  isIframeOpen = false,
}) => {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const viewportRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  
  // CRITICAL: Update module-level refs so components can read latest values
  // These refs are updated on every render, but the components object itself never changes
  const prevConfig = globalConfigRef.current;
  const prevColors = globalColorsRef.current;
  globalConfigRef.current = config;
  globalColorsRef.current = colors;
  
  // Log when config/colors change
  if (prevConfig !== config || prevColors !== colors) {
    console.log('[DEBUG] Thread render - config/colors updated', {
      configChanged: prevConfig !== config,
      colorsChanged: prevColors !== colors,
      configId: config ? Object.keys(config).join(',') : 'null',
      timestamp: Date.now()
    });
  }
  
  // Use the module-level components object - it NEVER changes
  const messageComponents = MESSAGE_COMPONENTS;
  
  // Log if components object reference changes (should never happen)
  if (messageComponents !== MESSAGE_COMPONENTS) {
    console.error('[DEBUG] CRITICAL: messageComponents reference changed!', {
      messageComponents,
      MESSAGE_COMPONENTS,
      timestamp: Date.now()
    });
  }
  
  console.log('[DEBUG] Thread render', {
    messageComponentsObjectId: messageComponents,
    MESSAGE_COMPONENTSObjectId: MESSAGE_COMPONENTS,
    areSame: messageComponents === MESSAGE_COMPONENTS,
    AssistantMessageFunction: messageComponents.AssistantMessage,
    timestamp: Date.now()
  });

  // Find and store viewport reference
  useEffect(() => {
    if (composerInputRef.current) {
      const viewport = composerInputRef.current.closest('[data-radix-scroll-area-viewport]') || 
                      composerInputRef.current.closest('.overflow-y-auto') ||
                      document.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewportRef.current = viewport as HTMLElement;
      }
    }
  }, []);

  // Keep composer visible when keyboard opens, maintain position when keyboard is open
  useEffect(() => {
    const handleFocus = () => {
      setIsKeyboardOpen(true);
      if (composerInputRef.current && viewportRef.current) {
        // Delay to let keyboard fully open
    const timeout = setTimeout(() => {
          const input = composerInputRef.current;
          const viewport = viewportRef.current;
          if (input && viewport) {
            const inputRect = input.getBoundingClientRect();
            const viewportRect = viewport.getBoundingClientRect();
            const inputBottom = inputRect.bottom;
            const viewportBottom = viewportRect.bottom;
            
            // Find the first message element to ensure it stays visible
            // Look for message containers in the viewport
            const messageContainers = viewport.querySelectorAll('[class*="grid"][class*="auto-rows"]');
            const firstMessage = messageContainers.length > 0 
              ? messageContainers[0] 
              : viewport.querySelector('div > div') || viewport.firstElementChild;
            
            let firstMessageTop = 0;
            if (firstMessage && firstMessage !== viewport) {
              const firstMessageRect = firstMessage.getBoundingClientRect();
              const viewportTop = viewportRect.top;
              firstMessageTop = firstMessageRect.top - viewportTop + viewport.scrollTop;
            }
            
            // Calculate desired scroll position to keep input above keyboard
            const desiredSpace = 20; // Space between keyboard and input
            const scrollAdjustment = inputBottom - viewportBottom + desiredSpace;
            
            if (scrollAdjustment > 0) {
              const newScrollTop = viewport.scrollTop + scrollAdjustment;
              
              // Ensure we don't scroll past the first message
              // Keep at least the first message visible (with some padding)
              const minScrollTop = Math.max(0, firstMessageTop - 20);
              const finalScrollTop = Math.max(minScrollTop, newScrollTop);
              
              lastScrollTopRef.current = finalScrollTop;
              viewport.scrollTo({
                top: finalScrollTop,
                behavior: 'smooth'
              });
            } else {
              // Store current position as target, but ensure first message is visible
              const currentScrollTop = viewport.scrollTop;
              const minScrollTop = Math.max(0, firstMessageTop - 20);
              lastScrollTopRef.current = Math.max(minScrollTop, currentScrollTop);
            }
          }
        }, 300);
    return () => clearTimeout(timeout);
      }
    };

    const handleBlur = () => {
      setIsKeyboardOpen(false);
    };

    const input = composerInputRef.current;
    if (input) {
      input.addEventListener('focus', handleFocus);
      input.addEventListener('blur', handleBlur);
      return () => {
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
      };
    }
  }, []);

  // Prevent scroll jitter when keyboard is open - maintain stable scroll position
  useEffect(() => {
    if (!isKeyboardOpen || !viewportRef.current) return;

    const viewport = viewportRef.current;
    const targetScrollTop = lastScrollTopRef.current || viewport.scrollTop;
    
    // When messages change and keyboard is open, maintain scroll position
    // Use requestAnimationFrame to restore position after any autoscroll
    const restoreScroll = () => {
      requestAnimationFrame(() => {
        if (viewport && isKeyboardOpen) {
          // Only restore if scroll changed significantly (more than 20px)
          if (Math.abs(viewport.scrollTop - targetScrollTop) > 20) {
            viewport.scrollTop = targetScrollTop;
          } else {
            // Update target if it's a small adjustment
            lastScrollTopRef.current = viewport.scrollTop;
          }
        }
      });
    };
    
    // Restore scroll position after a short delay to let autoscroll complete
    const timeout = setTimeout(restoreScroll, 100);
    
    return () => clearTimeout(timeout);
  }, [messages.length, isKeyboardOpen]);

  // Handle iframe close - reset scroll and ensure input is visible
  useEffect(() => {
    if (!isIframeOpen && viewportRef.current && composerInputRef.current) {
      // Iframe just closed - reset scroll position and ensure input is visible
      const viewport = viewportRef.current;
      const input = composerInputRef.current;
      
      // Blur the input to close keyboard if it's open
      if (document.activeElement === input) {
        input.blur();
        setIsKeyboardOpen(false);
      }
      
      // Reset scroll to show the input field
      setTimeout(() => {
        if (viewport && input) {
          // Scroll to show the input at the bottom
          const inputRect = input.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          
          // If input is below viewport or hidden, scroll it into view
          if (inputRect.bottom > viewportRect.bottom || inputRect.top < viewportRect.top) {
            input.scrollIntoView({
              behavior: 'smooth',
              block: 'end',
              inline: 'nearest'
            });
          }
          
          // Reset the stored scroll position
          lastScrollTopRef.current = viewport.scrollTop;
        }
      }, 100);
    }
  }, [isIframeOpen]);

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

      <ThreadPrimitive.Viewport 
        className="flex-0 md:flex-1 w-full overflow-y-auto"
        style={{ 
          maxHeight: "calc(100dvh - 4rem - env(safe-area-inset-bottom))",
          height: "calc(100dvh - 4rem - env(safe-area-inset-bottom))",
          scrollPaddingBottom: "calc(env(safe-area-inset-bottom) + 120px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex flex-col w-full items-center px-4 pt-4 pb-4 justify-end">
          {!messages.length && <Loader />}
          <ThreadPrimitive.Messages
          components={messageComponents}
        />  

          <ThreadPrimitive.If empty={false}>
            <div className="min-h-8 flex-grow" />
          </ThreadPrimitive.If>
        </div>
      </ThreadPrimitive.Viewport>
      
      {/* Suggestion bar - outside viewport so it doesn't interfere with composer */}
          {suggestedMessages?.buttons?.length > 0 && (
        <div className="flex flex-col w-full items-center justify-center px-4 pb-2 bg-inherit z-5">
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

      <div 
        className="sticky bottom-0 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit px-4 md:pb-4 mx-auto"
        style={{
          paddingBottom: 'max(calc(1rem + env(safe-area-inset-bottom)), calc(env(safe-area-inset-bottom) + 0.5rem))',
          marginBottom: 'env(safe-area-inset-bottom)',
          position: 'sticky',
          bottom: 0,
          zIndex: 20,
          backgroundColor: 'inherit',
        }}
      >
        <ThreadScrollToBottom />
        <Composer
          composerInputRef={
            composerInputRef as React.RefObject<HTMLTextAreaElement>
          }
          config={config}
          suggestedMessages={suggestedMessages}
          isIframeOpen={isIframeOpen}
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
  config: any;
  suggestedMessages: any;
  isIframeOpen?: boolean;
}

export const Composer: FC<ComposerProps> = ({
  composerInputRef,
  config,
  suggestedMessages,
  isIframeOpen = false,
}) => {
  return (
    <ComposerPrimitive.Root className="focus-within:border-[#4f46e5]/20 dark:focus-within:border-[#6366f1]/20 flex w-full flex-wrap items-end rounded-full border border-[#e2e8f0] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 shadow-sm transition-colors ease-in">
      <ComposerAttachments />
      <ComposerAddAttachment config={config} />
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        disabled={isIframeOpen}
        placeholder={config.app.name || "..."}
        className="placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-base outline-none focus:ring-0 disabled:cursor-not-allowed text-[#1e293b] dark:text-zinc-200"
        ref={composerInputRef}
      />
      <ComposerAction config={config} suggestedMessages={suggestedMessages} isIframeOpen={isIframeOpen} />
    </ComposerPrimitive.Root>
  );
};

interface ComposerActionProps {
  config: any;
  suggestedMessages?: any;
  isIframeOpen?: boolean;
}

const ComposerAction: FC<ComposerActionProps> = ({ config, suggestedMessages, isIframeOpen = false }) => {
  // Disable send button when buttons are displayed or iframe is open
  const hasActiveButtons = suggestedMessages?.buttons?.length > 0;
  const isDisabled = hasActiveButtons || isIframeOpen;
  
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={config?.chat?.attachment?.btnSendTooltip}
            variant="default"
            disabled={isDisabled}
            className="my-2.5 size-8 p-2 transition-opacity ease-in bg-[#4f46e5] dark:bg-[#6366f1] hover:bg-[#4338ca] dark:hover:bg-[#4f46e5] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
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

const UserActionBar: FC = ({ timestamp }) => {
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

// CRITICAL: Create module-level components object AFTER all components are defined
// This object is created ONCE when module loads and NEVER changes
// React will see this as a stable reference in production builds
const MESSAGE_COMPONENTS = {
  UserMessage: (props: any) => {
    console.log('[DEBUG] UserMessage wrapper called', { 
      colorsRef: globalColorsRef.current,
      timestamp: Date.now() 
    });
    return <UserMessage {...props} colors={globalColorsRef.current} />;
  },
  EditComposer: EditComposer,
  AssistantMessage: () => {
    console.log('[DEBUG] AssistantMessage wrapper called', { 
      configRef: globalConfigRef.current,
      timestamp: Date.now(),
      stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    return <AssistantMessage />; // Reads from globalConfigRef
  },
};

console.log('[DEBUG] MESSAGE_COMPONENTS created at module load', {
  timestamp: Date.now(),
  objectId: MESSAGE_COMPONENTS,
  AssistantMessageFunction: MESSAGE_COMPONENTS.AssistantMessage
});

const AssistantMessageComponent: FC = () => {
  // Read from module-level ref - no props means React never sees it as "new"
  const actualConfig = globalConfigRef.current;
  
  const content = useMessage((m) => {
    return m;
  });
  
  // CRITICAL: Store the FIRST message ID we see in a ref and NEVER change it
  // This prevents the component from unmounting/remounting when the library changes the message ID
  const stableMessageIdRef = useRef<string>('');
  const currentMessageId = content?.id ? String(content.id) : content?.createdAt ? String(content.createdAt) : '';
  
  // CRITICAL: Only set stable ID once - the FIRST time we see a message ID
  // After that, NEVER change it, even if the library gives us a different ID
  if (!stableMessageIdRef.current && currentMessageId) {
    stableMessageIdRef.current = currentMessageId;
    console.log('[DEBUG] AssistantMessageComponent - Setting stable message ID', {
      stableId: stableMessageIdRef.current,
      currentId: currentMessageId,
      timestamp: Date.now()
    });
  } else if (stableMessageIdRef.current && currentMessageId && currentMessageId !== stableMessageIdRef.current) {
    // Message ID changed - but we already have a stable one, NEVER change it
    console.log('[DEBUG] AssistantMessageComponent - Message ID changed but keeping stable ID', {
      stableId: stableMessageIdRef.current,
      newId: currentMessageId,
      timestamp: Date.now(),
      action: 'KEEPING_STABLE_ID'
    });
  }
  
  // Use the stable message ID for the key - this NEVER changes once set
  const messageIdForKey = stableMessageIdRef.current || currentMessageId;
  
  // Track mount/unmount - ONLY depend on stable ID, not current ID
  // This prevents the effect from running when the library changes the message ID
  React.useEffect(() => {
    console.log('🔴 [AssistantMessage] Component MOUNTED', {
      timestamp: Date.now(),
      stableMessageId: stableMessageIdRef.current,
      currentMessageId: currentMessageId,
      messageIdForKey,
      contentId: content?.id,
      contentTextLength: typeof content?.content === 'string' 
        ? content.content.length 
        : Array.isArray(content?.content) && content.content[0]?.text
        ? content.content[0].text.length
        : 0,
      hasContent: !!content?.content,
      stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
    });
    return () => {
      console.log('🔴 [AssistantMessage] Component UNMOUNTED', {
        timestamp: Date.now(),
        stableMessageId: stableMessageIdRef.current,
        currentMessageId: currentMessageId,
        messageIdForKey,
        contentId: content?.id,
        unmountReason: 'component unmounting',
        stackTrace: new Error().stack?.split('\n').slice(0, 5).join('\n')
      });
    };
    // CRITICAL: Only depend on stable ID - never on current ID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdForKey]);
  
  console.log('[DEBUG] AssistantMessageComponent render', {
    hasConfig: !!actualConfig,
    configId: actualConfig ? Object.keys(actualConfig).join(',') : 'null',
    stableMessageId: stableMessageIdRef.current,
    currentMessageId: currentMessageId,
    messageIdForKey,
    contentId: content?.id,
    contentCreatedAt: content?.createdAt,
    timestamp: Date.now(),
    componentInstance: 'AssistantMessageComponent'
  });
  
  // Extract config values directly - no memoization needed, just read from ref
  const avatarUrl = actualConfig?.chat?.colors?.assistantMessage?.avatar ?? "";
  const backgroundColor = actualConfig?.chat?.backgroundColor ?? "bg-blue-950";
  
  // Use refs to track previous values and prevent unnecessary re-renders
  const prevContentRef = useRef<string>('');
  const prevMessageIdRef = useRef<string>('');
  
  // CRITICAL: Get cached values from module-level cache using stable message ID
  // This persists across component instances
  const getCachedValues = React.useCallback(() => {
    const cached = messageContentCache.get(messageIdForKey);
    console.log('[DEBUG] getCachedValues', {
      messageIdForKey,
      hasCached: !!cached,
      cachedMessageId: cached?.messageId,
      cachedTextLength: cached?.markdownText?.length || 0,
      cacheSize: messageContentCache.size,
      allCacheKeys: Array.from(messageContentCache.keys())
    });
    if (cached) {
      return {
        messageId: cached.messageId,
        markdownText: cached.markdownText,
        timestamp: cached.timestamp,
        isInitialized: cached.isInitialized
      };
    }
    return null;
  }, [messageIdForKey]);
  
  const setCachedValues = React.useCallback((values: { messageId: string; markdownText: string; timestamp: string; isInitialized: boolean }) => {
    messageContentCache.set(messageIdForKey, values);
  }, [messageIdForKey]);
  
  // Extract stable values only when content actually changes
  // CRITICAL: Once we have content, NEVER lose it - ignore empty content from useMessage
  const stableValues = React.useMemo(() => {
    // Extract text for comparison
    const currentText = !content?.content 
      ? "" 
      : typeof content.content === "string" 
      ? content.content 
      : Array.isArray(content.content) && content.content[0]?.text
      ? content.content[0].text
      : "";
    
    // Extract message ID - this is the key identifier
    const currentMessageId = content?.id 
      ? String(content.id) 
      : content?.createdAt 
      ? String(content.createdAt) 
      : currentText 
      ? String(currentText.length) + currentText.substring(0, 50) 
      : '';
    
    // CRITICAL: Read from module-level cache (persists across component instances)
    const cachedValues = getCachedValues();
    const isInitialized = cachedValues?.isInitialized || false;
    
    // CRITICAL: Use the stable message ID for comparison, not the current one
    // This ensures we always preserve content for the same message, even if useMessage returns different IDs
    const stableId = messageIdForKey || cachedValues?.messageId || '';
    
    console.log('[DEBUG] stableValues useMemo', {
      stableId,
      messageIdForKey,
      currentMessageId,
      currentTextLength: currentText.length,
      currentTextPreview: currentText.substring(0, 50),
      isInitialized,
      hasCached: !!cachedValues,
      cachedMessageId: cachedValues?.messageId,
      cachedTextLength: cachedValues?.markdownText?.length || 0,
      timestamp: Date.now()
    });
    
    // CRITICAL: If we have cached values for this stable message, ALWAYS check it first
    // This prevents content from disappearing when useMessage returns different content
    // Check if currentMessageId matches our stable ID - if not, useMessage is returning wrong content
    const isCurrentMessageForThisComponent = currentMessageId === stableId || currentMessageId === messageIdForKey;
    
    if (cachedValues && stableId === cachedValues.messageId) {
      const cachedMessageId = cachedValues.messageId;
      const cachedText = cachedValues.markdownText || '';
      
      // CRITICAL: Check if this is the SAME stable message (not current message ID)
      // If the stable ID matches our cached ID, this is the same message - preserve content
      if (stableId === cachedMessageId) {
          console.log('[DEBUG] Same stable message - checking if update needed', {
            stableId,
            cachedMessageId,
            currentMessageId,
            isCurrentMessageForThisComponent,
            currentTextLength: currentText.length,
            cachedTextLength: cachedText.length,
            textIncreased: currentText && currentText.length > cachedText.length,
            textUnchanged: currentText === cachedText,
            isEmpty: !currentText,
            action: isCurrentMessageForThisComponent && currentText && currentText.length > cachedText.length ? 'UPDATE_STREAMING' : 'PRESERVE_CACHED'
          });
          
          // CRITICAL: Only use currentText if it's from the SAME message
          // If useMessage returned content for a different message, ignore it completely
          // EXCEPT: If cached text is empty and current text exists, allow the update
          // (This handles the case where useMessage ID is wrong but content is correct)
          if (!isCurrentMessageForThisComponent) {
            // useMessage returned content for a different message
            // But if cached is empty and current has content, allow update (content might be correct even if ID is wrong)
            if (!cachedText && currentText) {
              console.log('[DEBUG] Allowing update - cached empty, current has content (ID mismatch but content exists)', {
                stableId,
                currentMessageId,
                currentTextLength: currentText.length
              });
              prevContentRef.current = currentText;
              // Continue to calculate new values
            } else {
              // Cached has content or current is empty - preserve cached
              console.log('[DEBUG] Preserving cached content - currentMessageId does not match stableId', {
                stableId,
                currentMessageId,
                cachedTextLength: cachedText.length,
                currentTextLength: currentText.length
              });
              return cachedValues;
            }
          }
          
          // Same stable message AND currentText is from the same message - only update if text increased (streaming)
          if (currentText && currentText.length > cachedText.length) {
            // Text increased - this is a streaming update, allow it
            console.log('[DEBUG] Text increased - allowing streaming update', {
              oldLength: cachedText.length,
              newLength: currentText.length,
              diff: currentText.length - cachedText.length
            });
            prevContentRef.current = currentText;
            // Continue to calculate new values
          } else if (!cachedText && currentText) {
            // Cached is empty but we have current text - allow update (initial content arrival)
            console.log('[DEBUG] Allowing update - cached empty, current has content', {
              currentTextLength: currentText.length
            });
            prevContentRef.current = currentText;
            // Continue to calculate new values
          } else if (!currentText || currentText === cachedText) {
            // Current is empty or unchanged - keep cached
            console.log('[DEBUG] Preserving cached content - empty or unchanged', {
              isEmpty: !currentText,
              isUnchanged: currentText === cachedText,
              cachedTextLength: cachedText.length
            });
            return cachedValues;
          } else {
            // Text changed but not increased - ignore, keep cached
            console.log('[DEBUG] Preserving cached content - text changed but not increased', {
              currentLength: currentText.length,
              cachedLength: cachedText.length
            });
            return cachedValues;
          }
        } else if (stableId && stableId !== cachedMessageId) {
          // Different stable message - this is a genuinely new message
          console.log('[DEBUG] Different stable message - new message detected', {
            stableId,
            cachedMessageId,
            hasCurrentText: !!currentText,
            currentTextLength: currentText?.length || 0,
            action: currentText && stableId ? 'INITIALIZE_NEW' : 'PRESERVE_OLD'
          });
          
          // Only update if we have new content
          if (currentText && stableId) {
            prevContentRef.current = currentText;
            prevMessageIdRef.current = stableId;
          } else {
            // No new content - keep cached (this shouldn't happen for new messages, but be safe)
            console.log('[DEBUG] No new content for new message - preserving old cached', {
              hasCurrentText: !!currentText,
              hasStableId: !!stableId
            });
            return cachedValues;
          }
        }
    } else {
      // Not initialized yet - initialize if we have content
      console.log('[DEBUG] Not initialized - initializing if content available', {
        hasCurrentText: !!currentText,
        hasStableId: !!stableId,
        currentTextLength: currentText?.length || 0
      });
      
      if (currentText && stableId) {
        prevContentRef.current = currentText;
        prevMessageIdRef.current = stableId;
        console.log('[DEBUG] Initialized with stable ID and text', {
          stableId,
          textLength: currentText.length
        });
      } else if (currentText) {
        // Have text but no stableId - still initialize
        prevContentRef.current = currentText;
        console.log('[DEBUG] Initialized with text only (no stable ID)', {
          textLength: currentText.length
        });
      }
    }
    
    // Calculate new values - use current if available, otherwise preserve cached
    // CRITICAL: Always use the stable ID, never the current message ID
    const messageId = stableId || cachedValues?.messageId || '';
    const markdownText = currentText || cachedValues?.markdownText || '';
    
    // Calculate timestamp
    const timestamp = content?.content?.[0]?.created_at 
  ? new Date(content.content[0].created_at).toLocaleString([], {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
      : content?.created_at
      ? new Date(content.created_at).toLocaleString([], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
        })
      : (cachedValues?.timestamp || '');
    
    const newStableValues = { 
      messageId, 
      markdownText, 
      timestamp,
      isInitialized: !!markdownText || (cachedValues?.isInitialized || false)
    };
    
    // CRITICAL: Save to module-level cache so it persists across component instances
    setCachedValues(newStableValues);
    
    console.log('[DEBUG] Saved to module-level cache', {
      stableId: messageIdForKey,
      messageId,
      markdownTextLength: markdownText.length,
      isInitialized: newStableValues.isInitialized,
      cacheSize: messageContentCache.size
    });
    
    return newStableValues;
  }, [
    // CRITICAL: Include messageIdForKey and cache functions
    messageIdForKey,
    getCachedValues,
    setCachedValues,
    // Only depend on the actual content values, not object references
    content?.id,
    content?.createdAt,
    typeof content?.content === 'string' 
      ? content.content 
      : Array.isArray(content?.content) && content.content[0]?.text
      ? content.content[0].text
      : '',
    content?.content?.[0]?.created_at,
    content?.created_at
  ]);
  
  // Safely extract values with fallbacks to prevent null errors
  const messageId = stableValues?.messageId || '';
  const markdownText = stableValues?.markdownText || '';
  const timestamp = stableValues?.timestamp || '';
  
  // Check if message is empty (loading state)
  const isEmpty = !markdownText || markdownText.trim() === '';
  
  // Only render if we have a valid message ID (real message)
  // Don't render empty message boxes when content is briefly empty during re-renders
  const hasValidMessage = messageId && messageId.trim() !== '';
  const shouldRender = hasValidMessage;
  
  // CRITICAL: Get cached rendered content from module-level cache using STABLE message ID
  // This ensures we can read cached content even when messageId from stableValues is not yet available
  // CRITICAL: Only depend on messageIdForKey (stable ID), NOT messageId which changes
  const getCachedRenderedContent = React.useCallback(() => {
    // Use stable message ID ONLY - never use messageId which changes when new messages arrive
    const cacheKey = messageIdForKey;
    if (!cacheKey) {
      return null;
    }
    const cached = renderedContentCache.get(cacheKey);
    console.log('[DEBUG] getCachedRenderedContent', {
      cacheKey,
      messageIdForKey,
      hasCached: !!cached,
      cachedMessageId: cached?.messageId,
      cacheSize: renderedContentCache.size,
      allCacheKeys: Array.from(renderedContentCache.keys())
    });
    return cached || null;
  }, [messageIdForKey]); // CRITICAL: Only depend on stable ID, not messageId
  
  const setCachedRenderedContent = React.useCallback((content: { markdownText: string; messageId: string; content: React.ReactNode }) => {
    // Use stable message ID as the cache key
    const cacheKey = messageIdForKey || content.messageId;
    renderedContentCache.set(cacheKey, content);
    console.log('[DEBUG] Saved rendered content to module-level cache', {
      cacheKey,
      messageId: content.messageId,
      markdownTextLength: content.markdownText.length,
      cacheSize: renderedContentCache.size
    });
  }, [messageIdForKey]);
  
  // For backward compatibility, create a ref-like object that reads from cache
  const lastRenderedRef = React.useMemo(() => ({
    current: getCachedRenderedContent()
  }), [getCachedRenderedContent]);
  
  // CRITICAL: Check cache FIRST before any useMemo - this prevents unnecessary recalculations
  // If we have cached content for this stable message ID, use it directly without recalculation
  const cachedContentForStableId = React.useMemo(() => {
    return getCachedRenderedContent();
  }, [messageIdForKey]); // Only recalculate when stable ID changes (which should never happen)
  
  // CRITICAL: Use a ref to store the last rendered content to prevent re-renders
  // This ensures React sees the same reference even when useMemo recalculates
  const lastRenderedContentRef = React.useRef<React.ReactNode | null>(null);
  
  // CRITICAL: Check cache FIRST and return immediately if we have cached content
  // This prevents the useMemo from running at all when we have cached content
  let cachedContentDirect: React.ReactNode | null = null;
  if (cachedContentForStableId) {
    const cachedMessageId = cachedContentForStableId.messageId;
    const cachedText = cachedContentForStableId.markdownText || '';
    const comparisonId = messageIdForKey;
    
    // If this cached content belongs to our stable message ID and has text, use it directly
    if (cachedMessageId === comparisonId && cachedText && cachedText.length > 0) {
      // Use cached content directly - this prevents useMemo from running
      if (lastRenderedContentRef.current !== cachedContentForStableId.content) {
        console.log('[DEBUG] messageContent - using cached directly (bypassing useMemo)', {
          cachedMessageId,
          stableId: messageIdForKey,
          cachedTextLength: cachedText.length
        });
        lastRenderedContentRef.current = cachedContentForStableId.content;
      }
      // Use the ref to ensure we return the same reference
      cachedContentDirect = lastRenderedContentRef.current;
    }
  }
  
  // Only create useMemo if we don't have cached content (new message or loading)
  // Memoize the message content to prevent re-renders when content hasn't changed
  // CRITICAL: Once we render content, NEVER recalculate it unless content actually increases (streaming)
  const messageContentMemo = React.useMemo(() => {
    // CRITICAL: If we have cached content for this stable message ID, return it IMMEDIATELY
    // This prevents any recalculation when dependencies change for other messages
    if (cachedContentForStableId) {
      const cachedMessageId = cachedContentForStableId.messageId;
      const cachedText = cachedContentForStableId.markdownText || '';
      const comparisonId = messageIdForKey || messageId;
      
      // If this cached content belongs to our stable message ID, use it directly
      if (cachedMessageId === comparisonId || cachedMessageId === messageId || cachedMessageId === messageIdForKey) {
        if (cachedText && cachedText.length > 0) {
          console.log('[DEBUG] messageContent - returning cached immediately (stable ID match)', {
            cachedMessageId,
            stableId: messageIdForKey,
            cachedTextLength: cachedText.length
          });
          lastRenderedContentRef.current = cachedContentForStableId.content;
          return cachedContentForStableId.content;
        }
      }
    }
    
    // CRITICAL: Check if cached rendered content has actual text (not just markdownText from stableValues)
    // This handles the case where stableValues preserves empty content but cached rendered content has text
    const cachedContentForCheck = getCachedRenderedContent();
    const cachedHasText = cachedContentForCheck?.markdownText && cachedContentForCheck.markdownText.length > 0;
    
    // Only create new content if we have actual text OR it's a new message with loading state
    let content: React.ReactNode;
    // CRITICAL: Use cached text if available, even if markdownText from stableValues is empty
    // This handles the case where stableValues hasn't updated yet but cached content has text
    const effectiveText = markdownText || cachedContentForCheck?.markdownText || '';
    const effectiveIsEmpty = !effectiveText || effectiveText.trim() === '';
    
    // CRITICAL: If we have cached content with text, use it instead of creating new content
    // This prevents re-renders when useMessage returns content for a different message
    if (cachedContentForCheck && cachedHasText) {
      const cachedMessageId = cachedContentForCheck.messageId;
      const comparisonId = messageIdForKey || messageId;
      // Only use cached if it matches our stable ID
      if (cachedMessageId === comparisonId || cachedMessageId === messageId || cachedMessageId === messageIdForKey) {
        console.log('[DEBUG] messageContent - using cached (has text, stable ID match)', {
          cachedMessageId,
          stableId: messageIdForKey,
          cachedTextLength: cachedContentForCheck.markdownText.length
        });
        lastRenderedContentRef.current = cachedContentForCheck.content;
        return cachedContentForCheck.content;
      }
    }
    
    if (effectiveIsEmpty) {
      // Only show loading if we have a valid message ID (real message)
      if (hasValidMessage) {
        content = <LoadingDots />;
      } else {
        // No message yet - return cached if available, otherwise null
        console.log('[DEBUG] messageContent - empty, returning cached if available', {
          hasCached: !!cachedContentForCheck,
          cachedMessageId: cachedContentForCheck?.messageId,
          cachedHasText
        });
        const result = cachedContentForCheck?.content ?? null;
        lastRenderedContentRef.current = result;
        return result;
      }
    } else {
      // We have text - create content
      // CRITICAL: Use effectiveText which includes cached text if markdownText is empty
      content = (
        <>
        <MemoryUI />
        <MarkdownRenderer
          markdownText={effectiveText}
            messageId={messageId}
          showCopyButton={true}
          isDarkMode={document.documentElement.classList.contains("dark")}
        />
      <AssistantActionBar timestamp={timestamp} type="assistant" />
        </>
      );
    }
    
    // CRITICAL: Cache the rendered content in module-level cache - ALWAYS cache if we have content
    // Use effectiveText for caching to ensure we cache the actual text being rendered
    if (content) {
      const renderedContent = {
        markdownText: effectiveText, // Use effectiveText, not markdownText from stableValues
        messageId: messageIdForKey || messageId, // Use stable ID for caching
        content
      };
      setCachedRenderedContent(renderedContent);
    }
    
    lastRenderedContentRef.current = content;
    return content;
  }, [
    // CRITICAL: Only depend on stable ID and actual content - NOT messageId which changes
    messageIdForKey,
    cachedContentForStableId,
    // Only depend on markdownText if it actually changed (not just messageId)
    markdownText,
    // Only recalculate if content actually changed, not just dependencies
    timestamp,
    isEmpty,
    hasValidMessage,
    getCachedRenderedContent,
    setCachedRenderedContent
  ]);
  
  // Use cached content if available, otherwise use memoized content
  // CRITICAL: This prevents useMemo from running when we have cached content
  const messageContent: React.ReactNode = cachedContentDirect ?? messageContentMemo;
  
  // CRITICAL: Always try to get cached content using stable message ID
  // This ensures we can read cached content even when messageId from stableValues is not yet available
  const cachedRenderedContent = getCachedRenderedContent();
  
  // CRITICAL: Use ref to store the last valid displayContent to prevent text from disappearing
  // Once we've rendered content, we NEVER want it to disappear, even if useMessage briefly returns null
  const lastValidDisplayContentRef = React.useRef<React.ReactNode | null>(null);
  const lastValidMessageIdRef = React.useRef<string | null>(null);
  
  // CRITICAL: Use ref to prevent re-renders - if we have cached content, use it directly
  // This ensures React sees the same reference even when messageContent useMemo recalculates
  const displayContent = React.useMemo(() => {
    const currentMessageId = messageIdForKey || messageId || '';
    
    // If message ID changed, reset the ref (new message)
    if (lastValidMessageIdRef.current && lastValidMessageIdRef.current !== currentMessageId) {
      console.log('[DEBUG] displayContent - message ID changed, resetting ref', {
        oldId: lastValidMessageIdRef.current,
        newId: currentMessageId
      });
      lastValidDisplayContentRef.current = null;
      lastValidMessageIdRef.current = null;
    }
    
    let calculatedContent: React.ReactNode | null = null;
    
    // If we have cached content for this stable message ID, use it
    if (cachedRenderedContent) {
      const cachedMessageId = cachedRenderedContent.messageId;
      const comparisonId = messageIdForKey || messageId;
      if (cachedMessageId === comparisonId || cachedMessageId === messageId || cachedMessageId === messageIdForKey) {
        if (cachedRenderedContent.markdownText && cachedRenderedContent.markdownText.length > 0) {
          console.log('[DEBUG] displayContent - using cached (stable ID match)', {
            cachedMessageId,
            stableId: messageIdForKey
          });
          calculatedContent = cachedRenderedContent.content;
        }
      }
    }
    
    // If no cached content, try messageContent
    if (!calculatedContent) {
      calculatedContent = messageContent;
    }
    
    // If still no content, check raw message object (initial load)
    if (!calculatedContent && content?.content) {
      const rawText = typeof content.content === "string" 
        ? content.content 
        : Array.isArray(content.content) && content.content[0]?.text
        ? content.content[0].text
        : "";
      if (rawText) {
        console.log('[DEBUG] displayContent - using raw content from message object (initial load)', {
          rawTextLength: rawText.length,
          messageId: messageIdForKey
        });
        calculatedContent = rawText;
      }
    }
    
    // CRITICAL: If we have calculated content, store it in ref and return it
    // This ensures we preserve it for future renders AND allows new content to show
    if (calculatedContent) {
      lastValidDisplayContentRef.current = calculatedContent;
      lastValidMessageIdRef.current = currentMessageId;
      return calculatedContent;
    }
    
    // CRITICAL: Only use ref as fallback if calculated content is null
    // This allows new messages to show their content, but preserves existing content during transitions
    if (lastValidDisplayContentRef.current && lastValidMessageIdRef.current === currentMessageId) {
      console.log('[DEBUG] displayContent - preserving last valid content (preventing flicker)', {
        stableId: messageIdForKey,
        messageId: currentMessageId,
        hasPreviousContent: true
      });
      return lastValidDisplayContentRef.current;
    }
    
    return null;
  }, [cachedRenderedContent, messageContent, messageIdForKey, messageId, content]);
  
  console.log('[DEBUG] displayContent decision', {
    hasMessageContent: !!messageContent,
    hasCachedContent: !!cachedRenderedContent?.content,
    cachedMessageId: cachedRenderedContent?.messageId,
    stableMessageId: messageIdForKey,
    displayContentType: displayContent ? (typeof displayContent === 'object' ? 'ReactNode' : 'string') : 'null',
    timestamp: Date.now()
  });
  
  // Check if we've ever had a message (either current or cached)
  // This prevents the flash - if we've rendered this message before, keep rendering
  const hasEverHadMessage = messageId || cachedRenderedContent?.messageId || messageIdForKey;
  
  console.log('[DEBUG] hasEverHadMessage check', {
    messageId,
    cachedMessageId: cachedRenderedContent?.messageId,
    stableMessageId: messageIdForKey,
    hasEverHadMessage,
    willRender: hasEverHadMessage,
    timestamp: Date.now()
  });
  
  // Only return null if we've never had a message at all
  // If we have a cached message, always render (like UserMessage does)
  if (!hasEverHadMessage) {
    return null;
  }

  // CRITICAL: Use the STABLE message ID for the key, not the current one
  // This prevents unmounting/remounting when the library changes the message ID
  const stableKey = messageIdForKey ? `assistant-msg-${String(messageIdForKey)}` : undefined;
  
  console.log('[DEBUG] AssistantMessageComponent returning JSX', {
    stableMessageId: messageIdForKey,
    currentMessageId: messageId,
    stableKey,
    hasEverHadMessage,
    timestamp: Date.now()
  });

  // CRITICAL: Always render content when available, regardless of isRunning state
  // This prevents flicker when isRunning changes - the content stays mounted
  // Only show loading dots when isRunning is true AND content is empty
  const hasContent = displayContent !== null && displayContent !== undefined;
  const shouldShowLoadingDots = isEmpty && messageId && !hasContent;
  
  return (
    <MessagePrimitive.Root 
      key={stableKey}
      className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      {/* Always render content when available - prevents flicker during isRunning transition */}
      {hasContent && (
        <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
          {displayContent}
        </div>
      )}
      {/* Show loading dots only when running and no content yet */}
      <ThreadPrimitive.If running>
        {shouldShowLoadingDots && (
          <div className="col-span-2 col-start-2 row-start-1 my-1.5 flex items-center">
            <LoadingDots />
          </div>
        )}
      </ThreadPrimitive.If>

      <div key={`avatar-${avatarUrl}`} className="flex items-end justify-center col-start-1 row-start-1 mr-1 mb-1">
        <AssistantAvatar avatarUrl={avatarUrl} backgroundColor={backgroundColor} />
      </div>

      <BranchPicker className="col-start-2 row-start-2 -ml-2 mr-2" />
    </MessagePrimitive.Root>
  );
};

// Three-dot loading animation component
const LoadingDots: FC = () => {
  return (
    <div className="flex items-center gap-1.5 px-1">
      <span className="w-2 h-2 bg-[#475569] dark:bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></span>
      <span className="w-2 h-2 bg-[#475569] dark:bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '160ms', animationDuration: '1.4s' }}></span>
      <span className="w-2 h-2 bg-[#475569] dark:bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '320ms', animationDuration: '1.4s' }}></span>
    </div>
  );
};

// CRITICAL: Memoized avatar component to prevent Image reload
// This component only re-renders when avatarUrl or backgroundColor actually change
const AssistantAvatar: FC<{avatarUrl: string; backgroundColor: string}> = React.memo(({avatarUrl, backgroundColor}) => {
  // Track mount/unmount to see if component is being recreated
  React.useEffect(() => {
    console.log('[DEBUG] AssistantAvatar MOUNTED', {
      avatarUrl,
      backgroundColor,
      timestamp: Date.now()
    });
    return () => {
      console.log('[DEBUG] AssistantAvatar UNMOUNTED', {
        avatarUrl,
        backgroundColor,
        timestamp: Date.now()
      });
    };
  }, [avatarUrl, backgroundColor]);
  
  console.log('[DEBUG] AssistantAvatar render', {
    avatarUrl,
    backgroundColor,
    timestamp: Date.now(),
    imageWillReload: true
  });
  
  return (
    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${backgroundColor}`}>
      <Image
        key={`img-${avatarUrl}`} // Stable key based on URL
        src={avatarUrl}
        alt="Assistant Avatar"
        width={20}
        height={20}
        className="invert brightness-0 saturate-0 contrast-200"
        onLoad={() => console.log('[DEBUG] Image loaded', { avatarUrl, timestamp: Date.now() })}
        onError={(e) => console.error('[DEBUG] Image error', { avatarUrl, error: e, timestamp: Date.now() })}
        onLoadStart={() => console.log('[DEBUG] Image load START', { avatarUrl, timestamp: Date.now() })}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  const shouldSkip = prevProps.avatarUrl === nextProps.avatarUrl && 
                     prevProps.backgroundColor === nextProps.backgroundColor;
  
  console.log('[DEBUG] AssistantAvatar memo comparison', {
    prevAvatarUrl: prevProps.avatarUrl,
    nextAvatarUrl: nextProps.avatarUrl,
    prevBg: prevProps.backgroundColor,
    nextBg: nextProps.backgroundColor,
    shouldSkip,
    timestamp: Date.now()
  });
  
  // Only re-render if avatarUrl or backgroundColor actually changed
  return shouldSkip;
});
AssistantAvatar.displayName = 'AssistantAvatar';

// Loading message component that appears when assistant is generating a response
const LoadingMessage: FC<{config: any}> = ({config}) => {
  return (
    <div className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <LoadingDots />
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
    </div>
  );
};

// DON'T wrap with React.memo - UserMessage doesn't use it and it works fine
// The assistant-ui library handles memoization internally via useMessage
const AssistantMessage = AssistantMessageComponent;

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
