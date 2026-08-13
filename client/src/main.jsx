import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Self-hosted rather than pulled from the Google Fonts CDN - see theme.css.
// Latin subset only, and only the weights the design actually uses: the full
// imports also ship Devanagari, Cyrillic, and math faces this UI never renders.
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

import { App } from './App.jsx';
import { BASE_PATH } from './basePath.js';
import './theme.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* basename keeps every <Link> and navigate() inside the mount point, so a
        subpath deployment does not send users to the site root. */}
    <BrowserRouter basename={BASE_PATH}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
