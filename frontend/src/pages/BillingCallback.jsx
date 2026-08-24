import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export default function BillingCallback() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ title: 'Confirming your payment…', sub: 'Hang tight, checking with Paystack.', msg: '', msgType: '', done: false });

  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref');

    if (!reference) {
      setState({
        title: 'Missing payment reference',
        sub: 'We could not find a transaction reference in the URL.',
        msg: '',
        msgType: '',
        done: true,
      });
      return;
    }

    api
      .verifyPayment(reference, 'paystack')
      .then((result) => {
        if (result.status === 'success') {
          setState({
            title: 'Payment confirmed',
            sub: 'Your plan is now active.',
            msg: `Plan: ${result.planId}`,
            msgType: 'ok',
            done: true,
          });
        } else {
          setState({
            title: 'Payment not completed',
            sub: `Status: ${result.status}. If you were charged, contact support.`,
            msg: '',
            msgType: 'error',
            done: true,
          });
        }
      })
      .catch((err) => {
        setState({ title: 'Could not verify payment', sub: '', msg: err.message, msgType: 'error', done: true });
      });
  }, [params]);

  return (
    <div className="form-shell">
      <div className="form-card" style={{ textAlign: 'center' }}>
        <h1>{state.title}</h1>
        <p className="sub">{state.sub}</p>
        {state.msg && <p className={`form-msg ${state.msgType}`}>{state.msg}</p>}
        {state.done && (
          <Link className="btn btn-primary btn-block" to="/dashboard">
            Go to dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
