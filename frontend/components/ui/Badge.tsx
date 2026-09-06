"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { motion } from "motion/react";

type MotionConflictKeys = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationCancel" | "onAnimationIteration" | "onScroll";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, MotionConflictKeys> {
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "accent";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "neutral", size = "md", dot = false, className = "", children, ...props }, ref) => {
    const variantStyles = {
      success: "bg-success-500/20 text-success-400 border border-success-500/30",
      warning: "bg-warning-500/20 text-warning-400 border border-warning-500/30",
      danger: "bg-danger-500/20 text-danger-400 border border-danger-500/30",
      info: "bg-brand-500/20 text-brand-400 border border-brand-500/30",
      neutral: "bg-stone-100 text-stone-600 border border-stone-200",
      brand: "bg-gradient-to-r from-brand-500/20 to-brand-600/20 text-brand-300 border border-brand-500/30",
      accent: "bg-gradient-to-r from-accent-500/20 to-accent-600/20 text-accent-300 border border-accent-500/30",
    };

    const sizeStyles = {
      sm: "px-2 py-0.5 text-xs gap-1",
      md: "px-2.5 py-1 text-xs gap-1.5",
      lg: "px-3 py-1.5 text-sm gap-2",
    };

    const dotColors = {
      success: "bg-success-500",
      warning: "bg-warning-500",
      danger: "bg-danger-500",
      info: "bg-brand-500",
      neutral: "bg-white/40",
      brand: "bg-brand-500",
      accent: "bg-accent-500",
    };

    return (
      <motion.span
        ref={ref}
        className={`inline-flex items-center rounded-full font-medium border transition-smooth ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        {...props}
      >
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} aria-hidden="true" />}
        {children}
      </motion.span>
    );
  }
);

Badge.displayName = "Badge";