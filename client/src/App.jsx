import React, { useEffect, useState } from 'react';
import { Network, Folder, Upload, HardDrive, Wifi, Lock, Unlock, LogOut, FolderOpen, Compass, X, Activity, ChevronRight, ShieldCheck, Share2, PlayCircle, Search, Shield, Info } from 'lucide-react';
import FileExplorer from './components/FileExplorer';
import ConnectionPanel from './components/ConnectionPanel';
import UploadZone from './components/UploadZone';
import FilePreview from './components/FilePreview';
import PasscodeScreen from './components/PasscodeScreen';
import DirSelectorModal from './components/DirSelectorModal';
import SettingsPanel from './components/SettingsPanel';
import DeviceManager from './components/DeviceManager';
import ActivityLogs from './components/ActivityLogs';
import StorageInsights from './components/StorageInsights';
import UserManual from './components/UserManual';

export default function App() {
  const [config, setConfig] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState(null);
  const [files, setFiles] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [toast, setToast] = useState({ visible: false, type: 'Success', message: '' });
  const [loading, setLoading] = useState(true);
  
  // Passcode Security States
  const [passcode, setPasscode] = useState(localStorage.getItem('portexplo_passcode') || '');
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  const [isDirSelectorOpen, setIsDirSelectorOpen] = useState(false);
  const [role, setRole] = useState(null);
  const [showWelcome, setShowWelcome] = useState(!localStorage.getItem('portexplo_welcome_dismissed'));
  const [showManual, setShowManual] = useState(false);

  // Show Toast Toast Notification helper
  const showToast = (type, message) => {
    setToast({ visible: true, type, message });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Helper to generate fetch headers with passcode
  const getAuthHeaders = () => {
    const headers = {};
    if (passcode) {
      headers['Authorization'] = `Bearer ${passcode}`;
    }
    return headers;
  };

  // Capture Auto-Login Token from URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    if (tokenParam) {
      setPasscode(tokenParam);
      localStorage.setItem('portexplo_passcode', tokenParam);
      
      // Clear query string to keep address bar clean
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('Success', 'Auto-authorized via QR link!');
    }
  }, []);

  // Fetch Server Configuration on Load
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // If this IS the host machine (localhost), auto-authorize — no passcode needed
        if (data.isHostMachine) {
          setPasscodeRequired(false);
          // Clear any stale cached passcode so we don't accidentally use it
          // Host machine uses no auth header — server auto-passes localhost requests
          setPasscode('');
          localStorage.removeItem('portexplo_passcode');
        } else {
          setPasscodeRequired(data.passcodeRequired);
        }
      } else {
        console.error('Failed to load server config');
      }
    } catch (err) {
      console.error('Network error fetching config:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Fetch Files in Directory
  const fetchFiles = async (path = '') => {
    setLoading(true);
    try {
      const url = `/api/files?path=${encodeURIComponent(path)}`;
      const res = await fetch(url, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
        setParentPath(data.parentPath);
        setCurrentPath(data.currentPath);
      } else if (res.status === 401) {
        // Token expired or invalid
        showToast('Error', 'Session unauthorized. Please log in.');
        handleLogout();
      } else {
        const errorData = await res.json();
        showToast('Error', errorData.error || 'Failed to list directory contents');
      }
    } catch (err) {
      showToast('Error', 'Unable to connect to the file server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Poll/fetch files when currentPath or passcode changes
  useEffect(() => {
    if (!passcodeRequired || passcode) {
      fetchFiles(currentPath);
    }
  }, [currentPath, passcode, passcodeRequired]);

  // Log out / Reset passcode
  const handleLogout = () => {
    setPasscode('');
    localStorage.removeItem('portexplo_passcode');
    setRole(null);
  };

  // Periodically check session status — detect host revocation for REMOTE devices only
  // Host machine (localhost) is always auto-authorized, no need to poll
  useEffect(() => {
    if (!passcodeRequired || !passcode || config?.isHostMachine) return;

    const checkSessionStatus = async () => {
      try {
        const res = await fetch('/api/auth/status', {
          headers: getAuthHeaders()
        });
        if (res.status === 401) {
          showToast('Error', 'Session has been revoked by the host.');
          handleLogout();
        }
      } catch (err) {
        console.error('Session check failed:', err);
      }
    };

    const interval = setInterval(checkSessionStatus, 3000);
    return () => clearInterval(interval);
  }, [passcodeRequired, passcode, config?.isHostMachine]);

  // Navigate folder
  const handleNavigate = (path) => {
    setCurrentPath(path);
  };

  // Delete File/Folder
  const handleDelete = async (itemPath) => {
    try {
      const res = await fetch(`/api/delete?path=${encodeURIComponent(itemPath)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast('Success', 'Item deleted successfully!');
        fetchFiles(currentPath); // Refresh
      } else {
        const err = await res.json();
        showToast('Error', err.error || 'Failed to delete item');
      }
    } catch (error) {
      showToast('Error', 'Network error during deletion');
    }
  };

  // Upload Files handler using XMLHttpRequest for progress indicators
  const handleUpload = (fileList) => {
    const readOnly = config?.readOnly ?? true;
    if (readOnly) {
      showToast('Error', 'Server is in read-only mode.');
      return;
    }

    Array.from(fileList).forEach((file) => {
      const uploadId = Math.random().toString(36).substring(7);
      
      setUploadQueue((prev) => [
        ...prev,
        { id: uploadId, name: file.name, progress: 0, status: 'uploading' },
      ]);

      const formData = new FormData();
      formData.append('files', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload?path=${encodeURIComponent(currentPath)}`, true);

      // Inject authorization token
      if (passcode) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + passcode);
      }

      // Track progress
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadQueue((prev) =>
            prev.map((item) => (item.id === uploadId ? { ...item, progress: percentComplete } : item))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploadQueue((prev) =>
            prev.map((item) => (item.id === uploadId ? { ...item, status: 'done', progress: 100 } : item))
          );
          showToast('Success', `Uploaded: ${file.name}`);
          fetchFiles(currentPath); // Refresh
          
          setTimeout(() => {
            setUploadQueue((prev) => prev.filter((item) => item.id !== uploadId));
          }, 3000);
        } else {
          setUploadQueue((prev) =>
            prev.map((item) => (item.id === uploadId ? { ...item, status: 'failed' } : item))
          );
          showToast('Error', `Failed uploading: ${file.name}`);
        }
      };

      xhr.onerror = () => {
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === uploadId ? { ...item, status: 'failed' } : item))
        );
        showToast('Error', `Network error during upload: ${file.name}`);
      };

      xhr.send(formData);
    });
  };

  const handlePasscodeSuccess = (validCode) => {
    setPasscode(validCode);
    localStorage.setItem('portexplo_passcode', validCode);
    showToast('Success', 'Access Granted!');
    fetchConfig(); // Reload config
  };

  // Intercept layout if passcode is required and not provided
  if (passcodeRequired && !passcode) {
    return <PasscodeScreen onSuccess={handlePasscodeSuccess} />;
  }

  // Render role selection landing page on opening
  if (!role) {
    return (
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header className="glass-panel app-header" style={{ flexShrink: 0, zIndex: 10 }}>
          <div className="brand-section">
            <div className="brand-logo" style={{ background: 'linear-gradient(to right, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Portexplo</div>
            <span className="brand-badge" style={{ background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.2)' }}>Local-Share</span>
          </div>

          <div className="header-actions">
            {passcodeRequired && (
              <button 
                onClick={handleLogout}
                className="btn" 
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                title="Lock Server"
              >
                <LogOut size={14} /> Lock Session
              </button>
            )}
            <button 
              onClick={() => setShowManual(true)}
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.2)' }}
              title="User Manual"
            >
              <Info size={14} /> Manual
            </button>
            {!showWelcome && (
              <button 
                onClick={() => setShowWelcome(true)}
                className="btn" 
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="About Portexplo"
              >
                <Info size={14} /> About
              </button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', overflowY: 'auto' }}>
          
          {/* Decorative background elements */}
          <div style={{ position: 'absolute', top: '20%', left: '20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(0,242,254,0.08) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(40px)', zIndex: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(79,172,254,0.05) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '40px', textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                <Activity size={14} style={{ color: '#00f2fe' }} />
                Connected to {config?.hostname || 'Local Server'}
              </div>
              <h1 style={{ fontSize: '42px', fontWeight: 800, margin: '0 0 16px 0', letterSpacing: '-1px', color: 'var(--text-main)' }}>
                Select Your <span style={{ color: '#00f2fe' }}>Workspace</span>
              </h1>
              <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
                Portexplo gives you instant, secure access to files on this local network. Choose how you want to interact with the server.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', width: '100%' }}>
              
              {/* Explorer Card */}
              <div 
                className="welcome-role-card" 
                onClick={() => setRole('explorer')}
                style={{
                  background: 'rgba(15, 25, 45, 0.4)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(0, 242, 254, 0.15)',
                  borderRadius: '20px',
                  padding: '32px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  textAlign: 'left',
                  alignItems: 'stretch'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 242, 254, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'rgba(0, 242, 254, 0.15)';
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(0,242,254,0.1) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(20px)', borderTopRightRadius: '20px' }} />
                
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(0,242,254,0.1), rgba(79,172,254,0.1))', border: '1px solid rgba(0,242,254,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00f2fe', marginBottom: '8px' }}>
                  <Folder size={28} />
                </div>
                
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px 0' }}>File Explorer</h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                    Browse directories, preview images, watch videos, listen to audio, and read PDFs or code files directly in your browser. Download items or upload new files securely.
                  </p>
                </div>
                
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#00f2fe' }}>
                  Enter Workspace <ChevronRight size={16} />
                </div>
              </div>

              {/* Host Console Card */}
              <div 
                className="welcome-role-card" 
                onClick={() => setRole('host')}
                style={{
                  background: 'rgba(15, 25, 45, 0.4)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '20px',
                  padding: '32px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  textAlign: 'left',
                  alignItems: 'stretch',
                  opacity: config?.isHostMachine ? 1 : 0.8 // Slightly dim for non-hosts, though they can still click it
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(20px)', borderTopRightRadius: '20px' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)' }}>
                    <HardDrive size={28} />
                  </div>
                  {config?.isHostMachine && (
                    <span style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '999px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Host Access
                    </span>
                  )}
                </div>
                
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px 0' }}>Host Console</h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                    Manage server settings, view active network connections, monitor device sessions, and access sharing QR codes. Control who has access to your local files.
                  </p>
                </div>
                
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Open Console <ChevronRight size={16} />
                </div>
              </div>

            </div>
            
            <div style={{ marginTop: '40px', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '16px', opacity: 0.7 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> End-to-End Local</span>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Wifi size={14} /> Zero Cloud Routing</span>
            </div>
            
            <div style={{ marginTop: '60px', paddingBottom: '10px', fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>
              Developed by jsk
            </div>
          </div>
        </div>

        {/* Welcome Popup Modal */}
        {showWelcome && (
          <div className="welcome-overlay" style={{ background: 'rgba(5, 10, 22, 0.8)', backdropFilter: 'blur(8px)', zIndex: 9999, position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => {
            localStorage.setItem('portexplo_welcome_dismissed', 'true');
            setShowWelcome(false);
          }}>
            <div className="welcome-popup glass-panel" style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', borderRadius: '24px', border: '1px solid rgba(0,242,254,0.15)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
              
              {/* Modal Header with Graphic */}
              <div style={{ position: 'relative', padding: '40px 32px 32px', background: 'linear-gradient(180deg, rgba(0,242,254,0.05) 0%, rgba(5,10,22,0) 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                <button 
                  onClick={() => { localStorage.setItem('portexplo_welcome_dismissed', 'true'); setShowWelcome(false); }}
                  style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <X size={16} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#050a16', boxShadow: '0 8px 16px rgba(0,242,254,0.2)' }}>
                    <Share2 size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-main)' }}>Welcome to Portexplo</h1>
                    <div style={{ fontSize: '13px', color: '#00f2fe', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>High-Performance Local Sharing</div>
                  </div>
                </div>

                <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  Portexplo transforms this machine into a secure, high-speed file server. Instantly stream media, view documents, and transfer files across your entire local network without any internet connection.
                </p>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0,242,254,0.1)', color: '#00f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Search size={16} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>Deep Recursive Search</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Find exactly what you need instantly. Use <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>Ctrl+K</kbd> to search across all subdirectories with blazing speed.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <PlayCircle size={16} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>Native Media Streaming</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Enjoy high-quality playback. View images, watch videos, read PDFs, and listen to music with the built-in audio visualizer directly in your browser.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Shield size={16} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px' }}>Absolute Security Control</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>The Host Console provides real-time monitoring. View active connections, revoke unauthorized devices instantly, and manage passcode access.</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{ padding: '24px 32px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '12px 32px', fontSize: '14px', fontWeight: 600, borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,242,254,0.3)' }}
                  onClick={() => {
                    localStorage.setItem('portexplo_welcome_dismissed', 'true');
                    setShowWelcome(false);
                  }}
                >
                  Start Exploring
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass-panel app-header">
        <div className="brand-section">
          <div className="brand-logo" style={{ cursor: 'pointer' }} onClick={() => setRole(null)}>Portexplo</div>
          <span className="brand-badge" style={{ cursor: 'pointer' }} onClick={() => setRole(null)}>Local-Share</span>
        </div>

        <div className="header-actions">
          {config && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {/* Role Selection Tabs */}
              <div className="header-nav-tabs">
                <button 
                  className={`header-nav-tab ${role === 'explorer' ? 'active' : ''}`}
                  onClick={() => setRole('explorer')}
                >
                  <Folder size={12} /> Explore Files
                </button>
                <button 
                  className={`header-nav-tab ${role === 'host' ? 'active' : ''}`}
                  onClick={() => setRole('host')}
                >
                  <HardDrive size={12} /> Host Console
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wifi className="color-image" size={16} />
                <span>{config.hostname}</span>
              </div>
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              {config.readOnly ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                  <Lock size={14} /> Read-Only
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)' }}>
                  <Unlock size={14} /> Read-Write
                </span>
              )}

              {passcodeRequired && (
                <>
                  <span style={{ color: 'var(--text-dim)' }}>•</span>
                  <button 
                    onClick={handleLogout}
                    className="btn" 
                    style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Lock Server"
                  >
                    <LogOut size={12} /> Lock Session
                  </button>
                </>
              )}
              
              <span style={{ color: 'var(--text-dim)' }}>•</span>
              <button 
                onClick={() => setShowManual(true)}
                className="btn" 
                style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.2)' }}
                title="User Manual"
              >
                <Info size={12} /> Manual
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout (Toggles views depending on chosen role) */}
      <div className="main-layout" style={{ gridTemplateColumns: '1fr' }}>
        {role === 'explorer' ? (
          /* Explore Files View: Clean, Full-width File Manager & Upload Zone */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <FileExplorer
              currentPath={currentPath}
              parentPath={parentPath}
              files={files}
              readOnly={config?.readOnly ?? true}
              onNavigate={handleNavigate}
              onPreview={setPreviewFile}
              onDelete={handleDelete}
              showToast={showToast}
              config={config}
              passcode={passcode}
              onChangeRoot={() => setIsDirSelectorOpen(true)}
            />
            <UploadZone
              currentPath={currentPath}
              readOnly={config?.readOnly ?? true}
              onUpload={handleUpload}
              uploadQueue={uploadQueue}
            />
          </div>
        ) : (
          /* Host Console View: Full-width, 3-Column Administration Dashboard Grid */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            alignContent: 'start',
            width: '100%'
          }}>
            {/* Column 1: Connection & Host Diagnostics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ConnectionPanel config={config} showToast={showToast} passcode={passcode} />
            </div>

            {/* Column 2: Host Settings & Disk breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Directory Switcher Panel */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderOpen className="color-directory" size={20} />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Shared Directory</h3>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  This is the directory on the host computer currently shared and accessible to users.
                </p>
                <div style={{ 
                  background: 'rgba(0, 0, 0, 0.25)', 
                  border: '1px solid var(--border-color)', 
                  padding: '10px 12px', 
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  color: 'var(--text-main)'
                }}>
                  {config?.sharedDirPath || 'Loading path...'}
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setIsDirSelectorOpen(true)}
                  style={{ width: '100%', marginTop: '4px', cursor: 'pointer' }}
                >
                  <Compass size={14} style={{ marginRight: '6px' }} />
                  Change Shared Folder / Disk
                </button>
              </div>

              <SettingsPanel
                config={config}
                passcode={passcode}
                onUpdateSettings={(updatedReadOnly, passcodeRequired, newPasscode) => {
                  if (newPasscode !== undefined) {
                    setPasscode(newPasscode);
                    if (newPasscode) {
                      localStorage.setItem('portexplo_passcode', newPasscode);
                    } else {
                      localStorage.removeItem('portexplo_passcode');
                    }
                  }
                  setPasscodeRequired(passcodeRequired);
                  fetchConfig(); // Reload config
                }}
                showToast={showToast}
              />
              
              <StorageInsights passcode={passcode} />
            </div>

            {/* Column 3: Active Connections list & Server logs stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <DeviceManager passcode={passcode} showToast={showToast} />
              
              <ActivityLogs passcode={passcode} />
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace Footer */}
      <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>
        Developed by jsk
      </div>

      {/* Preview Modal overlay */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          files={files}
          onSelectFile={setPreviewFile}
          onClose={() => setPreviewFile(null)}
          showToast={showToast}
          config={config}
          passcode={passcode}
        />
      )}

      {/* User Manual Overlay */}
      {showManual && (
        <UserManual onClose={() => setShowManual(false)} />
      )}

      {/* Directory Switcher Modal */}
      <DirSelectorModal
        isOpen={isDirSelectorOpen}
        onClose={() => setIsDirSelectorOpen(false)}
        onSuccess={(newRootPath) => {
          fetchConfig();
          handleNavigate(''); // reset explorer navigation path to new root folder
        }}
        config={config}
        passcode={passcode}
        showToast={showToast}
      />

      {/* Toast Notification Popup */}
      {toast.visible && (
        <div className={`toast-notification ${toast.type === 'Success' ? 'toast-success' : 'toast-error'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
