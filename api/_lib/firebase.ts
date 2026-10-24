import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ParsedServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const LICENCES_APP_NAME = 'carisoft-licences-app';
const AUTH_APP_NAME = 'googly-keep-auth-app';

export async function parseServiceAccount(rawEnv: string | undefined): Promise<ParsedServiceAccount> {
  if (!rawEnv || !rawEnv.trim()) {
    throw new Error(`La variable d'environnement FIREBASE_SERVICE_ACCOUNT est vide ou absente.`);
  }
  let candidate = rawEnv.trim();
  
  if (!candidate.startsWith('{') && !candidate.startsWith('"') && !candidate.startsWith("'")) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        candidate = decoded;
      }
    } catch {}
  }
  
  if (candidate.startsWith("'") && candidate.endsWith("'")) {
    candidate = candidate.slice(1, -1).trim();
  }

  let parsed: Record<string, unknown>;
  try {
    let firstPass: unknown = JSON.parse(candidate);
    if (typeof firstPass === 'string') {
      firstPass = JSON.parse(firstPass);
    }
    parsed = firstPass as Record<string, unknown>;
  } catch (err) {
    if (candidate.startsWith('"') && candidate.endsWith('"')) {
      parsed = JSON.parse(candidate.slice(1, -1).trim()) as Record<string, unknown>;
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Échec du JSON.parse sur FIREBASE_SERVICE_ACCOUNT (${msg}).`);
    }
  }

  const projectId = (parsed.project_id ?? parsed.projectId) as string | undefined;
  const clientEmail = (parsed.client_email ?? parsed.clientEmail) as string | undefined;
  const rawPrivateKey = (parsed.private_key ?? parsed.privateKey) as string | undefined;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error(`Champs obligatoires manquants dans FIREBASE_SERVICE_ACCOUNT (project_id, client_email, private_key).`);
  }

  const privateKey = rawPrivateKey
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error(`La clé private_key ne contient pas les en-têtes PEM attendus.`);
  }

  const { createPrivateKey } = await import('node:crypto');
  createPrivateKey(privateKey);

  return { projectId, clientEmail, privateKey };
}

export async function initFirebaseClients(options: { withAuth: boolean }) {
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  
  const existingApps = getApps();

  let licencesApp = existingApps.find((app) => app.name === LICENCES_APP_NAME);
  if (!licencesApp) {
    const sa = await parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    licencesApp = initializeApp({
      credential: cert({
        projectId: sa.projectId,
        clientEmail: sa.clientEmail,
        privateKey: sa.privateKey,
      }),
      projectId: sa.projectId,
    }, LICENCES_APP_NAME);
  }
  const db = getFirestore(licencesApp);

  let auth: import('firebase-admin/auth').Auth | null = null;
  if (options.withAuth) {
    const { getAuth } = await import('firebase-admin/auth');
    const authProjectId = process.env.AUTH_PROJECT_ID?.trim() || 'googly-keep-3n96h';
    let authApp = getApps().find((app) => app.name === AUTH_APP_NAME);
    if (!authApp) {
      authApp = initializeApp({ projectId: authProjectId }, AUTH_APP_NAME);
    }
    auth = getAuth(authApp);
  }

  return { db, auth, licencesProjectId: licencesApp.options.projectId };
}
