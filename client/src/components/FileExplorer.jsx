import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Folder, File, Image, Film, Music, FileText, FileCode, Archive, 
  Search, Grid, List, ChevronRight, Download, Link2, Trash2, Compass, X, Loader2, FolderOpen
} from 'lucide-react';

export default function FileExplorer({ 
  currentPath, parentPath, files, readOnly, onNavigate, onPreview, onDelete, showToast, config, passcode, onChangeRoot
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'date' | 'size' | 'type'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Deep search state
  const [deepSearchResults, setDeepSearchResults] = useState(null); // null = inactive, [] = no results
  const [deepSearchLoading, setDeepSearchLoading] = useState(false);
  const [deepSearchActive, setDeepSearchActive] = useState(false);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Reset selection when current path changes
  useEffect(() => {
    setSelectedFiles([]);
  }, [currentPath]);

  // Ctrl+K shortcut to focus search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape' && deepSearchActive) {
        clearSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deepSearchActive]);

  // Debounced deep search — triggers API after 400ms of no typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery || searchQuery.trim().length < 2) {
      setDeepSearchResults(null);
      setDeepSearchActive(false);
      return;
    }

    setDeepSearchActive(true);
    setDeepSearchLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const headers = passcode ? { 'Authorization': `Bearer ${passcode}` } : {};
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setDeepSearchResults(data.results);
        } else {
          setDeepSearchResults([]);
        }
      } catch (err) {
        setDeepSearchResults([]);
      } finally {
        setDeepSearchLoading(false);
      }
    }, 400);
  }, [searchQuery, passcode]);

  const clearSearch = () => {
    setSearchQuery('');
    setDeepSearchResults(null);
    setDeepSearchActive(false);
    searchInputRef.current?.blur();
  };

  // Navigate to a deep search result
  const handleSearchResultClick = (file) => {
    clearSearch();
    if (file.isDirectory) {
      onNavigate(file.path);
    } else {
      // Navigate to the folder containing the file, then preview it
      const parentDir = file.path.includes('/') 
        ? file.path.substring(0, file.path.lastIndexOf('/')) 
        : '';
      onNavigate(parentDir);
      setTimeout(() => onPreview(file), 150);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    const props = { size: 24 };
    switch (type) {
      case 'directory': return <Folder className="color-directory" {...props} />;
      case 'image': return <Image className="color-image" {...props} />;
      case 'video': return <Film className="color-video" {...props} />;
      case 'audio': return <Music className="color-audio" {...props} />;
      case 'pdf': return <FileText className="color-pdf" {...props} />;
      case 'text': return <FileText className="color-text" {...props} />;
      case 'code': return <FileCode className="color-code" {...props} />;
      case 'archive': return <Archive className="color-archive" {...props} />;
      default: return <File className="color-other" {...props} />;
    }
  };

  // Build Breadcrumbs
  const renderBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    return (
      <div className="breadcrumbs-bar">
        <span 
          className={`breadcrumb-item ${!currentPath ? 'active' : ''}`}
          onClick={() => onNavigate('')}
        >
          <Folder size={16} />
          {config?.sharedDirName || 'shared'}
        </span>
        
        {config && (
          <button 
            className="breadcrumb-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onChangeRoot();
            }}
            title="Switch Shared Directory / Disk Partition"
          >
            <Compass size={13} />
          </button>
        )}
        
        {parts.map((part, index) => {
          const pathLink = parts.slice(0, index + 1).join('/');
          const isActive = index === parts.length - 1;
          return (
            <React.Fragment key={pathLink}>
              <span className="breadcrumb-separator"><ChevronRight size={14} /></span>
              <span 
                className={`breadcrumb-item ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(pathLink)}
              >
                {part}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Handle Copy File Share Link
  const handleCopyLink = (e, file) => {
    e.stopPropagation();
    const ipAddress = config?.ips && config.ips.length > 0 ? config.ips[0] : 'localhost';
    const localNetworkUrl = `http://${ipAddress}:${config.port}`;
    const baseUrl = config?.globalUrl ? config.globalUrl : localNetworkUrl;
    
    const tokenParam = passcode ? `&token=${encodeURIComponent(passcode)}` : '';
    const link = `${baseUrl}/api/download?path=${encodeURIComponent(file.path)}${tokenParam}`;
    
    navigator.clipboard.writeText(link);
    showToast('Success', 'File share link copied to clipboard!');
  };

  // Handle Quick Download
  const handleDownload = (e, file) => {
    e.stopPropagation();
    const tokenParam = passcode ? `&token=${encodeURIComponent(passcode)}` : '';
    window.location.href = `/api/download?path=${encodeURIComponent(file.path)}&download=true${tokenParam}`;
  };

  // Handle Delete
  const handleDelete = (e, file) => {
    e.stopPropagation();
    if (readOnly) return;
    
    const confirmMsg = `Are you sure you want to delete this ${file.isDirectory ? 'folder' : 'file'}?\n"${file.name}"`;
    if (window.confirm(confirmMsg)) {
      onDelete(file.path);
    }
  };

  // Toggle selection checkbox
  const toggleSelect = (e, file) => {
    e.stopPropagation();
    setSelectedFiles(prev => 
      prev.includes(file.name)
        ? prev.filter(name => name !== file.name)
        : [...prev, file.name]
    );
  };

  // Toggle select all items in current view
  const toggleSelectAll = () => {
    if (selectedFiles.length === sortedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(sortedFiles.map(file => file.name));
    }
  };

  // Download selected files as a ZIP
  const handleDownloadSelected = async () => {
    if (selectedFiles.length === 0) return;
    showToast('Info', 'Preparing ZIP archive...');
    try {
      const res = await fetch('/api/zip-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        },
        body: JSON.stringify({
          currentPath,
          items: selectedFiles
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        showToast('Error', errorData.error || 'Failed to compress files');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_files_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Success', 'Download started!');
      setSelectedFiles([]); // clear selection
    } catch (err) {
      showToast('Error', 'Network error generating ZIP archive.');
    }
  };

  // Delete all selected files/folders
  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0 || readOnly) return;
    const confirmMsg = `Are you sure you want to delete these ${selectedFiles.length} selected items?`;
    if (!window.confirm(confirmMsg)) return;

    showToast('Info', 'Deleting selected items...');
    let successCount = 0;
    let failCount = 0;

    for (const itemName of selectedFiles) {
      const itemRelativePath = currentPath ? `${currentPath}/${itemName}` : itemName;
      try {
        const res = await fetch(`/api/delete?path=${encodeURIComponent(itemRelativePath)}`, {
          method: 'DELETE',
          headers: {
            ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
          }
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    if (successCount > 0) {
      showToast('Success', `Successfully deleted ${successCount} items.`);
    }
    if (failCount > 0) {
      showToast('Error', `Failed to delete ${failCount} items.`);
    }

    onNavigate(currentPath); // reload folder list
    setSelectedFiles([]);
  };

  // Extract a ZIP archive on the host computer
  const handleExtractZip = async (e, file) => {
    e.stopPropagation();
    if (readOnly) return;
    if (!window.confirm(`Are you sure you want to extract "${file.name}" in the current folder?`)) {
      return;
    }

    showToast('Info', 'Extracting ZIP archive...');
    try {
      const res = await fetch('/api/extract-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(passcode ? { 'Authorization': `Bearer ${passcode}` } : {})
        },
        body: JSON.stringify({ zipPath: file.path })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Success', 'ZIP archive extracted successfully!');
        onNavigate(currentPath); // reload
      } else {
        showToast('Error', data.error || 'Failed to extract ZIP');
      }
    } catch (err) {
      showToast('Error', 'Connection error extracting ZIP');
    }
  };

  // Filter and Sort files
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    // Directories always stay on top
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    let valueA = a[sortBy];
    let valueB = b[sortBy];

    if (sortBy === 'name') {
      valueA = a.name.toLowerCase();
      valueB = b.name.toLowerCase();
    } else if (sortBy === 'date') {
      valueA = new Date(a.modified).getTime();
      valueB = new Date(b.modified).getTime();
    } else if (sortBy === 'size') {
      valueA = a.size;
      valueB = b.size;
    } else if (sortBy === 'type') {
      valueA = a.type;
      valueB = b.type;
    }

    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSortOrder = (type) => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  return (
    <div className="glass-panel explorer-panel">
      {/* Breadcrumbs */}
      {renderBreadcrumbs()}

      {/* Toolbar */}
      <div className="explorer-toolbar">
        <div className="search-wrapper" style={{ position: 'relative', flex: 1 }}>
          {deepSearchLoading 
            ? <Loader2 className="search-icon" size={16} style={{ animation: 'spin 1s linear infinite' }} />
            : <Search className="search-icon" size={16} />
          }
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search all files & folders... (Ctrl+K)" 
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={clearSearch}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', padding: '2px'
              }}
              title="Clear search (Esc)"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="toolbar-controls">
          {/* Sorting Dropdown/Buttons */}
          <button 
            className={`btn ${sortBy === 'name' ? 'btn-primary' : ''}`}
            onClick={() => toggleSortOrder('name')}
            title="Sort by Name"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          
          <button 
            className={`btn ${sortBy === 'date' ? 'btn-primary' : ''}`}
            onClick={() => toggleSortOrder('date')}
            title="Sort by Date"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>

          <button 
            className={`btn ${sortBy === 'size' ? 'btn-primary' : ''}`}
            onClick={() => toggleSortOrder('size')}
            title="Sort by Size"
            style={{ padding: '8px 12px', fontSize: '12px' }}
          >
            Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 4px' }} />

          {/* View Toggles */}
          <button 
            className={`btn btn-icon ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <Grid size={16} />
          </button>
          
          <button 
            className={`btn btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={16} />
          </button>

          {/* Quick ZIP download for current folder */}
          <button
            className="btn btn-primary"
            onClick={(e) => handleDownload(e, { path: currentPath, name: config?.sharedDirName || 'shared' })}
            style={{ gap: '6px' }}
            title="Download folder as ZIP"
          >
            <Download size={16} />
            Download ZIP
          </button>
        </div>
      </div>

      {/* Deep Search Results Overlay */}
      {deepSearchActive && (
        <div style={{
          background: 'rgba(8, 15, 30, 0.97)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          margin: '0 0 4px 0',
          maxHeight: '420px',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: '1px solid var(--border-color)',
            position: 'sticky', top: 0, background: 'rgba(8,15,30,0.98)', zIndex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Search size={13} />
              {deepSearchLoading
                ? <span>Searching across all folders...</span>
                : <span>
                    {deepSearchResults?.length > 0
                      ? <><span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{deepSearchResults.length}</span> result{deepSearchResults.length !== 1 ? 's' : ''} for <span style={{ color: 'var(--accent-cyan)' }}>"{searchQuery}"</span></>
                      : <>No results for <span style={{ color: 'var(--accent-cyan)' }}>"{searchQuery}"</span></>
                    }
                  </span>
              }
            </div>
            <button onClick={clearSearch} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={12} /> Esc
            </button>
          </div>

          {/* Results List */}
          {deepSearchLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
              Searching...
            </div>
          ) : deepSearchResults?.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Search size={28} style={{ marginBottom: '8px', opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              No files or folders match your search.
            </div>
          ) : (
            <div>
              {deepSearchResults?.map((file, i) => {
                const parentDir = file.path.includes('/')
                  ? file.path.substring(0, file.path.lastIndexOf('/'))
                  : '';
                return (
                  <div
                    key={file.path}
                    onClick={() => handleSearchResultClick(file)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      borderBottom: i < deepSearchResults.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Icon */}
                    <div style={{ flexShrink: 0 }}>
                      {file.isDirectory
                        ? <Folder size={18} className="color-directory" />
                        : file.type === 'image' ? <Image size={18} className="color-image" />
                        : file.type === 'video' ? <Film size={18} className="color-video" />
                        : file.type === 'audio' ? <Music size={18} className="color-audio" />
                        : file.type === 'pdf' ? <FileText size={18} className="color-pdf" />
                        : file.type === 'archive' ? <Archive size={18} className="color-archive" />
                        : <File size={18} className="color-other" />
                      }
                    </div>

                    {/* Name + Path */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FolderOpen size={10} />
                        {parentDir ? parentDir : config?.sharedDirName || 'shared'}
                      </div>
                    </div>

                    {/* Type badge + size */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {file.isDirectory ? 'folder' : file.type}
                      </span>
                      {!file.isDirectory && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
                          {formatBytes(file.size)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Files Display */}

      <div className="files-container">
        {sortedFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              {searchQuery ? <Search size={64} /> : <Folder size={64} />}
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>
              {searchQuery ? 'No matching files found' : 'This folder is empty'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {searchQuery 
                ? 'Try searching for something else.' 
                : readOnly 
                  ? 'There are no files in this shared directory.'
                  : 'Place files in this directory on the host PC or upload files here.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="files-grid">
            {sortedFiles.map((file) => {
              const isSelected = selectedFiles.includes(file.name);
              return (
                <div 
                  key={file.path} 
                  className={`file-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => file.isDirectory ? onNavigate(file.path) : onPreview(file)}
                >
                  {/* Selection Checkbox */}
                  <div 
                    className={`file-checkbox-wrapper ${selectedFiles.length > 0 ? 'has-selection' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input 
                      type="checkbox"
                      className="file-checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(e, file)}
                    />
                  </div>

                  {/* Floating Actions */}
                  <div className="file-card-actions">
                    {!readOnly && file.name.toLowerCase().endsWith('.zip') && (
                      <button 
                        className="action-icon-btn" 
                        onClick={(e) => handleExtractZip(e, file)}
                        title="Extract ZIP here"
                      >
                        <FolderOpen size={13} />
                      </button>
                    )}
                    <button 
                      className="action-icon-btn" 
                      onClick={(e) => handleCopyLink(e, file)}
                      title="Copy Share Link"
                    >
                      <Link2 size={13} />
                    </button>
                    <button 
                      className="action-icon-btn" 
                      onClick={(e) => handleDownload(e, file)}
                      title="Download"
                    >
                      <Download size={13} />
                    </button>
                    {!readOnly && (
                      <button 
                        className="action-icon-btn danger-hover" 
                        onClick={(e) => handleDelete(e, file)}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="file-icon-container">
                    {getFileIcon(file.type)}
                  </div>
                  
                  <div className="file-card-name" title={file.name}>
                    {file.name}
                  </div>
                  
                  <div className="file-card-meta">
                    {file.isDirectory ? 'Folder' : formatBytes(file.size)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="files-list">
            {sortedFiles.map((file) => {
              const isSelected = selectedFiles.includes(file.name);
              return (
                <div 
                  key={file.path} 
                  className={`file-row ${isSelected ? 'selected' : ''}`}
                  onClick={() => file.isDirectory ? onNavigate(file.path) : onPreview(file)}
                >
                  {/* Checkbox selector column */}
                  <div className="file-row-select" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox"
                      className="file-checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(e, file)}
                    />
                  </div>

                  <div className="file-row-icon">
                    {getFileIcon(file.type)}
                  </div>

                  <div className="file-row-name" title={file.name}>
                    {file.name}
                  </div>

                  <div className="file-row-size">
                    {file.isDirectory ? 'Folder' : formatBytes(file.size)}
                  </div>

                  <div className="file-row-date">
                    {new Date(file.modified).toLocaleDateString()} {new Date(file.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className="file-row-actions">
                    {!readOnly && file.name.toLowerCase().endsWith('.zip') && (
                      <button 
                        className="action-icon-btn" 
                        onClick={(e) => handleExtractZip(e, file)}
                        title="Extract ZIP here"
                      >
                        <FolderOpen size={14} />
                      </button>
                    )}
                    <button 
                      className="action-icon-btn" 
                      onClick={(e) => handleCopyLink(e, file)}
                      title="Copy Share Link"
                    >
                      <Link2 size={14} />
                    </button>
                    <button 
                      className="action-icon-btn" 
                      onClick={(e) => handleDownload(e, file)}
                      title="Download"
                    >
                      <Download size={14} />
                    </button>
                    {!readOnly && (
                      <button 
                        className="action-icon-btn danger-hover" 
                        onClick={(e) => handleDelete(e, file)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Selected Actions Bar */}
      <div className={`selection-bar-container ${selectedFiles.length > 0 ? 'active' : ''}`}>
        <div className="selection-info">
          {selectedFiles.length} item{selectedFiles.length > 1 ? 's' : ''} selected
        </div>
        <div className="selection-actions">
          <button className="selection-btn selection-btn-secondary" onClick={toggleSelectAll}>
            {selectedFiles.length === sortedFiles.length ? 'Deselect All' : 'Select All'}
          </button>
          
          <button className="selection-btn btn-primary" onClick={handleDownloadSelected}>
            <Download size={14} /> Download ZIP
          </button>
          
          {!readOnly && (
            <button className="selection-btn selection-btn-danger" onClick={handleDeleteSelected}>
              <Trash2 size={14} /> Delete Selected
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
