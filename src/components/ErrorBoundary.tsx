import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import i18n from "@/lib/i18n";

import { telemetry } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    telemetry.trackCrash(error, info.componentStack || undefined);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {i18n.t("errorBoundary.title")}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {i18n.t("errorBoundary.body")}
          </p>
          {this.state.error && (
            <details className="w-full max-w-sm rounded-xl border border-border bg-secondary/30 p-3 text-left text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                {i18n.t("errorBoundary.details")}
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all text-destructive/80">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <Button onClick={this.handleReset} variant="secondary">
              <RotateCcw className="mr-2 h-4 w-4" /> {i18n.t("errorBoundary.tryAgain")}
            </Button>
            <Button onClick={() => window.location.reload()}>
              {i18n.t("errorBoundary.reload")}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
