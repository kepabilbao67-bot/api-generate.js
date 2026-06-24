/**
 * Internationalization Routes
 * POST /api/v1/i18n/:slug/config    - Set i18n config for an API
 * GET  /api/v1/i18n/:slug/config    - Get i18n config
 * 
 * Adds multi-language error messages and response wrappers
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../utils/database.js';

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS i18n_configs (
    api_id TEXT PRIMARY KEY,
    default_language TEXT DEFAULT 'en',
    supported_languages TEXT DEFAULT '["en"]',
    translations TEXT DEFAULT '{}',
    FOREIGN KEY (api_id) REFERENCES apis(id)
  );
`);

const DEFAULT_MESSAGES = {
  en: {
    not_found: 'Resource not found',
    created: 'Created successfully',
    updated: 'Updated successfully',
    deleted: 'Deleted successfully',
    unauthorized: 'Authentication required',
    forbidden: 'Access denied',
    rate_limited: 'Too many requests, please try again later',
    validation_error: 'Validation failed',
    server_error: 'Internal server error',
  },
  es: {
    not_found: 'Recurso no encontrado',
    created: 'Creado exitosamente',
    updated: 'Actualizado exitosamente',
    deleted: 'Eliminado exitosamente',
    unauthorized: 'Autenticación requerida',
    forbidden: 'Acceso denegado',
    rate_limited: 'Demasiadas solicitudes, intente más tarde',
    validation_error: 'Error de validación',
    server_error: 'Error interno del servidor',
  },
  fr: {
    not_found: 'Ressource non trouvée',
    created: 'Créé avec succès',
    updated: 'Mis à jour avec succès',
    deleted: 'Supprimé avec succès',
    unauthorized: 'Authentification requise',
    forbidden: 'Accès refusé',
    rate_limited: 'Trop de requêtes, réessayez plus tard',
    validation_error: 'Erreur de validation',
    server_error: 'Erreur interne du serveur',
  },
  pt: {
    not_found: 'Recurso não encontrado',
    created: 'Criado com sucesso',
    updated: 'Atualizado com sucesso',
    deleted: 'Excluído com sucesso',
    unauthorized: 'Autenticação necessária',
    forbidden: 'Acesso negado',
    rate_limited: 'Muitas solicitações, tente novamente mais tarde',
    validation_error: 'Erro de validação',
    server_error: 'Erro interno do servidor',
  },
  de: {
    not_found: 'Ressource nicht gefunden',
    created: 'Erfolgreich erstellt',
    updated: 'Erfolgreich aktualisiert',
    deleted: 'Erfolgreich gelöscht',
    unauthorized: 'Authentifizierung erforderlich',
    forbidden: 'Zugriff verweigert',
    rate_limited: 'Zu viele Anfragen, bitte später erneut versuchen',
    validation_error: 'Validierungsfehler',
    server_error: 'Interner Serverfehler',
  },
};

// Set i18n config
router.post('/:slug/config', requireAuth, (req, res) => {
  const api = db.prepare('SELECT id FROM apis WHERE slug = ? AND owner_id = ?')
    .get(req.params.slug, req.user.userId);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const { defaultLanguage, supportedLanguages, customTranslations } = req.body;

  db.prepare(`
    INSERT OR REPLACE INTO i18n_configs (api_id, default_language, supported_languages, translations)
    VALUES (?, ?, ?, ?)
  `).run(
    api.id,
    defaultLanguage || 'en',
    JSON.stringify(supportedLanguages || ['en']),
    JSON.stringify(customTranslations || {})
  );

  res.json({ success: true, message: 'i18n config updated', availableLanguages: Object.keys(DEFAULT_MESSAGES) });
});

// Get i18n config
router.get('/:slug/config', (req, res) => {
  const api = db.prepare("SELECT id FROM apis WHERE slug = ?").get(req.params.slug);
  if (!api) return res.status(404).json({ error: 'API not found' });

  const config = db.prepare('SELECT * FROM i18n_configs WHERE api_id = ?').get(api.id);

  res.json({
    success: true,
    config: config ? {
      defaultLanguage: config.default_language,
      supportedLanguages: JSON.parse(config.supported_languages),
      translations: JSON.parse(config.translations),
    } : { defaultLanguage: 'en', supportedLanguages: ['en'] },
    availableLanguages: Object.keys(DEFAULT_MESSAGES),
    usage: 'Add Accept-Language header to API requests to get localized responses',
  });
});

export default router;
