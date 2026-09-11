import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loading } from './ui.jsx';

/**
 * Route gate for the interface. It hides views; it does not protect data - the
 * API re-checks the token and the role on every request, so bypassing this
 * component gets you an empty page and a 403.
 */
export default function ProtectedRoute({ children, role }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading label="Checking your session" />;

  // Visitors without a session land on the public marketing site instead of a
  // bare form; "Sign in" from there returns them to where they were headed.
  if (!user) return <Navigate to="/foldcraft" replace state={{ from: location.pathname }} />;

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(user.role)) {
      const target = user.role === 'admin' ? '/admin' : user.role === 'trainer' ? '/trainer' : '/';
      return <Navigate to={target} replace />;
    }
  }

  return children;
}
