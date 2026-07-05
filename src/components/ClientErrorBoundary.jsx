import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ClientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Client page error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-xl mb-2">Something went wrong loading this page</h2>
            <p className="text-slate-400 text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <RefreshCw size={15} /> Retry
            </button>
            <Link
              to="/dashboard"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 border border-white/20 text-slate-300 hover:text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
}