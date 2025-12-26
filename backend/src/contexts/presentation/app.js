/**
 * Presentation Context Application
 *
 * Port 3003 - Public search interface for ethnobotanical data
 * Allows public users to search and browse approved references
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use('/styles', express.static(path.join(__dirname, '../../../../frontend/dist/styles')));
app.use('/styles/presentation', express.static(path.join(__dirname, '../../../../frontend/src/presentation/styles')));
app.use('/images', express.static(path.join(__dirname, '../../shared/public/images')));

// Request logging
app.use((req, res, next) => {
  logger.presentation(`${req.method} ${req.path}`);
  next();
});

// Import routes
const routes = require('./routes');
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Página não encontrada',
    error: {}
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Presentation context error:', err.message);

  res.status(err.status || 500);
  res.render('error', {
    message: err.message || 'Ocorreu um erro no servidor',
    error: config.isDevelopment ? err : {}
  });
});

module.exports = app;
