"use client";

import { FC } from "react";
import { Loader2 } from "lucide-react";

interface WebSocketLoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export const WebSocketLoadingOverlay: FC<WebSocketLoadingOverlayProps> = ({
  isVisible,
  message = "Connecting...",
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      style={{
        pointerEvents: "all",
        userSelect: "none",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white/95 dark:bg-zinc-900/95 p-8 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>
    </div>
  );
};

