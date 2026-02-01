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

