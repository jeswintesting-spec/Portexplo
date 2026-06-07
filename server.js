const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const archiver = require('archiver');
const mime = require('mime-types');
const localtunnel = require('localtunnel');
const AdmZip = require('adm-zip');
const { execSync } = require('child_process');

// --- Parse CLI Arguments ---
let cliPort = 5050;
let cliDir = path.join(__dirname, 'shared');
let readOnly = true;
let passcode = null;
let enableTunnel = false;
let tunnelUrl = null;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--port' || arg === '-p') {
    cliPort = parseInt(process.argv[++i], 10) || 5050;
  } else if (arg === '--dir' || arg === '-d') {
    cliDir = process.argv[++i];
  } else if (arg === '--write' || arg === '-w') {
    readOnly = false;
  } else if (arg === '--passcode' || arg === '-c') {
    passcode = process.argv[++i];
  } else if (arg === '--tunnel' || arg === '-t') {
    enableTunnel = true;
  }
}

// Auto-generate passcode if tunnel is requested but no passcode is specified
if (enableTunnel && !passcode) {
  passcode = Math.floor(1000 + Math.random() * 9000).toString();
}

// Resolve shared folder to absolute real path
if (!fs.existsSync(cliDir)) {
  fs.mkdirSync(cliDir, { recursive: true });
}
let sharedDir = fs.realpathSync(path.resolve(cliDir));

console.log('=========================================');
console.log('      PORTEXPLO LOCAL FILE SERVER        ');
console.log('=========================================');
console.log(`Sharing Directory: ${sharedDir}`);
console.log(`Mode:              ${readOnly ? 'READ-ONLY (Secure)' : 'READ/WRITE (Upload/Delete enabled)'}`);
if (passcode) {
  console.log(`Passcode Security: ACTIVE (PIN: ${passcode})`);
} else {
  console.log(`Passcode Security: INACTIVE (Public Access)`);
}
console.log('=========================================\n');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'client', 'dist')));

// --- Session & Device Tracking ---
const activeSessions = new Map(); // key: ip + '|' + userAgent
const revokedSessions = new Set(); // set of ip + '|' + userAgent

// Add a mock mobile device connection for testing layout and revocation
activeSessions.set('192.168.1.100|Mozilla/5.0 (Linux; Android 10; Mobile)', {
  key: '192.168.1.100|Mozilla/5.0 (Linux; Android 10; Mobile)',
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0 (Linux; Android 10; Mobile)',
  deviceType: 'Mobile',
  lastActive: new Date().toISOString()
});

const activityLogs = [];
function addLog(action, details, req = null) {
  let ipString = '';
  if (req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    ipString = ` (IP: ${ip === '::1' || ip === '127.0.0.1' ? 'Localhost' : ip})`;
  }
  const logEntry = {
    id: Date.now() + Math.random().toString(36).substr(2, 5),
    timestamp: new Date().toLocaleTimeString(),
    action,
    details: details + ipString
  };
  activityLogs.push(logEntry);
  if (activityLogs.length > 50) {
    activityLogs.shift();
  }
}

function trackSession(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown User Agent';
  const sessionKey = ip + '|' + userAgent;

  let deviceType = 'Desktop';
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'Tablet';
  }

  activeSessions.set(sessionKey, {
    key: sessionKey,
    ip,
    userAgent,
    deviceType,
    lastActive: new Date()
  });
}

// --- Authentication Middleware ---
function isLocalhostRequest(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function authenticate(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const userAgent = req.headers['user-agent'] || 'Unknown User Agent';
  const sessionKey = ip + '|' + userAgent;

  if (revokedSessions.has(sessionKey)) {
    return res.status(401).json({ error: 'Session has been revoked by the host.' });
  }

  // Host machine (localhost) is always auto-authorized — no passcode needed
  if (isLocalhostRequest(req)) {
    trackSession(req);
    return next();
  }

  if (!passcode) {
    trackSession(req);
    return next(); // No passcode security configured — open access
  }

  // 1. Check HTTP Authorization Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token === passcode) {
      trackSession(req);
      return next();
    }
  }

  // 2. Check URL Query Parameter
  const queryToken = req.query.token;
  if (queryToken === passcode) {
    trackSession(req);
    return next();
  }

  res.status(401).json({ error: 'Unauthorized: Invalid passcode' });
}

// --- Helper Functions ---

