import React, { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Circle } from 'lucide-react';

export default function ActivityLogs({ passcode }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs', {
        headers: {
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [passcode]);

  const getActionColor = (action) => {
    const act = action.toLowerCase();
    if (act === 'auth') return '#00f2fe'; // cyan
    if (act === 'upload') return '#00f2fe'; // cyan
    if (act === 'download') return '#4facfe'; // blue
    if (act === 'delete' || act === 'revoke') return '#ff6b6b'; // red
    if (act === 'config') return '#f9d976'; // yellow/orange
    if (act === 'disk switch') return '#b19ffb'; // purple
    if (act.includes('zip')) return '#ec77ab'; // pink/magenta
    return 'var(--text-muted)';
  };

  return (
    <div className="glass-panel text-left" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={18} className="color-cyan" />
          Live Host Console Stream
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#00f2fe', background: 'rgba(0, 242, 254, 0.08)', padding: '2px 8px', borderRadius: '10px', marginLeft: '6px' }}>
            <Circle size={6} fill="#00f2fe" className="pulse" style={{ border: 'none' }} /> Live
          </span>
        </h3>
        <button 
          onClick={fetchLogs} 
          className="btn btn-icon" 
          disabled={loading}
          title="Refresh logs"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div 
        ref={containerRef}
        style={{
          fontFamily: 'monospace, "Courier New", Courier',
          fontSize: '11px',
          background: 'rgba(5, 8, 15, 0.6)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          height: '220px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'inset 0 4px 12px rgba(0, 0, 0, 0.4)'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
            $ listening for server events...
          </div>
        ) : (
          [...logs].reverse().map((log) => (
            <div key={log.id} style={{ lineHeight: '1.4', wordBreak: 'break-all' }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>[{log.timestamp}]</span>
              <span 
                style={{
                  color: getActionColor(log.action),
                  fontWeight: 'bold',
                  marginRight: '6px',
                  textTransform: 'uppercase',
                  border: `1px solid ${getActionColor(log.action)}33`,
                  background: `${getActionColor(log.action)}11`,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '9px'
                }}
              >
                {log.action}
              </span>
              <span style={{ color: 'var(--text-main)' }}>{log.details}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
