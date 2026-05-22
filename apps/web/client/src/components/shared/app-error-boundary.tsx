import React from "react";
import { Button } from "@/components/ui/button";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { reportClientError } from "@/lib/error-reporting";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  lastError?: { message: string; stack: string };
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      lastError: { message: error.message, stack: error.stack || '' },
    });

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
    const errMsg = this.state.lastError?.message || '';
    const errStack = this.state.lastError?.stack || '';

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 space-y-4 text-center">
            <h1 className="text-lg font-semibold text-foreground">Algo falló en esta pantalla</h1>
            <p className="text-sm text-muted-foreground">
              Ya guardamos la información técnica para revisarlo. Puedes intentar recargar o diagnosticar el problema.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => window.location.reload()} className="w-full">
                Recargar
              </Button>
              {errStack && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${errMsg}\n\n${errStack}`).catch(() => {});
                  }}
                  className="w-full text-xs"
                >
                  Copiar error
                </Button>
              )}
            </div>
            <div className="pt-2 border-t border-border flex justify-center">
              <DiagnosticButton module="app" />
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
