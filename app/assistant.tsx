"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  AppendMessage,
  ThreadMessageLike,
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState, use, useRef } from "react";
import { flushSync } from "react-dom";
import {
  Thread,
} from "@/components/assistant-ui/thread";
import ThemeAwareLogo from "@/components/mem0/theme-aware-logo";
import ActionModal from "@/components/mem0/ActionModal";
import { useIframe } from "./hooks/useIframe";
import { chatService } from "./services/chatService";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { SimplePdfAttachmentAdapter } from "./services/SimplePdfAttachmentAdapter";
import { OtpModal } from "@/components/assistant-ui/otpModal";
import { Box, Button, Modal, Typography } from "@mui/material";
import { getCookie, setCookie } from "cookies-next";
import { handleSelection } from "./utils/addOtpPhrase";
import { useBindReducer } from "./utils/useThunkReducer";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import CookiebotLoader from "@/components/CookiebotLoader";
import { getClientIp } from "./utils/get-ip";
import { keepInputFocused } from "./utils/deviceDetection";

// === Utility Functions ===
declare global {
  interface Window {
    Cookiebot?: any;
  }
}

const getOrCreateUserId = () => {
  if (typeof window === 'undefined') return uuidv4();
  let id = localStorage.getItem("userId1");
  if (!id) {
    id = uuidv4();
    localStorage.setItem("userId1", id);
  }
  return id;
};

const getConversationHistory = () => {
  if (typeof window === 'undefined') return [];
  try {
  return JSON.parse(localStorage.getItem("chatHistory") || "[]");
  } catch (e) {
    return [];
  }
};

