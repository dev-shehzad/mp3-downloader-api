const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { setup } = require('./setup');

const youtubeRouter = require('./routes/youtube');
const soundcloudRouter = require('./routes/soundcloud');

// ─── Auto-setup: download yt-dlp + verify ffmpeg on startup ─────────────────
// This runs BEFORE the server starts, so routes are only registered after
// all dependencies are confirmed available.
setup().then(startServer).catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});

function startServer() {

const app = express();
const PORT = process.env.PORT || 3001;

// Create temp directory for downloads
const TEMP_DIR = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Rate limiting (generous for local extension usage)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Routes
app.use('/api/youtube', youtubeRouter);
app.use('/api/soundcloud', soundcloudRouter);

// Serve temp files for download
app.use('/download', express.static(TEMP_DIR));

// Health checks
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MP3 Downloader Backend Running', version: '1.0.1' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MP3 Downloader Backend Running', version: '1.0.1' });
});

// Cleanup old temp files every 30 minutes
setInterval(() => {
  const now = Date.now();
  if (fs.existsSync(TEMP_DIR)) {
    fs.readdirSync(TEMP_DIR).forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > 30 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {}
    });
  }
}, 30 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`\n🎵 MP3 Downloader Backend running on http://localhost:${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health\n`);
  });

  return app;
}

module.exports = { startServer };
