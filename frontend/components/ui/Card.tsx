"use client";

import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { motion } from "motion/react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "hover" | "elevated" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", padding = "md", children, className = "", style, ...props }, ref) => {
    const variantStyles = {
      default: "rounded-xl bg-[#19191D] border border-[#232326] overflow-hidden",
      hover: "rounded-xl bg-[#19191D] border border-[#232326] overflow-hidden hover:border-[#2E2E32] hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
      elevated: "rounded-xl bg-[#19191D] border border-[#232326] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] hover:border-[#2E2E32]",
      glass: "rounded-xl bg-[#19191D]/80 backdrop-blur-xl border border-[#232326]/80 overflow-hidden",
    };

    const paddingStyles = {
      none: "",
      sm: "p-5",
      md: "p-6",
      lg: "p-7",
    };

    return (
      <div
        ref={ref}
        className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className} transition-[border-color_200ms_ease,box-shadow_200ms_ease]`}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = "", children, ...props }, ref) => (
    <div ref={ref} className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  )
);

CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className = "", children, ...props }, ref) => (
    <h3 ref={ref} className={`font-serif text-[18px] font-medium tracking-tight text-[#F5F1EB] leading-tight ${className}`} {...props}>
      {children}
    </h3>
  )
);

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = "", children, ...props }, ref) => (
    <p ref={ref} className={`mt-1.5 text-sm leading-relaxed text-stone-400 ${className}`} {...props}>
      {children}
    </p>
  )
);

CardDescription.displayName = "CardDescription";

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = "", children, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
);

CardContent.displayName = "CardContent";

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = "", children, ...props }, ref) => (
    <div ref={ref} className={`mt-4 pt-4 border-t border-stone-200 flex items-center ${className}`} {...props}>
      {children}
    </div>
  )
);

CardFooter.displayName = "CardFooter";