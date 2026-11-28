import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isPermissionError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isPermissionError: false
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error || 'Unexpected application error');
    let friendly = raw;
    let isPerm = false;

    if (raw.startsWith('{') && raw.includes('"operationType"')) {
      try {
        const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string | null };
        const inner = String(parsed.error || '');
        if (/permission|insufficient|unauthorized/i.test(inner)) {
          isPerm = true;
          friendly =
            'Cloud permission sync was blocked for this account role or unverified session. Try reloading or signing back in.';
        } else {
          friendly = inner || 'A cloud synchronization error occurred.';
        }
      } catch {
        friendly = 'A cloud synchronization error occurred.';
      }
    } else if (/permission-denied|Missing or insufficient permissions/i.test(raw)) {
      isPerm = true;
      friendly =
        'Cloud permission denied. Please make sure your account email is verified and authorized by your Admin/Owner.';
    }

    return {
      hasError: true,
      errorMessage: friendly,
      isPermissionError: isPerm
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetSessionAndReload = (): void => {
    try {
      sessionStorage.clear();
    } catch {
      // Ignore storage access failures
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-slate-900">
              Something went wrong / एपमा अस्थायी समस्या आयो
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {this.state.errorMessage}
            </p>
            {this.state.isPermissionError && (
              <p className="text-xs text-slate-500">
                कृपया आफ्नो खाता Admin वा Manager द्वारा स्वीकृत र इमेल प्रमाणित (Verified) भएको सुनिश्चित गरी पुनः लग-इन गर्नुहोस्।
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload App</span>
            </button>
            <button
              type="button"
              onClick={this.handleResetSessionAndReload}
              className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Session</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
