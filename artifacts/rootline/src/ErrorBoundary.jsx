import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Rootline ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0] p-6">
          <div className="bg-white border border-[#E7E2D6] rounded-2xl p-8 max-w-md w-full shadow-lg text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-serif font-bold text-[#1C1F1D] mb-2">
              Something went wrong
            </h2>
            <p className="text-xs text-[#6B7280] mb-4 leading-relaxed">
              We encountered an unexpected issue while rendering this page.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-left font-mono break-words">
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1C4B3C] text-white text-xs font-semibold rounded-xl hover:bg-[#163C30] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload page
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-[#D9D3C3] text-[#374151] text-xs font-semibold rounded-xl hover:bg-[#F7F5F0] transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Go to home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
