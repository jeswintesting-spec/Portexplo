import React, { useRef, useState } from 'react';
import { UploadCloud, ShieldAlert, File } from 'lucide-react';

export default function UploadZone({ currentPath, readOnly, onUpload, uploadQueue }) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (readOnly) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files);
    }
  };

  const onButtonClick = () => {
    if (readOnly) return;
    fileInputRef.current.click();
  };

  return (
    <div className="glass-panel upload-panel">
      <h3 className="upload-title">
        <UploadCloud size={20} className={readOnly ? 'color-other' : 'color-directory'} />
        {readOnly ? 'Uploads Disabled' : 'Upload Files'}
      </h3>

      <div
        className={`dropzone ${dragActive ? 'active' : ''} ${readOnly ? 'disabled-zone' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        style={{ opacity: readOnly ? 0.6 : 1, cursor: readOnly ? 'not-allowed' : 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={readOnly}
        />

        {readOnly ? (
          <>
            <ShieldAlert className="dropzone-icon color-pdf" size={36} />
            <p className="dropzone-text" style={{ color: 'var(--danger)', fontWeight: 600 }}>
              Folder is Write-Protected
            </p>
            <p className="dropzone-subtext">Run the server with the '--write' flag to enable uploads.</p>
          </>
        ) : (
          <>
            <UploadCloud className="dropzone-icon color-directory" size={36} />
            <p className="dropzone-text">
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Drag & Drop</span> files or click to browse
            </p>
            <p className="dropzone-subtext">Uploading to: /{currentPath || 'shared'}</p>
          </>
        )}
      </div>

      {/* Upload Progress Queue */}
      {uploadQueue.length > 0 && (
        <div className="upload-progress-container">
          <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Upload Queue</h4>
          {uploadQueue.map((item) => (
            <div key={item.id} className="upload-item">
              <div className="upload-item-header">
                <span className="upload-item-name">{item.name}</span>
                <span style={{ color: item.status === 'failed' ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'done' && 'Done'}
                  {item.status === 'failed' && 'Failed'}
                </span>
              </div>
              <div className="upload-item-progress-bar">
                <div
                  className="upload-item-progress-fill"
                  style={{
                    width: `${item.progress}%`,
                    backgroundColor: item.status === 'failed' ? 'var(--danger)' : undefined,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
