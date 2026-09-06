"use client";

import { useState, useRef, useEffect, type ReactNode, type HTMLAttributes } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronDown } from "lucide-react";
import { Button, type ButtonProps } from "./Button";
import { Avatar } from "./Avatar";

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
  dividerAfter?: boolean;
}

export interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
  trigger: ReactNode | ((state: { isOpen: boolean; onClick: () => void }) => ReactNode);
  items: DropdownItem[];
  align?: "left" | "right";
  offset?: number;
}

export function Dropdown({ trigger, items, align = "right", offset = 4, className = "", ...props }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`} {...props}>
      <div onClick={() => setIsOpen(!isOpen)} onKeyDown={handleKeyDown}>
        {typeof trigger === "function" ? trigger({ isOpen, onClick: () => setIsOpen(!isOpen) }) : trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`absolute z-50 mt-${offset} min-w-[180px] rounded-xl glass-strong border border-stone-200 shadow-glass-strong overflow-hidden`}
            style={{ [align]: 0 }}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="menu"
          >
            {items.map((item, index) => (
              <motion.button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                disabled={item.disabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 text-sm text-stone-600
                  transition-smooth
                  hover:bg-stone-100 hover:text-stone-900
                  disabled:opacity-50 disabled:pointer-events-none
                  ${item.danger ? "text-danger-400 hover:bg-danger-500/10" : ""}
                `}
                role="menuitem"
                tabIndex={-1}
                style={{ transitionDelay: `${index * 0.02}s` }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                {item.icon && <span className="flex h-4 w-4 shrink-0" aria-hidden="true">{item.icon}</span>}
                <span className="flex-1 text-left">{item.label}</span>
                {item.shortcut && (
                  <kbd className="px-1.5 py-0.5 text-xs text-stone-400 bg-stone-50 rounded" aria-hidden="true">
                    {item.shortcut}
                  </kbd>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface DropdownTriggerProps extends ButtonProps {
  children: ReactNode;
  "aria-label"?: string;
}

export function DropdownTrigger({ children, "aria-label": ariaLabel, ...props }: DropdownTriggerProps) {
  return (
    <Button
      variant="ghost"
      rightIcon={<ChevronDown className="h-4 w-4" aria-hidden="true" />}
      aria-haspopup="menu"
      aria-expanded={false}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </Button>
  );
}

export interface UserMenuProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onSignOut: () => void;
}

export function UserMenu({ user, onProfileClick, onSettingsClick, onSignOut }: UserMenuProps) {
  return (
    <Dropdown
      trigger={
        <button
          type="button"
          className="group flex items-center gap-2.5 rounded-full border border-[#3A3A38] bg-[#1A1A1E] pl-1.5 pr-3 h-11 hover:border-[#C8A96E]/60 hover:bg-[#232326] hover:shadow-[0_0_0_3px_rgba(200,169,110,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E] transition-all duration-200 cursor-pointer"
          aria-label="User menu"
        >
          <Avatar src={user.avatar} name={user.name} size="sm" status="online" className="ring-2 ring-[#C8A96E]/35" />
          <span className="hidden sm:block max-w-[160px] truncate text-sm font-medium text-[#F5F1EB]">{user.name}</span>
          <ChevronDown className="h-4 w-4 text-[#C8A96E] transition-transform duration-200 group-hover:translate-y-0.5" aria-hidden="true" />
        </button>
      }
      items={[
        { label: "Profile", onClick: onProfileClick, icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
        { label: "Settings", onClick: onSettingsClick, icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        { dividerAfter: true, label: "", onClick: () => {}, disabled: true },
        { label: "Sign out", onClick: onSignOut, icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>, danger: true },
      ]}
      align="right"
    />
  );
}