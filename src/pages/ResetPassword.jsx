// Redirect stub — the real reset password page is at src/pages/public/ResetPassword.jsx
import { Navigate } from 'react-router-dom';
export default function ResetPassword() {
  return <Navigate to="/reset-password" replace />;
}