import { Badge, type BadgeProps } from "@/components/ui/badge";

/** Map an upstream status label to a semantic badge colour. */
const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  Paid: "success",
  Due: "warning",
  Overdue: "destructive",
  Void: "secondary",
  Draft: "outline",
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>;
}
