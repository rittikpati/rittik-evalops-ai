"use client";

import { useState, type ReactNode, type HTMLAttributes } from "react";
import { motion } from "motion/react";

export interface TabItem {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  variant?: "line" | "pills" | "enclosed";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function Tabs({
  tabs,
  defaultValue,
  value,
  onChange,
  variant = "line",
  orientation = "horizontal",
  className = "",
  children,
  ...props
}: TabsProps) {
  const [activeValue, setActiveValue] = useState(value || defaultValue || tabs[0]?.value || "");
  const isControlled = value !== undefined;

  const handleTabClick = (tabValue: string) => {
    const tab = tabs.find((t) => t.value === tabValue);
    if (tab?.disabled) return;

    const newValue = tabValue;
    if (!isControlled) {
      setActiveValue(newValue);
    }
    onChange?.(newValue);
  };

  const variantStyles = {
    line: {
      container: "border-b border-[#1A1A1E]",
      tab: (isActive: boolean) =>
        `relative px-4 py-3 text-sm font-[450] tracking-[-0.01em] transition-colors duration-200 ${
          isActive
            ? "text-[#F5F1EB]"
            : "text-stone-400 hover:text-[#F5F1EB]"
        }`,
      indicator: (index: number) =>
        `absolute bottom-0 left-0 h-0.5 rounded-full bg-[#C8A96E] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`,
      tabWrapper: "relative",
    },
    pills: {
      container: "bg-[#1A1A1E] rounded-xl p-1 border border-[#2A2A28]",
      tab: (isActive: boolean) =>
        `px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
          isActive
            ? "bg-[#C8A96E] text-[#0F0F0F] shadow-sm font-medium"
            : "text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.04]"
        }`,
      indicator: () => "hidden",
      tabWrapper: "",
    },
    enclosed: {
      container: "bg-[#1A1A1E] rounded-xl border border-[#2A2A28]",
      tab: (isActive: boolean) =>
        `flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-200 ${
          isActive
            ? "bg-[#C8A96E] text-[#0F0F0F] shadow-sm"
            : "text-stone-400 hover:text-[#F5F1EB] hover:bg-white/[0.04]"
        }`,
      indicator: () => "hidden",
      tabWrapper: "flex-1",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={className} {...props}>
      <div
        className={`
          flex ${orientation === "vertical" ? "flex-col" : ""} gap-1
          ${styles.container}
        `}
        role="tablist"
        aria-orientation={orientation}
      >
        {tabs.map((tab, index) => {
          const isActive = activeValue === tab.value;
          return (
            <motion.button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.value}`}
              id={`tab-${tab.value}`}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.value)}
              className={`
                flex items-center gap-2 ${styles.tabWrapper} ${styles.tab(isActive)}
                ${tab.disabled ? "opacity-50 pointer-events-none" : ""}
              `}
              initial={{ opacity: 0, y: orientation === "vertical" ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {tab.icon && <span className="h-4 w-4" aria-hidden="true">{tab.icon}</span>}
              {tab.label}
              {tab.badge && (
                <span className="px-1.5 py-0.5 text-xs bg-stone-100 text-stone-500 rounded-full">
                  {tab.badge}
                </span>
              )}
            </motion.button>
          );
        })}
        {variant === "line" && (
          <motion.div
            className={styles.indicator(0)}
            style={{
              width: `${100 / tabs.length}%`,
              transform: `translateX(${tabs.findIndex((t) => t.value === activeValue) * (100 / tabs.length)}%)`,
            }}
            animate={{
              width: `${100 / tabs.filter((t) => !t.disabled).length}%`,
              transform: `translateX(${tabs.findIndex((t) => t.value === activeValue) * (100 / tabs.filter((t) => !t.disabled).length)}%)`,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-4" role="tabpanel">
        {tabs.map((tab) => (
          <motion.div
            key={tab.value}
            role="tabpanel"
            id={`panel-${tab.value}`}
            aria-labelledby={`tab-${tab.value}`}
            hidden={activeValue !== tab.value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeValue === tab.value && children}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

type MotionConflictKeys = "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationCancel" | "onAnimationIteration" | "onScroll";

export interface TabPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, MotionConflictKeys> {
  value: string;
  activeValue: string;
  children: ReactNode;
}

export function TabPanel({ value, activeValue, children, ...props }: TabPanelProps) {
  if (activeValue !== value) return null;

  return (
    <motion.div
      {...props}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {children}
    </motion.div>
  );
}