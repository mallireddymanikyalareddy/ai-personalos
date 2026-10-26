"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

export const TODAY_PAGE_SIZE = 5;

export function usePagedRows<T>(rows: readonly T[], pageSize = TODAY_PAGE_SIZE) {
  const [page, setPage] = React.useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);

  React.useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [page, totalPages]);

  return {
    page: currentPage,
    setPage,
    totalPages,
    rows: rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
  };
}

export function PagerDots({
  page,
  totalPages,
  onPage,
  label,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label={`${label} pages`} className="mt-3 flex items-center justify-center gap-1.5">
      {Array.from({ length: totalPages }, (_, index) => {
        const active = index === page;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Show ${label} page ${index + 1}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onPage(index)}
            className="group grid h-5 place-items-center px-0.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                active ? "w-5 bg-accent" : "w-1.5 bg-line-strong group-hover:bg-ink-3",
              )}
            />
          </button>
        );
      })}
      <span className="sr-only">
        Page {page + 1} of {totalPages}
      </span>
    </nav>
  );
}
