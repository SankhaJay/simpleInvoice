import { redirect } from "next/navigation";

/** The app has no distinct home — the invoice list is the landing screen. */
export default function RootPage() {
  redirect("/invoices");
}
