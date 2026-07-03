import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import App from './App';

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