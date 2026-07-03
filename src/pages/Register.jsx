// Redirect stub — the real register page is at src/pages/public/Register.jsx
import { Navigate } from 'react-router-dom';
export default function Register() {
  return <Navigate to="/register" replace />;
}