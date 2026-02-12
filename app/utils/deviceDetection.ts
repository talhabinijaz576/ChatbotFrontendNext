import React from "react";

/**
 * Detects if the current device is a mobile phone
 * @returns true if the device is a mobile phone, false otherwise
 */
export const isMobileDevice = (): boolean => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false;
  }

  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Common mobile device patterns
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  
  // Check screen width (mobile devices typically have smaller screens)
  const isSmallScreen = window.innerWidth <= 768;
  
  // Check for touch capability (most phones have touch screens)
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Consider it a mobile device if:
  // 1. User agent matches mobile pattern AND
  // 2. (Screen is small OR device has touch capability)
  // This helps distinguish phones from tablets (which might have larger screens)
  const isMobileUserAgent = mobileRegex.test(userAgent);
  const isPhone = isMobileUserAgent && (isSmallScreen || (hasTouchScreen && window.innerWidth <= 1024));
  
  return isPhone;
};

/**
 * Blurs the active input/textarea element if on a mobile device
 */
export const blurActiveInputIfMobile = (): void => {
  if (isMobileDevice()) {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
      (activeElement as HTMLElement).blur();
    }
  }
};

/**
 * Keeps the input/textarea element focused to maintain the on-screen keyboard open
 * This function finds the composer input and ensures it stays focused
 * @param inputRef - Optional ref to the input element (preferred method)
 */
export const keepInputFocused = (inputRef?: React.RefObject<HTMLTextAreaElement> | null): void => {
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    let inputToFocus: HTMLTextAreaElement | null = null;
    
    // First, try to use the provided ref
    if (inputRef?.current) {
      inputToFocus = inputRef.current;
    } else {
      // Try to find the composer input element
      // The input is typically inside a ComposerPrimitive.Root
      const composerInput = document.querySelector(
        'textarea[placeholder], textarea[data-composer-input], textarea.composer-input, [data-radix-composer-input]'
      ) as HTMLTextAreaElement | null;
      
      // Fallback: find any textarea that's likely the composer
      const fallbackInput = document.querySelector(
        'textarea:not([readonly]):not([disabled])'
      ) as HTMLTextAreaElement | null;
      
      inputToFocus = composerInput || fallbackInput;
    }
    
    if (inputToFocus && document.activeElement !== inputToFocus) {
      // Only focus if it's not already focused
      inputToFocus.focus();
      // Ensure cursor is at the end
      if (inputToFocus.setSelectionRange) {
        const length = inputToFocus.value.length;
        inputToFocus.setSelectionRange(length, length);
      }
    } else if (inputToFocus && document.activeElement === inputToFocus) {
      // Already focused, but ensure it stays focused by re-focusing
      // This helps maintain keyboard open on some mobile browsers
      const currentValue = inputToFocus.value;
      const selectionStart = inputToFocus.selectionStart;
      const selectionEnd = inputToFocus.selectionEnd;
      
      inputToFocus.blur();
      requestAnimationFrame(() => {
        if (inputToFocus) {
          inputToFocus.focus();
          if (inputToFocus.setSelectionRange && selectionStart !== null && selectionEnd !== null) {
            inputToFocus.setSelectionRange(selectionStart, selectionEnd);
          }
        }
      });
    }
  });
};

