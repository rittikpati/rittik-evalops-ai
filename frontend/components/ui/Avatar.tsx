"use client";

import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { motion } from "motion/react";

type MotionConflictKeys = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationCancel" | "onAnimationIteration" | "onScroll";

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, MotionConflictKeys> {
  src?: string;
  alt?: string;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  shape?: "circle" | "square";
  status?: "online" | "offline" | "busy" | "away";
  statusPosition?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-2xl",
};

const statusSizeClasses = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
  "2xl": "h-5 w-5",
};

const statusColors = {
  online: "bg-success-500",
  offline: "bg-white/30",
  busy: "bg-danger-500",
  away: "bg-warning-500",
};

const statusPositions = {
  "bottom-right": "bottom-0 right-0",
  "bottom-left": "bottom-0 left-0",
  "top-right": "top-0 right-0",
  "top-left": "top-0 left-0",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name: string): string {
  const colors = [
    "from-brand-500 to-brand-600",
    "from-accent-500 to-accent-600",
    "from-success-500 to-success-600",
    "from-purple-500 to-purple-600",
    "from-pink-500 to-pink-600",
    "from-indigo-500 to-indigo-600",
    "from-cyan-500 to-cyan-600",
    "from-orange-500 to-orange-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = "md",
      shape = "circle",
      status,
      statusPosition = "bottom-right",
      className = "",
      ...props
    },
    ref
  ) => {
    const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";
    const sizeClass = sizeClasses[size];
    const hasStatus = status && status !== "offline";

    return (
      <motion.div
        ref={ref}
        className={`relative inline-flex shrink-0 ${shapeClass} overflow-hidden bg-gradient-to-br ${getColorFromName(name || src || "default")} ${sizeClass} ${className}`}
        whileHover={hasStatus ? { scale: 1.05 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || "Avatar"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-medium text-stone-900">
            {name ? getInitials(name) : "?"}
          </span>
        )}
        {hasStatus && (
          <motion.span
            className={`absolute rounded-full border-2 border-background ${statusSizeClasses[size]} ${statusColors[status]} ${statusPositions[statusPosition]}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
            aria-label={`Status: ${status}`}
          />
        )}
      </motion.div>
    );
  }
);

Avatar.displayName = "Avatar";

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number;
  overlap?: number;
  children: ReactNode;
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max = 5, overlap = -8, children, className = "", ...props }, ref) => {
    const childArray = Array.isArray(children) ? children : [children];
    const visibleChildren = childArray.slice(0, max);
    const remainingCount = childArray.length - max;

    return (
      <div ref={ref} className={`flex ${className}`} {...props}>
        {visibleChildren.map((child, index) => (
          <motion.div
            key={index}
            className="relative"
            style={{ zIndex: visibleChildren.length - index, marginLeft: index > 0 ? overlap : 0 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            {child}
          </motion.div>
        ))}
        {remainingCount > 0 && (
          <motion.div
            className={`relative flex items-center justify-center ${sizeClasses.md} ${shapeClasses.circle} bg-stone-50 border-2 border-background ml-${Math.abs(overlap)}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", delay: visibleChildren.length * 0.05 }}
          >
            +{remainingCount}
          </motion.div>
        )}
      </div>
    );
  }
);

const shapeClasses = {
  circle: "rounded-full",
  square: "rounded-xl",
};

AvatarGroup.displayName = "AvatarGroup";