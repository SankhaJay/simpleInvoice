"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A lightweight, accessible disclosure used to keep optional invoice sections
 * (bank account, documents, custom fields) tucked away until the user wants
 * them. Dependency-free — a button toggles a labelled region.
 */
export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  /** Optional trailing hint, e.g. a count of filled rows. */
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const id = React.useId();

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 p-6 text-left"
      >
        <span>
          <span className="text-lg font-semibold leading-none tracking-tight">{title}</span>
          {description && (
            <span className="mt-1.5 block text-sm text-muted-foreground">{description}</span>
          )}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          {badge}
          <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <CardContent id={id} className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
