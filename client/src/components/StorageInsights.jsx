import React, { useState, useEffect } from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';

export default function StorageInsights({ passcode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStorage = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/storage', {
        headers: {
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch storage insights:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorage();
    const interval = setInterval(fetchStorage, 10000);
    return () => clearInterval(interval);
  }, [passcode]);

  const formatGB = (bytes) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!data) {
    return (
      <div className="glass-panel text-left animate-pulse" style={{ padding: '20px', height: '230px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <HardDrive size={18} />
          <span>Loading storage insights...</span>
        </div>
      </div>
    );
  }

  const { disk, breakdown } = data;
  const usedPercent = disk.total > 0 ? (disk.used / disk.total) * 100 : 0;
  
  // Calculate relative breakdown percentages inside shared folder size
  const totalBreakdownSize = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const getCatColor = (cat) => {
    const colors = {
      image: '#00f2fe',     // Cyan
      video: '#4facfe',     // Blue
      audio: '#00c6ff',     // Light Blue
      document: '#f9d976',  // Yellow/Orange
      archive: '#ec77ab',   // Pink
      other: '#a0a0a0'      // Gray
    };
    return colors[cat] || colors.other;
  };

  return (
    <div className="glass-panel text-left" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={18} className="color-cyan" />
          Disk Storage & Breakdown
        </h3>
        <button 
          onClick={fetchStorage} 
          className="btn btn-icon" 
          disabled={loading}
          title="Refresh storage data"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Disk Space Usage Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
          <span>Disk Space Used ({usedPercent.toFixed(1)}%)</span>
          <span style={{ color: 'var(--text-muted)' }}>{formatGB(disk.used)} / {formatGB(disk.total)}</span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex'
        }}>
          <div style={{
            width: `${usedPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00c6ff, #00f2fe)',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
          {formatGB(disk.free)} free of {formatGB(disk.total)}
        </div>
      </div>

      {/* Shared Directory File Breakdown segments */}
      <div>
        <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 10px 0' }}>
          Shared Folder Breakdown ({formatBytes(totalBreakdownSize)})
        </h4>

        {/* Stacked File Categories Bar */}
        {totalBreakdownSize > 0 ? (
          <div style={{
            width: '100%',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '5px',
            overflow: 'hidden',
            display: 'flex',
            marginBottom: '14px'
          }}>
            {Object.entries(breakdown).map(([cat, size]) => {
              if (size === 0) return null;
              const percent = (size / totalBreakdownSize) * 100;
              return (
                <div 
                  key={cat} 
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    backgroundColor: getCatColor(cat),
                    transition: 'width 0.3s ease'
                  }}
                  title={`${cat.toUpperCase()}: ${formatBytes(size)} (${percent.toFixed(1)}%)`}
                />
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 16px 0', textAlign: 'center' }}>
            No files in shared directory.
          </div>
        )}

        {/* Categories Legend Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '11px'
        }}>
          {Object.entries(breakdown).map(([cat, size]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: getCatColor(cat),
                display: 'inline-block',
                flexShrink: 0
              }} />
              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat}: <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{formatBytes(size)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
