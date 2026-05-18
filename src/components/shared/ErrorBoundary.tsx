import * as React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppError, mapSupabaseError } from "@/lib/errors";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: AppError, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: AppError | null;
}

/**
 * Global Error Boundary. Catches uncaught errors in the React tree and
 * shows a recovery UI instead of a blank white screen.
 *
 * For production, hook into a service like Sentry inside componentDidCatch.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: mapSupabaseError(error) };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Log for diagnostics. Replace with Sentry / Logflare in production.
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border/20 rounded-sm p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-sm bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight text-foreground">
                Algo salió mal
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Error inesperado
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{error.message}</p>

          {process.env.NODE_ENV === "development" && error.cause ? (
            <details className="text-xs text-muted-foreground/60 border border-border/10 rounded-sm p-3">
              <summary className="cursor-pointer font-bold uppercase tracking-widest">
                Detalles técnicos
              </summary>
              <pre className="mt-2 overflow-auto text-[10px]">
                {String((error.cause as any)?.stack || error.cause)}
              </pre>
            </details>
          ) : null}

          <div className="flex gap-3">
            <Button onClick={this.reset} className="flex-1 gap-2 rounded-sm">
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
              className="flex-1 gap-2 rounded-sm"
            >
              <Home className="w-4 h-4" />
              Inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
