import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav.jsx';
import Footer from '../components/Footer.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURE_LABELS = {
  monthlyConversions: (v) => `${v.toLocaleString()} conversions / month`,
  maxFileSizeMb: (v) => `${v}MB max HTML payload`,
  concurrentRequests: (v) => `${v} concurrent request${v > 1 ? 's' : ''}`,
  watermark: (v) => (v ? 'Includes watermark' : 'No watermark'),
};

function formatPrice(amountKobo, currency) {
  if (amountKobo === 0) return { main: 'Free', sub: 'forever' };
  const main = (amountKobo / 100).toLocaleString();
  return { main: `${currency === 'NGN' ? '₦' : currency}${main}`, sub: '/ month' };
}

export default function Pricing() {
  const [plans, setPlans] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });
  const { loggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .plans()
      .then((data) => setPlans(data.plans))
      .catch((err) => setMessage({ text: `Could not load plans: ${err.message}`, type: 'error' }));
  }, []);

  async function selectPlan(planId) {
    setMessage({ text: '', type: '' });

    if (!loggedIn) {
      navigate(`/signup?plan=${planId}`);
      return;
    }

    try {
      const result = await api.subscribe(planId, 'paystack');
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl); // hand off to Paystack checkout
      } else {
        setMessage({ text: result.message || 'Plan updated.', type: 'ok' });
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  return (
    <>
      <Nav />

      <section style={{ paddingTop: 64 }}>
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">// pricing</p>
            <h2>Pick a plan, upgrade any time</h2>
            <p>Prices in NGN, billed monthly via Paystack. Cancel whenever — you keep access until the period ends.</p>
          </div>

          <div className="plans">
            {plans?.map((p, i) => {
              const price = formatPrice(p.amount, p.currency);
              const featured = p.id === 'pro';
              return (
                <div className={`plan-card ${featured ? 'featured' : ''}`} key={p.id}>
                  <div className="tier-label">
                    Tier 0{i + 1}
                    {featured ? ' · most popular' : ''}
                  </div>
                  <h3>{p.name}</h3>
                  <div className="price">
                    {price.main} <small>{price.sub}</small>
                  </div>
                  <ul>
                    <li>{FEATURE_LABELS.monthlyConversions(p.monthlyConversions)}</li>
                    <li>{FEATURE_LABELS.maxFileSizeMb(p.maxFileSizeMb)}</li>
                    <li>{FEATURE_LABELS.concurrentRequests(p.concurrentRequests)}</li>
                    <li>{FEATURE_LABELS.watermark(p.watermark)}</li>
                  </ul>
                  <button
                    className={`btn ${featured ? 'btn-primary' : 'btn-ghost'} btn-block`}
                    onClick={() => selectPlan(p.id)}
                  >
                    {p.id === 'free' ? 'Start free' : 'Subscribe'}
                  </button>
                </div>
              );
            })}
          </div>

          {message.text && (
            <p className={`form-msg ${message.type}`} style={{ textAlign: 'center', marginTop: 24 }}>
              {message.text}
            </p>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
