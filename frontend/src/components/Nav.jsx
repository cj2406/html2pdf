import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Nav() {
  const { loggedIn } = useAuth();

  return (
    <nav className="nav">
      <div className="wrap">
        <Link className="brand" to="/">
          <span className="mark">⎘</span> HTML2PDF
        </Link>
        <div className="nav-links">
          <a href="/#docs">Docs</a>
          <Link to="/pricing">Pricing</Link>
          {!loggedIn && <Link to="/login">Log in</Link>}
          <Link className="btn btn-primary" to={loggedIn ? '/dashboard' : '/signup'} style={{ padding: '8px 16px' }}>
            {loggedIn ? 'Dashboard' : 'Get API key'}
          </Link>
        </div>
      </div>
    </nav>
  );
}
