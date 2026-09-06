"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, rows = 4, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = `${textareaId}-error`;
    const hintId = `${textareaId}-hint`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={`
            w-full rounded-xl bg-[#1A1A1E] border px-4 py-3 text-sm text-[#F5F1EB] placeholder:text-stone-500
            transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]/20 focus-visible:border-[#C8A96E]
            disabled:opacity-50 disabled:pointer-events-none
            ${error ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20 bg-red-500/5" : "border-[#2A2A28] hover:border-[#3A3A38]"}
            ${className}
          `}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          {...props}
        />
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

Textarea.displayName = "Textarea";