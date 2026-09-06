"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { motion } from "motion/react";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "danger" | "brand" | "accent";
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  striped?: boolean;
}

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

const variantClasses = {
  default: "bg-gradient-to-r from-brand-500 to-brand-600",
  success: "bg-gradient-to-r from-success-500 to-success-600",
  warning: "bg-gradient-to-r from-warning-500 to-warning-600",
  danger: "bg-gradient-to-r from-danger-500 to-danger-600",
  brand: "bg-gradient-to-r from-brand-500 via-brand-600 to-purple-600",
  accent: "bg-gradient-to-r from-accent-500 to-accent-600",
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      size = "md",
      variant = "default",
      showLabel = false,
      label,
      animated = true,
      striped = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div ref={ref} className={`w-full ${className}`} {...props}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-stone-600">
            {label || (showLabel ? `${Math.round(percentage)}%` : "")}
          </span>
          {showLabel && label && (
            <span className="text-xs text-stone-500 font-mono">{Math.round(percentage)}%</span>
          )}
        </div>
        <div
          className={`
            relative overflow-hidden rounded-full bg-stone-100
            ${sizeClasses[size]}
          `}
        >
          <motion.div
            className={`
              h-full rounded-full ${variantClasses[variant]}
              ${striped ? "bg-[length:20px_20px] animate-[stripe_1s_linear_infinite]" : ""}
            `}
            style={{ width: `${percentage}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 15, duration: 1 }}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-label={label}
          >
            {animated && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]"
                aria-hidden="true"
              />
            )}
          </motion.div>
        </div>
      </div>
    );
  }
);

Progress.displayName = "Progress";

export interface CircularProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: "default" | "success" | "warning" | "danger" | "brand" | "accent";
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

const circularVariantClasses = {
  default: "stroke-brand-500",
  success: "stroke-success-500",
  warning: "stroke-warning-500",
  danger: "stroke-danger-500",
  brand: "stroke-brand-500",
  accent: "stroke-accent-500",
};

export const CircularProgress = forwardRef<HTMLDivElement, CircularProgressProps>(
  (
    {
      value,
      max = 100,
      size = 48,
      strokeWidth = 4,
      variant = "default",
      showLabel = true,
      label,
      animated = true,
      className = "",
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div
        ref={ref}
        className={`relative inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            className="text-stone-200"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <motion.circle
            className={`transition-all duration-1000 ease-out ${circularVariantClasses[variant]}`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: animated ? offset : circumference,
            }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ type: "spring", stiffness: 100, damping: 15, duration: 1 }}
          />
        </svg>
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-foreground">
              {label ?? `${Math.round(percentage)}%`}
            </span>
          </div>
        )}
      </div>
    );
  }
);

CircularProgress.displayName = "CircularProgress";