import React, { useState, useEffect } from 'react';
import { Sliders, Lock, Unlock, Shield, ShieldAlert, Key, Eye, EyeOff, Save, Loader2 } from 'lucide-react';

export default function SettingsPanel({ config, passcode, onUpdateSettings, showToast }) {
  const [readOnly, setReadOnly] = useState(config?.readOnly ?? true);
  const [usePasscode, setUsePasscode] = useState(config?.passcodeRequired ?? false);
  const [passcodePIN, setPasscodePIN] = useState(passcode || '');
  const [showPIN, setShowPIN] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Synchronize with parent state changes
  useEffect(() => {
    if (config) {
      setReadOnly(config.readOnly);
      setUsePasscode(config.passcodeRequired);
    }
    if (passcode) {
      setPasscodePIN(passcode);
    }
  }, [config, passcode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (usePasscode) {
      if (!passcodePIN) {
        setError('Passcode cannot be empty when protection is enabled.');
        return;
      }
      if (passcodePIN.length < 4) {
        setError('Passcode must be at least 4 characters/digits.');
        return;
      }
    }

    setSaving(true);
    const targetPasscode = usePasscode ? passcodePIN.trim() : '';

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        },
        body: JSON.stringify({
          newPasscode: targetPasscode,
          newReadOnly: readOnly
        })
      });

      const data = await res.json();
      setSaving(false);

      if (res.ok && data.success) {
        showToast('Success', 'Host settings updated successfully!');
        if (onUpdateSettings) {
          onUpdateSettings(data.readOnly, data.passcodeRequired, data.passcode);
        }
      } else {
        setError(data.error || 'Failed to save settings.');
      }
    } catch (err) {
      setSaving(false);
      setError('Connection error saving settings.');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <Sliders className="color-code" size={20} />
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>Host Security Settings</h3>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* Read-Only / Write Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
              disabled={saving}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {readOnly ? <Lock size={14} className="color-pdf" /> : <Unlock size={14} className="color-image" />}
              Read-Only Mode
            </span>
          </label>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '24px' }}>
            When active, external visitors cannot upload, overwrite, or delete files on this host computer.
          </span>
        </div>

        {/* Passcode Security Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={usePasscode}
              onChange={(e) => setUsePasscode(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
              disabled={saving}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} className="color-directory" />
              Require Authentication Passcode
            </span>
          </label>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '24px' }}>
            Locks the web dashboard behind an entry passcode, requiring visitors to enter the PIN code.
          </span>
        </div>

        {/* Passcode Input Field (Conditional) */}
        {usePasscode ? (
          <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.2s ease-out' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)' }}>Set Server Passcode:</span>
            <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
              <input
                type={showPIN ? 'text' : 'password'}
                value={passcodePIN}
                onChange={(e) => setPasscodePIN(e.target.value)}
                maxLength={20}
                placeholder="Enter passcode PIN"
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 42px 10px 14px',
                  color: 'var(--text-main)',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  outline: 'none'
                }}
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPIN(!showPIN)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPIN ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        ) : (
          /* Warning message if passcode is disabled */
          <div style={{
            marginLeft: '24px',
            padding: '10px 12px',
            background: 'rgba(235, 94, 85, 0.05)',
            border: '1px solid rgba(235, 94, 85, 0.2)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <ShieldAlert size={16} className="color-pdf" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: '#ff6b6b', lineHeight: '1.4' }}>
              Warning: Disabling authentication allows anyone on your local network (and global tunnel, if running) to access, view, and modify your files.
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}
          disabled={saving}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
