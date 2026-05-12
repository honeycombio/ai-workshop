import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeTracing } from './config/tracing';

// Initialize OpenTelemetry tracing before rendering the app
initializeTracing();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
