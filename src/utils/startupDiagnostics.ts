/**
 * Startup Diagnostics Utility
 * Verifies window.location, environment variables, and runtime context
 * before the React application boots, detecting malformed URLs, domain injection,
 * or corrupted template interpolations.
 */

export interface DiagnosticReport {
  timestamp: string;
  isHealthy: boolean;
  warnings: string[];
  errors: string[];
  location: {
    origin: string;
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
    search: string;
    hash: string;
  };
  environment: {
    mode: string;
    baseUrl: string;
    isDev: boolean;
    isProd: boolean;
    definedViteKeys: string[];
  };
}

/**
 * Checks if a string contains un-interpolated template tokens or invalid URL syntax
 */
function checkForTemplateTokens(value: string, keyName: string, errors: string[]) {
  if (!value || typeof value !== 'string') return;

  // Patterns such as ${var}, {{var}}, %{var}, <var>, or raw literal expressions
  const templatePatterns = [
    /\$\{[\s\S]*?\}/,
    /\{\{[\s\S]*?\}\}/,
    /%\{[\s\S]*?\}/,
    /<%[\s\S]*?%>/,
    /\bundefined\b/i,
    /\bnull\b/i,
    /\bNaN\b/
  ];

  for (const pattern of templatePatterns) {
    if (pattern.test(value)) {
      errors.push(`Suspicious template pattern or unassigned keyword detected in ${keyName}: "${value}"`);
      break;
    }
  }
}

/**
 * Validates domain and hostname safety
 */
function validateHostname(hostname: string, errors: string[], warnings: string[]) {
  if (!hostname) {
    warnings.push('Hostname is empty or file-based origin.');
    return;
  }

  // Check for invalid host characters
  if (/[^a-zA-Z0-9.-]/.test(hostname)) {
    errors.push(`Hostname contains invalid characters: "${hostname}"`);
  }

  // Check for common malformed patterns (e.g. multiple consecutive dots, trailing dots)
  if (hostname.includes('..') || hostname.startsWith('.') || hostname.endsWith('.')) {
    errors.push(`Hostname has invalid dot positioning: "${hostname}"`);
  }
}

/**
 * Executes startup checks synchronously prior to React rendering.
 * Returns the diagnostic report and attaches it to window.__STARTUP_DIAGNOSTICS__
 */
export function runStartupDiagnostics(): DiagnosticReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const loc = typeof window !== 'undefined' ? window.location : null;

  const locationData = {
    origin: loc?.origin || '',
    protocol: loc?.protocol || '',
    hostname: loc?.hostname || '',
    port: loc?.port || '',
    pathname: loc?.pathname || '',
    search: loc?.search || '',
    hash: loc?.hash || '',
  };

  if (loc) {
    // 1. Verify window.location parameters
    validateHostname(loc.hostname, errors, warnings);
    checkForTemplateTokens(loc.href, 'window.location.href', errors);
    checkForTemplateTokens(loc.pathname, 'window.location.pathname', errors);
    checkForTemplateTokens(loc.search, 'window.location.search', errors);

    // Verify search params if present
    try {
      const searchParams = new URLSearchParams(loc.search);
      for (const [key, val] of searchParams.entries()) {
        checkForTemplateTokens(key, `URL Query Key [${key}]`, errors);
        checkForTemplateTokens(val, `URL Query Value [${key}]`, errors);
      }
    } catch (e) {
      errors.push(`Failed to parse URL query parameters: ${String(e)}`);
    }
  } else {
    warnings.push('Running outside of a browser window environment.');
  }

  // 2. Verify Vite environment variables
  const env = (import.meta as any).env || {};
  const definedViteKeys: string[] = [];

  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') || key === 'BASE_URL' || key === 'MODE') {
      definedViteKeys.push(key);
      const val = String(env[key] ?? '');
      checkForTemplateTokens(val, `env.${key}`, errors);
    }
  }

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    isHealthy: errors.length === 0,
    warnings,
    errors,
    location: locationData,
    environment: {
      mode: env.MODE || 'unknown',
      baseUrl: env.BASE_URL || '/',
      isDev: Boolean(env.DEV),
      isProd: Boolean(env.PROD),
      definedViteKeys,
    },
  };

  // Expose report globally for debugging in DevTools
  if (typeof window !== 'undefined') {
    (window as any).__STARTUP_DIAGNOSTICS__ = report;

    // Log diagnostic summary
    if (!report.isHealthy) {
      console.error('[CARISOFT Startup Diagnostics] Potential domain/URL issues detected:', report.errors);
      renderDiagnosticBanner(report);
    } else {
      console.log('[CARISOFT Startup Diagnostics] Environment & URL verified successfully. Origin:', locationData.origin || 'local');
    }
  }

  return report;
}

/**
 * Displays an unobtrusive on-screen banner if fatal URL or injection errors are detected
 */
function renderDiagnosticBanner(report: DiagnosticReport) {
  if (typeof document === 'undefined') return;

  const banner = document.createElement('div');
  banner.id = 'startup-diagnostic-banner';
  banner.style.position = 'fixed';
  banner.style.bottom = '16px';
  banner.style.right = '16px';
  banner.style.maxWidth = '480px';
  banner.style.backgroundColor = '#7f1d1d';
  banner.style.color = '#fef2f2';
  banner.style.padding = '14px 18px';
  banner.style.borderRadius = '8px';
  banner.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.4)';
  banner.style.zIndex = '999999';
  banner.style.fontFamily = 'monospace';
  banner.style.fontSize = '12px';
  banner.style.lineHeight = '1.4';

  banner.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 6px; font-size: 13px;">⚠️ Startup Warning Detected</div>
    <ul style="margin: 0; padding-left: 18px;">
      ${report.errors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}
    </ul>
    <button style="margin-top: 8px; background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 4px 8px; border-radius: 4px; cursor: pointer;" onclick="this.parentElement.remove()">Fermer</button>
  `;

  document.body.appendChild(banner);
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m] || m);
}
