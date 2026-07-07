import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { AppHeader } from "@/components/layout/app-header";

/**
 * Server-side gate for the authenticated area. This is the real authorization
 * boundary (middleware only checks cookie presence): if the sealed session is
 * missing or expired we redirect to login before rendering anything.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
