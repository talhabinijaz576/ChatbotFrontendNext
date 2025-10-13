"use client";

import { BotIcon, ChevronDownIcon } from "lucide-react";

import { type FC, forwardRef, useEffect, useRef, useState } from "react";
import { AssistantModalPrimitive } from "@assistant-ui/react";

import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Thread } from "./thread";
import { TooltipProvider } from "./ui/tooltip";

export const AssistantModal: FC = ({ config }) => {
  const [open, setOpen] = useState(config?.chat.isWidgetOpen);
  const parentRef = useRef(null);
  useEffect(() => {
    setOpen(config?.chat.isWidgetOpen);
  }, [config?.chat.isWidgetOpen]);

  function onOpenChange(value) {
    setOpen(value);

    if (value) {
      window.parent.postMessage("widget:open", "*");
    } else {
      window.parent.postMessage("widget:close", "*");
    }
  }

  useEffect(() => {
    const handleMessage = (event: any) => {
      const { type } = event.data;

      switch (type) {
        case "OPEN_MODAL":
          setOpen(true);
          window.parent.postMessage("widget:open", "*");
          break;

        case "CLOSE_MODAL":
          setOpen(false);
          window.parent.postMessage("widget:close", "*");
          break;

        default:
          console.warn("Unknown message:", event.data);
      }
    };

    window.addEventListener("message", handleMessage);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <AssistantModalPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AssistantModalPrimitive.Anchor
        className="fixed bottom-4 right-4 size-11"
        id="assistant-modal-anchor"
        ref={parentRef}
      >
        <AssistantModalPrimitive.Trigger asChild>
          <AssistantModalButton />
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        sideOffset={16}
        className="bg-popover text-popover-foreground z-50 h-[500px] w-[400px] overflow-clip rounded-xl border p-0 shadow-md outline-none [&>.aui-thread-root]:bg-inherit data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out data-[state=open]:zoom-in data-[state=open]:slide-in-from-bottom-1/2 data-[state=open]:slide-in-from-right-1/2 data-[state=closed]:slide-out-to-bottom-1/2 data-[state=closed]:slide-out-to-right-1/2"
      >
        <Thread
          defaultTitle={config?.app.title || "Mem0 Assistant"}
          disclaimer={config?.app.disclaimer}
          colors={config?.chat?.colors}
          config={config}
        />
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
};

type AssistantModalButtonProps = { "data-state"?: "open" | "closed" };

const AssistantModalButton = forwardRef<
  HTMLButtonElement,
  AssistantModalButtonProps
>(({ "data-state": state, ...rest }, ref) => {
  const tooltip = state === "open" ? "Close Assistant" : "Open Assistant";

  return (
    <TooltipProvider>
      <TooltipIconButton
        variant="default"
        tooltip={tooltip}
        side="left"
        {...rest}
        className="size-full rounded-full shadow transition-transform hover:scale-110 active:scale-90"
        ref={ref}
      >
        <BotIcon
          data-state={state}
          className="absolute size-6 transition-all data-[state=closed]:rotate-0 data-[state=open]:rotate-90 data-[state=closed]:scale-100 data-[state=open]:scale-0"
        />

        <ChevronDownIcon
          data-state={state}
          className="absolute size-6 transition-all data-[state=closed]:-rotate-90 data-[state=open]:rotate-0 data-[state=closed]:scale-0 data-[state=open]:scale-100"
        />
        {/* <span className="aui-sr-only">{tooltip}</span> */}
      </TooltipIconButton>
    </TooltipProvider>
  );
});

AssistantModalButton.displayName = "AssistantModalButton";
