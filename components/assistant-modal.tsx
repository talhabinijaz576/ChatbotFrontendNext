"use client";

import { BotIcon, ChevronDownIcon } from "lucide-react";

import { type FC, forwardRef, useEffect, useRef, useState } from "react";
import { AssistantModalPrimitive } from "@assistant-ui/react";

import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Thread } from "./thread";
import { TooltipProvider } from "./ui/tooltip";
import Image from "next/image";

export const AssistantModal: FC = ({
  config,
  suggestedMessages,
  onNew,
  messages,
  setStateData,
}) => {
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
        className="fixed bottom-4 right-4 sm:bottom-4 sm:right-4 size-11"
        id="assistant-modal-anchor"
        ref={parentRef}
      >
        <AssistantModalPrimitive.Trigger asChild>
          <AssistantModalButton config={config}/>
        </AssistantModalPrimitive.Trigger>
      </AssistantModalPrimitive.Anchor>
      <AssistantModalPrimitive.Content
        sideOffset={8}
        className="
         bg-popover text-popover-foreground z-50
          overflow-clip rounded-xl border-2 border-blue-500 p-0 shadow-md outline-none
          w-[90vw] h-[75vh]          /* default for small devices */
          sm:w-[450px] sm:h-[500px]  /* small tablets */
          md:w-[500px] md:h-[550px]  /* tablets/laptops */
          lg:w-[550px] lg:h-[65vh]   /* large screens */
          xl:w-[600px] xl:h-[70vh]   /* very large monitors */
      "
      >
        <Thread
          defaultTitle={config?.app.title || "Mem0 Assistant"}
          disclaimer={config?.app.disclaimer}
          colors={config?.chat?.colors}
          config={config}
          suggestedMessages={suggestedMessages}
          onNew={onNew}
          messages={messages}
          setStateData={setStateData}
        />
      </AssistantModalPrimitive.Content>
    </AssistantModalPrimitive.Root>
  );
};

type AssistantModalButtonProps = { "data-state"?: "open" | "closed" };

const AssistantModalButton = forwardRef<
  HTMLButtonElement,
  AssistantModalButtonProps
>(({ config, "data-state": state, ...rest}, ref) => {
  const tooltip = state === "open" ?  config?.widget?.close : config?.widget?.open;

  return (
    <TooltipProvider>
      <TooltipIconButton
        variant="default"
        tooltip={tooltip}
        side="left"
        tooltipColor={config?.widget?.bgColor}
        {...rest}
        className={`size-full rounded-full bg-[${config?.widget?.bgColor}] shadow transition-transform hover:scale-110 active:scale-90 hover:bg-[${config?.widget?.hoverColor}]`} 
        ref={ref}
      >
         {state !== "open" && <Image
          src={config?.widget?.icon ?? ""}
          alt="Assistant Avatar"
          width={40}
          height={40}
          className="absolute size-6 transition-all data-[state=closed]:rotate-0 data-[state=open]:rotate-90 data-[state=closed]:scale-100 data-[state=open]:scale-0 invert brightness-0 saturate-0 contrast-200"
        />}
        {/* <BotIcon
          data-state={state}
          className="absolute size-6 transition-all data-[state=closed]:rotate-0 data-[state=open]:rotate-90 data-[state=closed]:scale-100 data-[state=open]:scale-0"
        /> */}

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
