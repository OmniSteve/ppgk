// Redirect stub — the real forgot password page is at src/pages/public/ForgotPassword.jsx
import { Navigate } from 'react-router-dom';
export default function ForgotPassword() {
  return <Navigate to="/forgot-password" replace />;
}