import React, { useEffect, useState } from 'react';
import { X, Folder, HardDrive, Compass, ChevronRight, AlertTriangle, ArrowRight } from 'lucide-react';

export default function DirSelectorModal({ isOpen, onClose, onSuccess, config, passcode, showToast }) {
  const [locations, setLocations] = useState([]);
  const [selectedPath, setSelectedPath] = useState(config?.sharedDirPath || '');
  const [customPath, setCustomPath] = useState(config?.sharedDirPath || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch quick locations from server
  useEffect(() => {
    if (!isOpen) return;
    
    setLoading(true);
    setError('');
    
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/admin/locations', {
          headers: passcode ? { 'Authorization': `Bearer ${passcode}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setLocations(data);
        } else {
          setError('Failed to fetch host quick locations');
        }
      } catch (err) {
        console.error('Error fetching locations:', err);
        setError('Connection error fetching host folders');
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [isOpen, passcode]);

  // Sync selected path with input
  const handleSelectLocation = (path) => {
    setSelectedPath(path);
    setCustomPath(path);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customPath.trim()) return;

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/set-root', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        },
        body: JSON.stringify({ newPath: customPath.trim() })
      });

      const data = await res.json();
      setSaving(false);

      if (res.ok && data.success) {
        showToast('Success', `Shared folder switched to: ${data.sharedDirName}`);
        onSuccess(data.sharedDirPath);
        onClose();
      } else {
        setError(data.error || 'Failed to switch shared folder');
      }
    } catch (err) {
      setSaving(false);
      setError('Connection error applying new path');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="preview-modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="glass-panel preview-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', minHeight: 'auto' }}>
        {/* Header */}
        <div className="preview-header" style={{ padding: '16px 20px' }}>
          <div className="preview-title-wrapper">
            <HardDrive className="color-directory" size={22} />
            <div>
              <div className="preview-title">Switch Shared Disk / Folder</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Choose any path on the host computer</div>
            </div>
          </div>
          <button className="action-icon-btn" onClick={onClose} style={{ borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="preview-body" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '20px', minHeight: 'auto', background: 'rgba(0, 0, 0, 0.2)' }}>
          {/* Current Path Info */}
          <div style={{ marginBottom: '18px', padding: '12px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>Currently Sharing:</div>
            <div style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>{config?.sharedDirPath}</div>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Quick Select Drive/Folder:</div>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '13px' }}>Loading system folders...</div>
          ) : (
            <div className="location-grid">
              {locations.map((loc) => {
                const isActive = customPath === loc.path;
                return (
                  <button
                    key={loc.path}
                    className={`location-badge ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectLocation(loc.path)}
                  >
                    <span className="location-badge-name">
                      <Folder size={14} className="color-directory" />
                      {loc.name}
                    </span>
                    <span className="location-badge-path" title={loc.path}>{loc.path}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="path-input-section">
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>Custom Host Path:</div>
            <div className="path-input-group">
              <input
                type="text"
                className="path-input-field"
                placeholder="Enter absolute directory path e.g. /media/disk"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                disabled={saving}
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !customPath.trim()}>
                {saving ? 'Applying...' : 'Apply & Switch'}
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