// Secure Path Join - Prevents Directory Traversal
function getSafePath(relativePath = '') {
  const safePath = path.resolve(path.join(sharedDir, relativePath));
  if (safePath === sharedDir) {
    return safePath;
  }
  if (!safePath.startsWith(sharedDir + path.sep)) {
    throw new Error('Access Denied: Path traversal detected');
  }
  return safePath;
}

// Determine File Type Category
function getFileTypeCategory(ext) {
  const extension = ext.toLowerCase();
  const categories = {
    image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff', '.ico'],
    video: ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.flv', '.wmv'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma'],
    pdf: ['.pdf'],
    text: ['.txt', '.md', '.json', '.csv', '.log', '.ini', '.yaml', '.yml', '.xml'],
    code: ['.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.py', '.java', '.cpp', '.c', '.h', '.sh', '.go', '.rs', '.php', '.rb', '.sql', '.json'],
    archive: ['.zip', '.tar', '.gz', '.rar', '.7z', '.tgz']
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }
  return 'other';
}

// Get File Information Object
function getFileInfo(itemPath, filename) {
  const fullPath = path.join(itemPath, filename);
  const stat = fs.statSync(fullPath);
  const isDirectory = stat.isDirectory();
  const ext = isDirectory ? '' : path.extname(filename);
  const relPath = path.relative(sharedDir, fullPath);

  return {
    name: filename,
    path: relPath,
    isDirectory,
    size: stat.size,
    modified: stat.mtime,
    created: stat.birthtime,
    type: isDirectory ? 'directory' : getFileTypeCategory(ext),
    mimeType: isDirectory ? null : (mime.lookup(fullPath) || 'application/octet-stream')
  };
}

// Get Server IP Addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// --- API Endpoints ---

// Public Server Config & IP Information (does not require authenticate middleware)
app.get('/api/config', (req, res) => {
  const isHost = isLocalhostRequest(req);
  res.json({
    sharedDirName: path.basename(sharedDir),
    sharedDirPath: sharedDir,
    readOnly,
    ips: getLocalIPs(),
    port: cliPort,
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    passcodeRequired: !!passcode,
    globalUrl: tunnelUrl,
    isHostMachine: isHost  // true only when accessed from localhost
  });
});

// Recursive File Search API (Protected)
app.get('/api/search', authenticate, (req, res) => {
  try {
    const query = (req.query.q || '').trim().toLowerCase();
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    addLog('Search', `Searched for "${query}"`, req);

    const results = [];
    const MAX_RESULTS = 100;

    // Recursively walk the shared directory
    function walkDir(dirPath, depth) {
      if (depth > 8 || results.length >= MAX_RESULTS) return;
      let entries;
      try {
        entries = fs.readdirSync(dirPath);
      } catch (e) {
        return; // skip unreadable dirs
      }

      for (const entry of entries) {
        if (results.length >= MAX_RESULTS) break;
        // Skip hidden files/folders
        if (entry.startsWith('.')) continue;

        const fullPath = path.join(dirPath, entry);
        if (entry.toLowerCase().includes(query)) {
          try {
            results.push(getFileInfo(dirPath, entry));
          } catch (e) { /* skip */ }
        }

        // Recurse into subdirectories
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath, depth + 1);
          }
        } catch (e) { /* skip */ }
      }
    }

    walkDir(sharedDir, 0);

    res.json({ results, query });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Host Recovery — localhost ONLY, no auth required
// If someone forgets the passcode, they can recover it IF they have physical access
// to the host machine (i.e., accessing from localhost / 127.0.0.1 / ::1)
app.get('/api/host-recovery', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

  if (!isLocalhost) {
    return res.status(403).json({
      error: 'Recovery is only available from the host machine.',
      hint: 'Check the terminal window where Portexplo is running — the passcode is printed there.'
    });
  }

  if (!passcode) {
    return res.json({ noPasscode: true, message: 'This server has no passcode set.' });
  }

  addLog('Recovery', 'Host recovery passcode viewed from localhost', req);
  res.json({ passcode });
});

// Authenticate passcode route (frontend verification helper)

app.post('/api/auth', (req, res) => {
  const { code } = req.body;
  if (!passcode) {
    return res.json({ success: true, message: 'No passcode required' });
  }
  if (code === passcode) {
    // Clear revoked state on successful passcode entry
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown User Agent';
    const sessionKey = ip + '|' + userAgent;
    revokedSessions.delete(sessionKey);

    trackSession(req);
    addLog('Auth', 'Logged in successfully', req);
    res.json({ success: true });
  } else {
    addLog('Auth', 'Failed passcode attempt', req);
    res.status(401).json({ success: false, error: 'Invalid passcode' });
  }
});

