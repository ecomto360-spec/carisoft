import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {runStartupDiagnostics} from './utils/startupDiagnostics';

// Verify window.location and environment configuration before app mounts
runStartupDiagnostics();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  console.error("Critical error: Root element '#root' was not found in document.");
}

