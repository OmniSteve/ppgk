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
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-destructive" />
          </div>
          <div>
            <h2 className="text-foreground font-black text-xl mb-2">Something went wrong loading this page</h2>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              <RefreshCw size={15} /> Retry
            </button>
            <Link
              to="/dashboard"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="flex items-center gap-2 border border-border text-muted-foreground hover:text-foreground font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
