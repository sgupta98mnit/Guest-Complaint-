import { Router } from 'express';
import { searchOrganizations, createOrganization } from '../lib/organizationStore.js';
import { validateOrganization } from '../lib/validation.js';

export const organizationsRouter = Router();

// Both endpoints are public, because the guest wizard needs them before any
// authentication exists. Organizations are business entities rather than
// people, so exposing a name search is not a personal-data disclosure - but it
// is still an unauthenticated endpoint that reads and writes, so a production
// deployment should rate-limit it. Noted in the README.

/** GET /api/organizations?q=riverbend */
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

  // A name collision is not treated as a failure: the caller gets the existing
  // record and the UI selects it, which is what the filer wanted anyway.
  res.status(created ? 201 : 200).json({ created, organization });
});
