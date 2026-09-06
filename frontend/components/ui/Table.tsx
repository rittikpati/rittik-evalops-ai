"use client";

import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { motion } from "motion/react";

export interface Column<T> {
  key: string;
  header: string | ReactNode;
  render?: (value: unknown, row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
  align?: "left" | "center" | "right";
  sortable?: boolean;
}

export interface TableProps<T> extends HTMLAttributes<HTMLTableElement> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  rowClassName?: (row: T, index: number) => string;
  emptyMessage?: string;
  striped?: boolean;
  hoverable?: boolean;
  loading?: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  rowClassName,
  emptyMessage = "No data available",
  striped = false,
  hoverable = true,
  loading = false,
  pagination,
  className = "",
  ...props
}: TableProps<T>) {
  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl bg-[#1A1A1E] border border-[#2A2A28]">
        <table className="w-full border-collapse" {...props}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3.5 text-left text-xs font-medium text-stone-400 uppercase tracking-widest border-b border-[#2A2A28] bg-[#0F0F0F] ${column.headerClassName || ""}`}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-4 border-b border-[#1A1A1E]">
                    <div className="h-3.5 w-3/4 bg-white/[0.04] rounded animate-shimmer" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1A1A1E] border border-[#2A2A28] p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-xl bg-[#0F0F0F] border border-[#2A2A28] flex items-center justify-center mb-3">
          <svg className="h-5 w-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
        </div>
        <p className="text-sm font-medium text-[#F5F1EB]">{emptyMessage}</p>
        <p className="text-xs text-stone-500 mt-1">Try adjusting filters or create a new entry.</p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl bg-[#1A1A1E] border border-[#2A2A28] ${className}`}>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse" {...props}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3.5 text-left text-xs font-medium text-stone-400 uppercase tracking-widest border-b border-[#2A2A28] bg-[#0F0F0F] ${column.headerClassName || ""}`}
                  style={{ width: column.width, textAlign: column.align }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row)}
                className={`${rowClassName ? rowClassName(row, rowIndex) : ""} ${hoverable ? "hover:bg-white/[0.03]" : ""} ${striped && rowIndex % 2 === 1 ? "bg-white/[0.02]" : ""} transition-colors duration-200`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-4 text-sm text-stone-300 border-b border-[#1A1A1E] last:border-0 ${column.className || ""}`}
                    style={{ textAlign: column.align }}
                  >
                    {column.render
                      ? column.render((row as Record<string, unknown>)[column.key], row, rowIndex)
                      : String((row as Record<string, unknown>)[column.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && (
        <div className="px-4 py-3 border-t border-stone-200 flex items-center justify-between">
          <div className="text-sm text-stone-500">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pagination.pageSize}
              onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
              className="input bg-stone-50 border-stone-200 text-sm py-2 px-3 w-auto"
              aria-label="Page size"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="btn ghost btn-sm"
              aria-label="Previous page"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm text-stone-500 px-2">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              className="btn ghost btn-sm"
              aria-label="Next page"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns = 5, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto rounded-2xl glass border border-stone-200">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[...Array(columns)].map((_, i) => (
              <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200 bg-stone-50">
                <div className="h-4 w-24 bg-stone-100 rounded animate-shimmer" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i} className="animate-pulse">
              {[...Array(columns)].map((_, j) => (
                <td key={j} className="px-4 py-3 border-b border-stone-200">
                  <div className="h-4 w-3/4 bg-stone-100 rounded animate-shimmer" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}