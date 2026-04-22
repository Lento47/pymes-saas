import React from "react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/error-reporting";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    void reportClientError({
      source: "FRONTEND",
      category: "REACT_RENDER",
      severity: "CRITICAL",
      title: error.name || "React render error",
      message: error.message,
      stack: error.stack,
      context_json: {
        component_stack: errorInfo.componentStack,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 space-y-3 text-center">
            <h1 className="text-lg font-semibold text-foreground">Algo falló en esta pantalla</h1>
            <p className="text-sm text-muted-foreground">
              Ya guardamos la información técnica para revisarlo. Puedes recargar e intentar de nuevo.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Recargar
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
