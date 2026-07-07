"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { UserProfile } from "@/types/session";

/** Fetch the current user's read-only profile. */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => apiFetch<UserProfile>("/api/profile"),
    staleTime: 5 * 60_000,
  });
}
