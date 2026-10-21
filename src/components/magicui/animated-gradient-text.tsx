import React from "react";
import { cn } from "../../lib/utils";

interface AnimatedGradientTextProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const AnimatedGradientText: React.FC<AnimatedGradientTextProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "group relative flex flex-row items-center justify-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold backdrop-blur-sm border border-amber-300/40 shadow-xs [--bg-size:300%]",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "inline animate-gradient bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-700 bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent font-bold"
        )}
      >
        {children}
      </span>
    </div>
  );
};
