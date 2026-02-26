import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
} from "@assistant-ui/react";
import { useEffect, useState, type FC } from "react";
import {
  ArrowDownIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { MarkdownText } from "./markdown-text";
import { ComposerAddAttachment, ComposerAttachments, UserMessageAttachments } from "./attachment";
import { keepInputFocused } from "@/app/utils/deviceDetection";

export const Thread: FC = ({ defaultTitle, disclaimer, colors, config, suggestedMessages, onNew, messages, setStateData }) => {

  return (
    <ThreadPrimitive.Root
      className="bg-background box-border flex h-full flex-col overflow-hidden "
    >
      <ThreadHeader defaultTitle={defaultTitle} config={config} />
      <ThreadPrimitive.Viewport className="flex h-full flex-col items-center overflow-y-scroll scroll-smooth bg-inherit px-1 sm:px-4 pt-1 sm:pt-4">
        <ThreadWelcome
          defaultTitle={defaultTitle}
          disclaimer={disclaimer}
        />

        <ThreadPrimitive.Messages
          components={{
            UserMessage: (props) => <UserMessage {...props} colors={colors} />,
            EditComposer: () => <EditComposer config={config} />,
            AssistantMessage: (props) => <AssistantMessage {...props} config={config} />,
          }}
        />

        <ThreadPrimitive.If empty={false}>
          <div className="min-h-8 flex-grow" />
        </ThreadPrimitive.If>
        {suggestedMessages?.buttons?.length > 0 && (
      <div className="flex flex-col w-full items-center justify-center mb-6 ">
          <ThreadWelcomeSuggestions  suggestedMessages={suggestedMessages} config={config} onNew={onNew} messages={messages} setStateData={setStateData} />
        </div>
      )}
        <div className="sticky bottom-0 mt-3 flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-end rounded-t-lg bg-inherit pb-4">
          <ThreadScrollToBottom />
          <Composer config={config} suggestedMessages={suggestedMessages}/>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadHeader: FC = ({ defaultTitle, config }) => {
  const logoSrc =  config?.app?.lightLogo;
  const topBarColor = config?.chat?.topBarColor;
  
  return (
    <div 
      ref={(el) => {
        if (el && topBarColor) {
          // Set background color with important flag to override CSS classes
          el.style.setProperty('background-color', topBarColor, 'important');
        }
      }}
      className="flex p-4 border-b-1 border-blue-500 text-white"
      style={{
        backgroundColor: topBarColor || undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center">
        <Image
          src={logoSrc}
          alt="Jazee.ai"
          width={120}
          height={40}
        />
        </div>
      </div>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = ({  defaultTitle, disclaimer }) => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="flex w-full flex-grow flex-col items-center justify-center">
          <p className="mt-4 font-medium">{defaultTitle}</p>
        </div>
        <ThreadWelcomeSuggestions  />
      </div>
    </ThreadPrimitive.Empty>
  );
};

const ThreadWelcomeSuggestions: FC = ({
  suggestedMessages,
  config,
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
    onNew({
      content: [{ type: "text", text: message.message }],
      attachments: [],
      metadata: { keyword: message.keyword || message.label },
      createdAt: new Date(),
      role: "user",
    });

    // Keep input focused to maintain keyboard open after sending suggestion
    keepInputFocused();
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

  const isVertical = suggestedMessages?.buttons?.length > 1;

  return (
    <div
      className={`flex w-full justify-center gap-2 md:gap-4 ${
        isVertical ? "flex-col" : "flex-row"
      }`}
    >
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
      onClick={(e) => handleSuggestionClick(message, e)}
      className="flex h-10 md:h-14 flex-1 items-center justify-center rounded-xl md:rounded-[2rem] border border-[#e2e8f0] dark:border-zinc-700 p-2 md:p-3
                 text-center text-xs md:text-sm font-semibold transition-colors ease-in"
      onMouseEnter={(e) => {
        e.currentTarget.style.setProperty('background-color', hoverColor, 'important');
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.setProperty('background-color', backgroundColor, 'important');
      }}
    >
      <span className="text-center leading-tight px-1">{message.label}</span>
    </button>
  ))}
    </div>
  );
};



const Composer: FC = ({ config,suggestedMessages }) => {
  return (
    <ComposerPrimitive.Root className="focus-within:border-ring/20 flex w-full flex-wrap items-end rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in">
      <ComposerAttachments />
      <ComposerAddAttachment config={config}/>
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder={config.app.name || "..."}
        className="placeholder:text-muted-foreground max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0"
      />
      <ComposerAction config={config} suggestedMessages={suggestedMessages}/>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = ({config, suggestedMessages}) => {
  // Disable send button when suggestions are displayed
  const hasActiveButtons = suggestedMessages?.buttons?.length > 0;
  const isDisabled = hasActiveButtons || suggestedMessages?.disable_regular_message;
  
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
            tooltipColor={config?.widget?.bgColor}
            ref={(el) => {
              if (el) {
                // Set background color with important flag to override CSS classes
                el.style.setProperty('background-color', sendButtonColor, 'important');
              }
            }}
            className="my-2.5 size-8 p-2 transition-opacity ease-in text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseEnter={(e) => {
              e.currentTarget.style.setProperty('background-color', hoverColor, 'important');
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.setProperty('background-color', sendButtonColor, 'important');
            }}
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

const UserMessage: FC = ({colors}) => {
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
      {/* <UserActionBar /> */}
      <UserMessageAttachments />
      <div
        ref={(el) => {
          if (el) {
            // Set styles with important flag to override any CSS classes
            el.style.setProperty('background-color', backgroundColor, 'important');
            el.style.setProperty('color', textColor, 'important');
          }
        }}
        className="max-w-[calc(var(--thread-max-width)*0.8)] break-words rounded-3xl px-5 py-2.5 col-start-2 row-start-2">
        <MessagePrimitive.Content />
      
        <AssistantActionBar timestamp={timestamp} type="user" />
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end col-start-1 row-start-2 mr-3 mt-2.5"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = ({ config }: { config?: any }) => {
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
    <ComposerPrimitive.Root className="bg-muted my-4 flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 rounded-xl">
      <ComposerPrimitive.Input className="text-foreground flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button variant="ghost">Cancel</Button>
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

const AssistantMessage: FC = ({config}) => {
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
  : new Date(content.created_at).toLocaleString([], {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <MessagePrimitive.Root className="grid grid-cols-[auto_auto_1fr] grid-rows-[auto_1fr] relative w-full max-w-[var(--thread-max-width)] py-4">
      <div className="text-[#1e293b] dark:text-zinc-200 max-w-[calc(var(--thread-max-width)*0.8)] break-words leading-7 col-span-2 col-start-2 row-start-1 my-1.5 bg-white dark:bg-zinc-800 rounded-2xl px-5 py-2.5 border border-[#e2e8f0] dark:border-zinc-700 shadow-sm">
        <MessagePrimitive.Content components={{ Text: MarkdownText }} />
        <MessageError />
        <AssistantActionBar timestamp={timestamp} type="assistant" /> 
      </div>

      {/* Assistant Avatar - positioned at bottom left */}
      {/* Avatar comes from: chat.colors.assistantMessage.avatar */}
      {/* Background comes from: chat.assistantAvatarColor */}
      {/* Show avatar based on: chat.showBotAvatar */}
      {config?.chat?.showBotAvatar !== false && (
        <div className="flex items-end justify-center col-start-1 row-start-1 mr-1 mb-1">
        <div 
          ref={(el) => {
            if (el) {
              // Set background color with important flag to override CSS classes
              const backgroundColor = config?.chat?.assistantAvatarColor ?? "#1e3a8a";
              el.style.setProperty('background-color', backgroundColor, 'important');
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

      {/* <AssistantActionBar /> */}

      <BranchPicker className="col-start-2 row-start-2 -ml-2 mr-2" />
    </MessagePrimitive.Root>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="border-destructive bg-destructive/10 dark:text-red-200 dark:bg-destructive/5 text-destructive mt-2 rounded-md border p-3 text-sm">
        <ErrorPrimitive.Message className="line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

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
        "text-muted-foreground inline-flex items-center text-xs",
        className
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
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
