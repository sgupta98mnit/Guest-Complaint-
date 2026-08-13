import { Router } from 'express';
import { searchOrganizations, createOrganization } from '../lib/organizationStore.js';
import { validateOrganization } from '../lib/validation.js';

export const organizationsRouter = Router();

// Both endpoints are public, because the guest wizard needs them before any
// authentication exists. Organizations are business entities rather than
// people, so a name search is not a personal-data disclosure - but this is
// still an unauthenticated read and write, so creation is rate-limited
// alongside the other public write paths in index.js.

/** GET /api/organizations?q=cardinal */
organizationsRouter.get('/', (req, res) => {
  res.json({ organizations: searchOrganizations(req.query.q) });
});

/** POST /api/organizations */
organizationsRouter.post('/', (req, res) => {
  const errors = validateOrganization(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const { created, organization } = createOrganization(req.body);

  // A name collision is not a failure: the caller gets the existing record and
  // the UI selects it, which is what the filer wanted anyway.
  res.status(created ? 201 : 200).json({ created, organization });
});
