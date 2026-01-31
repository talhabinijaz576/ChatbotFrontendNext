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
  
  // CRITICAL: Memoize the components object to prevent component unmounting/remounting
  // This prevents the avatar and entire message from reloading
  const messageComponents = React.useMemo(() => ({
    UserMessage: (props: any) => (
      <UserMessage {...props} colors={colors} />
    ),
    EditComposer: EditComposer,
    AssistantMessage: (props: any) => <AssistantMessage {...props} config={config} />,
  }), [colors, config]);

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

const AssistantMessageComponent: FC<{config: any}> = ({config}) => {
  const content = useMessage((m) => {
    return m;
  });
  
  // Memoize config values that are actually used to prevent re-renders
  const avatarUrl = React.useMemo(() => config?.chat?.colors?.assistantMessage?.avatar ?? "", [config?.chat?.colors?.assistantMessage?.avatar]);
  const backgroundColor = React.useMemo(() => config?.chat?.backgroundColor ?? "bg-blue-950", [config?.chat?.backgroundColor]);
  
  // Use refs to track previous values and prevent unnecessary re-renders
  const prevContentRef = useRef<string>('');
  const prevMessageIdRef = useRef<string>('');
  const stableValuesRef = useRef<{
    messageId: string;
    markdownText: string;
    timestamp: string;
  } | null>(null);
  const isInitializedRef = useRef(false); // Track if we've ever had real content
  
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
    
    // CRITICAL: Once initialized with content, NEVER lose it
    // Ignore empty content from useMessage - it's just a re-render artifact
    if (isInitializedRef.current && stableValuesRef.current) {
      const cachedMessageId = stableValuesRef.current.messageId;
      const cachedText = stableValuesRef.current.markdownText;
      
      // If we have cached content, preserve it aggressively
      if (cachedText) {
        // If current is empty, ALWAYS ignore it and keep cached
        if (!currentText) {
          return stableValuesRef.current;
        }
        
        // Same message - only update if text increased (streaming)
        if (currentMessageId === cachedMessageId || (!currentMessageId && cachedMessageId)) {
          // Text increased - this is a streaming update, allow it
          if (currentText.length > cachedText.length) {
            prevContentRef.current = currentText;
            // Continue to calculate new values
          } else if (currentText === cachedText) {
            // Text unchanged - keep cached
            return stableValuesRef.current;
          } else {
            // Text decreased or changed but not increased - ignore, keep cached
            return stableValuesRef.current;
          }
        } else if (currentMessageId && currentMessageId !== cachedMessageId) {
          // Different message - this is a new message, update
          if (currentText) {
            prevContentRef.current = currentText;
            prevMessageIdRef.current = currentMessageId;
            isInitializedRef.current = true;
          }
        } else {
          // No current messageId - keep cached
          return stableValuesRef.current;
        }
      }
    } else {
      // Not initialized yet - initialize if we have content
      if (currentText && currentMessageId) {
        prevContentRef.current = currentText;
        prevMessageIdRef.current = currentMessageId;
        isInitializedRef.current = true;
      } else if (currentText) {
        // Have text but no messageId - still initialize
        prevContentRef.current = currentText;
        isInitializedRef.current = true;
      }
    }
    
    // Calculate new values - use current if available, otherwise preserve cached
    const messageId = currentMessageId || stableValuesRef.current?.messageId || '';
    const markdownText = currentText || stableValuesRef.current?.markdownText || '';
    
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
      : (stableValuesRef.current?.timestamp || '');
    
    const newStableValues = { messageId, markdownText, timestamp };
    stableValuesRef.current = newStableValues;
    // Mark as initialized if we have content
    if (markdownText) {
      isInitializedRef.current = true;
    }
    return newStableValues;
  }, [
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
  
  // Use ref to store last rendered content to prevent unnecessary re-renders
  const lastRenderedRef = useRef<{
    markdownText: string;
    messageId: string;
    content: React.ReactNode;
  } | null>(null);
  
  // Memoize the message content to prevent re-renders when content hasn't changed
  // CRITICAL: Once we render content, NEVER recalculate it unless content actually increases (streaming)
  const messageContent = React.useMemo(() => {
    // If we have cached content for this message, check if we should use it
    if (lastRenderedRef.current) {
      const cachedMessageId = lastRenderedRef.current.messageId;
      const cachedText = lastRenderedRef.current.markdownText;
      
      // Same message - check if we should preserve cached content
      if (cachedMessageId === messageId) {
        // If current is empty but cached exists, ALWAYS use cached
        if (isEmpty && cachedText) {
          return lastRenderedRef.current.content;
        }
        // If text hasn't changed, use cached
        if (markdownText === cachedText) {
          return lastRenderedRef.current.content;
        }
        // If text increased (streaming update), we need to update
        // But if text decreased or became empty, ignore it and keep cached
        if (markdownText && markdownText.length < cachedText.length) {
          // Text decreased - ignore, keep cached
          return lastRenderedRef.current.content;
        }
      } else if (cachedMessageId && !messageId) {
        // We have cached message but current is empty - keep cached
        return lastRenderedRef.current.content;
      }
    }
    
    // Only create new content if we have actual text OR it's a new message with loading state
    let content: React.ReactNode;
    if (isEmpty) {
      // Only show loading if we have a valid message ID (real message)
      if (hasValidMessage) {
        content = <LoadingDots />;
      } else {
        // No message yet - return cached if available, otherwise null
        return lastRenderedRef.current?.content ?? null;
      }
    } else {
      // We have text - create content
      content = (
        <>
          <MemoryUI />
          <MarkdownRenderer
            markdownText={markdownText}
            messageId={messageId}
            showCopyButton={true}
            isDarkMode={document.documentElement.classList.contains("dark")}
          />
          <AssistantActionBar timestamp={timestamp} type="assistant" />
        </>
      );
    }
    
    // Cache the rendered content - ALWAYS cache if we have content
    if (content) {
      lastRenderedRef.current = {
        markdownText,
        messageId,
        content
      };
    }
    
    return content;
  }, [markdownText, messageId, timestamp, isEmpty, hasValidMessage]);
  
  // Use cached content if current is empty but we have cache (prevents empty flash)
  const displayContent = messageContent || (lastRenderedRef.current?.content ?? null);
  
  // Check if we've ever had a message (either current or cached)
  // This prevents the flash - if we've rendered this message before, keep rendering
  const hasEverHadMessage = messageId || lastRenderedRef.current?.messageId;
  
  // Only return null if we've never had a message at all
  // If we have a cached message, always render (like UserMessage does)
  if (!hasEverHadMessage) {
    return null;
  }

  return (
    <MessagePrimitive.Root className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <ThreadPrimitive.If running>
          {isEmpty && messageId ? (
            <LoadingDots />
          ) : (
            displayContent
          )}
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running={false}>
          {displayContent}
        </ThreadPrimitive.If>
      </div>

      <div className="flex items-end justify-center col-start-1 row-start-1 mr-1 mb-1">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${backgroundColor}`}>
        <Image
          src={avatarUrl}
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

// Memoize AssistantMessage for production builds with stable comparison
const AssistantMessage = React.memo(AssistantMessageComponent, (prevProps, nextProps) => {
  // Compare actual config values that matter, not just the reference
  const prevAvatar = prevProps.config?.chat?.colors?.assistantMessage?.avatar;
  const nextAvatar = nextProps.config?.chat?.colors?.assistantMessage?.avatar;
  const prevBgColor = prevProps.config?.chat?.backgroundColor;
  const nextBgColor = nextProps.config?.chat?.backgroundColor;
  
  // Only re-render if config values that affect rendering actually changed
  // The content comparison is handled by useMessage hook and internal refs
  return (
    prevAvatar === nextAvatar &&
    prevBgColor === nextBgColor
  );
});

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
