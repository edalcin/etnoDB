/**
 * Curation Context Application
 *
 * Port 3002 - Data curation interface for reviewing and approving references
 * Allows curators to edit, approve, or reject submitted references
 */

const express = require('express');
const path = require('path');
const config = require('../../shared/config');
const logger = require('../../shared/logger');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Static files
app.use('/styles', express.static(path.join(__dirname, '../../../../frontend/dist/styles')));
app.use('/styles/curation', express.static(path.join(__dirname, '../../../../frontend/src/curation/styles')));

// Request logging
app.use((req, res, next) => {
  logger.curation(`${req.method} ${req.path}`);
  next();
});

// Import routes
const routes = require('./routes');
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Curation context error:', err.message);

  res.status(err.status || 500);
  res.render('error', {
    message: err.message || 'Ocorreu um erro no servidor',
    error: config.isDevelopment ? err : {}
  });
});

module.exports = app;
