import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      let parsedError: Record<string, unknown> | null = null;
      try {
        parsedError = JSON.parse(this.state.errorMessage);
      } catch {
        parsedError = null;
      }

      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-red-700 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-semibold">Operation Could Not Be Completed</h2>
            </div>
            <p className="text-sm text-stone-600 mb-4">
              {parsedError
                ? `Database permission or validation check failed on ${String(parsedError.operationType || 'operation')} (${String(parsedError.path || 'unknown path')}).`
                : this.state.errorMessage}
            </p>
            {parsedError && (
              <pre className="text-xs font-mono-tabular bg-stone-100 text-stone-800 p-3 rounded-lg overflow-x-auto mb-4">
                {JSON.stringify(parsedError, null, 2)}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Return to Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
