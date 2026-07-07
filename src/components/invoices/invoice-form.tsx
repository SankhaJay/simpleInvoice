"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save, Sparkles } from "lucide-react";
import {
  createInvoiceSchema,
  computeInvoiceTotals,
  CURRENCIES,
  UOMS,
  type CreateInvoiceInput,
} from "@/schemas/invoice.schema";
import { defaultInvoiceValues, suggestInvoiceNumber } from "@/lib/invoice-defaults";
import { formatCurrency } from "@/lib/format";
import { useCreateInvoice } from "@/hooks/use-create-invoice";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InvoiceForm() {
  const router = useRouter();
  const createInvoice = useCreateInvoice();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: defaultInvoiceValues(),
    mode: "onBlur",
  });

  // Live total preview. `useWatch` subscribes without breaking React Compiler
  // memoization (unlike the `watch()` return value).
  const [quantity, rate, taxPercentage, discountValue, currency] = useWatch({
    control,
    name: ["quantity", "rate", "taxPercentage", "discountValue", "currency"],
  });
  const totals = computeInvoiceTotals({
    quantity: Number(quantity) || 0,
    rate: Number(rate) || 0,
    taxPercentage: Number(taxPercentage) || 0,
    discountValue: Number(discountValue) || 0,
  });

  async function onSubmit(values: CreateInvoiceInput) {
    try {
      const result = await createInvoice.mutateAsync(values);
      toast.success("Invoice created", {
        description: `${result.invoiceNumber} was created successfully.`,
      });
      router.push("/invoices");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.error.fields) {
        for (const [field, message] of Object.entries(err.error.fields)) {
          setError(field as keyof CreateInvoiceInput, { message });
        }
        toast.error("Please correct the highlighted fields.");
      } else {
        toast.error(
          err instanceof ApiClientError ? err.error.message : "Could not create the invoice.",
        );
      }
    }
  }

  const numberField = (name: keyof CreateInvoiceInput) =>
    register(name, { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Customer */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>Who is this invoice for?</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.customerFirstName?.message} htmlFor="customerFirstName">
              <Input id="customerFirstName" {...register("customerFirstName")} aria-invalid={!!errors.customerFirstName} />
            </Field>
            <Field label="Last name" error={errors.customerLastName?.message} htmlFor="customerLastName">
              <Input id="customerLastName" {...register("customerLastName")} aria-invalid={!!errors.customerLastName} />
            </Field>
            <Field label="Email" error={errors.customerEmail?.message} htmlFor="customerEmail">
              <Input id="customerEmail" type="email" {...register("customerEmail")} aria-invalid={!!errors.customerEmail} />
            </Field>
            <Field label="Mobile number" error={errors.customerMobile?.message} htmlFor="customerMobile">
              <Input id="customerMobile" placeholder="+6597594971" {...register("customerMobile")} aria-invalid={!!errors.customerMobile} />
            </Field>
          </CardContent>
        </Card>

        {/* Invoice details */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice details</CardTitle>
            <CardDescription>Reference, currency and dates.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice number" error={errors.invoiceNumber?.message} htmlFor="invoiceNumber">
              <div className="flex gap-2">
                <Input id="invoiceNumber" {...register("invoiceNumber")} aria-invalid={!!errors.invoiceNumber} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Suggest a number"
                  onClick={() => setValue("invoiceNumber", suggestInvoiceNumber(), { shouldValidate: true })}
                >
                  <Sparkles />
                </Button>
              </div>
            </Field>
            <Field label="Reference (optional)" error={errors.invoiceReference?.message} htmlFor="invoiceReference">
              <Input id="invoiceReference" placeholder="#PO-1234" {...register("invoiceReference")} />
            </Field>
            <Field label="Currency" error={errors.currency?.message} htmlFor="currency">
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Invoice date" error={errors.invoiceDate?.message} htmlFor="invoiceDate">
              <Input id="invoiceDate" type="date" {...register("invoiceDate")} aria-invalid={!!errors.invoiceDate} />
            </Field>
            <Field label="Due date" error={errors.dueDate?.message} htmlFor="dueDate">
              <Input id="dueDate" type="date" {...register("dueDate")} aria-invalid={!!errors.dueDate} />
            </Field>
            <Field label="Description (optional)" error={errors.description?.message} htmlFor="description" className="sm:col-span-2">
              <Input id="description" placeholder="Invoice issued to…" {...register("description")} />
            </Field>
          </CardContent>
        </Card>

        {/* Line item */}
        <Card>
          <CardHeader>
            <CardTitle>Line item</CardTitle>
            <CardDescription>A single item per invoice.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Item name" error={errors.itemName?.message} htmlFor="itemName">
              <Input id="itemName" {...register("itemName")} aria-invalid={!!errors.itemName} />
            </Field>
            <Field label="Unit" error={errors.itemUOM?.message} htmlFor="itemUOM">
              <Controller
                control={control}
                name="itemUOM"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="itemUOM">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UOMS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Item description (optional)" error={errors.itemDescription?.message} htmlFor="itemDescription" className="sm:col-span-2">
              <Input id="itemDescription" {...register("itemDescription")} />
            </Field>
            <Field label="Quantity" error={errors.quantity?.message} htmlFor="quantity">
              <Input id="quantity" type="number" step="any" min="0" {...numberField("quantity")} aria-invalid={!!errors.quantity} />
            </Field>
            <Field label="Rate" error={errors.rate?.message} htmlFor="rate">
              <Input id="rate" type="number" step="any" min="0" {...numberField("rate")} aria-invalid={!!errors.rate} />
            </Field>
            <Field label="Tax % (optional)" error={errors.taxPercentage?.message} htmlFor="taxPercentage">
              <Input id="taxPercentage" type="number" step="any" min="0" max="100" {...numberField("taxPercentage")} aria-invalid={!!errors.taxPercentage} />
            </Field>
            <Field label="Discount (optional)" error={errors.discountValue?.message} htmlFor="discountValue">
              <Input id="discountValue" type="number" step="any" min="0" {...numberField("discountValue")} aria-invalid={!!errors.discountValue} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Summary rail */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Live total preview.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Subtotal" value={formatCurrency(totals.subtotal, currency)} />
            <Row label="Tax" value={formatCurrency(totals.tax, currency)} />
            <Row label="Discount" value={`- ${formatCurrency(totals.discount, currency)}`} />
            <div className="border-t border-border pt-3">
              <Row label="Total" value={formatCurrency(totals.total, currency)} strong />
            </div>
            <Button type="submit" className="mt-2 w-full" disabled={createInvoice.isPending}>
              {createInvoice.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Save /> Create invoice
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => router.push("/invoices")}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-base font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
