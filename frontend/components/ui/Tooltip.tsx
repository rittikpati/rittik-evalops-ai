"use client";

import { useState, useRef, useEffect, type ReactNode, type HTMLAttributes } from "react";
import { motion, AnimatePresence } from "motion/react";

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  offset?: number;
  delay?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = "top",
  offset = 8,
  delay = 200,
  className = "",
  ...props
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const positionStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowStyles = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-white/10",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-white/10",
    left: "left-full top-1/2 -translate-y-1/2 border-l-white/10",
    right: "right-full top-1/2 -translate-y-1/2 border-r-white/10",
  };

  return (
    <div
      ref={tooltipRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      {...props}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`
              absolute z-50 px-3 py-2 text-xs font-medium text-stone-900
              rounded-lg glass-strong border border-stone-200 shadow-glass-strong
              whitespace-nowrap pointer-events-none
              ${positionStyles[position]}
            `}
            initial={{ opacity: 0, scale: 0.9, y: position === "top" ? 4 : position === "bottom" ? -4 : 0, x: position === "left" ? 4 : position === "right" ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="tooltip"
          >
            {content}
            <div
              className={`
                absolute w-0 h-0 border-4 border-transparent
                ${arrowStyles[position]}
              `}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}