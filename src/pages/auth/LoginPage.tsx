import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, initDemoData, ensureDefaultUsersAndSettings } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import {
  verifyPassword,
  getRateLimitStatus,
  recordFailedAttempt,
  resetFailedAttempts
} from '../../lib/security';
import { getTauriLicenseStatus } from '../../lib/licensing';
import { auth, firestore, googleProvider } from '../../lib/firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword
} from 'firebase/auth';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" width="24" height="24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06 0.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

async function resolveDefaultCompanyId(): Promise<string | undefined> {
  try {
    const tauriState = await getTauriLicenseStatus();
    if (tauriState?.tenant_id && typeof tauriState.tenant_id === 'string' && tauriState.tenant_id.trim()) {
      return tauriState.tenant_id.trim();
    }
  } catch {}

  try {
    const settings = await db.settings.get(1);
    if ((settings as any)?.companyId) {
      return (settings as any).companyId;
    }
    const licStates = await db.licenseState.toArray();
    const activeLic = licStates.find((l) => l.status === 'active' && l.tenantId);
    if (activeLic?.tenantId) {
      return activeLic.tenantId;
    }
    if (settings?.name) {
      return 'comp-demo-sidar-01';
    }
  } catch {}

  return undefined;
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [identifier, setIdentifier] = useState('admin@carisoft.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isNotRobot, setIsNotRobot] = useState(false);
  const [verifyingRobot, setVerifyingRobot] = useState(false);
  const [robotError, setRobotError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Honeypot field for bot trap
  const [botTrap, setBotTrap] = useState('');

  // Lockout / Rate limit state
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const finalizeOAuthUser = async (user: any) => {
    const mappedUser: any = {
      id: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Utilisateur',
      username: user.email?.split('@')[0] || 'user',
      email: user.email || '',
      role: 'admin',
      active: true
    };

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        if (data.companyId) mappedUser.companyId = data.companyId;
        if (data.role) mappedUser.role = data.role;
        if (data.active !== undefined) mappedUser.active = data.active;
      }
    } catch (fetchErr) {
      console.warn('Could not fetch user from Firestore during OAuth', fetchErr);
    }

    await ensureDefaultUsersAndSettings();
    await initDemoData();

    if (!mappedUser.companyId) {
      const existingLocal = await db.users.get(user.uid);
      mappedUser.companyId = existingLocal?.companyId || (await resolveDefaultCompanyId());
    }

    await db.users.put(mappedUser);
    login(mappedUser);
    navigate('/', { replace: true });
  };

  useEffect(() => {
    ensureDefaultUsersAndSettings();
    const status = getRateLimitStatus();
    if (status.isLocked) {
      setLockoutSeconds(status.remainingSeconds);
    }

    // Récupère un éventuel retour OAuth par redirection (fallback popup bloquée)
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          setLoading(true);
          await finalizeOAuthUser(result.user);
        }
      })
      .catch((err) => {
        if (err?.code && err.code !== 'auth/no-auth-event') {
          console.warn('OAuth redirect warning:', err);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggleRobot = () => {
    if (verifyingRobot) return;
    setRobotError(false);
    if (isNotRobot) {
      setIsNotRobot(false);
      return;
    }
    setVerifyingRobot(true);
    setTimeout(() => {
      setVerifyingRobot(false);
      setIsNotRobot(true);
      setError((prev) => (prev?.includes('robot') ? null : prev));
    }, 300);
  };

  const handleOAuthLogin = async (provider: any, providerName: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, provider);
      await finalizeOAuthUser(result.user);
    } catch (err: any) {
      console.error('OAuth error:', err);
      const code = err?.code || '';
      const msg = String(err?.message || '');

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return;
      }
      if (code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch {
          setError('La fenêtre Google a été bloquée. Autorisez les popups puis réessayez.');
          return;
        }
      }
      if (code.includes('api-key-not-valid') || msg.includes('API key expired') || msg.includes('API_KEY_INVALID')) {
        setError("Clé API Firebase expirée (firebase-applet-config.json). Mettez à jour la configuration Web depuis votre projet Firebase 'carisoft-licences'.");
        return;
      }
      if (code === 'auth/unauthorized-domain' || msg.includes('requests-from-referer')) {
        setError(`Domaine '${window.location.hostname}' non autorisé dans Firebase Auth. Ajoutez-le dans Firebase Console > Authentication > Paramètres > Domaines autorisés.`);
        return;
      }
      if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
        setError("La connexion Google n'est pas encore activée dans Firebase Console > Authentication > Mode de connexion.");
        return;
      }
      setError(`Erreur lors de la connexion avec ${providerName} (${code || msg || 'erreur inconnue'}).`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          resetFailedAttempts();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleLogin = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (botTrap) {
      setError('Tentative automatisée bloquée par la sécurité CARISOFT.');
      return;
    }

    if (!isNotRobot) {
      setRobotError(true);
      setError("Veuillez cocher la case « Pas un robot » avant de vous connecter.");
      return;
    }

    const rateStatus = getRateLimitStatus();
    if (rateStatus.isLocked) {
      setError(`Trop de tentatives échouées. Compte verrouillé temporairement (${rateStatus.remainingSeconds}s).`);
      setLockoutSeconds(rateStatus.remainingSeconds);
      return;
    }

    setLoading(true);

    try {
      await ensureDefaultUsersAndSettings();
      await initDemoData();

      const term = identifier.trim().toLowerCase();

      // 1. Compte Super Admin
      if (term === 'nabsterzero@gmail.com' || term === 'nabsterzero') {
        if (password !== 'blidsi@0808@') {
          const failStatus = recordFailedAttempt();
          if (failStatus.isLocked) {
            setLockoutSeconds(failStatus.remainingSeconds);
            setError(`Trop de tentatives incorrectes. Bloqué pendant ${failStatus.remainingSeconds}s.`);
          } else {
            setError(`Mot de passe Super Admin incorrect. (Tentative ${failStatus.attempts}/5)`);
          }
          return;
        }

        resetFailedAttempts();
        const superUser = {
          id: 'U0',
          name: 'Super Administrateur SaaS',
          username: 'nabsterzero',
          email: 'nabsterzero@gmail.com',
          role: 'superadmin' as const,
          companyId: (await resolveDefaultCompanyId()) || 'comp-demo-sidar-01',
          active: true
        };
        await db.users.put(superUser);
        login(superUser);
        navigate('/', { replace: true });
        return;
      }

      // 2. Recherche locale (IndexedDB + comptes par défaut)
      const allUsers = await db.users.toArray();
      let foundUser = allUsers.find(
        (u) => u.email?.toLowerCase() === term || u.username?.toLowerCase() === term
      );

      if (!foundUser) {
        if (term === 'admin@carisoft.com' || term === 'admin') {
          foundUser = {
            id: 'U1',
            name: 'Administrateur Principal',
            username: 'admin',
            email: 'admin@carisoft.com',
            password: 'admin',
            role: 'admin',
            active: true
          };
          await db.users.put(foundUser);
        } else if (term === 'facturation@carisoft.com' || term === 'facturation') {
          foundUser = {
            id: 'U2',
            name: 'Responsable Facturation',
            username: 'facturation',
            email: 'facturation@carisoft.com',
            password: 'admin',
            role: 'billing',
            active: true
          };
          await db.users.put(foundUser);
        }
      }

      let isLocalPasswordValid = false;
      if (foundUser) {
        if (foundUser.active === false) {
          setError('Ce compte utilisateur a été désactivé. Veuillez contacter un administrateur.');
          return;
        }
        const storedPass = foundUser.password || 'admin';
        isLocalPasswordValid = await verifyPassword(password, storedPass);
      }

      // 3. Synchronisation Cloud optionnelle avec Firebase Auth
      let isCloudVerified = false;
      let cloudAuthError: any = null;
      let loginEmail = foundUser?.email || term;

      if (!foundUser && !term.includes('@')) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const mapSnap = await getDoc(doc(firestore, 'username_mappings', term));
          if (mapSnap.exists() && mapSnap.data()?.email) {
            loginEmail = mapSnap.data().email;
          }
        } catch {}
      }

      if (loginEmail.includes('@')) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
          const fbUser = userCredential.user;
          isCloudVerified = true;

          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const userDocSnap = await getDoc(doc(firestore, 'users', fbUser.uid));
            if (userDocSnap.exists()) {
              const data = userDocSnap.data() as any;
              if (!foundUser) {
                foundUser = {
                  id: fbUser.uid,
                  name: data.name || fbUser.displayName || loginEmail.split('@')[0],
                  username: data.username || loginEmail.split('@')[0],
                  email: loginEmail,
                  role: data.role || 'admin',
                  companyId: data.companyId,
                  active: data.active !== false
                };
              } else {
                if (data.companyId) foundUser.companyId = data.companyId;
                if (data.role) foundUser.role = data.role;
                if (data.active !== undefined) foundUser.active = data.active;
              }
            } else if (!foundUser) {
              foundUser = {
                id: fbUser.uid,
                name: fbUser.displayName || loginEmail.split('@')[0],
                username: loginEmail.split('@')[0],
                email: loginEmail,
                role: 'admin',
                active: true
              };
            }
          } catch (fetchErr) {
            console.warn('Firestore profile sync skipped:', fetchErr);
          }
        } catch (fbError: any) {
          cloudAuthError = fbError;
          console.warn('Firebase Auth fallback local:', fbError?.code || fbError?.message);
        }
      }

      // 4. Décision finale : succès si validé par le Cloud OU par la base locale
      if (!isCloudVerified && !isLocalPasswordValid) {
        const failStatus = recordFailedAttempt();
        if (failStatus.isLocked) {
          setLockoutSeconds(failStatus.remainingSeconds);
          setError(`Accès temporairement suspendu pour sécurité (${failStatus.remainingSeconds}s).`);
          return;
        }

        const code = cloudAuthError?.code || '';
        const msg = String(cloudAuthError?.message || '');
        if (!foundUser && (code.includes('api-key-not-valid') || msg.includes('API key expired'))) {
          setError("Compte introuvable en local et clé API Firebase Cloud expirée (firebase-applet-config.json). Utilisez un compte local (ex: admin@carisoft.com) ou mettez à jour la clé Firebase.");
          return;
        }

        setError(`Identifiant ou mot de passe incorrect. (Tentative ${failStatus.attempts}/5)`);
        return;
      }

      if (!foundUser) {
        setError('Aucun profil associé à ce compte.');
        return;
      }

      if (foundUser.active === false) {
        setError('Ce compte utilisateur a été désactivé. Veuillez contacter un administrateur.');
        return;
      }

      // Rattachement automatique au tenantId actif du poste si absent
      if (!foundUser.companyId) {
        const fallbackCompanyId = await resolveDefaultCompanyId();
        if (fallbackCompanyId) {
          foundUser.companyId = fallbackCompanyId;
        }
      }

      await db.users.put(foundUser);
      resetFailedAttempts();
      login(foundUser);
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setError('Une erreur est survenue lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1120] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden text-white">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 space-y-8 my-6">
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/60 bg-transparent text-slate-300 text-[11px] font-medium tracking-wide">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            PORTAIL SÉCURISÉ & DONNÉES CHIFFRÉES
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
            <span className="text-blue-500 font-black">CARISOFT</span>
            <span className="text-white font-bold">.next</span>
          </h1>
          <p className="text-sm text-slate-400 font-light">
            Gestion intégrée de carrières & granulats • Mode SaaS Sécurisé
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-[#0d1627] border border-slate-800/60 rounded-[20px] p-7 shadow-2xl space-y-6">
          {/* Social Logins */}
          <div>
            <button
              type="button"
              onClick={() => handleOAuthLogin(googleProvider, 'Google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-slate-700/70 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-800/80 active:bg-slate-800 transition-all font-medium text-sm text-slate-200 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <GoogleIcon />
              <span>Continuer avec Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 font-medium">ou avec email</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Lockout Warning */}
          {lockoutSeconds > 0 && (
            <div className="p-3.5 bg-amber-950/70 border border-amber-800/60 rounded-xl flex items-center gap-3 text-amber-200 text-xs animate-pulse">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
              <span>
                Verrouillage anti-bruteforce actif : réessayez dans <strong>{lockoutSeconds}s</strong>
              </span>
            </div>
          )}

          {/* Error Alert */}
          {error && lockoutSeconds === 0 && (
            <div className="p-3.5 bg-red-950/60 border border-red-800/50 rounded-xl flex items-start gap-3 text-red-200 text-sm animate-in fade-in">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Honeypot Bot Trap */}
            <input
              type="text"
              name="company_trap_code"
              value={botTrap}
              onChange={(e) => setBotTrap(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              className="opacity-0 absolute -z-10 w-0 h-0 pointer-events-none"
            />

            {/* Champ E-mail ou Identifiant */}
            <div className="space-y-1">
              <input
                type="text"
                required
                placeholder="Adresse e-mail ou identifiant"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
              />
            </div>

            {/* Champ Mot de passe */}
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs text-amber-500 hover:text-amber-400 font-medium transition-colors border-b border-transparent hover:border-amber-400 pb-0.5"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            {/* Bouton / Case Pas un robot interactif */}
            <div
              role="checkbox"
              aria-checked={isNotRobot}
              tabIndex={0}
              onClick={handleToggleRobot}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  handleToggleRobot();
                }
              }}
              className={`flex items-center justify-between gap-3 p-3.5 bg-[#131d32] border rounded-xl mt-2 cursor-pointer select-none transition-all ${
                robotError
                  ? 'border-red-500/80 ring-1 ring-red-500/30'
                  : isNotRobot
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`relative flex items-center justify-center w-5 h-5 rounded-[4px] border transition-colors ${
                    isNotRobot
                      ? 'border-emerald-500 bg-emerald-600'
                      : 'border-slate-500 bg-[#0d1627]'
                  }`}
                >
                  {verifyingRobot ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  ) : isNotRobot ? (
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                </div>
                <span className="text-sm font-medium text-white">Pas un robot</span>
              </div>

              <ShieldCheck
                className={`w-4 h-4 transition-colors ${
                  isNotRobot ? 'text-emerald-400' : 'text-slate-600'
                }`}
              />
            </div>

            {/* Bouton Se connecter */}
            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0 || verifyingRobot}
              className="w-full py-3.5 px-4 bg-[#1d64d8] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-full flex items-center justify-center gap-2 text-sm transition-all cursor-pointer mt-6"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Inscription Link */}
          <div className="pt-2 text-center">
            <p className="text-sm text-slate-300">
              Vous n'avez pas de compte ?{' '}
              <Link
                to="/register"
                className="text-amber-500 hover:text-amber-400 transition-colors border-b border-amber-500 hover:border-amber-400 pb-0.5"
              >
                Inscrivez-vous gratuitement
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
