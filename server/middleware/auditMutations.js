import { logActivity } from '../utils/activityLogger.js';

const METHOD_VERB = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

export const auditMutations = (resource) => (req, res, next) => {
  const verb = METHOD_VERB[req.method];
  if (!verb) return next();

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return; // only successes
    const id = req.params?.id || '';
    const label = resource.charAt(0).toUpperCase() + resource.slice(1);
    const past = verb === 'create' ? 'Created' : verb === 'update' ? 'Updated' : 'Deleted';
    logActivity(req, {
      action: `${resource}.${verb}`,
      category: 'data',
      severity: verb === 'delete' ? 'warning' : 'info',
      audit: false,
      resource: label,
      resourceId: id,
      description: `${past} ${resource}${id ? ` #${String(id).slice(-6)}` : ''}`,
    });
  });

  next();
};

export default auditMutations;
