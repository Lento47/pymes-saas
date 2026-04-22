import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export function LoadingSpinner({ className, size = 20 }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)} data-testid="loading-spinner">
      <Loader2 className="animate-spin text-muted-foreground" size={size} />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64" data-testid="page-loader">
      <Loader2 className="animate-spin text-primary" size={28} />
    </div>
  );
}
