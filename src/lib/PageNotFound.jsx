import { useLocation, Link } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-black text-muted-foreground">404</h1>
          <div className="h-0.5 w-16 bg-border mx-auto" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">Page Not Found</h2>
          <p className="text-muted-foreground leading-relaxed">
            The page <span className="font-medium text-foreground">"{pageName}"</span> could not be found.
          </p>
        </div>
        <div className="pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary-hover rounded-xl transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
