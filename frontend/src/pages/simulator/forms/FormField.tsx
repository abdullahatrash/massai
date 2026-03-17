import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormFieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
  label: ReactNode;
  layout?: "default" | "wide";
};

export function FormField({
  children,
  className,
  error,
  label,
  layout = "default",
}: FormFieldProps) {
  return (
    <label
      className={cn(
        "grid gap-2",
        layout === "wide" ? "md:col-span-2" : null,
        className,
      )}
    >
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      {children}
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </label>
  );
}

export function FormFieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <span className="text-xs text-rose-300">{message}</span>;
}
