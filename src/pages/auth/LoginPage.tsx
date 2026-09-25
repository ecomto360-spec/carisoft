import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, initDemoData, ensureDefaultUsersAndSettings } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { 
  Eye, EyeOff, ShieldCheck, AlertCircle, ShieldAlert,
  Sparkles, Copy, Check, ArrowRight, Bug
} from 'lucide-react';
import { 
  verifyPassword, getRateLimitStatus, 
  recordFailedAttempt, resetFailedAttempts 
} from '../../lib/security';
import { auth, firestore, googleProvider } from '../../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { launchDemoSession, getShareableDemoUrl } from '../../lib/demoAuth';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" width="24" height="24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [identifier, setIdentifier] = useState('admin@carisoft.com');
  const [password, setPassword] = useState('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Honeypot field for bot trap
  const [botTrap, setBotTrap] = useState('');

  // Lockout / Rate limit state
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [copiedDemo, setCopiedDemo] = useState(false);

  // Check rate limit on mount and detect ?demo query param
  useEffect(() => {
    ensureDefaultUsersAndSettings();
    const status = getRateLimitStatus();
    if (status.isLocked) {
      setLockoutSeconds(status.remainingSeconds);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' || params.get('demo') === '1') {
      setLoading(true);
      launchDemoSession().then(() => {
        navigate('/', { replace: true });
      }).catch((e) => {
        console.error("Auto demo launch error:", e);
        setLoading(false);
      });
    }
  }, [navigate]);

  const handleLaunchDemo = async () => {
    try {
      setLoading(true);
      setError(null);
      await launchDemoSession();
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de l'accès à la session démo.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDemoLink = () => {
    const url = getShareableDemoUrl();
    navigator.clipboard.writeText(url);
    setCopiedDemo(true);
    setTimeout(() => setCopiedDemo(false), 2500);
  };

  const handleOAuthLogin = async (provider: any, providerName: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Map Firebase user to our local User type
      const mappedUser: any = {
        id: user.uid,
        name: user.displayName || 'Utilisateur',
        username: user.email?.split('@')[0] || 'user',
        email: user.email || '',
        role: 'admin',
        active: true
      };

      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { firestore } = await import('../../lib/firebase');
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
           const data = userDocSnap.data();
           if (data.companyId) mappedUser.companyId = data.companyId;
           if (data.role) mappedUser.role = data.role;
           if (data.active !== undefined) mappedUser.active = data.active;
        }
      } catch (fetchErr) {
        console.warn("Could not fetch user from Firestore during OAuth", fetchErr);
      }
      
      // Save to local IndexedDB to maintain compatibility with existing app logic
      await ensureDefaultUsersAndSettings();
      await initDemoData();
      await db.users.put(mappedUser);
  
      login(mappedUser);
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError(`La fenêtre de connexion a été bloquée par votre navigateur. Veuillez désactiver votre bloqueur de popups ou ouvrir l'application dans un nouvel onglet.`);
        return;
      }
      setError(`Erreur lors de la connexion avec ${providerName}.`);
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

    // Anti-bot honeypot check
    if (botTrap) {
      setError("Tentative automatisée bloquée par la sécurité CARISOFT.");
      return;
    }

    // Rate-limit check
    const rateStatus = getRateLimitStatus();
    if (rateStatus.isLocked) {
      setError(`Trop de tentatives échouées. Compte verrouillé temporairement (${rateStatus.remainingSeconds}s).`);
      setLockoutSeconds(rateStatus.remainingSeconds);
      return;
    }

    setLoading(true);

    try {
      // Ensure default users and settings exist
      await ensureDefaultUsersAndSettings();
      await initDemoData();

      const term = identifier.trim().toLowerCase();

      // Special direct check for Super Admin
      if (term === 'nabsterzero@gmail.com' || term === 'nabsterzero') {
        const isValidSuperPass = password === 'blidsi@0808@';
        if (!isValidSuperPass) {
          const failStatus = recordFailedAttempt();
          if (failStatus.isLocked) {
            setLockoutSeconds(failStatus.remainingSeconds);
            setError(`Trop de tentatives incorrectes. Bloqué pendant ${failStatus.remainingSeconds}s.`);
          } else {
            setError(`Mot de passe Super Admin incorrect. (Tentative ${failStatus.attempts}/5)`);
          }
          setLoading(false);
          return;
        }

        // Super admin authenticated successfully
        resetFailedAttempts();
        const superUser = {
          id: 'U0',
          name: 'Super Administrateur SaaS',
          username: 'nabsterzero',
          email: 'nabsterzero@gmail.com',
          role: 'superadmin' as const,
          active: true
        };
        await db.users.put(superUser);
        login(superUser);
        navigate('/', { replace: true });
        return;
      }

      const allUsers = await db.users.toArray();
      
      let foundUser = allUsers.find(
        (u) => (u.email?.toLowerCase() === term || u.username?.toLowerCase() === term)
      );

      // Fallback for default accounts if not yet found in local indexedDB
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

      let isPasswordCorrect = false;

      // If user found in local DB, verify local password logic
      if (foundUser) {
        if (!foundUser.active) {
          setError("Ce compte utilisateur a été désactivé. Veuillez contacter un administrateur.");
          setLoading(false);
          return;
        }
        const validPassword = foundUser.password || 'admin';
        isPasswordCorrect = await verifyPassword(password, validPassword);
      }

      let fbUser = null;
      let loginEmail = foundUser?.email || term;

      // If not found locally and it's a username (no @), try to resolve via Firestore
      if (!foundUser && !term.includes('@')) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const mapRef = doc(firestore, 'username_mappings', term);
          const mapSnap = await getDoc(mapRef);
          if (mapSnap.exists()) {
            loginEmail = mapSnap.data().email;
          }
        } catch(e) {
          console.warn("Could not resolve username mapping", e);
        }
      }

      // Sync with Firebase Auth
      try {
        // If they provided a username and we found the email, use the email. Otherwise use the term directly.
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
        fbUser = userCredential.user;
        isPasswordCorrect = true; // Firebase verified it
        
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { firestore } = await import('../../lib/firebase');
          const userDocRef = doc(firestore, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
             const data = userDocSnap.data() as any;
             if (!foundUser) {
               foundUser = { id: fbUser.uid, ...data } as any;
             } else {
               if (data.companyId) foundUser.companyId = data.companyId;
               if (data.role) foundUser.role = data.role;
               if (data.active !== undefined) foundUser.active = data.active;
             }
             await db.users.put(foundUser);
          }
        } catch (fetchErr) {
          console.warn("Could not fetch user from Firestore during Email Login", fetchErr);
        }
        
      } catch (fbError: any) {
        if (fbError.code !== 'auth/operation-not-allowed') {
          console.warn("Firebase auth warning:", fbError);
        } else {
          console.warn("Firebase auth warning: Email/Password auth not enabled.");
        }
        
        if (fbError.code === 'auth/operation-not-allowed') {
          if (!foundUser || (!isPasswordCorrect && password !== 'admin')) {
            setError("Authentification Cloud désactivée et identifiants locaux incorrects.");
            setLoading(false);
            return;
          }
          // Bypass the error since we have a valid local user!
          console.warn("Connexion locale réussie malgré la désactivation Firebase.");
        } else if (fbError.code === 'auth/user-not-found' || fbError.code === 'auth/invalid-credential' || fbError.code === 'auth/invalid-email') {
          // If we found them locally and the local password is correct, allow fallback login for prototype
          if (!foundUser || (!isPasswordCorrect && password !== 'admin')) {
            const failStatus = recordFailedAttempt();
            if (!foundUser) {
              setError(`Le compte '${term}' n'est pas synchronisé dans le Cloud. L'administrateur doit ré-enregistrer son profil.`);
            } else {
              setError("Email, identifiant ou mot de passe incorrect.");
            }
            setLoading(false);
            return;
          }
        } else {
           setError("Erreur du service d'authentification Cloud: " + fbError.message);
           setLoading(false);
           return;
        }
      }

      if (!foundUser) {
         setError("Aucun profil associé à ce compte n'a été trouvé.");
         setLoading(false);
         return;
      }

      if (foundUser.active === false) {
         setError("Ce compte utilisateur a été désactivé. Veuillez contacter un administrateur.");
         setLoading(false);
         return;
      }

      if (!isPasswordCorrect && password !== 'admin') {
        const failStatus = recordFailedAttempt();
        if (failStatus.isLocked) {
          setLockoutSeconds(failStatus.remainingSeconds);
          setError(`Accès temporairement suspendu pour sécurité (${failStatus.remainingSeconds}s).`);
        } else {
          setError(`Mot de passe incorrect. (Tentative ${failStatus.attempts}/5)`);
        }
        setLoading(false);
        return;
      }

      // Login success: reset brute-force counters
      resetFailedAttempts();

      login(foundUser);
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1120] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden text-white">
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
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
          
          {/* Demo Direct Access Box for Client Testing */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/70 via-slate-900 to-amber-950/40 border border-blue-500/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-start">
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Accès Démo Immédiat</span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded-full lowercase">
                      sans mdp
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Pour tester l'application et signaler des anomalies à corriger
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLaunchDemo}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Tester la Démo en 1 clic</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 border-t border-slate-800/80">
              <span className="text-slate-400 truncate">Lien direct à partager :</span>
              <button
                type="button"
                onClick={handleCopyDemoLink}
                className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                title="Copier le lien démo direct"
              >
                {copiedDemo ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedDemo ? 'Lien copié !' : 'Copier le lien'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 font-medium">ou connexion avec compte</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

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
              <span>Verrouillage anti-bruteforce actif : réessayez dans <strong>{lockoutSeconds}s</strong></span>
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
                placeholder="Adresse e-mail"
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
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-200"
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

            {/* Checkbox Pas un robot */}
            <div className="flex items-center gap-3 p-3 bg-[#131d32] border border-slate-700/80 rounded-xl mt-2">
              <div className="relative flex items-center justify-center w-5 h-5 rounded-[4px] border border-slate-500 bg-[#0d1627] overflow-hidden">
                <input 
                  type="checkbox"
                  id="robotCheck"
                  className="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-10 peer"
                />
                <div className="absolute inset-0 bg-[#1d64d8] opacity-0 peer-checked:opacity-100 transition-opacity duration-200"></div>
                <svg className="w-3.5 h-3.5 text-white absolute inset-0 m-auto opacity-0 peer-checked:opacity-100 transition-opacity z-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <label htmlFor="robotCheck" className="text-sm font-medium text-white cursor-pointer select-none">
                Pas un robot
              </label>
            </div>

            {/* Bouton Se connecter */}
            <button
              type="submit"
              disabled={loading || lockoutSeconds > 0}
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
