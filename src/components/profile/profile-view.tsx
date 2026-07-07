"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, RefreshCw, User } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import type { UserProfile } from "@/types/session";

export function ProfileView() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useProfile();

  React.useEffect(() => {
    if (error instanceof ApiClientError && error.status === 401) router.replace("/login");
  }, [error, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details.</p>
      </div>

      {isLoading && <ProfileSkeleton />}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="font-medium">Couldn’t load your profile</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw /> Retry
          </Button>
        </div>
      )}

      {data && <Profile profile={data} />}
    </div>
  );
}

function Profile({ profile }: { profile: UserProfile }) {
  return (
    <>
      {/* Identity header */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
            {initials(profile.displayName)}
          </div>
          <div className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-xl font-semibold">{profile.displayName}</h2>
              {profile.status && (
                <Badge variant={profile.status === "Active" ? "success" : "secondary"}>
                  {profile.status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{profile.organisation.role}</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Personal details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <Field label="First name" value={profile.firstName} />
          <Field label="Last name" value={profile.lastName} />
          <Field label="Mobile number" value={profile.mobileNumber} />
          <Field label="Email" value={profile.email} />
          <Field label="Member since" value={profile.createdAt ? formatDate(profile.createdAt) : undefined} />
          <Field label="User ID" value={profile.userId} mono copyable />
        </CardContent>
      </Card>

      {/* Organisation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Organisation
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
          <Field label="Organisation" value={profile.organisation.name} />
          <Field label="Role" value={profile.organisation.role} />
          <Field label="Organisation type" value={profile.organisation.organisationRole} />
          <Field label="Organisation number" value={profile.organisation.organisationNumber} />
          <Field label="Company number" value={profile.organisation.companyNumber} />
          <Field label="Organisation ID" value={profile.organisation.id} mono copyable />
        </CardContent>
      </Card>
    </>
  );
}

function Field({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={mono ? "break-all font-mono text-sm" : "font-medium"}>{value || "—"}</p>
        {copyable && value && <CopyButton value={value} label={label} />}
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
