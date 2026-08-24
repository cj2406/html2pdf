import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { loggedIn, loading } = useAuth();

  if (loading) return null; // brief flash-free wait while we check the session
  if (!loggedIn) return <Navigate to="/login" replace />;
  return children;
}
