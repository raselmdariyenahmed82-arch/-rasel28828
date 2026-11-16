import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected application error' };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-xl p-8">
            <h1 className="text-xl font-bold text-stone-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-stone-600 break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 text-sm font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
