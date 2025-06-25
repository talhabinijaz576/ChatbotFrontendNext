import { useState, useCallback } from 'react';

interface UseIframeReturn {
  iframeUrl: string | null;
  showIframe: boolean;
  iframeError: boolean;
  openIframe: (url: string) => void;
  closeIframe: () => void;
  setIframeError: (error: boolean) => void;
  onIframeError: () => void;
  onIframeLoad: () => void;
  onIframeMessage: (message: any) => void;
}

export const useIframe = (): UseIframeReturn => {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [showIframe, setShowIframe] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const openIframe = useCallback((url: string) => {
    setIframeUrl(url);
    setShowIframe(true);
    setIframeError(false);
  }, []);

  const closeIframe = useCallback(() => {
    setShowIframe(false);
    setIframeUrl(null);
    setIframeError(false);
  }, []);

  const onIframeError = useCallback(() => {
    setIframeError(true);
  }, []);

  const onIframeLoad = useCallback(() => {
    setIframeError(false);
  }, []);

  const onIframeMessage = useCallback((message: any) => {
    console.log('🔄 Iframe interaction captured:', message);
    
    // You can handle different types of iframe interactions here
    switch (message.action) {
      case 'button_click':
        console.log(`User clicked button: "${message.buttonText}" in iframe`);
        // You could send this to your chat service or display it in the UI
        break;
      case 'form_submit':
        console.log('User submitted form in iframe:', message.formData);
        break;
      case 'navigation':
        console.log('User navigated in iframe:', message.newUrl);
        break;
      case 'error':
        console.log('Error occurred in iframe:', message.error);
        break;
      default:
        console.log('Unknown iframe interaction:', message);
    }
  }, []);

  return {
    iframeUrl,
    showIframe,
    iframeError,
    openIframe,
    closeIframe,
    setIframeError,
    onIframeError,
    onIframeLoad,
    onIframeMessage,
  };
}; 