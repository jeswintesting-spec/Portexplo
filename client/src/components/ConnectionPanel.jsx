import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Share2, Monitor, Cpu, HardDrive, ShieldAlert, Check, Copy, Globe, RefreshCw } from 'lucide-react';

export default function ConnectionPanel({ config, showToast, passcode, onRefreshConfig }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [sysInfo, setSysInfo] = useState(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);

  // Derive target URLs
  const ipAddress = config?.ips && config.ips.length > 0 ? config.ips[0] : 'localhost';
  const networkUrl = config ? `http://${ipAddress}:${config.port}` : '';
  const localUrl = config ? `http://localhost:${config.port}` : '';
  const globalUrl = config?.globalUrl || '';

  // Preferred shareable link (globalUrl has priority, then local network)
  const preferredUrl = globalUrl || networkUrl || localUrl;
  
  // Append auto-login token parameter for trusted QR code entry
  const shareableUrlWithToken = passcode 
    ? `${preferredUrl}?token=${encodeURIComponent(passcode)}` 
    : preferredUrl;

  // Generate QR Code on Canvas
  useEffect(() => {
    if (canvasRef.current && shareableUrlWithToken) {
      QRCode.toCanvas(
        canvasRef.current,
        shareableUrlWithToken,
        {
          width: 160,
          margin: 1,
          color: {
            dark: '#07090e',
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) console.error('Error rendering QR Code:', error);
        }
      );
    }
  }, [shareableUrlWithToken]);

  // Poll server system info with passcode auth header
  useEffect(() => {
    const fetchSysInfo = async () => {
      try {
        const res = await fetch('/api/sysinfo', {
          headers: passcode ? { 'Authorization': `Bearer ${passcode}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setSysInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch system info:', err);
      }
    };

    fetchSysInfo();
    const interval = setInterval(fetchSysInfo, 5000);
    return () => clearInterval(interval);
  }, [passcode]);

  const toggleGlobalAccess = async () => {
    if (tunnelLoading) return;
    setTunnelLoading(true);
    
    try {
      const endpoint = globalUrl ? '/api/admin/tunnel/stop' : '/api/admin/tunnel/start';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: passcode ? { 'Authorization': `Bearer ${passcode}` } : {}
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        showToast('Success', globalUrl ? 'Global Access Disabled' : 'Global Access Enabled');
        if (onRefreshConfig) onRefreshConfig();
      } else {
        showToast('Error', data.error || 'Failed to toggle Global Access');
      }
    } catch (err) {
      showToast('Error', 'Connection error');
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareableUrlWithToken) return;
    navigator.clipboard.writeText(shareableUrlWithToken);
    setCopied(true);
    showToast('Success', 'Access link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="sidebar-panel">
      {/* Network Access Card */}
      <div className="glass-panel connection-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', width: '100%' }}>
          <Share2 className="color-directory" size={20} />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Connect Devices</h3>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '12px' }}>
          {globalUrl 
            ? 'Scan this QR code to access these files globally from anywhere in the world!' 
            : 'Scan to access files from your phone, tablet, or another PC on this Wi-Fi network.'}
        </p>

        <div className="qr-container">
          <canvas ref={canvasRef} className="qr-canvas"></canvas>
        </div>

        <button className="btn btn-primary" onClick={handleCopyLink} style={{ width: '100%', marginTop: '8px' }}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied Access Link' : 'Copy Access Link'}
        </button>

        <div style={{ marginTop: '16px', marginBottom: '8px' }}>
          <button 
            className="btn" 
            onClick={toggleGlobalAccess} 
            disabled={tunnelLoading}
            style={{ 
              width: '100%', 
              background: globalUrl ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 254, 0.15)',
              border: `1px solid ${globalUrl ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 242, 254, 0.4)'}`,
              color: globalUrl ? '#ef4444' : '#00f2fe',
              fontWeight: 600,
              padding: '10px'
            }}
          >
            {tunnelLoading ? (
              <><RefreshCw size={16} className="spin" /> Updating...</>
            ) : globalUrl ? (
              <><ShieldAlert size={16} /> Disable Global Access</>
            ) : (
              <><Globe size={16} /> Enable Global Access</>
            )}
          </button>
        </div>

        <div className="connection-details">
          {globalUrl && (
            <div className="info-row">
              <span className="info-label">Global URL</span>
              <span className="info-value" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                {globalUrl}
              </span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">Local URL</span>
            <span className="info-value">{localUrl || 'http://localhost:5050'}</span>
          </div>
          {networkUrl && (
            <div className="info-row">
              <span className="info-label">Network URL</span>
              <span className="info-value" style={{ color: 'var(--accent-blue)' }}>
                {networkUrl}
              </span>
            </div>
          )}
          <div className="info-row">
            <span className="info-label">PC IP Address</span>
            <span className="info-value">
              {config?.ips && config.ips.map((ip, idx) => (
                <span key={ip} className="ip-badge">
                  {ip}
                </span>
              ))}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Access Mode</span>
            <span className="info-value" style={{ color: config?.readOnly ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
              {config?.readOnly ? 'Read-Only (Secure)' : 'Read-Write (Admin)'}
            </span>
          </div>
        </div>
      </div>

      {/* System Resources Card */}
      {sysInfo && (
        <div className="glass-panel system-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Monitor className="color-code" size={20} />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Host Diagnostics</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* CPU */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                  <Cpu size={14} />
                  Processor ({sysInfo.cpuCount} Cores)
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sysInfo.cpuModel}
              </div>
            </div>

            {/* RAM */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                  <HardDrive size={14} />
                  RAM Usage
                </span>
                <span style={{ fontWeight: 500 }}>{sysInfo.memory.percentage}%</span>
              </div>
              <div className="progress-track" style={{ marginBottom: '4px' }}>
                <div 
                  className="progress-bar" 
                  style={{ 
                    width: `${sysInfo.memory.percentage}%`,
                    background: parseFloat(sysInfo.memory.percentage) > 85 ? 'var(--danger)' : 'var(--accent-gradient)' 
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
                <span>Used: {formatBytes(sysInfo.memory.used)}</span>
                <span>Total: {formatBytes(sysInfo.memory.total)}</span>
              </div>
            </div>

            {/* Platform OS */}
            <div className="info-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <span className="info-label">Host OS</span>
              <span className="info-value" style={{ textTransform: 'capitalize' }}>
                {sysInfo.platform} ({config?.hostname})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
