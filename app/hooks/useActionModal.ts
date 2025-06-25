import { useState } from 'react';

interface UseActionModalReturn {
  showModal: boolean;
  modalUrl: string | null;
  iframeError: boolean;
  openModal: (url: string) => void;
  closeModal: () => void;
  handleIframeError: () => void;
  handleIframeLoad: () => void;
}

export const useActionModal = (): UseActionModalReturn => {
  const [showModal, setShowModal] = useState(false);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [iframeError, setIframeError] = useState(false);

  const openModal = (url: string) => {
    console.log('Opening modal with URL:', url);
    setModalUrl(url);
    setShowModal(true);
    setIframeError(false);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalUrl(null);
    setIframeError(false);
  };

  const handleIframeError = () => {
    console.log('Iframe failed to load due to X-Frame-Options');
    setIframeError(true);
  };

  const handleIframeLoad = () => {
    // Reset error state when iframe loads successfully
    setIframeError(false);
  };

  return {
    showModal,
    modalUrl,
    iframeError,
    openModal,
    closeModal,
    handleIframeError,
    handleIframeLoad,
  };
}; 