const saveConversationToHistory = (id: string, title: string) => {
  if (typeof window === 'undefined') return;
  const history = getConversationHistory();
  const exists = history.find((h) => h.id === id);
  if (!exists) {
    history.push({ id, title });
  } else if (title && !exists.title) {
    exists.title = title;
  }
  try {
  localStorage.setItem("chatHistory", JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save conversation history:", e);
  }
};

const saveMessages = (id: string, messages: any[]) => {
  if (typeof window === 'undefined') return;
  try {
  localStorage.setItem(`conversation:${id}`, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save messages:", e);
  }
};

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 1000,
  bgcolor: "background.paper",
  borderRadius: 2,
  boxShadow: 24,
  p: 4,
  maxHeight: "80vh",
  overflowY: "auto",
};

// === Main Component ===

export function Assistant({
  initialConversationId,
  searchParams,
  initialConfig,
}: {
  initialConversationId: string | null;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
  initialConfig?: any;
}) {
  const router = useRouter();
  const iframe = useIframe();
  
  // Unwrap searchParams if it's a Promise (Next.js 15+)
  // Check if it's a Promise by checking for 'then' method (safer than instanceof)
  const resolvedSearchParams = searchParams && typeof (searchParams as any).then === 'function' 
    ? use(searchParams as Promise<{ [key: string]: string | string[] | undefined }>)
    : searchParams as { [key: string]: string | string[] | undefined };

  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [history, setHistory] = useState(() => getConversationHistory());
  const [isRunning, setIsRunning] = useState(false);
  const keyboardOpenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialViewportHeightRef = useRef<number | null>(null);
  
  // Use initialConfig if provided (from server), otherwise fallback to state for backward compatibility
  const [config, setConfig] = useState<any>(initialConfig || null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [lastMessageResponse, setlastMessageResponse] = useState(null);
  const [openCookieModal, setOpenCookieModal] = useState(true);
  const [cookieLoading, setCookieLoading] = useState(false);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);
  const [
    { error, suggestedMessages, conversationId, sidebarOpen, ipAddress },
    setStateData,
  ] = useBindReducer({
    error: null,
    suggestedMessages: [],
    conversationId: initialConversationId,
    sidebarOpen: true,
    ipAddress: "",
  });
  
  // Keep ref in sync with state so handler can read current value
  const suggestedMessagesRef = useRef<any>(null);
  suggestedMessagesRef.current = suggestedMessages;

  
  const userId = getOrCreateUserId();
  const [modalOpen, setModalOpen] = useState(false);
  const createdConversationsRef = useRef<Set<string>>(new Set());

  const handleModalOpen = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);

  // Step 1: Load config once on page load

  // Monitor visual viewport height to adjust layout when keyboard opens
  useEffect(() => {
    // #region agent log
    const logViewportInfo = () => {
      if (typeof window === 'undefined') return;
      const html = document.documentElement;
      const body = document.body;
      const mainContainer = document.querySelector('[style*="100dvh"], [style*="visualViewportHeight"]') as HTMLElement | null;
      fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:163',message:'Viewport dimensions check',data:{windowInnerHeight:window.innerHeight,windowOuterHeight:window.outerHeight,visualViewportHeight:window.visualViewport?.height||null,visualViewportOffsetTop:window.visualViewport?.offsetTop||null,htmlClientHeight:html.clientHeight,htmlScrollHeight:html.scrollHeight,htmlOffsetHeight:html.offsetHeight,bodyClientHeight:body.clientHeight,bodyScrollHeight:body.scrollHeight,bodyOffsetHeight:body.offsetHeight,mainContainerHeight:mainContainer?.offsetHeight||null,mainContainerComputedHeight:mainContainer ? window.getComputedStyle(mainContainer).height : null,scrollY:window.scrollY,userAgent:navigator.userAgent.includes('iPhone')||navigator.userAgent.includes('iPad')||navigator.userAgent.includes('Safari')},timestamp:Date.now(),runId:'viewport1',hypothesisId:'A'})}).catch(()=>{});
    };
    // #endregion
    
    if (typeof window === 'undefined' || !window.visualViewport) {
      setVisualViewportHeight(window.innerHeight);
      // #region agent log
      logViewportInfo();
      // #endregion
      return;
    }

    const visualViewport = window.visualViewport;
    
    // Store initial viewport height for keyboard detection
    if (initialViewportHeightRef.current === null) {
      initialViewportHeightRef.current = visualViewport.height;
    }
    
    const updateViewportHeight = () => {
      // Update height and trigger re-render to adjust header position
      setVisualViewportHeight(visualViewport.height);
      
      // CRITICAL: Force header repositioning immediately when viewport changes
      // This prevents delay in header movement when keyboard opens/closes
      // Use requestAnimationFrame to ensure it happens in the same frame
      const header = document.querySelector('header');
      if (header && visualViewport.offsetTop !== undefined) {
        // Apply transform immediately to prevent delay
        header.style.transform = `translateY(${visualViewport.offsetTop}px)`;
        // Also use will-change for better performance
        header.style.willChange = 'transform';
      } else if (header) {
        // Reset transform when offsetTop is not available
        header.style.transform = '';
        header.style.willChange = '';
      }
      
      // CRITICAL: Update body/html height to match visual viewport to prevent white space below screen
      // When keyboard opens, visualViewport.height shrinks, but body/html might still be at full height
      // This causes white space to appear below the screen on iOS Safari
      const html = document.documentElement;
      const body = document.body;
      if (html && body) {
        // CRITICAL: Better keyboard detection for Safari iOS
        // On Safari, both visualViewport.height and window.innerHeight shrink when keyboard opens
        // So we compare to the initial height and also check offsetTop (which changes when keyboard opens)
        const initialHeight = initialViewportHeightRef.current || window.innerHeight;
        const heightReduction = initialHeight - visualViewport.height;
        const hasOffsetTop = visualViewport.offsetTop !== undefined && visualViewport.offsetTop > 0;
        // Keyboard is open if height reduced significantly (>100px) OR offsetTop exists (Safari iOS behavior)
        const isKeyboardOpen = heightReduction > 100 || hasOffsetTop;
        
        // Detect iOS (Safari, Chrome, or any browser on iOS)
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        
        // #region agent log
        const mainContainer = document.querySelector('[style*="100dvh"], [style*="visualViewportHeight"]') as HTMLElement | null;
        const mainContainerComputed = mainContainer ? window.getComputedStyle(mainContainer) : null;
        fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:183',message:'updateViewportHeight - BEFORE applying styles',data:{visualViewportHeight:visualViewport.height,windowInnerHeight:window.innerHeight,initialViewportHeight:initialViewportHeightRef.current,heightReduction,hasOffsetTop,visualViewportOffsetTop:visualViewport.offsetTop,isKeyboardOpen,isIOS,htmlHeightBefore:html.style.height,htmlMaxHeightBefore:html.style.maxHeight,htmlPositionBefore:html.style.position,bodyHeightBefore:body.style.height,bodyMaxHeightBefore:body.style.maxHeight,bodyPositionBefore:body.style.position,htmlComputedHeight:window.getComputedStyle(html).height,bodyComputedHeight:window.getComputedStyle(body).height,htmlComputedPosition:window.getComputedStyle(html).position,bodyComputedPosition:window.getComputedStyle(body).position,htmlComputedBackground:window.getComputedStyle(html).backgroundColor,bodyComputedBackground:window.getComputedStyle(body).backgroundColor,mainContainerPosition:mainContainerComputed?.position,mainContainerTop:mainContainerComputed?.top,mainContainerHeight:mainContainerComputed?.height,mainContainerBackground:mainContainerComputed?.backgroundColor,scrollY:window.scrollY,htmlScrollHeight:html.scrollHeight,bodyScrollHeight:body.scrollHeight,userAgent:navigator.userAgent},timestamp:Date.now(),runId:'ios1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // CRITICAL: On iOS, prevent white/blue space by preventing any scrolling and clamping viewport
        // The white/blue space appears because iOS allows scrolling below the viewport when keyboard opens
        if (isIOS && isKeyboardOpen) {
          // CRITICAL: Prevent window scrolling immediately
          window.scrollTo(0, 0);
          
          // Prevent any scrolling by fixing position and clamping height
          html.style.position = 'fixed';
          html.style.top = '0';
          html.style.left = '0';
          html.style.right = '0';
          html.style.width = '100%';
          html.style.height = `${visualViewport.height}px`;
          html.style.maxHeight = `${visualViewport.height}px`;
          html.style.overflow = 'hidden';
          
          body.style.position = 'fixed';
          body.style.top = '0';
          body.style.left = '0';
          body.style.right = '0';
          body.style.width = '100%';
          body.style.height = `${visualViewport.height}px`;
          body.style.maxHeight = `${visualViewport.height}px`;
          body.style.overflow = 'hidden';
          
          // Prevent touch scrolling on window/body to prevent white space
          // But allow vertical scrolling within containers (messages container can scroll)
          // The preventScroll function will handle preventing window scroll while allowing container scroll
          body.style.touchAction = 'pan-y';
          html.style.touchAction = 'pan-y';
          
          // Set background to match container to hide any visible space
          const bodyComputed = window.getComputedStyle(body);
          const isDark = document.documentElement.classList.contains('dark') || 
                         bodyComputed.backgroundColor.includes('24') || 
                         bodyComputed.backgroundColor.includes('27');
          const bgColor = isDark ? 'rgb(24, 24, 27)' : 'rgb(255, 255, 255)';
          html.style.setProperty('background-color', bgColor, 'important');
          body.style.setProperty('background-color', bgColor, 'important');
        } else if (isIOS) {
          // iOS but keyboard closed - restore normal but keep overflow hidden
          html.style.position = '';
          html.style.top = '';
          html.style.left = '';
          html.style.right = '';
          html.style.width = '';
          html.style.height = '';
          html.style.maxHeight = '';
          html.style.overflow = 'hidden';
          html.style.touchAction = '';
          
          body.style.position = '';
          body.style.top = '';
          body.style.left = '';
          body.style.right = '';
          body.style.width = '';
          body.style.height = '';
          body.style.maxHeight = '';
          body.style.overflow = 'hidden';
          body.style.touchAction = '';
          
          // Keep background matching
          const bodyComputed = window.getComputedStyle(body);
          const isDark = document.documentElement.classList.contains('dark') || 
                         bodyComputed.backgroundColor.includes('24') || 
                         bodyComputed.backgroundColor.includes('27');
          const bgColor = isDark ? 'rgb(24, 24, 27)' : 'rgb(255, 255, 255)';
          html.style.setProperty('background-color', bgColor, 'important');
          body.style.setProperty('background-color', bgColor, 'important');
        } else {
          // Non-iOS: normal behavior
          html.style.position = '';
          html.style.top = '';
          html.style.left = '';
          html.style.right = '';
          html.style.width = '';
          html.style.height = '';
          html.style.maxHeight = '';
          html.style.overflow = 'hidden';
          html.style.touchAction = '';
          
          body.style.position = '';
          body.style.top = '';
          body.style.left = '';
          body.style.right = '';
          body.style.width = '';
          body.style.height = '';
          body.style.maxHeight = '';
          body.style.overflow = 'hidden';
          body.style.touchAction = '';
          
          html.style.setProperty('background-color', 'transparent', 'important');
          body.style.setProperty('background-color', 'transparent', 'important');
        }
        
        // #region agent log
        // Use requestAnimationFrame to log AFTER styles are applied
        requestAnimationFrame(() => {
          const htmlAfter = window.getComputedStyle(html);
          const bodyAfter = window.getComputedStyle(body);
          const mainContainerAfter = mainContainer ? window.getComputedStyle(mainContainer) : null;
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
          fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:183',message:'updateViewportHeight - AFTER applying styles',data:{visualViewportHeight:visualViewport.height,windowInnerHeight:window.innerHeight,initialViewportHeight:initialViewportHeightRef.current,heightReduction,hasOffsetTop,visualViewportOffsetTop:visualViewport.offsetTop,isKeyboardOpen,isIOS,htmlHeightAfter:html.style.height,htmlMaxHeightAfter:html.style.maxHeight,htmlPositionAfter:html.style.position,bodyHeightAfter:body.style.height,bodyMaxHeightAfter:body.style.maxHeight,bodyPositionAfter:body.style.position,htmlComputedHeight:htmlAfter.height,bodyComputedHeight:bodyAfter.height,htmlComputedPosition:htmlAfter.position,bodyComputedPosition:bodyAfter.position,htmlComputedBackground:htmlAfter.backgroundColor,bodyComputedBackground:bodyAfter.backgroundColor,htmlComputedOverflow:htmlAfter.overflow,bodyComputedOverflow:bodyAfter.overflow,mainContainerPosition:mainContainerAfter?.position,mainContainerTop:mainContainerAfter?.top,mainContainerLeft:mainContainerAfter?.left,mainContainerRight:mainContainerAfter?.right,mainContainerBottom:mainContainerAfter?.bottom,mainContainerHeight:mainContainerAfter?.height,mainContainerWidth:mainContainerAfter?.width,mainContainerBackground:mainContainerAfter?.backgroundColor,mainContainerZIndex:mainContainerAfter?.zIndex,scrollY:window.scrollY,htmlScrollHeight:html.scrollHeight,bodyScrollHeight:body.scrollHeight,htmlClientHeight:html.clientHeight,bodyClientHeight:body.clientHeight,mainContainerOffsetHeight:mainContainer?.offsetHeight,mainContainerOffsetTop:mainContainer?.offsetTop,userAgent:navigator.userAgent},timestamp:Date.now(),runId:'ios1',hypothesisId:'B'})}).catch(()=>{});
        });
        // #endregion
      }
      
      // #region agent log
      logViewportInfo();
      // #endregion
    };

    // Set initial height
    updateViewportHeight();

    // Listen for viewport changes (keyboard open/close)
    visualViewport.addEventListener('resize', updateViewportHeight);
    visualViewport.addEventListener('scroll', updateViewportHeight);
    
    // CRITICAL: On iOS, prevent window scroll that causes white space
    // But allow scrolling within the messages container
    const isIOSDevice = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const preventScroll = (e: Event) => {
      const initialHeight = initialViewportHeightRef.current || window.innerHeight;
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightReduction = initialHeight - currentHeight;
      const hasOffsetTop = window.visualViewport?.offsetTop !== undefined && window.visualViewport.offsetTop > 0;
      const keyboardOpen = heightReduction > 100 || hasOffsetTop;
      
      if (isIOSDevice && keyboardOpen) {
        // Allow scrolling within the messages container (ThreadPrimitive.Viewport)
        const target = e.target as HTMLElement;
        if (target) {
          // Check if the event is within a scrollable container (messages viewport)
          // Look for elements with overflow-y-auto or within the main container
          const scrollableContainer = target.closest('[class*="Viewport"], [class*="viewport"], [class*="overflow-y-auto"], main');
          if (scrollableContainer && scrollableContainer !== document.body && scrollableContainer !== document.documentElement) {
            // Check if this container is actually scrollable
            const computedStyle = window.getComputedStyle(scrollableContainer);
            const isScrollable = computedStyle.overflowY === 'auto' || 
                                 computedStyle.overflowY === 'scroll' ||
                                 scrollableContainer.scrollHeight > scrollableContainer.clientHeight;
            if (isScrollable) {
              // Allow scrolling within the messages container
              return;
            }
          }
        }
        
        // Prevent window/body scrolling
        e.preventDefault();
        window.scrollTo(0, 0);
      }
    };
    
    if (isIOSDevice) {
      window.addEventListener('scroll', preventScroll, { passive: false });
      window.addEventListener('touchmove', preventScroll, { passive: false });
    }
    
    // #region agent log
    // Also log on window resize and scroll
    const handleResize = () => {
      logViewportInfo();
      // Additional logging for resize events
      const html = document.documentElement;
      const body = document.body;
      const mainContainer = document.querySelector('[style*="100dvh"], [style*="visualViewportHeight"]') as HTMLElement | null;
      fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:240',message:'Window resize event',data:{windowInnerHeight:window.innerHeight,windowOuterHeight:window.outerHeight,visualViewportHeight:window.visualViewport?.height||null,htmlClientHeight:html.clientHeight,htmlScrollHeight:html.scrollHeight,bodyClientHeight:body.clientHeight,bodyScrollHeight:body.scrollHeight,mainContainerHeight:mainContainer?.offsetHeight||null,scrollY:window.scrollY,userAgent:navigator.userAgent},timestamp:Date.now(),runId:'ios2',hypothesisId:'D'})}).catch(()=>{});
    };
    const handleScroll = () => {
      logViewportInfo();
      // Additional logging for scroll events
      const html = document.documentElement;
      const body = document.body;
      fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:241',message:'Window scroll event',data:{scrollY:window.scrollY,scrollX:window.scrollX,htmlScrollHeight:html.scrollHeight,htmlClientHeight:html.clientHeight,bodyScrollHeight:body.scrollHeight,bodyClientHeight:body.clientHeight,visualViewportHeight:window.visualViewport?.height||null,userAgent:navigator.userAgent},timestamp:Date.now(),runId:'ios2',hypothesisId:'E'})}).catch(()=>{});
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    // Log initial state after a short delay to ensure DOM is ready
    setTimeout(logViewportInfo, 100);
    setTimeout(logViewportInfo, 500);
    setTimeout(logViewportInfo, 1000);
    // #endregion
    
    return () => {
      visualViewport.removeEventListener('resize', updateViewportHeight);
      visualViewport.removeEventListener('scroll', updateViewportHeight);
      // #region agent log
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      // #endregion
      if (isIOSDevice) {
        window.removeEventListener('scroll', preventScroll);
        window.removeEventListener('touchmove', preventScroll);
      }
    };
  }, []);

  useEffect(() => {
    // If config is already provided from server, use it immediately
    if (initialConfig) {
      fetch("/api/getip")
        .then((res) => res.json())
        .then((data) => {
          setStateData({ ipAddress: data });
        });
      setConfig(initialConfig);
      initConversation(initialConfig);
      window?.Cookiebot?.renew?.();
      return;
    }

    // Fallback: fetch config if not provided (for backward compatibility)
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        fetch("/api/getip")
        .then((res) => res.json())
        .then((data) => {
          setStateData({ ipAddress: data });
        })
        setConfig(data);
        initConversation(data);
        window?.Cookiebot?.renew?.();
      });
  }, [initialConfig]);

  // Update document title and favicon from config
  useEffect(() => {
    if (config?.app?.title) {
      document.title = config.app.title;
    }
    
    if (config?.app?.icon) {
      let iconUrl = config.app.icon;
      console.log('Setting favicon from config:', iconUrl);
      
      // Normalize the icon URL
      // If it's a relative path and doesn't start with /, add it
      // If it's a relative path starting with /, it's already correct for public folder
      // If it's an absolute URL (http/https), use it as-is
      if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('/')) {
        iconUrl = '/' + iconUrl;
      }
      
      console.log('Normalized icon URL:', iconUrl);
      
      // Remove all existing favicon links first to avoid conflicts
      const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel*='Icon']");
      existingLinks.forEach(link => link.remove());
      
      // Create all favicon-related links
      const iconTypes = [
        { rel: "icon" },
        { rel: "shortcut icon" },
        { rel: "apple-touch-icon" },
        { rel: "mask-icon" }
      ];
      
      iconTypes.forEach(({ rel }) => {
        const newLink = document.createElement("link");
        newLink.rel = rel;
        newLink.href = iconUrl;
        
        // Set appropriate type based on file extension
        if (iconUrl.match(/\.svg$/i)) {
          newLink.type = "image/svg+xml";
        } else if (iconUrl.match(/\.png$/i)) {
          newLink.type = "image/png";
        } else if (iconUrl.match(/\.ico$/i)) {
          newLink.type = "image/x-icon";
        } else if (iconUrl.match(/\.jpg$/i) || iconUrl.match(/\.jpeg$/i)) {
          newLink.type = "image/jpeg";
        }
        
        document.head.appendChild(newLink);
        console.log(`Added favicon link: ${rel} -> ${iconUrl}`);
      });
    }
  }, [config]);

  useEffect(() => {
    const handleConsentUpdate = async (event) => {
      // Wait until Cookiebot is fully ready
      if (!window.Cookiebot || !window.Cookiebot.consent) {
        return;
      }
  
      const consent = window.Cookiebot.consent;
      const consentData = {
        necessary: consent.necessary,
        preferences: consent.preferences,
        statistics: consent.statistics,
        marketing: consent.marketing,
        userId: conversationId,
        consentedAt: new Date().toISOString(),
      };
  
      await handleSelection(config, consentData, conversationId);
    };
  
    window.addEventListener("CookiebotOnAccept", handleConsentUpdate);
    window.addEventListener("CookiebotOnDecline", handleConsentUpdate);
  
    return () => {
      window.removeEventListener("CookiebotOnAccept", handleConsentUpdate);
      window.removeEventListener("CookiebotOnDecline", handleConsentUpdate);
    };
  }, [config, conversationId]);
  
  
  
  // Step 2: Load conversation/messages when config + conversationId are ready

  const initConversation = (config2: any) => {
    const otpPhrase = getCookie("otpPhrase");

    


    let parsedOtpPhrase = [];
    if (otpPhrase) {
      try {
        parsedOtpPhrase = JSON.parse(otpPhrase);
      } catch (e) {
        // Fail silently
      }
    }

    const otpPhraseArray = parsedOtpPhrase.find?.(
      (item) => item.conversationId === conversationId
    );

    const headers = new Headers({
      Accept: "*/*", // from browser or another config
    });
    if (otpPhraseArray?.passphrase) {
      headers.set("passphrase", otpPhraseArray.passphrase);
    }
    const params = new URLSearchParams(resolvedSearchParams).toString();

    // Get initial_state from URL parameters
    const initialState = resolvedSearchParams?.initial_state;
    const initialStateValue = Array.isArray(initialState) ? initialState[0] : initialState;
    
    // Parse initial_state - it might be a JSON object like {"nome": "John", "telefono": "3981235564"}
    // Extract the key from the JSON object to use as the autoMessage key, and get all variables for template replacement
    let autoMessageKey: string | null = null;
    let templateVariables: Record<string, any> = {};
    if (initialStateValue) {
      let parsed: any = null;
      let decodedValue = String(initialStateValue);
      
      // First, try to parse as-is (in case Next.js already decoded it)
      try {
        parsed = JSON.parse(decodedValue);
      } catch (e) {
        // If parsing fails, try decoding URL-encoded characters
        try {
          // Check if it contains URL-encoded characters (like %7B, %3A, etc.)
          if (decodedValue.includes('%')) {
            decodedValue = decodeURIComponent(decodedValue);
          }
          parsed = JSON.parse(decodedValue);
        } catch (e2) {
          // If still fails, try one more time with aggressive decoding
          try {
            // Sometimes the entire string might be double-encoded or have special characters
            decodedValue = decodeURIComponent(decodeURIComponent(decodedValue));
            parsed = JSON.parse(decodedValue);
          } catch (e3) {
            console.warn('Failed to parse initial_state after multiple attempts:', e3, 'Original value:', initialStateValue);
            // If all parsing attempts fail, treat it as a plain string key
            autoMessageKey = initialStateValue;
          }
        }
      }
      
      // If we successfully parsed the JSON
      if (parsed && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        // Store all variables for template replacement
        templateVariables = parsed;
        
        // Find the first key in initial_state that exists in chat.autoMessage (excluding "default")
        const keys = Object.keys(parsed);
        for (const key of keys) {
          if (key !== 'default' && config2.chat.autoMessage[key]) {
            autoMessageKey = key;
            break;
          }
        }
      } else if (parsed === null && autoMessageKey === null) {
        // If parsing resulted in null or we couldn't parse, use the decoded value as key
        autoMessageKey = decodedValue;
      }
    }
    
    // Select autoMessage based on initial_state
    // If a matching field exists in chat.autoMessage, use it; otherwise use default
    let selectedAutoMessage = config2.chat.autoMessage.default;
    if (autoMessageKey && config2.chat.autoMessage[autoMessageKey]) {
      selectedAutoMessage = config2.chat.autoMessage[autoMessageKey];
    }
    
    // Replace template variables in the message text (e.g., {{nome}}, {{telefono}})
    let messageText = selectedAutoMessage?.text || '';
    if (messageText && Object.keys(templateVariables).length > 0) {
      messageText = messageText.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
        return templateVariables[key] !== undefined ? String(templateVariables[key]) : match;
      });
    }
    
    // Use the role from the selected message, or fallback to default role
    const autoMessageRole = selectedAutoMessage?.role || config2.chat.autoMessage.role;

    // Display the first message immediately without waiting for API calls
    const autoMessage = {
      role: autoMessageRole,
      content: [{ ...selectedAutoMessage, text: messageText, type: "text", created_at: new Date() }],
      id: "user-message-" + conversationId,
      createdAt: new Date(),
      created_at: new Date(),
    };
    setMessages([autoMessage]);

    // Only call /create once per conversationId - run in background, non-blocking
    if (conversationId && !createdConversationsRef.current.has(conversationId)) {
      createdConversationsRef.current.add(conversationId);
      
      // Fire and forget - don't wait for this to complete
      fetch('https://ipinfo.io/?callback=?',{
        method: "GET",
        headers: headers,
      }).then(res => res?.text()).then(data => {
        let ipInfo = data;
        fetch(`${config2.api.baseUrl}/conversation/${conversationId}/create?${params}`, {
          method: "POST",
          headers: headers,
          body: JSON.stringify(ipInfo),
        }).catch(() => {
          // Fail silently
        });
      }).catch(() => {
        // Fail silently
      });
    }

    // Fetch conversation history in background - non-blocking
    // This will update messages if there are existing messages, but won't block the initial display
    fetch(
      `${config2.api.baseUrl}/conversation/${conversationId}/view?${params}`,
      {
        method: "GET",
        headers: headers,
      }
    )
      .then((res) => {
        if (res.status === 403) {
          setOtpModalOpen(true);
          throw new Error("403 Forbidden - OTP required");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const converted = data.messages.map((item) => {
            let contentArray;
            if (item.type === "user") {
              try {
                // Replace single quotes with double quotes for valid JSON parsing
                // const normalized = item.text.replace(/'/g, '"');
                // const parsed = JSON.parse(normalized);
                contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
              } catch (err) {
                contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
              }
            } else {
              // Assistant messages are plain text
              contentArray = [{ type: "text", text: item.text, created_at: item.created_at }];
            }

            return {
              role: item.type, // "user" or "assistant"
              content: contentArray,
              id: `${item.type}-message-${item.id}`,
              createdAt: new Date(), // You can use item.timestamp if available
              created_at: item.created_at,
            };
          });

          // Update messages with history if available, but keep autoMessage at the start
          setMessages([autoMessage, ...converted]);
        } else {
          const existingMessage = typeof window !== 'undefined' 
            ? JSON.parse(localStorage.getItem(`conversation:${conversationId}`) || "[]")
            : [];

          if (existingMessage.length > 1) {
            const parsedMessages = existingMessage.map((item) => ({
              role: item.role,
              content: [{ text: item.text, type: "text" }],
              id: "user-message-" + conversationId,
              createdAt: new Date(),
            }));
            setMessages(parsedMessages);
          }
          // If no existing messages, keep the autoMessage that was already set
        }
      })
      .catch((e) => {
        // If view fails, keep the autoMessage that was already displayed
        // Only update if we need to show error state (currently just keeping autoMessage)
        console.error("Error loading conversation history:", e);
      });
  };

  useEffect(() => {
    if (config?.chat?.isDark) setIsDarkMode(true);
  }, [config]);

  useEffect(() => {
    // const updatedArray = messages.map(msg => {
    //   if (msg.attachments) {
    //     const newMsg = { ...msg };
    //     delete newMsg.attachments;
    //     return newMsg;
    //   }
    //   return msg;
    // });

    if (conversationId && messages.length > 1) {
      const updatedArray = messages.map(({ attachments, ...rest }) => rest);
      saveMessages(conversationId, updatedArray);
    }
  }, [messages]);

  useEffect(() => {
    chatService.initializeConnection(conversationId);
    
    // Subscribe to connection status changes
    const unsubscribeStatus = chatService.onConnectionStatusChange((isConnected) => {
      console.log(`📡 [Assistant] Connection status changed: ${isConnected}`);
      setIsWebSocketConnected(isConnected);
    });
    
    const unsubscribe = chatService.onMessage((incoming) => {
      console.log("🔵 [WebSocket Handler] Message received", {
        timestamp: Date.now(),
        hasIncoming: !!incoming,
        type: incoming?.type,
        hasText: !!incoming?.text,
        textLength: incoming?.text?.length || 0,
        pk: incoming?.pk,
        id: incoming?.id,
        fullIncoming: incoming
      });
      
      // Fail silently if incoming is undefined
      if (!incoming) {
        console.log("🔵 [WebSocket Handler] Incoming is undefined, returning");
        return;
      }
      
      // Handle event messages first (display_suggestions, open_url, close_url)
      if (incoming?.type === "event") {
        console.log("🔵 [WebSocket Handler] Processing event message", {
          timestamp: Date.now(),
          action: incoming.event?.action,
          event: incoming.event
        });
        const action = incoming.event?.action;
        
        if (action === "open_url" || action === "on_open") {
          // Cancel any pending keyboard open timeout since an action was received
          if (keyboardOpenTimeoutRef.current) {
            clearTimeout(keyboardOpenTimeoutRef.current);
            keyboardOpenTimeoutRef.current = null;
          }
          
          iframe.openIframe(incoming.event.url);
          // Keep input focused when opening iframe (but only if no suggestions)
          if (!suggestedMessagesRef.current?.buttons?.length) {
            keepInputFocused();
          }
        } else if (action === "close_url" || action === "on_close") {
          // Cancel any pending keyboard open timeout since an action was received
          if (keyboardOpenTimeoutRef.current) {
            clearTimeout(keyboardOpenTimeoutRef.current);
            keyboardOpenTimeoutRef.current = null;
          }
          
          iframe.closeIframe();
          // Keep input focused when closing iframe (but only if no suggestions)
          if (!suggestedMessagesRef.current?.buttons?.length) {
            keepInputFocused();
          }
        } else if (action === "display_suggestions") {
          // When displaying suggestions, keep keyboard open but disable send button
          // CRITICAL: Delay suggestions display to ensure any pending message updates complete first
          // This prevents messages from disappearing when suggestions appear
          setTimeout(() => {
            flushSync(() => {
          setStateData({ suggestedMessages: incoming.event });
            });
            // Keep keyboard open - don't blur the input
          }, 100); // Delay to ensure messages are fully rendered first
        }
        return;
      }
      
      // Handle assistant messages - be more lenient with text validation
      // Accept messages even if text is empty or whitespace (might be streaming or partial)
      if (incoming?.type === "assistant" && incoming.text !== undefined && incoming.text !== null) {
        console.log("🔵 [WebSocket Handler] Processing assistant message", {
          timestamp: Date.now(),
          pk: incoming.pk,
          id: incoming.id,
          textLength: incoming.text.length,
          textPreview: incoming.text.substring(0, 50)
        });
        
        // Use pk (primary key) if available, otherwise use id, otherwise generate one
        // CRITICAL: Use the same ID format as API responses to ensure messages can be found/updated
        // This matches the format used in onNew: assistant-message-${pk} or assistant-message-${Date.now()}
        const messageId = incoming.pk 
          ? `assistant-message-${String(incoming.pk)}` 
          : incoming.id 
          ? `assistant-message-${String(incoming.id)}` 
          : `assistant-message-${Date.now()}`;
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:856',message:'WebSocket: Message received',data:{messageId,incomingPk:incoming.pk,incomingId:incoming.id,incomingType:incoming.type,incomingTextLength:incoming.text?.length||0,fromPk:!!incoming.pk,fromId:!!incoming.id},timestamp:Date.now(),runId:'websocket1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        console.log("🔵 [WebSocket Handler] Generated messageId", {
          timestamp: Date.now(),
          messageId,
          fromPk: !!incoming.pk,
          fromId: !!incoming.id
        });
        
        // Ensure text is a string, even if empty
        const messageText = typeof incoming.text === 'string' ? incoming.text : String(incoming.text || '');
        
        const incRes: ThreadMessageLike = {
          role: incoming.type || "assistant",
          content: [{ text: messageText, type: "text", created_at: incoming.created_at }],
          id: messageId,
          createdAt: new Date(),
        };
        
        console.log("🔵 [WebSocket Handler] Created message object", {
          timestamp: Date.now(),
          messageId: incRes.id,
          role: incRes.role,
          contentLength: incRes.content[0]?.text?.length || 0
        });
        
        // Update optimistic message or add new one
        // Use flushSync to ensure the update is processed immediately
        // CRITICAL: Wrap in try-catch to ensure message is never lost
        try {
          flushSync(() => {
            setMessages((currentConversation) => {
            console.log("🔵 [WebSocket Handler] setMessages callback - current state", {
              timestamp: Date.now(),
              conversationLength: currentConversation.length,
              messageIds: currentConversation.map(m => ({ id: m.id, role: m.role })),
              searchingForId: messageId
            });
            
            // First, check if message already exists by ID (pk) - most reliable check
            // Also check for messages with the same pk/id even if the prefix differs
            const existingByIdIndex = currentConversation.findIndex(msg => {
              const msgIdStr = String(msg.id);
              const incomingPkStr = incoming.pk ? String(incoming.pk) : null;
              const incomingIdStr = incoming.id ? String(incoming.id) : null;
              
              // Check exact match
              if (msgIdStr === String(messageId)) return true;
              
              // Check if message ID contains the pk/id (handles both prefixed and non-prefixed)
              if (incomingPkStr && (msgIdStr.includes(incomingPkStr) || msgIdStr === incomingPkStr)) return true;
              if (incomingIdStr && (msgIdStr.includes(incomingIdStr) || msgIdStr === incomingIdStr)) return true;
              
              return false;
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:901',message:'WebSocket: Checking for existing message by ID',data:{messageId,incomingPk:incoming.pk,incomingId:incoming.id,existingByIdIndex,foundById:existingByIdIndex!==-1,currentConversationLength:currentConversation.length,allMessageIds:currentConversation.map(m=>({id:m.id,role:m.role}))},timestamp:Date.now(),runId:'websocket1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            console.log("🔵 [WebSocket Handler] ID check result", {
              timestamp: Date.now(),
              existingByIdIndex,
              foundById: existingByIdIndex !== -1,
              messageId
            });
            
            if (existingByIdIndex !== -1) {
              // Message already exists with this ID - update it to ensure content is current
              console.log("🔵 [WebSocket Handler] Message exists by ID, updating", {
                timestamp: Date.now(),
                existingIndex: existingByIdIndex,
                existingId: currentConversation[existingByIdIndex].id,
                newId: messageId,
                existingContentLength: currentConversation[existingByIdIndex].content[0]?.text?.length || 0,
                newContentLength: incRes.content[0]?.text?.length || 0
              });
              const updated = [...currentConversation];
              // Only update if new content is longer or different (for streaming updates)
              const existingText = updated[existingByIdIndex].content[0]?.text || '';
              const newText = incRes.content[0]?.text || '';
              if (newText.length > existingText.length || newText !== existingText) {
                updated[existingByIdIndex] = incRes;
              }
              return updated;
            }
            
            // Find the last optimistic assistant message (created by the library)
            let optimisticIndex = -1;
            for (let i = currentConversation.length - 1; i >= 0; i--) {
              const msg = currentConversation[i];
              if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                optimisticIndex = i;
                break;
              }
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:943',message:'WebSocket: Checking for optimistic message',data:{messageId,optimisticIndex,foundOptimistic:optimisticIndex!==-1,optimisticId:optimisticIndex!==-1?currentConversation[optimisticIndex].id:null,currentConversationLength:currentConversation.length,allMessageIds:currentConversation.map(m=>({id:m.id,role:m.role}))},timestamp:Date.now(),runId:'websocket1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            console.log("🔵 [WebSocket Handler] Optimistic message check", {
              timestamp: Date.now(),
              optimisticIndex,
              foundOptimistic: optimisticIndex !== -1,
              optimisticId: optimisticIndex !== -1 ? currentConversation[optimisticIndex].id : null
            });
            
            if (optimisticIndex !== -1) {
              // Update the optimistic message in place, keeping its ID but updating content
              // This preserves the stable ID reference that the component already has
              const optimisticId = currentConversation[optimisticIndex].id;
              const existingText = currentConversation[optimisticIndex].content[0]?.text || '';
              const newText = incRes.content[0]?.text || '';
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:960',message:'WebSocket: Updating optimistic message (keeping optimistic ID)',data:{optimisticIndex,optimisticId,newMessageId:messageId,willKeepOptimisticId:true,existingTextLength:existingText.length,newTextLength:newText.length,problematicBehavior:'Keeping optimistic ID means WebSocket messages for next turn might update this message'},timestamp:Date.now(),runId:'websocket1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              
              console.log("🔵 [WebSocket Handler] Updating optimistic message", {
                timestamp: Date.now(),
                optimisticIndex,
                optimisticId,
                newMessageId: messageId,
                willKeepOptimisticId: true,
                existingTextLength: existingText.length,
                newTextLength: newText.length
              });
              
              // CRITICAL: Always update the optimistic message with websocket content
              // The websocket message is the authoritative source, even if it's shorter
              // This ensures the real response replaces the optimistic placeholder
              const updated = [...currentConversation];
              updated[optimisticIndex] = {
                ...incRes,
                id: optimisticId, // Keep the optimistic ID to maintain component reference
              };
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:981',message:'WebSocket: Updated optimistic message (kept optimistic ID)',data:{optimisticIndex,optimisticId,newMessageId:messageId,updatedMessageId:updated[optimisticIndex].id,updatedMessageRole:updated[optimisticIndex].role,updatedMessageContentLength:updated[optimisticIndex].content[0]?.text?.length||0,updatedLength:updated.length},timestamp:Date.now(),runId:'websocket1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
              
              console.log("🔵 [WebSocket Handler] Returning updated conversation (optimistic)", {
                timestamp: Date.now(),
                updatedLength: updated.length,
                updatedMessage: updated[optimisticIndex] ? {
                  id: updated[optimisticIndex].id,
                  role: updated[optimisticIndex].role,
                  contentLength: updated[optimisticIndex].content[0]?.text?.length || 0
                } : null
              });
              
              return updated;
            }
            
            // No optimistic message found - add the new message
            // WebSocket messages should always be added if they don't exist by ID
            console.log("🔵 [WebSocket Handler] No optimistic message, adding new message", {
              timestamp: Date.now(),
              currentLength: currentConversation.length,
              newMessageId: messageId,
              newMessageRole: incRes.role,
              newMessageContentLength: incRes.content[0]?.text?.length || 0
            });
            
            // Always add the message - don't check for duplicate content
            // CRITICAL: Ensure the message has actual text content so it won't be filtered by runtime
            // The runtime may filter empty or incomplete messages when isRunning changes
            const messageToAdd = {
              ...incRes,
              // Ensure content is properly structured
              content: incRes.content && incRes.content.length > 0 
                ? incRes.content 
                : [{ text: messageText || '', type: "text", created_at: incoming.created_at }]
            };
            
            const newConversation = [...currentConversation, messageToAdd];
            
            console.log("🔵 [WebSocket Handler] Returning new conversation with added message", {
              timestamp: Date.now(),
              newLength: newConversation.length,
              lastMessage: newConversation[newConversation.length - 1] ? {
                id: newConversation[newConversation.length - 1].id,
                role: newConversation[newConversation.length - 1].role,
                contentLength: newConversation[newConversation.length - 1].content[0]?.text?.length || 0
              } : null,
              allMessageIds: newConversation.map(m => ({ id: m.id, role: m.role }))
            });
            
            return newConversation;
            });
          });
        } catch (error) {
          // If flushSync fails, try adding message directly as fallback
          console.error("🔵 [WebSocket Handler] Error in flushSync, using fallback", {
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : String(error),
            messageId
          });
          
          setMessages((currentConversation) => {
            // Simple fallback: just add the message if it doesn't exist
            const exists = currentConversation.some(msg => String(msg.id) === String(messageId));
            if (!exists) {
              return [...currentConversation, incRes];
            }
            return currentConversation;
          });
        }
        
        console.log("🔵 [WebSocket Handler] After flushSync, setting isRunning to false", {
          timestamp: Date.now(),
          messageId
        });
        
        // Set isRunning to false after message is added
        // Use a longer delay to ensure message is fully rendered and persisted before changing isRunning
        // This prevents the runtime from filtering the message when suggestions appear
        // CRITICAL: Wait longer to ensure message is fully in the DOM and cached before allowing runtime to filter
        // Use multiple requestAnimationFrame to ensure React has fully processed the update
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              setIsRunning(false);
            }, 200); // Additional delay to ensure message is fully persisted
            });
        });
        
        // CRITICAL: Wait 2 seconds after message response, then open keyboard if no action was received
        // This is the safest way to avoid opening keyboard when suggestions are about to appear
        // Clear any existing timeout first
        if (keyboardOpenTimeoutRef.current) {
          clearTimeout(keyboardOpenTimeoutRef.current);
          keyboardOpenTimeoutRef.current = null;
        }
        
        // Set a 2-second timeout to open keyboard if no action is received
        keyboardOpenTimeoutRef.current = setTimeout(() => {
          // Double-check that no suggestions are visible before opening keyboard
          const hasSuggestions = suggestedMessagesRef.current?.buttons?.length > 0;
          const suggestionBar = document.querySelector('[data-suggestion-bar]');
          const suggestionsVisible = suggestionBar && suggestionBar.getBoundingClientRect().height > 0;
          const isIframeOpen = iframe.showIframe;
          
          // Only open keyboard if no suggestions are visible and iframe is closed
          if (!hasSuggestions && !suggestionsVisible && !isIframeOpen) {
            keepInputFocused();
          }
          
          keyboardOpenTimeoutRef.current = null;
        }, 2000); // Wait 2 seconds
      } else {
        console.log("🔵 [WebSocket Handler] Message skipped - not assistant or invalid", {
          timestamp: Date.now(),
          type: incoming?.type,
          hasText: incoming?.text !== undefined && incoming?.text !== null,
          textType: typeof incoming?.text,
          textValue: incoming?.text,
          textLength: typeof incoming?.text === 'string' ? incoming.text.length : 0,
          textIsEmpty: typeof incoming?.text === 'string' ? incoming.text.trim().length === 0 : true
        });
      }
    });
    return () => {
      // chatService.disconnect();
      unsubscribe();
      unsubscribeStatus();
      // Clean up any pending keyboard open timeout
      if (keyboardOpenTimeoutRef.current) {
        clearTimeout(keyboardOpenTimeoutRef.current);
        keyboardOpenTimeoutRef.current = null;
      }
    };
  }, [conversationId, iframe.showIframe]);

  // NOTE: Keyboard opening is now handled by the 2-second timeout after message responses
  // This is safer as it waits to see if any actions (like display_suggestions) are received
  // The old 1-second timeout logic has been removed in favor of this approach

  // === Chat Handlers ===
  const createNewChat = () => {
    const newId = uuidv4();
    saveConversationToHistory(newId, ""); // title will be set on first user message
    setHistory(getConversationHistory());
    switchConversation(newId);
  };

  const switchConversation = (id: string) => {
    setStateData({ conversationId: id });
    router.push(`/chat/${id}`, undefined, { shallow: true });
    if (typeof window !== 'undefined') {
    localStorage.setItem(`my-convo-${id}`, "true");
    }
  };

  const updateTitleIfNeeded = (msgText: string) => {
    if (!conversationId) return;
    const current = getConversationHistory().find(
      (h) => h.id === conversationId
    );
    if (!current?.title) {
      const title =
        msgText.trim().split(/\s+/).slice(0, 3).join(" ") || "Untitled Chat";
      saveConversationToHistory(conversationId, title);
      setHistory(getConversationHistory());
    }
  };

  const onNew = useCallback(
    async (userAppendMessage: AppendMessage) => {
      if (
        suggestedMessages?.buttons?.length > 0 &&
        suggestedMessages?.close_on_ignore === true
      ) {
        setStateData({ suggestedMessages: [] });
      }
 
      const text =
        userAppendMessage.content.find((c) => c.type === "text")?.text ?? "";
      const userMessage: ThreadMessageLike = {
        role: "user",
        content: userAppendMessage.content,
        id: `user-message-${Date.now()}`,
        createdAt: new Date(),
        attachments: userAppendMessage.attachments,
      };
      setMessages((currentConversation) => [
        ...currentConversation,
        userMessage,
      ]);
      updateTitleIfNeeded(text);
      
      // CRITICAL: Production vs Dev difference
      // In DEV: React's batching is more forgiving, runtime creates optimistic message and it syncs
      // In PROD: React batches more aggressively, causing timing issues where:
      //   1. Runtime creates optimistic message internally (not in our state)
      //   2. We search our state, don't find it, add new message with different ID
      //   3. Component locks onto runtime's ID, but we update different message = FLICKER
      // 
      // Solution: Set isRunning first, then wait a tick for runtime to create optimistic message
      // In production, we need explicit synchronization
      
      // CRITICAL: The runtime creates optimistic messages internally but doesn't add them to our state
      // The component locks onto the optimistic ID, but we can't update it if it's not in our state
      // Solution: Manually add an optimistic message to our state so we can find and update it later
      const optimisticId = `__optimistic__${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const optimisticMessage: ThreadMessageLike = {
        role: "assistant",
        content: [{ text: "", type: "text" }],
        id: optimisticId,
        createdAt: new Date(),
      };
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1189',message:'onNew: Creating optimistic message',data:{optimisticId,userMessageId:userAppendMessage.id,userMessageRole:userAppendMessage.role,userMessageContentLength:userAppendMessage.content[0]?.text?.length||0,conversationId,userId},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Add optimistic message and set isRunning atomically
      if (process.env.NODE_ENV === 'production') {
        // In production, use flushSync to ensure atomic update
        flushSync(() => {
          setMessages((currentConversation) => {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1201',message:'onNew: Adding optimistic message to state',data:{optimisticId,currentConversationLength:currentConversation.length,existingMessageIds:currentConversation.map(m=>({id:m.id,role:m.role})),willAddOptimistic:true},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            return [...currentConversation, optimisticMessage];
          });
      setIsRunning(true);
        });
      } else {
        // In dev, regular batching is fine
        setMessages((currentConversation) => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1206',message:'onNew: Adding optimistic message to state (dev)',data:{optimisticId,currentConversationLength:currentConversation.length,existingMessageIds:currentConversation.map(m=>({id:m.id,role:m.role})),willAddOptimistic:true},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          return [...currentConversation, optimisticMessage];
        });
        setIsRunning(true);
      }
      
      try {
        // Send message - response comes from API, not WebSocket
        const assistantResponse = await chatService.sendMessage(
          userAppendMessage,
          userId,
          conversationId!,
          resolvedSearchParams,
          ipAddress
        );
        
        // Fail silently if response is empty, undefined, or invalid
        if (!assistantResponse || !assistantResponse.type || !assistantResponse.text) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1255',message:'onNew: HTTP response invalid/empty',data:{assistantResponse:!!assistantResponse,assistantResponseType:assistantResponse?.type,assistantResponseText:!!assistantResponse?.text,optimisticId},timestamp:Date.now(),runId:'error1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          // CRITICAL: Only remove empty optimistic messages
          // If WebSocket already updated the message with real content, keep it
          // WebSocket messages have real IDs (assistant-message-*) so they won't be removed
          flushSync(() => {
            setMessages((currentConversation) => {
              // #region agent log
              const beforeFilter = currentConversation.map(m => ({id:m.id,role:m.role,contentLength:typeof m.content[0]==='object'?m.content[0]?.text?.length||0:0,isOptimistic:String(m.id).startsWith('__optimistic__')}));
              // #endregion
              
              // Only remove optimistic messages that are still empty (not updated by WebSocket)
              // WebSocket updates change the ID to assistant-message-* so they won't match this filter
              const filtered = currentConversation.filter((msg) => {
                const isOptimistic = msg.role === "assistant" && String(msg.id).startsWith("__optimistic__");
                if (isOptimistic) {
                  // Check if message has real content (WebSocket might have updated it)
                  const hasContent = typeof msg.content[0] === 'object' && 
                                     msg.content[0]?.text && 
                                     String(msg.content[0].text).trim().length > 0;
                  // Only remove if it's still empty (not updated by WebSocket)
                  return hasContent; // Keep if has content, remove if empty
                }
                return true; // Keep all non-optimistic messages
              });
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1260',message:'onNew: Filtering optimistic messages after HTTP error',data:{beforeLength:currentConversation.length,afterLength:filtered.length,removedCount:currentConversation.length-filtered.length,beforeMessages:beforeFilter,afterMessages:filtered.map(m => ({id:m.id,role:m.role,contentLength:typeof m.content[0]==='object'?m.content[0]?.text?.length||0:0,isOptimistic:String(m.id).startsWith('__optimistic__')}))},timestamp:Date.now(),runId:'error1',hypothesisId:'F'})}).catch(()=>{});
              // #endregion
              
              return filtered;
            });
          });
          setIsRunning(false);
          return;
        }
        
        // Update the optimistic message with the real response
        // The library creates optimistic messages with IDs starting with '__optimistic__'
        // CRITICAL: Update both messages and isRunning atomically in the same flushSync
        // This prevents the runtime from seeing an inconsistent state in production
        const messageId = assistantResponse?.pk || assistantResponse?.id || `assistant-message-${Date.now()}`;
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1242',message:'onNew: API response received',data:{messageId,assistantResponsePk:assistantResponse?.pk,assistantResponseId:assistantResponse?.id,assistantResponseType:assistantResponse?.type,assistantResponseTextLength:assistantResponse?.text?.length||0,assistantResponseCreatedAt:assistantResponse?.created_at,optimisticId},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // CRITICAL: Don't use messages.length here - it's a stale closure value!
        // We'll check inside setMessages callback where we have the current state
        flushSync(() => {
          setMessages((currentConversation) => {
            // CRITICAL: Use currentConversation (current state) not messages (stale closure)
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1247',message:'onNew: Starting to update optimistic message',data:{messageId,optimisticId,currentConversationLength:currentConversation.length,allMessageIds:currentConversation.map(m=>({id:m.id,role:m.role}))},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // CRITICAL: The runtime creates optimistic messages internally (not in our state)
            // The component sees them via useMessage and locks onto their optimistic ID
            // Strategy: 
            // 1. First, try to find ANY optimistic message (runtime might have added it to our state)
            // 2. If not found, replace the LAST assistant message
            // This ensures we update the message the component is locked onto
            
            // First, search for optimistic messages (runtime might have added them to our state)
            let optimisticIndex = -1;
            for (let i = currentConversation.length - 1; i >= 0; i--) {
              const msg = currentConversation[i];
              if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                optimisticIndex = i;
                break;
              }
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1261',message:'onNew: Found optimistic message',data:{optimisticIndex,foundOptimistic:optimisticIndex!==-1,optimisticMessageId:optimisticIndex!==-1?currentConversation[optimisticIndex].id:null,messageId},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // If no optimistic message found, find the last assistant message
            let lastAssistantIndex = -1;
            if (optimisticIndex === -1) {
              for (let i = currentConversation.length - 1; i >= 0; i--) {
                if (currentConversation[i].role === "assistant") {
                  lastAssistantIndex = i;
                  break;
                }
              }
            }
            
            const targetIndex = optimisticIndex !== -1 ? optimisticIndex : lastAssistantIndex;
            
            // If we found a target message (optimistic or last assistant), replace it
            // This handles both cases: runtime added optimistic to state, or we need to update last assistant
            if (targetIndex !== -1) {
              // Update the target message in place
              // CRITICAL: Change the ID from optimistic to real message ID
              // This prevents subsequent websocket messages for the next turn from finding and updating this message
              // The real message ID format is: assistant-message-${pk}
              const targetId = currentConversation[targetIndex].id;
              const isOptimisticId = String(targetId).startsWith('__optimistic__');
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1282',message:'onNew: Replacing optimistic message with real ID',data:{targetIndex,targetId,isOptimisticId,oldId:targetId,newId:messageId,willReplaceId:true,assistantResponseTextLength:assistantResponse.text?.length||0},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              
              const updated = [...currentConversation];
              
              // CRITICAL: Use the real message ID (assistant-message-${pk}) instead of keeping the optimistic ID
              // This ensures:
              // 1. The message has a proper ID that websocket messages can match by pk
              // 2. When websocket messages for the NEXT turn arrive (different pk), they won't find this message
              //    and will create a new message instead of updating this old one
              // The component will handle the ID change gracefully since the message content is updated
              
              updated[targetIndex] = {
                role: assistantResponse.type || "assistant",
                content: [{ text: assistantResponse.text || "", type: "text", created_at: assistantResponse.created_at }],
                id: messageId, // CRITICAL: Use real message ID, not optimistic ID
                createdAt: new Date(),
              };
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1302',message:'onNew: Message replaced with real ID',data:{targetIndex,oldId:targetId,newId:messageId,replacedMessageId:updated[targetIndex].id,replacedMessageRole:updated[targetIndex].role,replacedMessageContentLength:updated[targetIndex].content[0]?.text?.length||0,updatedLength:updated.length},timestamp:Date.now(),runId:'optimistic1',hypothesisId:'C'})}).catch(()=>{});
              // #endregion
              
              // CRITICAL: Remove any OTHER optimistic messages (old ones from previous messages)
              // This prevents multiple optimistic messages from accumulating
              const cleaned = updated.filter((msg, idx) => {
                if (idx === targetIndex) return true; // Keep the one we just updated
                // Remove other optimistic assistant messages
                if (msg.role === "assistant" && String(msg.id).startsWith("__optimistic__")) {
                  return false;
                }
                return true;
              });
              
              if (cleaned.length !== updated.length) {
                return cleaned;
              }
              
              return updated;
            }
            
            // No optimistic message found (shouldn't happen, but handle gracefully)
            
        const assRes: ThreadMessageLike = {
              role: assistantResponse.type || "assistant",
              content: [{ text: assistantResponse.text || "", type: "text", created_at: assistantResponse.created_at }],
              id: messageId,
          createdAt: new Date(),
        };
            return [...currentConversation, assRes];
          });
          
          // CRITICAL: Don't set isRunning to false immediately
          // The runtime filters optimistic messages when isRunning=false, causing flicker
          // We'll set it to false after a delay to ensure the message update is fully rendered
          // In production, React's batching is stricter, so we need explicit timing
          
          // Set isRunning to false after the message update is rendered
          // This prevents the runtime from filtering the optimistic message before it's updated
          if (process.env.NODE_ENV === 'production') {
            // In production, use multiple requestAnimationFrame to ensure render completes
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setIsRunning(false);
              });
            });
          } else {
            // In dev, single frame is usually enough
            requestAnimationFrame(() => {
              setIsRunning(false);
            });
          }
        });
        
        setlastMessageResponse(assistantResponse);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1412',message:'onNew: HTTP request threw error',data:{errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:'Unknown',optimisticId},timestamp:Date.now(),runId:'error1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        
        // CRITICAL: Only remove empty optimistic messages
        // If WebSocket already updated the message with real content, keep it
        // WebSocket messages have real IDs (assistant-message-*) so they won't be removed
        flushSync(() => {
          setMessages((currentConversation) => {
            // #region agent log
            const beforeFilter = currentConversation.map(m => ({id:m.id,role:m.role,contentLength:typeof m.content[0]==='object'?m.content[0]?.text?.length||0:0,isOptimistic:String(m.id).startsWith('__optimistic__')}));
            // #endregion
            
            // Only remove optimistic messages that are still empty (not updated by WebSocket)
            // WebSocket updates change the ID to assistant-message-* so they won't match this filter
            const filtered = currentConversation.filter((msg) => {
              const isOptimistic = msg.role === "assistant" && String(msg.id).startsWith("__optimistic__");
              if (isOptimistic) {
                // Check if message has real content (WebSocket might have updated it)
                const hasContent = typeof msg.content[0] === 'object' && 
                                   msg.content[0]?.text && 
                                   String(msg.content[0].text).trim().length > 0;
                // Only remove if it's still empty (not updated by WebSocket)
                return hasContent; // Keep if has content, remove if empty
              }
              return true; // Keep all non-optimistic messages
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1417',message:'onNew: Filtering optimistic messages after HTTP exception',data:{beforeLength:currentConversation.length,afterLength:filtered.length,removedCount:currentConversation.length-filtered.length,beforeMessages:beforeFilter,afterMessages:filtered.map(m => ({id:m.id,role:m.role,contentLength:typeof m.content[0]==='object'?m.content[0]?.text?.length||0:0,isOptimistic:String(m.id).startsWith('__optimistic__')}))},timestamp:Date.now(),runId:'error1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            
            return filtered;
          });
        });
        setIsRunning(false);
      }
    },
    [chatService, setMessages, setIsRunning]
  );

  const deleteConversation = (id: string) => {
    const updated = history.filter((c) => c.id !== id);
      if (typeof window !== 'undefined') {
    localStorage.setItem("chatHistory", JSON.stringify(updated));
    localStorage.removeItem(`conversation:${id}`);
      }
    setHistory(updated);

    if (conversationId === id) {
      updated.length ? switchConversation(updated[0].id) : createNewChat();
    }
  };

  // Memoize adapters to prevent recreation on every render
  const adapters = useMemo(() => ({
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new SimplePdfAttachmentAdapter(),
      ]),
  }), []);

  // Memoize convertMessage to prevent runtime recreation
  const convertMessage = useCallback((m: any) => m, []);

  // Detect iOS (Safari, Chrome, or any browser on iOS)
  const isIOS = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  // Calculate if keyboard is open (for Safari fix)
  const isKeyboardOpen = useMemo(() => {
    if (typeof window === 'undefined' || !visualViewportHeight || !window.visualViewport) return false;
    const initialHeight = initialViewportHeightRef.current || window.innerHeight;
    const heightReduction = initialHeight - visualViewportHeight;
    const hasOffsetTop = window.visualViewport.offsetTop !== undefined && window.visualViewport.offsetTop > 0;
    // Keyboard is open if height reduced significantly (>100px) OR offsetTop exists (Safari iOS behavior)
    return heightReduction > 100 || hasOffsetTop;
  }, [visualViewportHeight]);

  // Track messages changes for debugging
  useEffect(() => {
  }, [messages, isRunning]);

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
    adapters,
  });
  

 
  if (!config) return <div>Loading config...</div>;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
        {/* <CookiebotLoader config={config} /> */}
      {/* HEADER */}

      {/* MAIN LAYOUT */}
      <div 
        className="flex flex-col relative"
        style={{
          height: visualViewportHeight ? `${visualViewportHeight}px` : '100dvh',
          maxHeight: visualViewportHeight ? `${visualViewportHeight}px` : '100dvh',
          width: '100%',
          // CRITICAL: On iOS when keyboard is open, use fixed positioning to prevent white space
          // The main container must be fixed to prevent scrolling that reveals white/blue space below
          position: (isIOS && isKeyboardOpen) ? 'fixed' : 'relative',
          ...((isIOS && isKeyboardOpen) && {
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
          }),
          // CRITICAL: Set background to match body to prevent white/blue space
          backgroundColor: isDarkMode ? 'rgb(24 24 27)' : 'rgb(255 255 255)',
          // #region agent log
          // iOS Safari fix: Prevent overflow that causes white space below screen
          overflow: 'hidden',
          // Allow touch scrolling within this container and its children (messages container)
          touchAction: (isIOS && isKeyboardOpen) ? 'pan-y' : 'auto',
          // #endregion
        }}
        ref={(el) => {
          // #region agent log
          if (el) {
            const computed = window.getComputedStyle(el);
            const initialHeight = initialViewportHeightRef.current || window.innerHeight;
          const heightReduction = initialHeight - (visualViewportHeight || window.innerHeight);
          const hasOffsetTop = typeof window !== 'undefined' && window.visualViewport && window.visualViewport.offsetTop !== undefined && window.visualViewport.offsetTop > 0;
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
          fetch('http://127.0.0.1:7243/ingest/b924afbe-002b-4741-a237-97e02892efc5',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'assistant.tsx:1141',message:'Main container render - style values',data:{visualViewportHeight,initialViewportHeight:initialViewportHeightRef.current,heightReduction,hasOffsetTop,visualViewportOffsetTop:typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.offsetTop : null,isKeyboardOpen,isIOS,computedPosition:computed.position,computedTop:computed.top,computedLeft:computed.left,computedRight:computed.right,computedBottom:computed.bottom,computedHeight:computed.height,computedWidth:computed.width,computedBackground:computed.backgroundColor,computedOverflow:computed.overflow,offsetHeight:el.offsetHeight,offsetWidth:el.offsetWidth,clientHeight:el.clientHeight,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,scrollTop:el.scrollTop,getBoundingClientRect:JSON.stringify(el.getBoundingClientRect()),userAgent:navigator.userAgent},timestamp:Date.now(),runId:'ios1',hypothesisId:'C'})}).catch(()=>{});
          }
          // #endregion
        }}
      >

<header
  ref={(el) => {
    if (el && config?.chat?.topBarColor) {
      // Set background color with important flag to override CSS classes
      el.style.setProperty('background-color', config.chat.topBarColor, 'important');
    }
  }}
  className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 border-b dark:border-zinc-800 dark:text-white"
  style={{
    // On mobile, position relative to visual viewport offset
    transform: typeof window !== 'undefined' && window.visualViewport 
      ? `translateY(${window.visualViewport.offsetTop}px)` 
      : undefined,
    // Apply topBarColor from config if available
    backgroundColor: config?.chat?.topBarColor || undefined,
  }}
>
  <ThemeAwareLogo
    width={180}
    height={30}
    isDarkMode={isDarkMode}
    config={config}
  />
   {/* <button
      onClick={() => window?.Cookiebot?.renew?.()}
      className="mt-2 px-4 py-2 bg-blue-900 text-white rounded hover:bg-blue-800"
    >
      R
    </button>  */}
</header>

<main 
  className="flex-1" 
  style={{ 
    marginTop: '4rem', // Account for fixed header height
    height: visualViewportHeight ? `calc(${visualViewportHeight}px - 4rem)` : 'calc(100dvh - 4rem)',
    maxHeight: visualViewportHeight ? `calc(${visualViewportHeight}px - 4rem)` : 'calc(100dvh - 4rem)',
    // CRITICAL: Allow scrolling within messages container even when keyboard is open
    // The ThreadPrimitive.Viewport inside will handle the actual scrolling
    overflow: 'hidden', // Prevent main container from scrolling, but allow children to scroll
  }}
>
  <Thread
    sidebarOpen={sidebarOpen}
    setStateData={setStateData}
    onResetUserId={() => {}}
    isDarkMode={isDarkMode}
    toggleDarkMode={() => {
      setIsDarkMode((prev) => !prev);
      document.documentElement.classList.toggle("dark", !isDarkMode);
    }}
    defaultTitle={config.app.title || 'Mem0 Assistant'}
    disclaimer={config.app.disclaimer}
    colors={config.chat?.colors}
    onNew={onNew}
    messages={messages}
    config={config}
    suggestedMessages={suggestedMessages}
    runtime={runtime}
    isIframeOpen={iframe.showIframe}
  />
</main>
</div>


      {/* <main className="flex-1 overflow-y-auto">
    <Thread
      sidebarOpen={sidebarOpen}
      setStateData={setStateData}
      onResetUserId={() => {}}
      isDarkMode={isDarkMode}
      toggleDarkMode={() => {
        setIsDarkMode((prev) => !prev);
        document.documentElement.classList.toggle("dark", !isDarkMode);
      }}
      defaultTitle={config.app.title || 'Mem0 Assistant'}
      disclaimer={config.app.disclaimer}
      colors={config.chat?.colors}
      onNew={onNew}
      messages={messages}
      config={config}
      suggestedMessages={suggestedMessages}
      runtime={runtime}
    />
  </main> */}

      {config.chat.isVisible && (
        <Button variant="contained" onClick={handleModalOpen}>
          Show JSON Message
        </Button>
      )}
      {/* JSON Viewer Modal */}
      <ActionModal
        config={config}
        open={iframe.showIframe}
        url={iframe.iframeUrl}
        iframeError={iframe.iframeError}
        onClose={iframe.closeIframe}
        onIframeError={iframe.onIframeError}
        onIframeLoad={iframe.onIframeLoad}
      />

      <OtpModal
        open={otpModalOpen}
        onOtpSuccess={() => {
          setOtpModalOpen(false);
          initConversation(config); // retry with new header
        }}
        conversationId={conversationId}
        config={config}
        // onVerify={(otp) => handleOtpVerification(otp)}
      />
      <Modal open={modalOpen} onClose={handleModalClose}>
        <Box sx={style}>
          <Typography variant="h6" mb={2}>
            JSON Response
          </Typography>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "10px",
              borderRadius: "4px",
            }}
          >
            {JSON.stringify(lastMessageResponse, null, 2)}
          </pre>
        </Box>
      </Modal>

      {/* <Modal open={openCookieModal}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: "background.paper",
            p: 4,
            borderRadius: 2,
            boxShadow: 24,
            width: 400,
            textAlign: "",
          }}
        >
          <Typography variant="h6" gutterBottom>
            {config.cookie.header}
          </Typography>
          <Typography variant="body2" sx={{ mb: 3 }}>
            {config.cookie.description}
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "", gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              disabled={cookieLoading}
              onClick={() =>
                handleSelection(
                  config,
                  "accept",
                  conversationId,
                  setCookieLoading,
                  setOpenCookieModal
                )
              }
            >
              {config.cookie.acceptButton}
            </Button>
            <Button
              variant="outlined"
              color="error"
              disabled={cookieLoading}
              onClick={() =>
                handleSelection(
                  config,
                  "reject",
                  conversationId,
                  setCookieLoading,
                  setOpenCookieModal
                )
              }
            >
              {config.cookie.rejectButton}
            </Button>
          </Box>
        </Box>
      </Modal> */}
    </AssistantRuntimeProvider>
  );
}
