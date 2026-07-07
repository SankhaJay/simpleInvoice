import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Only allow redirecting to internal, single-slash paths — blocks open-redirect
 * attempts like `//evil.com` or `https://evil.com`.
 */
function safeRedirect(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/invoices";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Already signed in? Skip the form.
  if (await getSessionUser()) redirect("/invoices");

  const sp = await searchParams;
  const redirectTo = safeRedirect(typeof sp.redirect === "string" ? sp.redirect : undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">SimpleInvoice</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage your invoices</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirectTo} />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your session is protected with encrypted, httpOnly cookies.
        </p>
      </div>
    </main>
  );
}
