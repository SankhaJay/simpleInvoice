"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import {
  createInvoiceSchema,
  computeInvoiceTotals,
  CURRENCIES,
  UOMS,
  ADJUSTMENT_NAMES,
  ADJUSTMENT_DIRECTIONS,
  ADJUSTMENT_TYPES,
  type CreateInvoiceInput,
} from "@/schemas/invoice.schema";
import { defaultInvoiceValues, suggestInvoiceNumber } from "@/lib/invoice-defaults";
import { formatCurrency } from "@/lib/format";
import { useCreateInvoice } from "@/hooks/use-create-invoice";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
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
  const [quantity, rate, currency] = useWatch({
    control,
    name: ["quantity", "rate", "currency"],
  });
  const itemExtensions = useWatch({ control, name: "itemExtensions" });
  const totals = computeInvoiceTotals({
    quantity: Number(quantity) || 0,
    rate: Number(rate) || 0,
    extensions: (itemExtensions ?? []).map((e) => ({
      addDeduct: e.addDeduct,
      type: e.type,
      value: Number(e.value) || 0,
    })),
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

            <p className="sm:col-span-2 mt-2 text-sm font-medium text-muted-foreground">
              Billing address <span className="font-normal">(optional)</span>
            </p>
            <Field label="Premise / street" error={errors.addressPremise?.message} htmlFor="addressPremise" className="sm:col-span-2">
              <Input id="addressPremise" placeholder="CT11, 123 High Street" {...register("addressPremise")} />
            </Field>
            <Field label="City" error={errors.addressCity?.message} htmlFor="addressCity">
              <Input id="addressCity" {...register("addressCity")} />
            </Field>
            <Field label="County / region" error={errors.addressCounty?.message} htmlFor="addressCounty">
              <Input id="addressCounty" {...register("addressCounty")} />
            </Field>
            <Field label="Postcode" error={errors.addressPostcode?.message} htmlFor="addressPostcode">
              <Input id="addressPostcode" {...register("addressPostcode")} />
            </Field>
            <Field label="Country code (ISO)" error={errors.addressCountryCode?.message} htmlFor="addressCountryCode">
              <Input id="addressCountryCode" placeholder="GB" maxLength={2} className="uppercase" {...register("addressCountryCode")} aria-invalid={!!errors.addressCountryCode} />
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
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <div>
              <p className="text-sm font-medium">Adjustments</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Add taxes, discounts or surcharges — any combination of add/deduct and fixed/percentage.
              </p>
              <ExtensionsEditor control={control} register={register} errors={errors} />
            </div>
          </CardContent>
        </Card>

        {/* Optional, collapsed-by-default sections */}
        <CollapsibleSection
          title="Bank account"
          description="Payee account for this invoice. Provide the full set or leave the section empty."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account name" error={errors.bankAccountName?.message} htmlFor="bankAccountName" className="sm:col-span-2">
              <Input id="bankAccountName" placeholder="John Terry" {...register("bankAccountName")} aria-invalid={!!errors.bankAccountName} />
            </Field>
            <Field label="Sort code" error={errors.bankSortCode?.message} htmlFor="bankSortCode">
              <Input id="bankSortCode" placeholder="09-01-01" {...register("bankSortCode")} aria-invalid={!!errors.bankSortCode} />
            </Field>
            <Field label="Account number" error={errors.bankAccountNumber?.message} htmlFor="bankAccountNumber">
              <Input id="bankAccountNumber" placeholder="12345678" {...register("bankAccountNumber")} aria-invalid={!!errors.bankAccountNumber} />
            </Field>
            <Field label="Bank ID" error={errors.bankId?.message} htmlFor="bankId" className="sm:col-span-2">
              <Input id="bankId" placeholder="Bank identifier from your organisation" {...register("bankId")} aria-invalid={!!errors.bankId} />
            </Field>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Documents" description="Attach related document links to this invoice.">
          <DocumentsEditor control={control} register={register} errors={errors} />
        </CollapsibleSection>

        <CollapsibleSection title="Custom fields" description="Add arbitrary key/value metadata.">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Invoice-level</p>
              <KeyValueEditor name="customFields" control={control} register={register} errors={errors} addLabel="Add invoice field" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Line-item-level</p>
              <KeyValueEditor name="itemCustomFields" control={control} register={register} errors={errors} addLabel="Add item field" />
            </div>
          </div>
        </CollapsibleSection>
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
            <Row label="Additions" value={`+ ${formatCurrency(totals.additions, currency)}`} />
            <Row label="Deductions" value={`- ${formatCurrency(totals.deductions, currency)}`} />
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

const NAME_LABELS: Record<(typeof ADJUSTMENT_NAMES)[number], string> = {
  tax: "Tax",
  discount: "Discount",
};
const DIRECTION_LABELS: Record<(typeof ADJUSTMENT_DIRECTIONS)[number], string> = {
  ADD: "Add",
  DEDUCT: "Deduct",
};
const TYPE_LABELS: Record<(typeof ADJUSTMENT_TYPES)[number], string> = {
  FIXED_VALUE: "Fixed",
  PERCENTAGE: "Percentage",
};

/**
 * Repeatable adjustment editor (`items[0].extensions`). Each row is a full
 * combination: name, direction (Add/Deduct), type (Fixed/Percentage), value.
 */
function ExtensionsEditor({
  control,
  register,
  errors,
}: {
  control: Control<CreateInvoiceInput>;
  register: UseFormRegister<CreateInvoiceInput>;
  errors: FieldErrors<CreateInvoiceInput>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "itemExtensions" });
  const rowErrors = errors.itemExtensions;

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-wrap items-start gap-2 rounded-lg border border-border p-3 sm:flex-nowrap">
          <Controller
            control={control}
            name={`itemExtensions.${index}.name`}
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className="w-[8rem] flex-1" aria-label="Adjustment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_NAMES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {NAME_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Controller
            control={control}
            name={`itemExtensions.${index}.addDeduct`}
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className="w-[7.5rem]" aria-label="Direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_DIRECTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DIRECTION_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <Controller
            control={control}
            name={`itemExtensions.${index}.type`}
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className="w-[8.5rem]" aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <div className="w-24">
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="Value"
              aria-label="Value"
              {...register(`itemExtensions.${index}.value`, {
                setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
              })}
            />
            {rowErrors?.[index]?.value?.message && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {rowErrors[index]?.value?.message}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove adjustment">
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: undefined })}
      >
        <Plus /> Add adjustment
      </Button>
    </div>
  );
}

