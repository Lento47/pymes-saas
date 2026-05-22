import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface FeatureFlagsData {
  profile: "emprende" | "business" | "enterprise";
  flags: Record<string, boolean>;
  sidebarItems: Array<{
    path: string;
    icon: string;
    label: string;
    badge?: string;
  }>;
}

export function useFeatureFlags() {
  return useQuery<FeatureFlagsData>({
    queryKey: ["/api/feature-flags/profile"],
    queryFn: api.getFeatureFlags,
    staleTime: 5 * 60_000, // 5 min
    retry: false,
  });
}
