"use client";

import { ComponentPropsWithoutRef, forwardRef } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TooltipIconButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  ({ tooltip, side, children, ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
{/* 
      <TooltipTrigger asChild>
      <Button ref={ref} {...props}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side={side}>{tooltip}</TooltipContent> */}
    </Tooltip>
  )
);

TooltipIconButton.displayName = "TooltipIconButton";
