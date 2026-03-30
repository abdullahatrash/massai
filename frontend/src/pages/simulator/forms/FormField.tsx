import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
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
    <div
      className={cn(
        "grid gap-1.5",
        layout === "wide" ? "md:col-span-2" : null,
        className,
      )}
    >
      <Label className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </Label>
      {children}
      {error ? <p className="text-[0.68rem] text-rose-400">{error}</p> : null}
    </div>
  );
}

export function FormFieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-[0.68rem] text-rose-400">{message}</p>;
}
