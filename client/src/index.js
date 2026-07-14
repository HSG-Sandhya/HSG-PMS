import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Browser extensions (password managers, Gemini, etc.) inject content scripts
// whose torn-down message channels surface as noisy "Uncaught (in promise)"
// errors in OUR console — e.g. "A listener indicated an asynchronous response by
// returning true, but the message channel closed before a response was received".
// They come from outside the app and are harmless, so we quiet ONLY those exact
// signatures; any other error/rejection is left to surface normally.
const EXTENSION_NOISE = [
  'message channel closed',
  'Extension context',
  'chrome-extension',
  'moz-extension',
];
const isExtensionNoise = (msg) =>
  typeof msg === 'string' && EXTENSION_NOISE.some((s) => msg.includes(s));

window.addEventListener('unhandledrejection', (event) => {
  if (isExtensionNoise(event.reason?.message || event.reason)) event.preventDefault();
});
window.addEventListener('error', (event) => {
  if (isExtensionNoise(event.message || event.error?.message)) event.preventDefault();
});

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register the service worker so the admin installs as a PWA (desktop + mobile
// home screen) and auto-updates on every deploy. It never caches API/socket
// traffic, so live data stays current — see public/service-worker.js.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}
