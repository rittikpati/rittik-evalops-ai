"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      leftElement,
      rightElement,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <div className="relative">
          {leftElement && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              {leftElement}
            </div>
          )}
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-xl bg-[#1A1A1E] border px-4 py-3 text-sm text-[#F5F1EB] placeholder:text-stone-500
              transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]/20 focus-visible:border-[#C8A96E]
              disabled:opacity-50 disabled:pointer-events-none
              ${leftIcon || leftElement ? "pl-10" : ""}
              ${rightIcon || rightElement ? "pr-10" : ""}
              ${error ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20 bg-red-500/5" : "border-[#2A2A28] hover:border-[#3A3A38]"}
              ${className}
            `}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400">
              {rightElement}
            </div>
          )}
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-2 text-sm text-danger-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-2 text-sm text-stone-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";