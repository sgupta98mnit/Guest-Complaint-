import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

// Picklists, status labels, and decision options are fetched once from the
// server and shared. Keeping them server-owned means the options a user can
// pick and the values the server will accept cannot drift apart.

const ReferenceContext = createContext({ reference: null, error: null });

export function ReferenceProvider({ children }) {
  const [reference, setReference] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .reference()
      .then(setReference)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <ReferenceContext.Provider value={{ reference, error }}>{children}</ReferenceContext.Provider>
  );
}

export function useReference() {
  return useContext(ReferenceContext);
}

/** Status label + pill colours, with a readable fallback for unknown values. */
export function useStatus(status) {
  const { reference } = useReference();
  return (
    reference?.statuses?.[status] || {
      label: String(status || '').replace(/_/g, ' '),
      bg: '#e8eaec',
      fg: '#3d4145',
    }
  );
}
