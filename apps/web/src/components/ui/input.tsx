import * as React from "react";

import { cn } from "@/lib/cn";

const fieldClasses =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 " +
  "transition-colors duration-150 hover:border-line-strong " +
  "focus:border-accent focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent/20 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldClasses, "h-9", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldClasses, "min-h-20 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export function FieldLabel({
  className,
  children,
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-xs font-medium text-ink-3", className)}
    >
      {children}
    </label>
  );
}