/** Repeatable key/value editor bound to a `customFields`-shaped array field. */
function KeyValueEditor({
  name,
  control,
  register,
  errors,
  addLabel,
}: {
  name: "customFields" | "itemCustomFields";
  control: Control<CreateInvoiceInput>;
  register: UseFormRegister<CreateInvoiceInput>;
  errors: FieldErrors<CreateInvoiceInput>;
  addLabel: string;
}) {
  const { fields, append, remove } = useFieldArray({ control, name });
  const rowErrors = errors[name];

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <div className="flex-1">
            <Input placeholder="Key" {...register(`${name}.${index}.key`)} aria-label="Key" />
            {rowErrors?.[index]?.key?.message && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {rowErrors[index]?.key?.message}
              </p>
            )}
          </div>
          <div className="flex-1">
            <Input placeholder="Value" {...register(`${name}.${index}.value`)} aria-label="Value" />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove field">
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ key: "", value: "" })}>
        <Plus /> {addLabel}
      </Button>
    </div>
  );
}

/** Repeatable document editor bound to the `documents` array field. */
function DocumentsEditor({
  control,
  register,
  errors,
}: {
  control: Control<CreateInvoiceInput>;
  register: UseFormRegister<CreateInvoiceInput>;
  errors: FieldErrors<CreateInvoiceInput>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "documents" });
  const rowErrors = errors.documents;

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <div className="flex-1">
            <Input placeholder="Document name" {...register(`documents.${index}.documentName`)} aria-label="Document name" />
            {rowErrors?.[index]?.documentName?.message && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {rowErrors[index]?.documentName?.message}
              </p>
            )}
          </div>
          <div className="flex-1">
            <Input placeholder="https://…" {...register(`documents.${index}.documentUrl`)} aria-label="Document URL" />
            {rowErrors?.[index]?.documentUrl?.message && (
              <p role="alert" className="mt-1 text-sm text-destructive">
                {rowErrors[index]?.documentUrl?.message}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="Remove document">
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ documentName: "", documentUrl: "" })}
      >
        <Plus /> Add document
      </Button>
    </div>
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
