import React, { useRef, useState, useCallback } from "react";
import { cn } from "../../lib/utils";

interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  isSelected?: boolean;
}

export const MagicCard: React.FC<MagicCardProps> = ({
  children,
  className,
  gradientSize = 220,
  gradientColor = "#FACC15",
  gradientOpacity = 0.22,
  isSelected = false,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState<number>(-500);
  const [mouseY, setMouseY] = useState<number>(-500);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
    setMouseY(e.clientY - rect.top);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMouseX(-500);
        setMouseY(-500);
      }}
      className={cn(
        "relative rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer",
        isSelected
          ? "border-amber-400 bg-amber-50/70 shadow-sm ring-2 ring-amber-400/40"
          : "border-zinc-200/90 bg-white hover:border-zinc-300 hover:shadow-sm",
        className
      )}
      {...props}
    >
      {/* Mouse Spotlight Background */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}${Math.round(
            gradientOpacity * 255
          )
            .toString(16)
            .padStart(2, "0")}, transparent 80%)`,
        }}
      />
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
};
