"use client";

import darkLogo from "@/app/images/dark.svg";
import lightLogo from "@/app/images/light.svg";
import React from "react";
import Image from "next/image";

export default function ThemeAwareLogo({
  width = 120,
  height = 30,
  variant = "default",
  isDarkMode = false,
  config,
  useLogo2 = false,
}: {
  width?: number;
  height?: number;
  variant?: "default" | "collapsed";
  isDarkMode?: boolean;
  config?: {
    app: {
      lightLogo: string;
      darkLogo: string;
      lightLogo2?: string;
      darkLogo2?: string;
      logoPosition?: "left" | "right" | "center";
    };
  };
  useLogo2?: boolean;
}) {
  // For collapsed variant, always use the icon
  // if (variant === "collapsed") {
  //   return (
  //     <div
  //       className={`flex items-center justify-center rounded-full ${isDarkMode ? 'bg-[#6366f1]' : 'bg-[#4f46e5]'}`}
  //       style={{ width, height }}
  //     >
  //       <span className="text-white font-bold text-lg">M</span>
  //     </div>
  //   );
  // }

  // For default variant, use the full logo image
  // If useLogo2 is true, use the second logo set, otherwise use the first
  const logoSrc = useLogo2
    ? (isDarkMode ? config?.app?.darkLogo2 || darkLogo : config?.app?.lightLogo2 || lightLogo)
    : (isDarkMode ? config?.app?.darkLogo || darkLogo : config?.app?.lightLogo || lightLogo);

  return (
    <div className="flex h-full items-center py-1">
      <Image
        src={logoSrc}
        alt="Jazee.ai"
        width={width}
        height={height}
        className="h-full w-auto object-contain"
      />
    </div>
  );
}