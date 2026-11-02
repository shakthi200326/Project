import React from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/inventory";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 shadow-sm mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Unable to display this view
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 max-w-md">
            An unexpected error occurred while rendering the interface. Your inventory data is safe.
          </p>
          {this.state.error && (
            <pre className="mt-3 p-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-[11px] font-mono text-rose-600 dark:text-rose-400 max-w-lg overflow-x-auto text-left">
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reload Page</span>
            </button>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
