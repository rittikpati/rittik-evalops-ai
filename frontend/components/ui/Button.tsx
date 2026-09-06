"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion } from "motion/react";

type MotionConflictKeys = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationCancel" | "onAnimationIteration" | "onScroll";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, MotionConflictKeys> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 rounded-xl font-[550] tracking-[-0.01em] leading-none transition-[all_220ms_cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

    const variantStyles = {
      primary: "bg-[#C8A96E] text-[#0F0F0F] hover:bg-[#B89A5F] active:bg-[#A67C52] border border-[#C8A96E] shadow-[0_2px_8px_rgba(200,169,110,0.2)] hover:shadow-[0_6px_20px_rgba(200,169,110,0.25)] hover:-translate-y-[1px] active:translate-y-0 font-semibold",
      secondary: "bg-[#1A1A1E] text-[#F5F1EB] hover:bg-[#232326] hover:border-[#3A3A38] border border-[#2A2A28] active:bg-[#262624] shadow-sm hover:shadow",
      ghost: "bg-transparent text-stone-400 hover:bg-white/[0.06] hover:text-[#F5F1EB] active:bg-white/[0.08] border border-transparent",
      outline: "border border-[#2A2A28] bg-transparent text-[#F5F1EB] hover:bg-[#1A1A1E] hover:border-[#3A3A38] active:bg-[#262624]",
      danger: "bg-[#dc2626] text-white hover:bg-[#b91c1c] active:bg-[#991b1b] shadow-sm font-medium",
      accent: "bg-[#C8A96E] text-[#0F0F0F] hover:bg-[#B89A5F] active:bg-[#A67C52] font-semibold border border-[#C8A96E]",
    };

    const sizeStyles = {
      sm: "px-3 py-2 text-xs",
      md: "px-5 py-3 text-sm",
      lg: "px-6 py-4 text-base",
      icon: "p-2",
    };

    const widthStyles = fullWidth ? "w-full" : "";

    return (
      <motion.button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`}
        style={style}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        {...props}
      >
        {isLoading ? (
          <motion.svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </motion.svg>
        ) : leftIcon ? (
          <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>
        ) : null}
        <span className={isLoading ? "opacity-0" : ""}>{children}</span>
        {!isLoading && rightIcon && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
      </motion.button>
    );
  }
);

Button.displayName = "Button";