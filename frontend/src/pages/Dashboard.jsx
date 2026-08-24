import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer.jsx';
import CodeBlock from '../components/CodeBlock.jsx';
import { api, fetchUsageWithApiKey } from '../api/client.js';
import { API_BASE_URL } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user, subscription, apiKeys, refresh, logout } = useAuth();
  const navigate = useNavigate();

  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  const activeKey = apiKeys?.find((k) => k.active)?.key || '';

  useEffect(() => {
    if (activeKey) {
      fetchUsageWithApiKey(activeKey).then(setUsage);
    }
  }, [activeKey]);

  useEffect(() => {
    api
      .history()
      .then((data) => setPayments(data.payments))
      .catch(() => setHistoryError('Could not load billing history.'));
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function handleRotate() {
    if (!confirm('Rotating will immediately revoke your current key. Continue?')) return;
    setRotating(true);
    try {
      await api.rotateKey();
      await refresh();
    } catch (err) {
      alert('Could not rotate key: ' + err.message);
    } finally {
      setRotating(false);
    }
  }

  function copyKey() {
    if (!activeKey) return;
    navigator.clipboard.writeText(activeKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const planId = subscription ? subscription.planId : 'free';
  const status = subscription ? subscription.status : 'active';
  const usagePct = usage ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  const curlSnippet = `curl -X POST ${API_BASE_URL}/api/v1/convert \\
  -H "X-API-Key: ${activeKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"html":"<h1>Hello world</h1>","format":"A4"}' \\
  --output out.pdf`;

  return (
    <>
      <nav className="nav">
        <div className="wrap">
          <Link className="brand" to="/">
            <span className="mark">⎘</span> HTML2PDF
          </Link>
          <div className="nav-links">
            <Link to="/pricing">Pricing</Link>
            <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
              Log out
            </a>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="dash-header">
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              // dashboard
            </p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: 0 }}>{user?.email || '—'}</h1>
          </div>
          <span className={`pill ${status}`}>{status}</span>
        </div>

        <div className="stat-row">
          <div className="stat">
            <div className="label">Current plan</div>
            <div className="value">{planId}</div>
          </div>
          <div className="stat">
            <div className="label">Used this month</div>
            <div className="value">{usage ? usage.used.toLocaleString() : '—'}</div>
            <div className="usage-bar">
              <span style={{ width: `${usagePct}%` }}></span>
            </div>
          </div>
          <div className="stat">
            <div className="label">Quota</div>
            <div className="value">{usage ? usage.limit.toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="dash-grid">
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3>API key</h3>
              <p style={{ marginBottom: 14 }}>
                Use this in the <code>X-API-Key</code> header on every request. Rotating revokes the old key immediately.
              </p>
              <div className="key-row">{activeKey || 'No active key'}</div>
              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={copyKey}>
                  {copied ? 'Copied' : 'Copy key'}
                </button>
                <button className="btn btn-stamp" onClick={handleRotate} disabled={rotating}>
                  {rotating ? 'Rotating…' : 'Rotate key'}
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Quick integration</h3>
              <p style={{ marginBottom: 14 }}>Your key is already filled in below.</p>
              <CodeBlock label="curl" code={curlSnippet} />
            </div>
          </div>

          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <h3>Plan</h3>
              <p style={{ marginBottom: 16 }}>Need more volume or a bigger payload limit?</p>
              <Link className="btn btn-primary btn-block" to="/pricing">
                Change plan
              </Link>
            </div>

            <div className="card">
              <h3>Billing history</h3>
              <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--text-muted)' }}>
                {historyError ? (
                  historyError
                ) : payments === null ? (
                  'Loading…'
                ) : payments.length === 0 ? (
                  'No payments yet.'
                ) : (
                  payments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderTop: '1px dashed var(--border)',
                      }}
                    >
                      <span>
                        {p.planId} · {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      <span className={`pill ${p.status === 'success' ? 'active' : ''}`}>{p.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
