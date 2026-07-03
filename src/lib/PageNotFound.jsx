import { useLocation, Link } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0F172A]">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-black text-slate-700">404</h1>
          <div className="h-0.5 w-16 bg-white/10 mx-auto" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-white">Page Not Found</h2>
          <p className="text-slate-400 leading-relaxed">
            The page <span className="font-medium text-slate-300">"{pageName}"</span> could not be found.
          </p>
        </div>
        <div className="pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-xl transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}