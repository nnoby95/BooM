/**
 * TW Controller - Central Server
 * Main entry point for Express + WebSocket server
 */

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { initWebSocket } = require('./websocket');
const templateManager = require('./state/templates');
const apiRoutes = require('./routes/api');
const commandRoutes = require('./routes/commands');
const farmRoutes = require('./routes/farm');
const debugRoutes = require('./routes/debug');
const { logger } = require('./utils/logger');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// API routes
app.use('/api', apiRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/farm', farmRoutes);
app.use('/api/debug', debugRoutes);

// Serve userscript with proper headers for Tampermonkey
app.get('/tw-agent-v1.0.12.user.js', (req, res) => {
  const scriptPath = path.join(__dirname, 'public', 'tw-agent-v1.0.12.user.js');
  res.setHeader('Content-Type', 'text/javascript; charset=UTF-8');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(scriptPath);
});

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Express error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Create HTTPS server with self-signed certificate
const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
}, app);

// Initialize WebSocket server
const wss = initWebSocket(server);

// Start server
server.listen(PORT, HOST, () => {
  logger.info(`TW Controller Server started (HTTPS/WSS)`);
  logger.info(`HTTPS: https://${HOST}:${PORT}`);
  logger.info(`WebSocket: wss://${HOST}:${PORT}/ws`);
  logger.info(`Dashboard: https://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, server, wss };
