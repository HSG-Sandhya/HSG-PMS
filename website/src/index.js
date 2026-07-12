import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import axios from 'axios';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import App from './App';

// API base URL for all axios calls.
// - Left empty (the default) requests go to the same origin that serves this
//   site, using relative /api/... paths. That is what the dev-server proxy
//   (package.json "proxy") relies on locally, and what a same-origin production
//   deploy relies on.
// - For a cross-origin deploy (site and API on different domains, e.g. the site
//   on sandhyagrand.in and the API on admin.sandhyagrand.in), set
//   REACT_APP_API_URL to the API's base URL at build time and it applies to
//   every request below with no other code change.
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// Global error handler for browser extension related errors
const handleGlobalError = (event) => {
  // Ignore message channel closed errors (browser extension related)
  if (event.error && event.error.message && 
      event.error.message.includes('message channel closed')) {
    event.preventDefault();
    console.warn('Browser extension communication error ignored:', event.error.message);
    return;
  }
  
  // Ignore other common browser extension errors
  if (event.error && event.error.message && 
      (event.error.message.includes('Extension context') ||
       event.error.message.includes('chrome-extension') ||
       event.error.message.includes('moz-extension'))) {
    event.preventDefault();
    console.warn('Browser extension error ignored:', event.error.message);
    return;
  }
};

// Add global error handlers
window.addEventListener('error', handleGlobalError);
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && 
      event.reason.message.includes('message channel closed')) {
    event.preventDefault();
    console.warn('Unhandled promise rejection (browser extension):', event.reason.message);
    return;
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));

// Wrap render in try-catch to handle any initialization errors
try {
  root.render(
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </BrowserRouter>
    </React.StrictMode>
  );
} catch (error) {
  // Handle any render errors gracefully
  if (error.message && error.message.includes('message channel closed')) {
    console.warn('Render error (browser extension):', error.message);
    // Try to render a simple fallback
    root.render(
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Hotel Sandhya Grand</h1>
        <p>Please refresh the page if you see this message.</p>
        <button onClick={() => window.location.reload()}>Refresh Page</button>
      </div>
    );
  } else {
    console.error('Render error:', error);
  }
} 