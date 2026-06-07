import React, { useState, useEffect } from 'react';
import { Laptop, Smartphone, Tablet, ShieldX, RefreshCw, WifiOff, ShieldCheck } from 'lucide-react';

export default function DeviceManager({ passcode, showToast }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Track which keys are in "disconnected" state (key -> timestamp)
  const [disconnectedKeys, setDisconnectedKeys] = useState({});
  // Track which keys are pending inline confirmation
  const [pendingKeys, setPendingKeys] = useState({});

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/sessions', {
        headers: {
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        }
      });
      if (!res.ok) throw new Error('Failed to fetch active sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [passcode]);

  // Auto-remove disconnected cards after 3.5s
  useEffect(() => {
    const timers = Object.entries(disconnectedKeys).map(([key, ts]) => {
      const remaining = 3500 - (Date.now() - ts);
      return setTimeout(() => {
        setDisconnectedKeys(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setSessions(prev => prev.filter(s => s.key !== key));
      }, Math.max(0, remaining));
    });
    return () => timers.forEach(clearTimeout);
  }, [disconnectedKeys]);

  // Show inline confirm pill
  const handleDisconnectClick = (key) => {
    setPendingKeys(prev => ({ ...prev, [key]: true }));
  };

  // Cancel inline confirm
  const handleCancelDisconnect = (key) => {
    setPendingKeys(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Confirm revocation
  const handleRevoke = async (key) => {
    setPendingKeys(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const res = await fetch('/api/admin/sessions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        },
        body: JSON.stringify({ key })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Mark as disconnected — keep card visible for 3.5s
        setDisconnectedKeys(prev => ({ ...prev, [key]: Date.now() }));
        showToast('Success', 'Device disconnected successfully.');
      } else {
        showToast('Error', data.error || 'Failed to revoke session');
      }
    } catch (err) {
      showToast('Error', 'Connection error revoking session');
    }
  };

  const getDeviceIcon = (deviceType, isDisconnected) => {
    const color = isDisconnected ? 'rgba(239,68,68,0.7)' : undefined;
    const props = { size: 20, style: color ? { color } : {}, className: color ? undefined : 'color-cyan' };
    if (deviceType === 'Mobile') return <Smartphone {...props} />;
    if (deviceType === 'Tablet') return <Tablet {...props} />;
    return <Laptop {...props} />;
  };

  const parseUserAgent = (userAgent) => {
    const ua = userAgent;
    let browser = 'Browser', os = 'OS';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';
    if (ua.includes('Chrome') || ua.includes('CriOS')) browser = 'Chrome';
    else if (ua.includes('Firefox') || ua.includes('FxiOS')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge') || ua.includes('Edg')) browser = 'Edge';
    return `${browser} (${os})`;
  };

  const formatLastActive = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    if (diffSecs < 15) return 'Active just now';
    if (diffSecs < 60) return `Active ${diffSecs}s ago`;
    return `Active ${diffMins}m ago`;
  };

  // Merge live sessions with any temporarily kept disconnected sessions
  const displaySessions = sessions;

  return (
    <div className="glass-panel text-left" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Laptop size={18} className="color-cyan" />
          Active Connections ({sessions.filter(s => !disconnectedKeys[s.key]).length})
        </h3>
        <button
          onClick={fetchSessions}
          className="btn btn-icon"
          disabled={loading}
          title="Refresh connection list"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displaySessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            No active connections tracked.
          </div>
        ) : (
          displaySessions.map((session) => {
            const isDisconnected = !!disconnectedKeys[session.key];
            const isPending = !!pendingKeys[session.key];

            return (
              <div
                key={session.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: isDisconnected
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${
                    isDisconnected
                      ? 'rgba(239, 68, 68, 0.3)'
                      : session.isCurrent
                        ? 'rgba(0, 242, 254, 0.2)'
                        : 'var(--border-color)'
                  }`,
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  opacity: isDisconnected ? 0.65 : 1,
                  transition: 'all 0.4s ease',
                  animation: isDisconnected ? 'none' : undefined,
                }}
              >
                {/* Left: Icon + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: isDisconnected
                      ? 'rgba(239, 68, 68, 0.1)'
                      : session.isCurrent
                        ? 'rgba(0, 242, 254, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isDisconnected
                      ? <WifiOff size={18} style={{ color: '#ef4444' }} />
                      : getDeviceIcon(session.deviceType, false)
                    }
                  </div>

                  <div>
                    <div style={{ fontWeight: 600, color: isDisconnected ? '#ef4444' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {session.ip === '::1' || session.ip === '127.0.0.1' ? 'Localhost (Host PC)' : session.ip}
                      {session.isCurrent && !isDisconnected && (
                        <span className="badge badge-success" style={{ fontSize: '9px', padding: '2px 6px' }}>
                          Your Device
                        </span>
                      )}
                      {isDisconnected && (
                        <span style={{
                          fontSize: '9px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <WifiOff size={8} /> DISCONNECTED
                        </span>
                      )}
                    </div>
                    <div style={{ color: isDisconnected ? 'rgba(239,68,68,0.5)' : 'var(--text-muted)', marginTop: '2px', fontSize: '11px' }}>
                      {isDisconnected
                        ? 'Session revoked — access blocked'
                        : `${parseUserAgent(session.userAgent)} • ${formatLastActive(session.lastActive)}`
                      }
                    </div>
                  </div>
                </div>

                {/* Right: Action button or inline confirm */}
                {!session.isCurrent && !isDisconnected && (
                  isPending ? (
                    /* Inline confirm pill */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Confirm?</span>
                      <button
                        onClick={() => handleRevoke(session.key)}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          background: 'rgba(239,68,68,0.15)',
                          border: '1px solid rgba(239,68,68,0.5)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600,
                        }}
                      >
                        <ShieldX size={11} /> Yes
                      </button>
                      <button
                        onClick={() => handleCancelDisconnect(session.key)}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => handleDisconnectClick(session.key)}
                      title="Disconnect and revoke device access"
                      style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        color: '#ef4444',
                        background: 'rgba(239, 68, 68, 0.05)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldX size={12} />
                      Disconnect
                    </button>
                  )
                )}

                {/* Disconnected state — checkmark "done" */}
                {isDisconnected && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'rgba(239,68,68,0.6)',
                    flexShrink: 0,
                  }}>
                    <ShieldCheck size={14} style={{ color: '#ef4444' }} />
                    Revoked
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
