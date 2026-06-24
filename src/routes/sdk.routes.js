/**
 * SDK & Documentation Routes
 * GET /api/v1/sdk/:slug/:language     - Download SDK
 * GET /api/v1/sdk/:slug/languages     - Available languages
 * GET /api/v1/docs/:slug              - API documentation (OpenAPI)
 */

import { Router } from 'express';
import { generateSDK, getAvailableLanguages } from '../sdk/builder.js';
import db from '../utils/database.js';

const router = Router();

// Get available SDK languages
router.get('/:slug/languages', (req, res) => {
  res.json({ success: true, languages: getAvailableLanguages() });
});

// Generate and download SDK
router.get('/:slug/:language', (req, res) => {
  try {
    const { slug, language } = req.params;
    const sdk = generateSDK(slug, language);

    const contentTypes = {
      javascript: 'application/javascript',
      typescript: 'application/typescript',
      python: 'text/x-python',
      curl: 'text/plain',
    };

    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      curl: 'sh',
    };

    // If download query param, send as file
    if (req.query.download === 'true') {
      res.setHeader('Content-Type', contentTypes[language] || 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${slug}-sdk.${extensions[language] || 'txt'}"`);
      return res.send(sdk.code);
    }

    res.json({
      success: true,
      ...sdk,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
