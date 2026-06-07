import React, { useState } from 'react';
import { BookOpen, X, ChevronRight, Folder, HardDrive, Shield, UploadCloud, MonitorSmartphone, Key, Zap, Info } from 'lucide-react';

export default function UserManual({ onClose }) {
  const [activeTab, setActiveTab] = useState('getting_started');

  const tabs = [
    { id: 'getting_started', label: 'Getting Started', icon: <Info size={16} /> },
    { id: 'file_explorer', label: 'File Explorer', icon: <Folder size={16} /> },
    { id: 'host_console', label: 'Host Console', icon: <HardDrive size={16} /> },
    { id: 'security', label: 'Security & Access', icon: <Shield size={16} /> },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: <Zap size={16} /> },
  ];

  return (
    <div className="preview-modal-overlay" onClick={onClose} style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div 
        className="glass-panel" 
        onClick={e => e.stopPropagation()}
        style={{ 
          maxWidth: '860px', 
          width: '100%', 
          maxHeight: '90vh', 
          height: '100%',
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          borderRadius: '24px',
          border: '1px solid rgba(0, 242, 254, 0.2)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '24px 32px', 
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(90deg, rgba(5,10,22,1) 0%, rgba(10,20,40,1) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0,242,254,0.1)', color: '#00f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,242,254,0.2)' }}>
              <BookOpen size={24} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'white' }}>Portexplo User Manual</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Complete guide to local high-speed file sharing.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn btn-icon"
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Sidebar */}
          <div style={{ 
            width: '240px', 
            background: 'rgba(5,10,22,0.4)', 
            borderRight: '1px solid rgba(255,255,255,0.05)',
            padding: '20px 12px',
            overflowY: 'auto',
            flexShrink: 0
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: activeTab === tab.id ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                  color: activeTab === tab.id ? '#00f2fe' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.id ? 600 : 500,
                  transition: 'all 0.2s',
                  marginBottom: '4px'
                }}
                onMouseEnter={e => {
                  if (activeTab !== tab.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
                onMouseLeave={e => {
                  if (activeTab !== tab.id) e.currentTarget.style.background = 'transparent';
                }}
              >
                {tab.icon}
                <span style={{ flex: 1 }}>{tab.label}</span>
                {activeTab === tab.id && <ChevronRight size={14} />}
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, padding: '32px', overflowY: 'auto', background: 'rgba(5, 10, 22, 0.95)' }}>
            
            {activeTab === 'getting_started' && (
              <div className="manual-section">
                <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '16px' }}>What is Portexplo?</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Portexplo is a high-speed, local network file sharing platform. It turns the computer running it (the "Host") into a secure web server. Any device on the same WiFi network (phones, tablets, other laptops) can access these files through their web browser without installing any apps.
                </p>
                
                <h4 style={{ color: '#00f2fe', marginBottom: '12px' }}>Key Benefits</h4>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'white', display: 'block', marginBottom: '4px' }}>⚡ Blazing Fast Transfers</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Files never leave your local network. Speeds are limited only by your WiFi router, often 10x faster than cloud uploads.</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'white', display: 'block', marginBottom: '4px' }}>🔒 Complete Privacy</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Zero cloud routing. Your files are not uploaded to any server on the internet. They stream directly from device to device.</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'white', display: 'block', marginBottom: '4px' }}>📱 Cross-Platform</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Works on iOS, Android, macOS, Windows, and Linux. If it has a modern web browser, it can use Portexplo.</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'file_explorer' && (
              <div className="manual-section">
                <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '16px' }}>Using the File Explorer</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                  The Explorer is your primary workspace for viewing and managing files. It supports grid and list views for comfortable browsing.
                </p>

                <h4 style={{ color: '#00f2fe', marginBottom: '12px' }}>Features</h4>
                <ul style={{ color: 'var(--text-muted)', lineHeight: 1.7, paddingLeft: '20px', marginBottom: '24px' }}>
                  <li><strong>Native Media Previews:</strong> Click on images, PDFs, videos, or audio files to view them directly in your browser without downloading.</li>
                  <li><strong>Audio Visualizer:</strong> Music files open with a beautiful, reactive waveform visualizer.</li>
                  <li><strong>Deep Search:</strong> Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>Ctrl+K</kbd> to search for files. The search recursively looks inside folders up to 8 levels deep.</li>
                  <li><strong>Batch Downloads:</strong> Select multiple files and click the "Download ZIP" button to grab them all at once.</li>
                  <li><strong>Upload Files:</strong> Drag and drop files directly onto the grid, or click the "Upload File" button. (Only available if the host enabled Write access).</li>
                </ul>
              </div>
            )}

            {activeTab === 'host_console' && (
              <div className="manual-section">
                <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '16px' }}>The Host Console</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Available to the administrator, the Host Console provides tools to monitor and share the server.
                </p>

                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <MonitorSmartphone size={24} style={{ color: '#00f2fe', flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: 'white', display: 'block', marginBottom: '6px' }}>Connection & QR Sharing</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
                        The console displays the local network IP addresses (e.g., 192.168.1.5) you can type into mobile devices. It also generates a QR code. Simply scan the QR code with your phone's camera to instantly connect — no typing required!
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <HardDrive size={24} style={{ color: '#00f2fe', flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: 'white', display: 'block', marginBottom: '6px' }}>Storage Analysis</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
                        Click "Scan Directory" in the storage panel to see a beautiful breakdown of what file types are taking up the most space in your shared folder.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="manual-section">
                <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '16px' }}>Security & Access Control</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                  Portexplo is designed to be safe on your home or office network. You have absolute control over who can see or edit files.
                </p>

                <h4 style={{ color: '#00f2fe', marginBottom: '12px' }}>Passcode Protection</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                  If a passcode is set, the host machine (where the server is actually running) is automatically authorized to bypass the lock screen. Any other device (phones, other laptops) will hit the lock screen and must enter the PIN.
                </p>

                <h4 style={{ color: '#ef4444', marginBottom: '12px' }}>Revoking Devices</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                  From the Host Console, you can view a list of all actively connected devices (including their browser, OS, and IP). Click <strong>Disconnect</strong> next to a device to instantly revoke their session. They will be immediately kicked back to the lock screen on their device.
                </p>
                
                <h4 style={{ color: '#eab308', marginBottom: '12px' }}>Read-Only Mode</h4>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                  If the server was started in Read-Only mode (default), remote users cannot upload, delete, or rename files. They can only view and download. Start the server with the <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>--write</code> flag to enable two-way sharing.
                </p>
              </div>
            )}

            {activeTab === 'troubleshooting' && (
              <div className="manual-section">
                <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '16px' }}>Troubleshooting</h3>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'white', display: 'block', marginBottom: '8px' }}>I can't connect from my phone!</strong>
                    <ul style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, paddingLeft: '20px', lineHeight: 1.6 }}>
                      <li>Ensure your phone and computer are connected to the <strong>exact same WiFi network</strong>.</li>
                      <li>Check your PC's Firewall. Windows Firewall often blocks port 5050 by default for Node.js. You must allow Node.js through the firewall on private networks.</li>
                      <li>Try using the Global Tunnel URL (if enabled) in the Host Console.</li>
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'white', display: 'block', marginBottom: '8px' }}>I forgot the passcode!</strong>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                      Go to the Host computer (the PC running the server). The passcode is printed in the terminal window where you started Portexplo. Alternatively, click "Forgot Passcode" on the host computer's browser, and it will bypass security to show you the PIN.
                    </p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <strong style={{ color: 'white', display: 'block', marginBottom: '8px' }}>Uploads keep failing?</strong>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                      Check if the server is in Read-Only mode (look at the header badge). If it says "Read-Only", you must restart the Portexplo server from the terminal using the <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px' }}>--write</code> command-line argument.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
