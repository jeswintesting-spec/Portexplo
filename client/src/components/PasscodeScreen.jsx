import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, Key, HelpCircle, X, Monitor, Wifi, Copy, Check, TerminalSquare } from 'lucide-react';

export default function PasscodeScreen({ onSuccess }) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Forgot passcode state
  const [showRecovery, setShowRecovery] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState(null); // { passcode } or { error, hint } or { noPasscode }
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();
      setVerifying(false);

      if (res.ok && data.success) {
        onSuccess(code.trim(), data.status);
      } else {
        triggerShake(data.error || 'Invalid passcode');
      }
    } catch (err) {
      setVerifying(false);
      triggerShake('Connection error. Is the server running?');
    }
  };

  const triggerShake = (message) => {
    setError(message);
    setShake(true);
    setCode('');
    setTimeout(() => setShake(false), 500);
  };

  const handleRecovery = async () => {
    setRecovering(true);
    setRecoveryResult(null);
    try {
      const res = await fetch('/api/host-recovery');
      const data = await res.json();
      if (res.ok) {
        setRecoveryResult(data);
      } else {
        setRecoveryResult({ error: data.error, hint: data.hint });
      }
    } catch (err) {
      setRecoveryResult({ error: 'Could not reach the server.' });
    } finally {
      setRecovering(false);
    }
  };

  const handleCopyRecovered = () => {
    if (recoveryResult?.passcode) {
      navigator.clipboard.writeText(recoveryResult.passcode);
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2000);
      // Also pre-fill the code input
      setCode(recoveryResult.passcode);
      setShowRecovery(false);
      setRecoveryResult(null);
    }
  };

  return (
    <div className="passcode-container">
      <div className={`glass-panel passcode-card ${shake ? 'shake' : ''}`}>
        <div className="passcode-icon-wrapper">
          <Lock size={32} />
        </div>

        <div>
          <h2 className="passcode-title">Portexplo Secure</h2>
          <p className="passcode-subtitle" style={{ marginTop: '8px' }}>
            Enter the passcode set by the host to access the shared files.
          </p>
        </div>

        <form className="passcode-form" onSubmit={handleSubmit}>
          <div className="passcode-input-wrapper">
            <input
              type={showCode ? 'text' : 'password'}
              placeholder="••••"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="passcode-field"
              disabled={verifying}
              autoFocus
              maxLength={16}
            />
            <button
              type="button"
              className="passcode-visibility-btn"
              onClick={() => setShowCode(!showCode)}
              disabled={verifying}
            >
              {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)' }}>
              <ShieldAlert size={14} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px 18px', marginTop: '4px' }}
            disabled={verifying || !code.trim()}
          >
            <Key size={16} />
            {verifying ? 'Authorizing...' : 'Unlock Server'}
          </button>
        </form>

        {/* Forgot Passcode trigger */}
        <button
          onClick={() => { setShowRecovery(true); setRecoveryResult(null); handleRecovery(); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 0',
            marginTop: '4px',
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <HelpCircle size={13} />
          Forgot Passcode?
        </button>
      </div>

      {/* Recovery Modal Overlay */}
      {showRecovery && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowRecovery(false)}
        >
          <div
            className="glass-panel"
            style={{ maxWidth: '400px', width: '100%', padding: '28px', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowRecovery(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,200,255,0.1)', border: '1px solid rgba(0,200,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={16} className="color-cyan" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Passcode Recovery</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Portexplo self-hosted server</div>
              </div>
            </div>

            {recovering && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                Checking your access level...
              </div>
            )}

            {/* Host machine — passcode recovered */}
            {!recovering && recoveryResult?.passcode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px',
                  background: 'rgba(0, 200, 100, 0.08)',
                  border: '1px solid rgba(0, 200, 100, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px', color: 'rgba(0, 210, 110, 0.9)'
                }}>
                  <Monitor size={14} />
                  Host machine detected — recovery authorized
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Your current passcode is:</div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(0, 200, 255, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                  }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, letterSpacing: '6px', color: '#00f2fe' }}>
                      {recoveryResult.passcode}
                    </span>
                    <button
                      onClick={handleCopyRecovered}
                      style={{
                        background: copiedRecovery ? 'rgba(0,200,100,0.15)' : 'rgba(0,200,255,0.1)',
                        border: `1px solid ${copiedRecovery ? 'rgba(0,200,100,0.3)' : 'rgba(0,200,255,0.2)'}`,
                        borderRadius: '6px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        color: copiedRecovery ? '#00d26a' : '#00f2fe',
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px'
                      }}
                    >
                      {copiedRecovery ? <Check size={12} /> : <Copy size={12} />}
                      {copiedRecovery ? 'Copied!' : 'Copy & Fill'}
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  To change your passcode, restart the server with <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>--passcode &lt;newcode&gt;</code> or update it from the <strong>Host Console → Security Settings</strong>.
                </p>
              </div>
            )}

            {/* No passcode set */}
            {!recovering && recoveryResult?.noPasscode && (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                This server has no passcode set — you should be able to log in without one.
              </div>
            )}

            {/* Remote device — can't recover */}
            {!recovering && recoveryResult?.error && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px', color: 'rgba(239,100,100,0.9)'
                }}>
                  <Wifi size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
                  <div>
                    <strong>Remote device detected.</strong> Passcode recovery is only available on the host machine for security reasons.
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <TerminalSquare size={14} /> How to recover your passcode:
                  </strong>
                  <ol style={{ margin: '0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li>Go to the <strong>host computer</strong> running Portexplo.</li>
                    <li>Check the <strong>terminal window</strong> — the passcode is printed in the startup banner.</li>
                    <li>Or open <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>http://localhost:{window.location.port || 5050}/api/host-recovery</code> in a browser <strong>on the host machine</strong>.</li>
                    <li>Or restart the server with a new passcode:<br/>
                      <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>node server.js --passcode &lt;newcode&gt;</code>
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
