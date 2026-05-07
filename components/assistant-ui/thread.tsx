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
import { keepInputFocused } from "@/app/utils/deviceDetection";

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
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const keepVisibleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visualViewportRef = useRef<VisualViewport | null>(null);
  const suggestionBarRef = useRef<HTMLDivElement | null>(null);
  const hasFocusedOnLoadRef = useRef<boolean>(false);
  
  // CRITICAL: Update module-level refs so components can read latest values
  // These refs are updated on every render, but the components object itself never changes
  const prevConfig = globalConfigRef.current;
  const prevColors = globalColorsRef.current;
  globalConfigRef.current = config;
  globalColorsRef.current = colors;
  
  // Use the module-level components object - it NEVER changes
  const messageComponents = MESSAGE_COMPONENTS;

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
    
    // Store visual viewport reference for keyboard detection
    if (typeof window !== 'undefined' && window.visualViewport) {
      visualViewportRef.current = window.visualViewport;
      setVisualViewportHeight(window.visualViewport.height);
      
      // Listen for viewport changes to update height state
      const updateHeight = () => {
        if (window.visualViewport) {
          setVisualViewportHeight(window.visualViewport.height);
        }
      };
      
      window.visualViewport.addEventListener('resize', updateHeight);
      window.visualViewport.addEventListener('scroll', updateHeight);
      
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', updateHeight);
          window.visualViewport.removeEventListener('scroll', updateHeight);
        }
      };
    } else {
      // Fallback for browsers without visual viewport API
      setVisualViewportHeight(window.innerHeight);
    }
  }, []);

  // Scroll to bottom on initial load to prevent white space on iPhone
  useEffect(() => {
    const scrollToBottom = () => {
      const viewport = viewportRef.current;
      if (viewport && viewport.scrollHeight > 0) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          // Scroll to the very bottom
          const maxScroll = viewport.scrollHeight - viewport.clientHeight;
          viewport.scrollTop = Math.max(0, maxScroll);
          lastScrollTopRef.current = viewport.scrollTop;
        });
      }
    };

    // Try multiple times to ensure it works on iPhone
    // iPhone sometimes needs multiple attempts due to layout timing
    const attemptScroll = () => {
      scrollToBottom();
    };

    // Immediate attempt
    attemptScroll();

    // Delayed attempts to handle layout completion
    const timeouts: NodeJS.Timeout[] = [];
    [50, 100, 200, 300, 500].forEach((delay) => {
      const timeout = setTimeout(attemptScroll, delay);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [visualViewportHeight]);

  // Scroll to bottom when messages are loaded or change
  // Also trigger on last message content changes, not just length
  const lastMessageContent = messages.length > 0 
    ? JSON.stringify(messages[messages.length - 1]?.content) 
    : '';
  
  useEffect(() => {
    if (messages.length > 0 && viewportRef.current) {
      const viewport = viewportRef.current;
      // Use multiple attempts to ensure scroll happens after layout
      const scrollToBottom = () => {
        if (viewport.scrollHeight > 0) {
          requestAnimationFrame(() => {
            // Use scrollTo with smooth behavior for better UX, but ensure it reaches the bottom
            const maxScroll = viewport.scrollHeight - viewport.clientHeight;
            const targetScroll = Math.max(0, maxScroll);
            
            // Check if we're already at the bottom (within 10px threshold)
            const currentScroll = viewport.scrollTop;
            const isNearBottom = Math.abs(currentScroll - targetScroll) < 10;
            
            // Only scroll if we're not already at the bottom
            if (!isNearBottom || targetScroll > currentScroll) {
              viewport.scrollTop = targetScroll;
              lastScrollTopRef.current = viewport.scrollTop;
            }
          });
        }
      };

      // Immediate scroll
      scrollToBottom();

      // Delayed scrolls to handle layout changes and content rendering
      const timeout1 = setTimeout(scrollToBottom, 50);
      const timeout2 = setTimeout(scrollToBottom, 200);
      const timeout3 = setTimeout(scrollToBottom, 400);
      const timeout4 = setTimeout(scrollToBottom, 600); // Additional delay for slow renders

      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
        clearTimeout(timeout4);
      };
    }
  }, [messages.length, lastMessageContent]);

  // Ensure last message scrolls into view when it appears or content changes
  useEffect(() => {
    if (messages.length === 0 || !viewportRef.current) return;

    const viewport = viewportRef.current;
    
    // Find the last message element - look for MessagePrimitive.Root elements
    const findLastMessage = () => {
      // Try multiple selectors to find message elements
      const selectors = [
        '[role="article"]', // Radix UI message root
        '[data-radix-scroll-area-viewport] > div > div', // Message container
      ];
      
      for (const selector of selectors) {
        const elements = viewport.querySelectorAll(selector);
        if (elements.length > 0) {
          return elements[elements.length - 1] as HTMLElement;
        }
      }
      
      // Fallback: find by structure - last div with message-like content
      const allDivs = viewport.querySelectorAll('div');
      for (let i = allDivs.length - 1; i >= 0; i--) {
        const div = allDivs[i];
        if (div.textContent && div.textContent.trim().length > 10) {
          return div as HTMLElement;
        }
      }
      return null;
    };

    const scrollToLastMessage = () => {
      if (!viewport || viewport.scrollHeight === 0) return;
      
      // Always ensure we scroll to the absolute bottom
      requestAnimationFrame(() => {
        const maxScroll = viewport.scrollHeight - viewport.clientHeight;
        const targetScroll = Math.max(0, maxScroll);
        const currentScroll = viewport.scrollTop;
        
        // Only scroll if we're not already at the bottom (within 5px threshold)
        if (Math.abs(currentScroll - targetScroll) > 5) {
          viewport.scrollTop = targetScroll;
          lastScrollTopRef.current = viewport.scrollTop;
        }
      });
      
      // Also try to find and scroll the last message element for extra reliability
      const lastMessage = findLastMessage();
      if (lastMessage) {
        // Use instant scroll for reliability, then smooth if needed
        requestAnimationFrame(() => {
          const messageRect = lastMessage.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          
          // Check if message is fully visible
          const isFullyVisible = 
            messageRect.top >= viewportRect.top &&
            messageRect.bottom <= viewportRect.bottom;
          
          if (!isFullyVisible) {
            // Message is not fully visible, scroll it into view
            lastMessage.scrollIntoView({
              behavior: 'auto', // Use instant for reliability
              block: 'end',
              inline: 'nearest'
            });
          }
        });
      }
    };

    // Scroll immediately and after delays to handle rendering
    scrollToLastMessage();
    const timeout1 = setTimeout(scrollToLastMessage, 100);
    const timeout2 = setTimeout(scrollToLastMessage, 300);
    const timeout3 = setTimeout(scrollToLastMessage, 600);

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      clearTimeout(timeout3);
    };
  }, [messages.length, lastMessageContent]);

  // Focus input on first load when messages are loaded
  useEffect(() => {
    // Only focus on first load, when we have messages and no suggestions
    if (!hasFocusedOnLoadRef.current && messages.length > 0 && !suggestedMessages?.buttons?.length && !isIframeOpen) {
      hasFocusedOnLoadRef.current = true;
      
      // Wait a bit for the DOM to be ready, then focus
      const timeout = setTimeout(() => {
        if (composerInputRef.current && document.activeElement !== composerInputRef.current) {
          composerInputRef.current.focus();
          setIsKeyboardOpen(true);
          }
        }, 300);
      
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [messages.length, suggestedMessages?.buttons?.length, isIframeOpen]);

  // Keep keyboard open when suggestions are displayed - send button will be disabled instead

  // Auto-scroll suggestions into view when they appear, ensuring they're above the keyboard
  useEffect(() => {
    if (suggestedMessages?.buttons?.length > 0 && suggestionBarRef.current && viewportRef.current) {
      // Wait a bit for the DOM to render the suggestions and keyboard to settle
      const timeout = setTimeout(() => {
        const suggestionBar = suggestionBarRef.current;
        const viewport = viewportRef.current;
        
        if (!suggestionBar || !viewport) return;

        // Get visual viewport height (accounts for keyboard)
        const visualViewport = visualViewportRef.current;
        const viewportHeight = visualViewport ? visualViewport.height : window.innerHeight;

        // Get the bounding rectangles relative to the viewport
        const suggestionRect = suggestionBar.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        
        // Calculate the visible viewport bottom (accounting for keyboard)
        const visibleViewportBottom = Math.min(viewportRect.bottom, viewportHeight);
        
        // Check if suggestion bar is fully visible above the keyboard
        const isFullyVisible = 
          suggestionRect.top >= viewportRect.top &&
          suggestionRect.bottom <= visibleViewportBottom;
        
        if (!isFullyVisible) {
          // Calculate the scroll position needed to show the suggestion bar above the keyboard
          const suggestionTop = suggestionBar.offsetTop;
          const suggestionHeight = suggestionBar.offsetHeight;
          
          // Account for input/composer height (we want suggestions above the input)
          const input = composerInputRef.current;
          let inputHeight = 0;
          if (input) {
            const inputRect = input.getBoundingClientRect();
            inputHeight = inputRect.height;
          }
          
          // Calculate scroll position to show suggestion bar above input and keyboard
          // Leave padding between suggestions and input
          const padding = 20;
          const targetScrollTop = suggestionTop + suggestionHeight + inputHeight + padding - viewportHeight;
          
          // Smooth scroll to the target position
          viewport.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        }
      }, 300); // Longer delay to ensure keyboard is fully open and DOM is ready
      
      return () => clearTimeout(timeout);
    }
  }, [suggestedMessages?.buttons?.length, visualViewportHeight, isKeyboardOpen]);

  // Keep composer visible when keyboard opens, maintain position when keyboard is open
  useEffect(() => {
    const handleFocus = () => {
      setIsKeyboardOpen(true);
      // The continuous visibility check will handle positioning
    };

    const handleBlur = () => {
      // Don't immediately set to false - wait a bit in case it's a temporary blur
      setTimeout(() => {
        if (document.activeElement !== composerInputRef.current) {
      setIsKeyboardOpen(false);
        }
      }, 100);
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

  // CRITICAL: Continuously ensure input is always visible above keyboard
  useEffect(() => {
    const ensureInputVisible = () => {
      const input = composerInputRef.current;
    const viewport = viewportRef.current;
      
      if (!input || !viewport) return;
      
      // Get visual viewport height (accounts for keyboard)
      const visualViewport = visualViewportRef.current;
      const viewportHeight = visualViewport ? visualViewport.height : window.innerHeight;
      
      // Calculate suggestion bar height if it exists and is visible
      let suggestionBarHeight = 0;
      let suggestionBarTop = 0;
      let suggestionBarBottom = 0;
      if (suggestionBarRef.current) {
        const suggestionBarRect = suggestionBarRef.current.getBoundingClientRect();
        // Only count suggestion bar if it's actually visible
        if (suggestionBarRect.height > 0 && suggestionBarRect.width > 0) {
          suggestionBarHeight = suggestionBarRect.height;
          suggestionBarTop = suggestionBarRect.top;
          suggestionBarBottom = suggestionBarRect.bottom;
        }
      }
      
      // Get input position relative to viewport
      const inputRect = input.getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      
      // Calculate if input is visible
      const inputTop = inputRect.top;
      const inputBottom = inputRect.bottom;
      const inputHeight = inputRect.height;
      const viewportTop = viewportRect.top;
      const viewportBottom = Math.min(viewportRect.bottom, viewportHeight);
      
      // Desired space above keyboard (padding)
      const padding = 20;
      
      // Ensure suggestions are visible above the keyboard and input
      const suggestionBarIsVisible = suggestionBarHeight > 0;
      
      // Check if suggestion bar is hidden below the visible viewport (behind keyboard)
      const suggestionBarHiddenBelowViewport = suggestionBarIsVisible && 
                                                suggestionBarBottom > viewportBottom;
      
      // Check if suggestion bar is above the input (correct position)
      const suggestionBarAboveInput = suggestionBarIsVisible && 
                                      suggestionBarBottom <= inputTop;
      
      // If suggestions exist, ensure they're visible above keyboard and input
      if (suggestionBarIsVisible && suggestionBarRef.current) {
        if (suggestionBarHiddenBelowViewport || !suggestionBarAboveInput) {
          // Scroll to show suggestions above input and keyboard
          const suggestionTop = suggestionBarRef.current.offsetTop;
          const suggestionHeight = suggestionBarHeight;
          
          // Calculate scroll position to show suggestions above input
          const targetScrollTop = suggestionTop + suggestionHeight + inputHeight + padding - viewportHeight;
          
          viewport.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        }
      }
      
      // Account for suggestion bar height - input must be completely visible above keyboard
      // Suggestions should be above input, so we need space for both
      const totalSpaceNeeded = padding + (suggestionBarIsVisible ? suggestionBarHeight + inputHeight : inputHeight);
      const targetBottom = viewportBottom - totalSpaceNeeded;
      
      // Check if input is hidden below viewport or too close to bottom
      if (inputBottom > targetBottom || inputTop < viewportTop) {
        // Calculate how much to scroll
        let scrollAdjustment = 0;
        
        if (inputBottom > targetBottom) {
          // Input is below target position (keyboard + suggestions + input + padding)
          scrollAdjustment = inputBottom - targetBottom;
        } else if (inputTop < viewportTop) {
          // Input is above viewport, scroll up to show it
          scrollAdjustment = -(viewportTop - inputTop + padding);
        }
        
        if (scrollAdjustment > 0) {
          // Scroll down to show input
          const newScrollTop = viewport.scrollTop + scrollAdjustment;
          viewport.scrollTop = newScrollTop;
          lastScrollTopRef.current = newScrollTop;
        } else if (scrollAdjustment < 0) {
          // Scroll up to show input
          const newScrollTop = Math.max(0, viewport.scrollTop + scrollAdjustment);
          viewport.scrollTop = newScrollTop;
          lastScrollTopRef.current = newScrollTop;
        }
      }
    };
    
    // Use IntersectionObserver to monitor input visibility
    let intersectionObserver: IntersectionObserver | null = null;
    const input = composerInputRef.current;
    
    if (input && typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // If input is not fully visible, ensure it becomes visible
            if (!entry.isIntersecting || entry.intersectionRatio < 1) {
              ensureInputVisible();
            }
          });
        },
        {
          root: viewportRef.current,
          rootMargin: '0px',
          threshold: [0, 0.5, 1.0], // Check at different visibility levels
        }
      );
      
      intersectionObserver.observe(input);
    }
    
    // Run continuously when keyboard is open or input is focused
    if (isKeyboardOpen || document.activeElement === composerInputRef.current) {
      // Clear any existing interval
      if (keepVisibleIntervalRef.current) {
        clearInterval(keepVisibleIntervalRef.current);
      }
      
      // Check immediately
      ensureInputVisible();
      
      // Check continuously using requestAnimationFrame for smooth updates
      let rafId: number;
      const continuousCheck = () => {
        ensureInputVisible();
        rafId = requestAnimationFrame(continuousCheck);
      };
      rafId = requestAnimationFrame(continuousCheck);
      
      // Also check on visual viewport resize (keyboard open/close)
      const handleVisualViewportResize = () => {
        ensureInputVisible();
      };
      
      // Also check on window resize
      const handleResize = () => {
        ensureInputVisible();
      };
      
      if (visualViewportRef.current) {
        visualViewportRef.current.addEventListener('resize', handleVisualViewportResize);
        visualViewportRef.current.addEventListener('scroll', handleVisualViewportResize);
      }
      window.addEventListener('resize', handleResize);
      
      return () => {
        cancelAnimationFrame(rafId);
        if (keepVisibleIntervalRef.current) {
          clearInterval(keepVisibleIntervalRef.current);
          keepVisibleIntervalRef.current = null;
        }
        if (intersectionObserver) {
          intersectionObserver.disconnect();
        }
        if (visualViewportRef.current) {
          visualViewportRef.current.removeEventListener('resize', handleVisualViewportResize);
          visualViewportRef.current.removeEventListener('scroll', handleVisualViewportResize);
        }
        window.removeEventListener('resize', handleResize);
      };
    } else {
      // Clear interval when keyboard is closed
      if (keepVisibleIntervalRef.current) {
        clearInterval(keepVisibleIntervalRef.current);
        keepVisibleIntervalRef.current = null;
      }
    }
  }, [isKeyboardOpen, messages.length, suggestedMessages?.buttons?.length]);

  // Handle iframe close - reset scroll and ensure input is visible and focused
  useEffect(() => {
    if (!isIframeOpen && viewportRef.current && composerInputRef.current) {
      // Iframe just closed - reset scroll position and ensure input is visible
      const viewport = viewportRef.current;
      const input = composerInputRef.current;
      
      // Keep input focused to maintain keyboard open
      setTimeout(() => {
        if (input && document.activeElement !== input) {
          input.focus();
          setIsKeyboardOpen(true);
        }
      }, 100);
      
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
          // Use visual viewport height if available (accounts for keyboard), otherwise fallback to dvh
          maxHeight: visualViewportHeight 
            ? `calc(${visualViewportHeight}px - 4rem - env(safe-area-inset-bottom))`
            : "calc(100dvh - 4rem - env(safe-area-inset-bottom))",
          height: visualViewportHeight 
            ? `calc(${visualViewportHeight}px - 4rem - env(safe-area-inset-bottom))`
            : "calc(100dvh - 4rem - env(safe-area-inset-bottom))",
          scrollPaddingBottom: "calc(env(safe-area-inset-bottom) + 120px)",
          // Minimal paddingBottom to prevent extra whitespace on iOS
          // The sticky element below handles the main safe-area spacing
          paddingBottom: "0.5rem",
        }}
      >
        <div className="flex flex-col w-full items-center px-4 pt-4 pb-4 justify-end">
          {!messages.length && <Loader />}
      <ThreadPrimitive.Messages
          components={messageComponents}
        />  

          {/* Global loading bubble for assistant while running */}
          <ThreadPrimitive.If running>
            <LoadingMessage config={config} />
          </ThreadPrimitive.If>

          <ThreadPrimitive.If empty={false}>
            <div className="min-h-8 flex-grow" />
          </ThreadPrimitive.If>
      
          {/* Suggestion bar - inside viewport so it scrolls with messages */}
          {/* Always show suggestions above keyboard */}
          {suggestedMessages?.buttons?.length > 0 && (
            <div 
              ref={suggestionBarRef}
              data-suggestion-bar
              className="flex flex-col w-full items-center justify-center px-4 pb-4 pt-2 bg-inherit"
            >
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
        </div>
      </ThreadPrimitive.Viewport>

      <div 
        className="sticky bottom-0 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit px-4 md:pb-4 mx-auto"
        style={{
          // Use a simpler calculation to prevent excessive padding on iOS
          // The parent viewport already accounts for safe-area, so we minimize padding here
          // Only add safe-area padding when keyboard is likely closed (viewport height matches window height)
          paddingBottom: (() => {
            if (typeof window === 'undefined') return '1rem';
            // Check if keyboard is likely open (viewport height is significantly less than window height)
            const isKeyboardOpen = visualViewportHeight && 
                                   window.innerHeight && 
                                   visualViewportHeight < window.innerHeight * 0.75;
            // Use minimal padding when keyboard is open to prevent extra whitespace
            return isKeyboardOpen 
              ? '1rem' 
              : `min(calc(1rem + env(safe-area-inset-bottom)), calc(env(safe-area-inset-bottom) + 0.5rem))`;
          })(),
          position: 'sticky',
          bottom: 0,
          zIndex: 20,
          backgroundColor: 'inherit',
          // Remove transform to avoid iOS Safari scrolling quirks
          // transform: 'translateZ(0)', // Can cause scroll issues on iOS Safari
          // willChange: 'transform', // Can cause scroll issues on iOS Safari
          marginBottom: 0, // Prevent extra space
          // Ensure it doesn't extend beyond viewport
          maxHeight: '100%',
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
    e.stopPropagation();
    
    // CRITICAL: Blur the input if it's focused to prevent keyboard from opening
    // This ensures keyboard stays closed when suggestion is clicked
    if (composerInputRef.current && document.activeElement === composerInputRef.current) {
      composerInputRef.current.blur();
    }
    setStateData({ suggestedMessages: [] });

    onNew({
      content: [{ type: "text", text: message.message }],
      attachments: [],
      metadata: { keyword: message.keyword || message.label },
      createdAt: new Date(),
      role: "user",
    });

    // DON'T focus the input after clicking a suggestion
    // The keyboard should stay closed while waiting for the response
    // If new suggestions appear, they will keep it closed
    // If no suggestions appear, the 1-second timeout will open it
  };

  // Get colors from config with fallbacks
  // Path: chat.colors.assistantMessage.suggestions_colors.background and .text
  const suggestionColors = config?.chat?.colors?.assistantMessage?.suggestions_colors;
  const backgroundColor = suggestionColors?.background || '#F1F0F0';
  const textColor = suggestionColors?.text || '#000000';
  
  // Create hover color by slightly darkening the background
  const getHoverColor = (bgColor: string) => {
    // If it's a hex color, convert to RGB and darken
    if (bgColor.startsWith('#')) {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      // Darken by 10%
      return `rgb(${Math.max(0, r - 25)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`;
    }
    // If it's already rgb, extract and darken
    if (bgColor.startsWith('rgb')) {
      const matches = bgColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = Math.max(0, parseInt(matches[0]) - 25);
        const g = Math.max(0, parseInt(matches[1]) - 25);
        const b = Math.max(0, parseInt(matches[2]) - 25);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    // Fallback
    return '#eef2ff';
  };
  
  const hoverColor = getHoverColor(backgroundColor);

  return (
    <div className="mt-2 md:mt-3 flex flex-col md:flex-row w-full md:items-stretch justify-center gap-2 md:gap-4 dark:text-white items-center">
      {suggestedMessages?.buttons?.map((message: any) => (
        <button
          key={message.label}
          ref={(el) => {
            if (el) {
              // Set styles with important flag to override any CSS classes
              el.style.setProperty('background-color', backgroundColor, 'important');
              el.style.setProperty('color', textColor, 'important');
            }
          }}
          className="w-full flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-xl md:rounded-[2rem] border border-[#e2e8f0] dark:border-zinc-700 p-2 md:p-3 transition-colors ease-in"
          onMouseEnter={(e) => {
            e.currentTarget.style.setProperty('background-color', hoverColor, 'important');
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.setProperty('background-color', backgroundColor, 'important');
          }}
          onClick={(e) => handleSuggestionClick(message, e)}
          onMouseDown={(e) => {
            // Prevent button click from focusing the input
            // This helps keep keyboard closed when suggestion is clicked
            e.preventDefault();
          }}
        >
          <span className="line-clamp-2 text-ellipsis text-xs md:text-sm font-semibold px-1">
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
  // Keep input focused to maintain keyboard open
  useEffect(() => {
    const input = composerInputRef.current;
    if (!input || isIframeOpen) return;

    let blurTimeout: NodeJS.Timeout | null = null;
    let isUserIntentionalBlur = false;

    // Prevent blur events that would close the keyboard
    const handleBlur = (e: FocusEvent) => {
      // Keep keyboard open even when suggestions are visible - send button will be disabled instead

      // Clear any pending re-focus
      if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
      }

      const relatedTarget = e.relatedTarget as HTMLElement | null;
      
      // Check if blur is caused by clicking on interactive elements
      // If user clicks on send button or attachment button, allow blur temporarily
      if (relatedTarget && (
        relatedTarget.closest('button') ||
        relatedTarget.closest('[role="button"]') ||
        relatedTarget.closest('a')
      )) {
        // Check if it's a suggestion button - don't re-focus if it is
        const isSuggestionButton = relatedTarget.closest('[data-suggestion-bar]') || 
                                   relatedTarget.closest('button')?.closest('[data-suggestion-bar]');
        if (isSuggestionButton) {
          // Suggestion button was clicked - don't re-focus, keep keyboard closed
          return;
        }
        
        // Check if it's the send button - we'll re-focus after message is sent
        const isSendButton = relatedTarget.closest('button')?.querySelector('svg') || 
                            relatedTarget.closest('[role="button"]')?.querySelector('svg');
        if (isSendButton) {
          // Re-focus after a short delay to keep keyboard open after sending
          // But only if no suggestions are visible
          blurTimeout = setTimeout(() => {
            const stillNoSuggestions = !suggestedMessages?.buttons?.length;
            const suggestionBarCheck = document.querySelector('[data-suggestion-bar]');
            const stillNoSuggestionsVisible = !suggestionBarCheck || suggestionBarCheck.getBoundingClientRect().height === 0;
            
            if (input && document.activeElement !== input && !isIframeOpen && stillNoSuggestions && stillNoSuggestionsVisible) {
              input.focus();
            }
          }, 300);
        }
        return;
      }
      
      // For other blur events (like WebSocket messages, iframe actions, etc.),
      // re-focus after a short delay to keep keyboard open
      // Keep keyboard open even when suggestions are visible - send button will be disabled instead
      blurTimeout = setTimeout(() => {
        if (input && document.activeElement !== input && !isIframeOpen && !isUserIntentionalBlur) {
          input.focus();
        }
        isUserIntentionalBlur = false;
      }, 100);
    };

    // Track if user intentionally wants to close keyboard (e.g., clicking outside)
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If clicking outside the composer area, allow blur
      if (!target.closest('[data-composer-root]') && !target.closest('.composer-input')) {
        isUserIntentionalBlur = true;
      }
    };

    input.addEventListener('blur', handleBlur);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      input.removeEventListener('blur', handleBlur);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [composerInputRef, isIframeOpen, suggestedMessages?.buttons?.length]); // Add suggestedMessages to dependencies

  return (
    <ComposerPrimitive.Root 
      data-composer-root
      className="focus-within:border-[#4f46e5]/20 dark:focus-within:border-[#6366f1]/20 flex w-full flex-col rounded-3xl border border-[#e2e8f0] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 shadow-sm transition-colors ease-in"
    >
      {/* Attachments row (full width) */}
      <div className="w-full pt-2">
        <ComposerAttachments />
      </div>

      {/* Input + actions row (never wrap) */}
      <div className="flex w-full items-end gap-1 pb-1">
        <ComposerAddAttachment config={config} />
        <ComposerPrimitive.Input
          rows={1}
          autoFocus
          disabled={isIframeOpen}
          placeholder={config.app.name || "..."}
          className="composer-input placeholder:text-zinc-400 dark:placeholder:text-zinc-500 max-h-40 min-h-12 flex-1 resize-none border-none bg-transparent px-2 py-3 text-base leading-6 outline-none focus:ring-0 disabled:cursor-not-allowed text-[#1e293b] dark:text-zinc-200"
          ref={composerInputRef}
        />
        <ComposerAction config={config} suggestedMessages={suggestedMessages} isIframeOpen={isIframeOpen} />
      </div>
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
  
  // Get send button color from config
  const sendButtonColor = config?.chat?.colors?.userMessage?.background || '#4f46e5';
  
  // Create hover color by slightly darkening the background
  const getHoverColor = (bgColor: string) => {
    // If it's a hex color, convert to RGB and darken
    if (bgColor.startsWith('#')) {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      // Darken by 10%
      return `rgb(${Math.max(0, r - 25)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`;
    }
    // If it's already rgb, extract and darken
    if (bgColor.startsWith('rgb')) {
      const matches = bgColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = Math.max(0, parseInt(matches[0]) - 25);
        const g = Math.max(0, parseInt(matches[1]) - 25);
        const b = Math.max(0, parseInt(matches[2]) - 25);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    // Fallback
    return '#4338ca';
  };
  
  const hoverColor = getHoverColor(sendButtonColor);
  
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip={config?.chat?.attachment?.btnSendTooltip}
            variant="default"
            disabled={isDisabled}
            ref={(el) => {
              if (el) {
                // Set background color with important flag to override CSS classes
                el.style.setProperty('background-color', sendButtonColor, 'important');
              }
            }}
            className="my-2.5 size-8 p-2 transition-opacity ease-in text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed shadow-lg md:shadow-none"
            onMouseEnter={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.setProperty('background-color', hoverColor, 'important');
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('background-color', sendButtonColor, 'important');
            }}
          >
            <SendHorizontalIcon className="w-4 h-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            ref={(el) => {
              if (el) {
                // Set background color with important flag to override CSS classes
                el.style.setProperty('background-color', sendButtonColor, 'important');
              }
            }}
            className="my-2.5 size-8 p-2 transition-opacity ease-in text-white rounded-full"
            onMouseEnter={(e) => {
              e.currentTarget.style.setProperty('background-color', hoverColor, 'important');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('background-color', sendButtonColor, 'important');
            }}
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
  const backgroundColor = colors?.userMessage?.background ?? "#10101a";
  const textColor = colors?.userMessage?.text ?? "#ffffff";
  
  return (
    <MessagePrimitive.Root className="grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 [&:where(>*)]:col-start-2 w-full max-w-[var(--thread-max-width)] py-4">
      <UserMessageAttachments />
      <div
        ref={(el) => {
          if (el) {
            // Set styles with important flag to override any CSS classes
            el.style.setProperty('background-color', backgroundColor, 'important');
            el.style.setProperty('color', textColor, 'important');
          }
        }}
        className="text-sm max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2"
      >
        <MessagePrimitive.Content />
        <AssistantActionBar timestamp={timestamp} type="user" />
        </div>
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
  // Get send button color from config via global ref
  const config = globalConfigRef.current;
  const sendButtonColor = config?.chat?.colors?.userMessage?.background || '#4f46e5';
  
  // Create hover color by slightly darkening the background
  const getHoverColor = (bgColor: string) => {
    // If it's a hex color, convert to RGB and darken
    if (bgColor.startsWith('#')) {
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      // Darken by 10%
      return `rgb(${Math.max(0, r - 25)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`;
    }
    // If it's already rgb, extract and darken
    if (bgColor.startsWith('rgb')) {
      const matches = bgColor.match(/\d+/g);
      if (matches && matches.length >= 3) {
        const r = Math.max(0, parseInt(matches[0]) - 25);
        const g = Math.max(0, parseInt(matches[1]) - 25);
        const b = Math.max(0, parseInt(matches[2]) - 25);
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    // Fallback
    return '#4338ca';
  };
  
  const hoverColor = getHoverColor(sendButtonColor);
  
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
          <Button 
            ref={(el) => {
              if (el) {
                // Set background color with important flag to override CSS classes
                el.style.setProperty('background-color', sendButtonColor, 'important');
              }
            }}
            className="text-white rounded-[2rem]"
            onMouseEnter={(e) => {
              e.currentTarget.style.setProperty('background-color', hoverColor, 'important');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('background-color', sendButtonColor, 'important');
            }}
          >
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
    return <UserMessage {...props} colors={globalColorsRef.current} />;
  },
  EditComposer: EditComposer,
  AssistantMessage: () => {
    return <AssistantMessage />; // Reads from globalConfigRef
  },
};

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
  }
  
  // Use the stable message ID for the key - this NEVER changes once set
  const messageIdForKey = stableMessageIdRef.current || currentMessageId;
  
  // Track mount/unmount - ONLY depend on stable ID, not current ID
  // This prevents the effect from running when the library changes the message ID
  React.useEffect(() => {
    return () => {
      // Component unmounted
    };
    // CRITICAL: Only depend on stable ID - never on current ID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageIdForKey]);
  
  // Extract config values directly - no memoization needed, just read from ref
  // Avatar comes from: chat.colors.assistantMessage.avatar
  // Background comes from: chat.assistantAvatarColor
  // Show avatar based on: chat.showBotAvatar
  const showBotAvatar = actualConfig?.chat?.showBotAvatar !== false; // Default to true if not set
  const avatarUrl = actualConfig?.chat?.colors?.assistantMessage?.avatar ?? "";
  const backgroundColor = actualConfig?.chat?.assistantAvatarColor ?? "#1e3a8a";
  
  // Use refs to track previous values and prevent unnecessary re-renders
  const prevContentRef = useRef<string>('');
  const prevMessageIdRef = useRef<string>('');
  
  // CRITICAL: Get cached values from module-level cache using stable message ID
  // This persists across component instances
  const getCachedValues = React.useCallback(() => {
    const cached = messageContentCache.get(messageIdForKey);
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
    // Extract text for comparison with defensive checks
    const currentText = !content?.content 
      ? "" 
      : typeof content.content === "string" 
      ? content.content 
      : Array.isArray(content.content) && content.content[0] && typeof content.content[0] === 'object' && content.content[0]?.text
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
          // CRITICAL: Only use currentText if it's from the SAME message
          // If useMessage returned content for a different message, ignore it completely
          // EXCEPT: If cached text is empty and current text exists, allow the update
          // (This handles the case where useMessage ID is wrong but content is correct)
          if (!isCurrentMessageForThisComponent) {
            // useMessage returned content for a different message
            // But if cached is empty and current has content, allow update (content might be correct even if ID is wrong)
            if (!cachedText && currentText) {
              prevContentRef.current = currentText;
              // Continue to calculate new values
            } else {
              // Cached has content or current is empty - preserve cached
              return cachedValues;
            }
          }
          
          // Same stable message AND currentText is from the same message - only update if text increased (streaming)
          if (currentText && currentText.length > cachedText.length) {
            // Text increased - this is a streaming update, allow it
            prevContentRef.current = currentText;
            // Continue to calculate new values
          } else if (!cachedText && currentText) {
            // Cached is empty but we have current text - allow update (initial content arrival)
            prevContentRef.current = currentText;
            // Continue to calculate new values
          } else if (!currentText || currentText === cachedText) {
            // Current is empty or unchanged - keep cached
            return cachedValues;
          } else {
            // Text changed but not increased - ignore, keep cached
            return cachedValues;
          }
        } else if (stableId && stableId !== cachedMessageId) {
          // Different stable message - this is a genuinely new message
          
          // Only update if we have new content
          if (currentText && stableId) {
            prevContentRef.current = currentText;
            prevMessageIdRef.current = stableId;
          } else {
            // No new content - keep cached (this shouldn't happen for new messages, but be safe)
            return cachedValues;
          }
        }
    } else {
      // Not initialized yet - initialize if we have content
      
      if (currentText && stableId) {
        prevContentRef.current = currentText;
        prevMessageIdRef.current = stableId;
      } else if (currentText) {
        // Have text but no stableId - still initialize
        prevContentRef.current = currentText;
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
      : Array.isArray(content?.content) && content.content[0] && typeof content.content[0] === 'object' && content.content[0]?.text
      ? content.content[0].text || ''
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
    return cached || null;
  }, [messageIdForKey]); // CRITICAL: Only depend on stable ID, not messageId
  
  const setCachedRenderedContent = React.useCallback((content: { markdownText: string; messageId: string; content: React.ReactNode }) => {
    // Use stable message ID as the cache key
    const cacheKey = messageIdForKey || content.messageId;
    renderedContentCache.set(cacheKey, content);
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
        lastRenderedContentRef.current = cachedContentForCheck.content;
        return cachedContentForCheck.content;
      }
    }
    
    if (effectiveIsEmpty) {
      // Don't set loading dots as content - they should be rendered separately
      // Return null so loading dots show in the separate loading section, not in a bubble
      if (hasValidMessage) {
        // Return null - loading dots will be shown separately via shouldShowLoadingDots
        return null;
      } else {
        // No message yet - return cached if available, otherwise null
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
    
    // #region agent log
    try {
      const rawText = typeof content?.content === "string" 
        ? content.content 
        : Array.isArray(content?.content) && content.content[0] && typeof content.content[0] === 'object' && content.content[0]?.text
        ? content.content[0].text || ""
        : "";
    } catch(e) {}
    // #endregion
    
    // If message ID changed, reset the ref (new message)
    if (lastValidMessageIdRef.current && lastValidMessageIdRef.current !== currentMessageId) {
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
      let rawText = "";
      try {
        rawText = typeof content.content === "string" 
          ? content.content 
          : Array.isArray(content.content) && content.content[0] && typeof content.content[0] === 'object' && content.content[0]?.text
          ? content.content[0].text || ""
          : "";
      } catch (error) {
        rawText = "";
      }
      // CRITICAL: Only use raw text if it has actual content (not empty string)
      if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
        calculatedContent = rawText;
      }
    }
    
    // #region agent log
    try {
    } catch(e) {}
    // #endregion
    
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
      return lastValidDisplayContentRef.current;
    }
    
    return null;
  }, [cachedRenderedContent, messageContent, messageIdForKey, messageId, content]);
  
  // Check if we've ever had a message (either current or cached)
  // This prevents the flash - if we've rendered this message before, keep rendering
  const hasEverHadMessage = messageId || cachedRenderedContent?.messageId || messageIdForKey;
  
  // Only return null if we've never had a message at all
  // If we have a cached message, always render (like UserMessage does)
  if (!hasEverHadMessage) {
    return null;
  }

  // CRITICAL: Fail silently if there's an error reading message content
  // Wrap in try-catch to prevent crashes from malformed messages
  try {
    // CRITICAL: Use the STABLE message ID for the key, not the current one
    // This prevents unmounting/remounting when the library changes the message ID
    const stableKey = messageIdForKey ? `assistant-msg-${String(messageIdForKey)}` : undefined;

    // CRITICAL: Always render content when available, regardless of isRunning state
    // This prevents flicker when isRunning changes - the content stays mounted
    // Only show loading dots when isRunning is true AND content is empty
    // CRITICAL: Only show bubble when cached rendered content has text
    // This ensures content is fully processed and ready to display
    // For new messages, don't show bubble until content is cached and ready
    const hasActualContent = React.useMemo(() => {
      // #region agent log
      try {
        const rawText = typeof content?.content === "string" 
          ? content.content 
          : Array.isArray(content?.content) && content.content[0] && typeof content.content[0] === 'object' && content.content[0]?.text
          ? content.content[0].text || ""
          : "";
      } catch(e) {}
      // #endregion
      
      // CRITICAL: Check if cached rendered content has text - this means content is fully processed
      // Only show bubble if we have cached content with text, ensuring it's ready
      const cachedHasText = cachedRenderedContent?.markdownText && cachedRenderedContent.markdownText.trim().length > 0;
      
      // For strings, check if displayContent has actual text
      if (typeof displayContent === 'string') {
        return displayContent.trim().length > 0;
      }
      
      // For ReactNodes, ONLY show bubble if cached rendered content has text
      // This ensures the content has been fully processed and is ready to display
      // Don't show bubble just because source has text - wait for it to be processed
      const result = cachedHasText && displayContent !== null && displayContent !== undefined;
      
      // #region agent log
      try {
      } catch(e) {}
      // #endregion
      
      return result;
    }, [displayContent, cachedRenderedContent]);
    
    return (
    <MessagePrimitive.Root 
      key={stableKey}
      className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      {/* Always render content when available - prevents flicker during isRunning transition */}
      {/* CRITICAL: Only render bubble if we have actual content, not just a non-null value */}
      {hasActualContent && (
        <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
          {displayContent}
        </div>
      )}

      {/* Only show avatar when this message has actual content.
          The global LoadingMessage handles avatar display while running. */}
      {showBotAvatar && hasActualContent && (
        <div
          key={`avatar-${avatarUrl}`}
          className="flex items-end justify-center col-start-1 row-start-1 mr-1 mb-1"
        >
          <AssistantAvatar
            avatarUrl={avatarUrl}
            backgroundColor={backgroundColor}
          />
        </div>
      )}
    </MessagePrimitive.Root>
  );
  } catch (error) {
    // Fail silently - don't show message if there's an error reading content
    return null;
  }
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
  return (
    <div 
      ref={(el) => {
        if (el) {
          // Set background color with important flag to override CSS classes
          el.style.setProperty('background-color', backgroundColor, 'important');
        }
      }}
      className="flex items-center justify-center w-8 h-8 rounded-full">
      <Image
        key={`img-${avatarUrl}`} // Stable key based on URL
        src={avatarUrl}
        alt="Assistant Avatar"
        width={20}
        height={20}
        className="invert brightness-0 saturate-0 contrast-200"
      />
    </div>
  );
}, (prevProps, nextProps) => {
  const shouldSkip = prevProps.avatarUrl === nextProps.avatarUrl && 
                     prevProps.backgroundColor === nextProps.backgroundColor;
  
  // Only re-render if avatarUrl or backgroundColor actually changed
  return shouldSkip;
});
AssistantAvatar.displayName = 'AssistantAvatar';

// Loading message component that appears when assistant is generating a response
// Avatar comes from: chat.colors.assistantMessage.avatar
// Background comes from: chat.assistantAvatarColor
// Show avatar based on: chat.showBotAvatar
const LoadingMessage: FC<{config: any}> = ({config}) => {
  const showBotAvatar = config?.chat?.showBotAvatar !== false; // Default to true if not set
  const avatarBackgroundColor = config?.chat?.assistantAvatarColor ?? "#1e3a8a";
  
  return (
    <div className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-3xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <LoadingDots />
      </div>

      {showBotAvatar && (
      <div className="flex items-end justify-center col-start-1 row-start-1 mr-1 mb-1">
        <div 
          ref={(el) => {
            if (el) {
              // Set background color with important flag to override CSS classes
              el.style.setProperty('background-color', avatarBackgroundColor, 'important');
            }
          }}
          className="flex items-center justify-center w-8 h-8 rounded-full">
        <Image
          src={config?.chat?.colors?.assistantMessage?.avatar ?? ""}
          alt="Assistant Avatar"
          width={20}
          height={20}
          className="invert brightness-0 saturate-0 contrast-200"
        />
      </div>
      </div>
      )}
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