// File List API (Protected)
app.get('/api/files', authenticate, (req, res) => {
  try {
    const relPath = req.query.path || '';
    addLog('Navigate', `Browsed folder "${relPath || 'Root'}"`, req);
    const targetPath = getSafePath(relPath);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Specified path is not a directory' });
    }

    const files = fs.readdirSync(targetPath);
    const result = [];

    for (const file of files) {
      try {
        result.push(getFileInfo(targetPath, file));
      } catch (err) {
        console.warn(`Error reading file stats for: ${file}`, err.message);
      }
    }

    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    res.json({
      currentPath: relPath,
      parentPath: relPath ? path.dirname(relPath) : null,
      files: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File Download & Preview Router (Protected)
app.get('/api/download', authenticate, (req, res) => {
  try {
    const relPath = req.query.path || '';
    const targetPath = getSafePath(relPath);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }

    const stat = fs.statSync(targetPath);

    if (stat.isDirectory()) {
      const folderName = path.basename(targetPath) || 'shared';
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err) => {
        console.error('Archiver error:', err);
        if (!res.headersSent) {
          res.status(500).send({ error: err.message });
        }
      });

      archive.pipe(res);
      archive.directory(targetPath, false);
      archive.finalize();
      return;
    }

    const isAttachment = req.query.download === 'true';
    if (isAttachment) {
      addLog('Download', `Downloaded file "${path.basename(targetPath)}"`, req);
      res.download(targetPath);
    } else {
      const mimeType = mime.lookup(targetPath) || 'application/octet-stream';
      addLog('Download', `Streamed/Viewed file "${path.basename(targetPath)}"`, req);
      res.setHeader('Content-Type', mimeType);
      res.sendFile(targetPath);
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const relPath = req.query.path || '';
      const targetPath = getSafePath(relPath);
      cb(null, targetPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// File Upload Endpoint (Protected)
app.post('/api/upload', authenticate, (req, res) => {
  if (readOnly) {
    return res.status(403).json({ error: 'Server is running in READ-ONLY mode.' });
  }

  upload.array('files')(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (req.files && req.files.length > 0) {
      const fileNames = req.files.map(f => f.originalname).join(', ');
      addLog('Upload', `Uploaded ${req.files.length} file(s): ${fileNames}`, req);
    }
    res.json({ message: 'Files uploaded successfully!', count: req.files ? req.files.length : 0 });
  });
});

// Delete Endpoint (Protected)
app.delete('/api/delete', authenticate, (req, res) => {
  if (readOnly) {
    return res.status(403).json({ error: 'Server is running in READ-ONLY mode.' });
  }

  try {
    const relPath = req.query.path || '';
    if (!relPath) {
      return res.status(400).json({ error: 'No path specified for deletion' });
    }

    const targetPath = getSafePath(relPath);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }

    addLog('Delete', `Deleted "${relPath}"`, req);
    res.json({ message: 'Item deleted successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System Diagnostics/Info Endpoint (Protected)
app.get('/api/sysinfo', authenticate, (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  res.json({
    uptime: os.uptime(),
    loadAverage: os.loadavg(),
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percentage: ((usedMem / totalMem) * 100).toFixed(1)
    },
    platform: os.platform(),
    cpuCount: os.cpus().length,
    cpuModel: os.cpus()[0] ? os.cpus()[0].model : 'Unknown'
  });
});

// GET Quick locations list on host PC (Protected)
app.get('/api/admin/locations', authenticate, (req, res) => {
  try {
    const locations = [];
    const homeDir = os.homedir();
    
    // Home directory
    locations.push({ name: 'Home Folder', path: homeDir });
    
    // Common directories
    const commonFolders = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Videos'];
    commonFolders.forEach(folder => {
      const fullPath = path.join(homeDir, folder);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        locations.push({ name: folder, path: fullPath });
      }
    });
    
    // Root directory
    locations.push({ name: 'Root Directory (/)', path: '/' });
    
    // Mounted Media (Linux USBs/Disks)
    const mediaDir = '/media';
    if (fs.existsSync(mediaDir)) {
      try {
        const users = fs.readdirSync(mediaDir);
        users.forEach(user => {
          const userMedia = path.join(mediaDir, user);
          if (fs.statSync(userMedia).isDirectory()) {
            const drives = fs.readdirSync(userMedia);
            drives.forEach(drive => {
              const drivePath = path.join(userMedia, drive);
              if (fs.statSync(drivePath).isDirectory()) {
                locations.push({ name: `USB/Disk: ${drive}`, path: drivePath });
              }
            });
          }
        });
      } catch (err) {
        // Ignore folder read errors
      }
    }

    // Mounted mnt
    const mntDir = '/mnt';
    if (fs.existsSync(mntDir)) {
      try {
        const mnts = fs.readdirSync(mntDir);
        mnts.forEach(mnt => {
          const mntPath = path.join(mntDir, mnt);
          if (fs.statSync(mntPath).isDirectory()) {
            locations.push({ name: `Mount: ${mnt}`, path: mntPath });
          }
        });
      } catch (err) {
        // Ignore folder read errors
      }
    }

    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST Set dynamic shared directory root (Protected)
app.post('/api/admin/set-root', authenticate, (req, res) => {
  try {
    const { newPath } = req.body;
    if (!newPath) {
      return res.status(400).json({ error: 'New path is required' });
    }

    const resolvedPath = path.resolve(newPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Directory path does not exist on host machine' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a valid directory' });
    }

    sharedDir = fs.realpathSync(resolvedPath);
    console.log(`Dynamic Host Directory changed to: ${sharedDir}`);
    addLog('Disk Switch', `Switched shared root folder to "${sharedDir}"`, req);

    res.json({
      success: true,
      sharedDirName: path.basename(sharedDir) || 'shared',
      sharedDirPath: sharedDir
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST Update admin settings (Protected)
app.post('/api/admin/settings', authenticate, (req, res) => {
  try {
    const { newPasscode, newReadOnly } = req.body;
    
    if (newReadOnly !== undefined) {
      readOnly = !!newReadOnly;
    }
    
    if (newPasscode !== undefined) {
      if (newPasscode === null || newPasscode === '') {
        passcode = null;
      } else {
        passcode = String(newPasscode);
      }
    }
    
    console.log(`Dynamic Host settings updated: passcodeRequired=${!!passcode}, readOnly=${readOnly}`);
    addLog('Config', `Updated settings (readOnly=${readOnly}, passcode=${passcode ? 'enabled' : 'disabled'})`, req);
    
    res.json({
      success: true,
      readOnly,
      passcodeRequired: !!passcode,
      passcode: passcode
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST Compress selected files & folders into a ZIP archive (Protected)
app.post('/api/zip-selected', authenticate, (req, res) => {
  try {
    const { currentPath, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items selected for compression' });
    }

    addLog('ZIP Compress', `Compressed ${items.length} selected item(s)`, req);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="selected_files.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      if (!res.headersSent) {
        res.status(500).send({ error: err.message });
      }
    });

    archive.pipe(res);

    for (const itemName of items) {
      const itemRelativePath = currentPath ? path.join(currentPath, itemName) : itemName;
      const targetPath = getSafePath(itemRelativePath);

      if (fs.existsSync(targetPath)) {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          archive.directory(targetPath, itemName);
        } else {
          archive.file(targetPath, { name: itemName });
        }
      }
    }

    archive.finalize();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// POST Extract ZIP file (Protected)
app.post('/api/extract-zip', authenticate, (req, res) => {
  if (readOnly) {
    return res.status(403).json({ error: 'Server is running in READ-ONLY mode.' });
  }

  try {
    const { zipPath } = req.body;
    if (!zipPath) {
      return res.status(400).json({ error: 'Zip file path is required' });
    }

    const targetZipPath = getSafePath(zipPath);
    if (!fs.existsSync(targetZipPath)) {
      return res.status(404).json({ error: 'Zip file not found' });
    }

    const zipDir = path.dirname(targetZipPath);
    const zip = new AdmZip(targetZipPath);
    zip.extractAllTo(zipDir, true); // true to overwrite existing files

    console.log(`Extracted zip file: ${targetZipPath} into directory: ${zipDir}`);
    addLog('ZIP Extract', `Extracted archive "${path.basename(targetZipPath)}"`, req);
    res.json({ success: true, message: 'ZIP extracted successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET active sessions (Protected)
app.get('/api/admin/sessions', authenticate, (req, res) => {
  try {
    const now = Date.now();
    // Auto clean up sessions idle for over 2 hours
    for (const [key, session] of activeSessions.entries()) {
      if (now - new Date(session.lastActive).getTime() > 2 * 60 * 60 * 1000) {
        activeSessions.delete(key);
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'Unknown User Agent';
    const currentKey = ip + '|' + userAgent;

    const sessionsList = Array.from(activeSessions.values()).map(session => ({
      ...session,
      isCurrent: session.key === currentKey
    }));

    res.json({ sessions: sessionsList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST revoke session (Protected)
app.post('/api/admin/sessions/revoke', authenticate, (req, res) => {
  try {
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Session key is required' });
    }

    revokedSessions.add(key);
    activeSessions.delete(key);

    const targetIp = key.split('|')[0];
    addLog('Revoke', `Revoked access for device: ${targetIp}`, req);
    console.log(`Session revoked: ${key}`);
    res.json({ success: true, message: 'Session revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lightweight endpoint to check authentication and revocation status (Protected)
app.get('/api/auth/status', authenticate, (req, res) => {
  res.json({ authenticated: true });
});

// GET active logs (Protected)
app.get('/api/admin/logs', authenticate, (req, res) => {
  res.json({ logs: activityLogs });
});

// Helper: Calculate Host Disk Space
function getDiskSpace(dirPath) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`wmic logicaldisk where "DeviceID='${path.parse(dirPath).root.replace('\\\\', '')}'" get Size,FreeSpace /value`, { encoding: 'utf8' });
      const lines = output.split('\n');
      let free = 0;
      let total = 0;
      lines.forEach(line => {
        if (line.startsWith('FreeSpace=')) free = parseInt(line.split('=')[1].trim(), 10);
        if (line.startsWith('Size=')) total = parseInt(line.split('=')[1].trim(), 10);
      });
      return { total, free, used: total - free };
    } else {
      const output = execSync(`df -B1 "${dirPath}" | tail -n 1`, { encoding: 'utf8' });
      const parts = output.trim().split(/\s+/);
      const total = parseInt(parts[1], 10);
      const used = parseInt(parts[2], 10);
      const free = parseInt(parts[3], 10);
      return { total, free, used };
    }
  } catch (err) {
    return { total: 250 * 1024 * 1024 * 1024, free: 120 * 1024 * 1024 * 1024, used: 130 * 1024 * 1024 * 1024 };
  }
}

// Helper: Calculate File Size breakdown by categories recursively
function getFolderBreakdown(dirPath) {
  const breakdown = {
    image: 0,
    video: 0,
    audio: 0,
    document: 0,
    archive: 0,
    other: 0
  };
  let scannedCount = 0;

  function scan(currentDir, depth = 0) {
    if (depth > 5 || scannedCount > 500) return;
    try {
      const items = fs.readdirSync(currentDir);
      for (const item of items) {
        if (scannedCount > 500) break;
        const fullPath = path.join(currentDir, item);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (e) {
          continue;
        }
        if (stat.isDirectory()) {
          scan(fullPath, depth + 1);
        } else {
          scannedCount++;
          const ext = path.extname(item);
          const cat = getFileTypeCategory(ext);
          const size = stat.size;
          if (cat === 'image') breakdown.image += size;
          else if (cat === 'video') breakdown.video += size;
          else if (cat === 'audio') breakdown.audio += size;
          else if (cat === 'pdf' || cat === 'text') breakdown.document += size;
          else if (cat === 'archive') breakdown.archive += size;
          else breakdown.other += size;
        }
      }
    } catch (err) {}
  }

  scan(dirPath);
  return breakdown;
}

// GET storage diagnostics (Protected)
app.get('/api/admin/storage', authenticate, (req, res) => {
  try {
    const disk = getDiskSpace(sharedDir);
    const breakdown = getFolderBreakdown(sharedDir);
    res.json({ disk, breakdown });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback to React Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// Start listening and set up tunnel
app.listen(cliPort, '0.0.0.0', async () => {
  const ips = getLocalIPs();
  console.log('\n=========================================');
  console.log(`Server is running locally at:`);
  console.log(`- Local URL:   http://localhost:${cliPort}`);
  ips.forEach(ip => {
    console.log(`- Network URL: http://${ip}:${cliPort}`);
  });
  console.log('=========================================');

  if (enableTunnel) {
    console.log('Starting global tunnel via localtunnel...');
    try {
      const tunnel = await localtunnel({ port: cliPort, local_host: '127.0.0.1' });
      tunnelUrl = tunnel.url;
      console.log('=========================================');
      console.log(`GLOBAL ACCESS ONLINE!`);
      console.log(`- Public URL:  ${tunnelUrl}`);
      console.log(`- Passcode Required: ${passcode}`);
      console.log('=========================================\n');

      tunnel.on('close', () => {
        console.warn('Global tunnel was closed.');
        tunnelUrl = null;
      });
    } catch (err) {
      console.error('Failed to initialize localtunnel:', err.message);
    }
  }
});
