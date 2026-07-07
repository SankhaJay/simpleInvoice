"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import type { SessionUser } from "@/types/session";

const SESSION_KEY = ["session"] as const;

/** Read the current authenticated user (null when signed out). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => apiFetch<{ user: SessionUser | null }>("/api/auth/session"),
    staleTime: 60_000,
  });
}

/** Log out, clear cached queries, and return to the login screen. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ success: boolean }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
