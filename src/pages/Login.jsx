import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await window.api.auth.login({ username, password });
      if (result.ok) {
        await window.api.session.save(result.user.id);
        onLogin(result.user);
      } else setError(result.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--teal-950)', fontFamily: 'var(--font-body)'
    }}>
      <form onSubmit={submit} style={{
        background: '#fff', borderRadius: 16, padding: '40px 36px', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Healthy Appliances</h1>
          <div className="page-sub">Sign in to your ERP</div>
        </div>

        <div className="field">
          <label>Username</label>
          <input autoFocus value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        {error && (
          <div style={{ background: '#f6e0da', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '11px 0', marginTop: 6 }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="page-sub" style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
          Default: admin / changeme — change this in Settings after first login.
        </div>
      </form>
    </div>
  );
}
