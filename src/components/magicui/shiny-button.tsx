import React from "react";
import { motion, HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

interface ShinyButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary";
}

export const ShinyButton: React.FC<ShinyButtonProps> = ({
  children,
  className,
  variant = "primary",
  ...props
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative rounded-full px-6 py-2.5 font-bold text-xs backdrop-blur-xl transition-all duration-300 ease-in-out cursor-pointer",
        variant === "primary"
          ? "bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 shadow-md shadow-amber-400/20 border border-amber-300"
          : "bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 shadow-xs",
        "overflow-hidden select-none",
        className
      )}
      {...props}
    >
      {/* Shimmer sweep effect */}
      <span
        className="pointer-events-none absolute inset-0 block h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent"
        style={{
          backgroundSize: "200% 100%",
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
};
