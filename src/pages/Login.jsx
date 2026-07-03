// Redirect stub — the real sign-in page is at src/pages/public/SignIn.jsx
// This file exists only because the Base44 router expects a Login.jsx.
import { Navigate } from 'react-router-dom';
export default function Login() {
  return <Navigate to="/signin" replace />;
}