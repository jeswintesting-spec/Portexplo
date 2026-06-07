import React, { useEffect, useState } from 'react';
import { X, Download, Link2, File, FileText, Image, Film, Music, ChevronLeft, ChevronRight, Play, Pause, Check, Copy } from 'lucide-react';
import PdfPresenter from './PdfPresenter';
import AudioVisualizer from './AudioVisualizer';

export default function FilePreview({ file, files = [], onSelectFile, onClose, showToast, config, passcode }) {
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);

  // Filter media files (images, videos, audio) for playlist/lightbox navigation
  const mediaFiles = files.filter(f => f.type === 'image' || f.type === 'video' || f.type === 'audio');
  const currentIndex = mediaFiles.findIndex(f => f.path === file.path);
  const isMedia = file.type === 'image' || file.type === 'video' || file.type === 'audio';

  const [presentationMode, setPresentationMode] = useState(file.type === 'pdf');

  useEffect(() => {
    setPresentationMode(file.type === 'pdf');
  }, [file.path, file.type]);

  // Construct URLs with passcode token parameter (needed to authorize direct browser media requests)
  const tokenParam = passcode ? `&token=${encodeURIComponent(passcode)}` : '';
  const fileUrl = `/api/download?path=${encodeURIComponent(file.path)}${tokenParam}`;
  const downloadUrl = `/api/download?path=${encodeURIComponent(file.path)}&download=true${tokenParam}`;
  
  // Derive full network share URL (globalUrl is priority if global tunnel is active)
  const ipAddress = config?.ips && config.ips.length > 0 ? config.ips[0] : 'localhost';
  const localNetworkUrl = `http://${ipAddress}:${config.port}`;
  const baseUrl = config?.globalUrl ? config.globalUrl : localNetworkUrl;
  const networkShareUrl = config ? `${baseUrl}/api/download?path=${encodeURIComponent(file.path)}${tokenParam}` : '';

  // Fetch Text/Code Content if applicable
  useEffect(() => {
    if (file.type === 'text' || file.type === 'code') {
      setLoading(true);
      fetch(fileUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to read file');
          return res.text();
        })
        .then((text) => {
          setTextContent(text);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setTextContent('Error loading file content: ' + err.message);
          setLoading(false);
        });
    }
  }, [file.path, file.type, fileUrl]);

  // Slideshow Autoplay Loop
  useEffect(() => {
    let timer;
    if (slideshowActive && mediaFiles.length > 1 && onSelectFile) {
      timer = setInterval(() => {
        const nextIndex = (currentIndex + 1) % mediaFiles.length;
        onSelectFile(mediaFiles[nextIndex]);
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [slideshowActive, currentIndex, mediaFiles, onSelectFile]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && mediaFiles.length > 1 && currentIndex !== -1 && onSelectFile) {
        const nextIndex = (currentIndex + 1) % mediaFiles.length;
        onSelectFile(mediaFiles[nextIndex]);
      } else if (e.key === 'ArrowLeft' && mediaFiles.length > 1 && currentIndex !== -1 && onSelectFile) {
        const prevIndex = (currentIndex - 1 + mediaFiles.length) % mediaFiles.length;
        onSelectFile(mediaFiles[prevIndex]);
      } else if (e.key === ' ' && mediaFiles.length > 1 && currentIndex !== -1) {
        // Spacebar toggles slideshow if focus isn't on a text element
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setSlideshowActive(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaFiles, onClose, onSelectFile]);

  const handleCopyLink = () => {
    if (!networkShareUrl) return;
    navigator.clipboard.writeText(networkShareUrl);
    setCopiedLink(true);
    showToast('Success', 'Direct file link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(textContent);
    setCopiedText(true);
    showToast('Success', 'File text copied to clipboard!');
    setTimeout(() => setCopiedText(false), 2000);
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderIcon = (type) => {
    const props = { size: 36 };
    switch (type) {
      case 'image': return <Image className="color-image" {...props} />;
      case 'video': return <Film className="color-video" {...props} />;
      case 'audio': return <Music className="color-audio" {...props} />;
      case 'pdf': return <FileText className="color-pdf" {...props} />;
      case 'text': return <FileText className="color-text" {...props} />;
      case 'code': return <FileText className="color-code" {...props} />;
      case 'archive': return <File className="color-archive" {...props} />;
      default: return <File className="color-other" {...props} />;
    }
  };

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="glass-panel preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title-wrapper">
            {renderIcon(file.type)}
            <div style={{ overflow: 'hidden' }}>
              <div className="preview-title" title={file.name}>{file.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{file.mimeType || 'Unknown format'}</div>
            </div>
          </div>

          {/* Slideshow & Pagination Controls (Only for media files) */}
          {isMedia && mediaFiles.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', marginRight: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                {currentIndex + 1} / {mediaFiles.length}
              </span>
              <button 
                onClick={() => setSlideshowActive(!slideshowActive)} 
                className="btn"
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  background: slideshowActive ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  color: slideshowActive ? '#00f2fe' : 'var(--text-main)',
                  border: slideshowActive ? '1px solid rgba(0, 242, 254, 0.3)' : '1px solid var(--border-color)',
                  height: '28px',
                  cursor: 'pointer'
                }}
                title={slideshowActive ? "Pause Slideshow" : "Play Slideshow (Spacebar)"}
              >
                {slideshowActive ? <Pause size={12} fill="#00f2fe" style={{ border: 'none' }} /> : <Play size={12} fill="currentColor" style={{ border: 'none' }} />}
                <span>{slideshowActive ? 'Playing' : 'Slideshow'}</span>
              </button>
            </div>
          )}

          {file.type === 'pdf' && (
            <button 
              onClick={() => setPresentationMode(!presentationMode)}
              className="btn"
              style={{ 
                padding: '6px 12px', 
                borderRadius: '12px', 
                fontSize: '11px', 
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-color)',
                height: '28px',
                marginRight: '12px',
                marginLeft: 'auto',
                cursor: 'pointer'
              }}
            >
              {presentationMode ? 'Reader Mode' : 'Presentation Mode'}
            </button>
          )}

          <button className="action-icon-btn" onClick={onClose} style={{ borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: file.type === 'pdf' ? '0' : 'auto' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content Viewer Body */}
        <div className="preview-body" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Overlay Navigation Chevrons */}
          {isMedia && mediaFiles.length > 1 && onSelectFile && (
            <>
              <button 
                onClick={() => onSelectFile(mediaFiles[(currentIndex - 1 + mediaFiles.length) % mediaFiles.length])}
                className="action-icon-btn nav-arrow-btn"
                style={{
                  position: 'absolute',
                  left: '16px',
                  zIndex: 10,
                  background: 'rgba(5, 8, 15, 0.7)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
                title="Previous Media (Left Arrow)"
              >
                <ChevronLeft size={22} />
              </button>
              <button 
                onClick={() => onSelectFile(mediaFiles[(currentIndex + 1) % mediaFiles.length])}
                className="action-icon-btn nav-arrow-btn"
                style={{
                  position: 'absolute',
                  right: '16px',
                  zIndex: 10,
                  background: 'rgba(5, 8, 15, 0.7)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}
                title="Next Media (Right Arrow)"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {file.type === 'image' && (
            <img src={fileUrl} className="preview-image" alt={file.name} style={{ maxWidth: '100%', maxHeight: '55vh', objectFit: 'contain' }} />
          )}

          {file.type === 'video' && (
            <video src={fileUrl} className="preview-video" controls autoPlay style={{ maxWidth: '100%', maxHeight: '55vh' }} />
          )}

          {file.type === 'audio' && (
            <div style={{ width: '100%', padding: '8px 0' }}>
              <AudioVisualizer fileUrl={fileUrl} fileName={file.name} />
            </div>
          )}

          {file.type === 'pdf' && (
            presentationMode ? (
              <PdfPresenter fileUrl={fileUrl} fileName={file.name} />
            ) : (
              <iframe src={fileUrl} className="preview-pdf" title={file.name} />
            )
          )}

          {(file.type === 'text' || file.type === 'code') && (
            <>
              {loading ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading file content...</div>
              ) : (
                <pre className="preview-code-box">
                  <code>{textContent}</code>
                </pre>
              )}
            </>
          )}

          {file.type !== 'image' &&
            file.type !== 'video' &&
            file.type !== 'audio' &&
            file.type !== 'pdf' &&
            file.type !== 'text' &&
            file.type !== 'code' && (
              <div className="preview-fallback">
                <div className="preview-fallback-icon">{renderIcon(file.type)}</div>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Preview unavailable</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '300px' }}>
                  This file format cannot be viewed directly inside the browser.
                </p>
                <a href={downloadUrl} className="btn btn-primary" style={{ marginTop: '12px' }}>
                  <Download size={16} />
                  Download File ({formatBytes(file.size)})
                </a>
              </div>
            )}
        </div>

        {/* Thumbnail Navigation Strip */}
        {isMedia && mediaFiles.length > 1 && onSelectFile && (
          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px 24px',
            background: 'rgba(5, 8, 15, 0.4)',
            borderTop: '1px solid var(--border-color)',
            overflowX: 'auto',
            width: '100%',
            backdropFilter: 'blur(10px)'
          }}>
            {mediaFiles.map((f, idx) => {
              const isCurrent = f.path === file.path;
              const thumbTokenParam = passcode ? `&token=${encodeURIComponent(passcode)}` : '';
              const thumbUrl = `/api/download?path=${encodeURIComponent(f.path)}${thumbTokenParam}`;
              
              return (
                <div 
                  key={f.path}
                  onClick={() => onSelectFile(f)}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: isCurrent ? '2px solid #00f2fe' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: isCurrent ? '0 0 10px rgba(0, 242, 254, 0.6)' : 'none',
                    transform: isCurrent ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={f.name}
                >
                  {f.type === 'image' ? (
                    <img src={thumbUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={f.name} />
                  ) : f.type === 'video' ? (
                    <Film size={18} style={{ color: '#00f2fe' }} />
                  ) : (
                    <Music size={18} style={{ color: '#00c6ff' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="preview-footer">
          <div className="preview-meta-details">
            <div>
              <span className="info-label">Size:</span>{' '}
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{formatBytes(file.size)}</span>
            </div>
            <div>
              <span className="info-label">Modified:</span>{' '}
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                {new Date(file.modified).toLocaleString()}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {(file.type === 'text' || file.type === 'code') && !loading && (
              <button className="btn" onClick={handleCopyText}>
                {copiedText ? <Check size={16} /> : <Copy size={16} />}
                {copiedText ? 'Copied Content' : 'Copy Text'}
              </button>
            )}
            <button className="btn" onClick={handleCopyLink}>
              {copiedLink ? <Check size={16} /> : <Link2 size={16} />}
              {copiedLink ? 'Copied Link' : 'Copy Share Link'}
            </button>
            <a href={downloadUrl} className="btn btn-primary">
              <Download size={16} />
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
