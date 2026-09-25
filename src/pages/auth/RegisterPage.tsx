import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, initDemoData } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { 
  Eye, EyeOff, AlertCircle
} from 'lucide-react';
import { 
  fetchClientIP, isIPTrialUsed, recordIPTrialUsed, 
  generate3DayTrialLicense
} from '../../lib/security';
import { PaidLicenseModal } from '../../components/licensing/PaidLicenseModal';
import { auth, googleProvider, firestore } from '../../lib/firebase';
import { signInWithPopup, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" width="24" height="24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isNotRobot, setIsNotRobot] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength visual indicator
  const passwordStrength = Math.min(4, Math.floor(password.length / 2));

  // IP Detection & Trial Restriction State
  const [clientIP, setClientIP] = useState<string>('Détection en cours...');
  const [isBlockedByIP, setIsBlockedByIP] = useState<boolean>(false);
  const [showPaidModal, setShowPaidModal] = useState<boolean>(false);

  useEffect(() => {
    async function checkIP() {
      const ip = await fetchClientIP();
      setClientIP(ip);

      // Bypass IP blocking for development/testing
      // const check = isIPTrialUsed(ip);
      // if (check.isUsed) {
      //   setIsBlockedByIP(true);
      // }
    }
    checkIP();
  }, []);

  const handleOAuthRegister = async (provider: any, providerName: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      await initDemoData();

      const term = user.email || `${user.uid}@example.com`;
      const existingUser = await db.users.where('email').equalsIgnoreCase(term).first();
      
      if (existingUser) {
        // If already exists, just log them in
        login(existingUser);
        navigate('/', { replace: true });
        return;
      }

      // New registration via OAuth
      const firstName = user.displayName?.split(' ')[0] || 'Utilisateur';
      const companyName = `Entreprise de ${firstName}`;
      const trial = await generate3DayTrialLicense(companyName);
      const username = term.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'admin';
      
      const newUser = {
        id: user.uid,
        name: user.displayName || 'Utilisateur',
        username,
        email: term,
        password: '', // No password needed for OAuth
        role: 'admin' as const,
        active: true,
        createdAt: new Date().toISOString()
      };

      await db.users.put(newUser);

      const existingSettings = await db.settings.get(1);
      await db.settings.put({
        id: 1,
        name: companyName.toUpperCase(),
        activity: existingSettings?.activity || "Production D'Agrégats & Granulats",
        address: existingSettings?.address || 'Site de Production',
        rc: existingSettings?.rc || '',
        nif: existingSettings?.nif || '',
        nis: existingSettings?.nis || '',
        article: existingSettings?.article || '',
        bank: existingSettings?.bank || '',
        capital: existingSettings?.capital || 1000000,
        phone: existingSettings?.phone || '',
        email: term,
        tvaRate: 19,
        timbre: 1,
        timbreLimit: 2500,
        licenseKey: trial.licenseKey,
        licensePlan: 'Essai Gratuit (5 Jours)',
        licenseExpiry: trial.expiryDate,
        licenseStatus: 'active'
      });

      recordIPTrialUsed(clientIP, term, companyName, trial.licenseKey);
      
      // Enregistrement Cloud immédiat pour la visibilité SuperAdmin
      try {
        await setDoc(doc(firestore, 'companies', user.uid), {
          id: user.uid,
          name: companyName.toUpperCase(),
          ownerId: user.uid,
          ownerEmail: term,
          email: term,
          contactName: user.displayName || firstName,
          phone: user.phoneNumber || '',
          address: '',
          licenseKey: trial.licenseKey,
          licensePlan: 'Essai Gratuit (5 Jours)',
          licenseExpiry: trial.expiryDate,
          licenseStatus: 'active',
          status: 'actif',
          createdAt: new Date().toISOString()
        }, { merge: true });

        await setDoc(doc(firestore, 'users', user.uid), {
          id: user.uid,
          companyId: user.uid,
          name: user.displayName || firstName,
          email: term,
          role: 'admin',
          active: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (cloudErr) {
        console.warn("Note: Enregistrement Cloud différé", cloudErr);
      }

      login(newUser);
      navigate('/setup', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      if (err.code === 'auth/popup-blocked') {
        setError(`La fenêtre de connexion a été bloquée par votre navigateur. Veuillez désactiver votre bloqueur de popups ou ouvrir l'application dans un nouvel onglet.`);
        return;
      }
      setError(`Erreur lors de l'inscription avec ${providerName}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // IP Check enforcement
    if (isBlockedByIP) {
      setError(`Cette adresse IP (${clientIP}) a déjà bénéficié d'un compte d'essai gratuit.`);
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (!isNotRobot) {
      setError("Veuillez confirmer que vous n'êtes pas un robot.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);

    try {
      await initDemoData();

      // Check if email already registered
      const term = email.trim().toLowerCase();
      const existingUser = await db.users.where('email').equalsIgnoreCase(term).first();
      if (existingUser) {
        setError("Un compte existe déjà avec cette adresse email.");
        setLoading(false);
        return;
      }

      const companyName = `Entreprise de ${firstName}`;
      // Generate 3-Day Trial License
      const trial = await generate3DayTrialLicense(companyName);

      // Create new user in Firebase Auth
      let firebaseUid: string;
      try {
        const result = await createUserWithEmailAndPassword(auth, term, password);
        firebaseUid = result.user.uid;
      } catch (fbError: any) {
        if (fbError.code === 'auth/email-already-in-use') {
          setError("Un compte existe déjà avec cette adresse email.");
          setLoading(false);
          return;
        } else {
          console.warn("Erreur Firebase Auth (" + fbError.code + "). Utilisation d'un compte local.", fbError);
          firebaseUid = 'local_' + Math.random().toString(36).substring(2, 9);
        }
      }

      // Create new user in IndexedDB
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') || 'admin';
      const userId = firebaseUid;
      const newUser = {
        id: userId,
        name: `${firstName.trim()} ${lastName.trim()}`,
        username,
        email: term,
        password: password.trim(),
        role: 'admin' as const,
        active: true,
        createdAt: new Date().toISOString()
      };

      await db.users.put(newUser);

      // Update company settings with 3-day trial license
      const existingSettings = await db.settings.get(1);
      await db.settings.put({
        id: 1,
        name: companyName.toUpperCase(),
        activity: existingSettings?.activity || "Production D'Agrégats & Granulats",
        address: existingSettings?.address || 'Site de Production',
        rc: existingSettings?.rc || '',
        nif: existingSettings?.nif || '',
        nis: existingSettings?.nis || '',
        article: existingSettings?.article || '',
        bank: existingSettings?.bank || '',
        capital: existingSettings?.capital || 1000000,
        phone: phone.trim() || existingSettings?.phone || '',
        email: term,
        tvaRate: 19,
        timbre: 1,
        timbreLimit: 2500,
        licenseKey: trial.licenseKey,
        licensePlan: 'Essai Gratuit (5 Jours)',
        licenseExpiry: trial.expiryDate,
        licenseStatus: 'active'
      });

      // Record IP usage to prevent duplicate free trials
      recordIPTrialUsed(clientIP, term, companyName, trial.licenseKey);

      // Enregistrement Cloud immédiat pour visibilité SuperAdmin
      try {
        await setDoc(doc(firestore, 'companies', userId), {
          id: userId,
          name: companyName.toUpperCase(),
          ownerId: userId,
          ownerEmail: term,
          email: term,
          contactName: `${firstName.trim()} ${lastName.trim()}`,
          phone: phone.trim(),
          address: '',
          licenseKey: trial.licenseKey,
          licensePlan: 'Essai Gratuit (5 Jours)',
          licenseExpiry: trial.expiryDate,
          licenseStatus: 'active',
          status: 'actif',
          createdAt: new Date().toISOString()
        }, { merge: true });

        await setDoc(doc(firestore, 'users', userId), {
          id: userId,
          companyId: userId,
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: term,
          role: 'admin',
          active: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (cloudErr) {
        console.warn("Note: Enregistrement Cloud différé", cloudErr);
      }

      // Auto login & redirect
      login(newUser);
      navigate('/setup', { replace: true });
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue lors de la création du compte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1120] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden text-white">
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 space-y-8 my-6">
        
        {/* Card Form */}
        <div className="bg-[#0d1627] border border-slate-800/60 rounded-[20px] p-7 shadow-2xl space-y-6">
          
          <h2 className="text-2xl font-semibold text-white">Créer un compte</h2>

          {/* Social Logins */}
          <div>
            <button 
              type="button"
              onClick={() => handleOAuthRegister(googleProvider, 'Google')}
              disabled={loading || isBlockedByIP}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border border-slate-700/70 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-800/80 active:bg-slate-800 transition-all font-medium text-sm text-slate-200 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              <GoogleIcon />
              <span>S'inscrire avec Google</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 font-medium">ou avec email</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-800/50 rounded-xl flex items-start gap-3 text-red-200 text-sm animate-in fade-in">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleRegister} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  placeholder="Prénom *"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isBlockedByIP}
                  className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <input
                  type="text"
                  required
                  placeholder="Nom *"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isBlockedByIP}
                  className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <input
                type="email"
                required
                placeholder="Adresse e-mail *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBlockedByIP}
                className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <input
                type="tel"
                required
                placeholder="Numéro de téléphone *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isBlockedByIP}
                className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mot de passe (8 car. min)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isBlockedByIP}
                  className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all pr-12 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="grid grid-cols-4 gap-1 pt-1.5 px-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i}
                      className={`h-1 rounded-full transition-colors ${
                        i <= passwordStrength 
                          ? (passwordStrength < 2 ? 'bg-red-500' : passwordStrength < 3 ? 'bg-amber-500' : passwordStrength < 4 ? 'bg-emerald-400' : 'bg-emerald-500') 
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Checkbox Pas un robot */}
            <div className="flex items-center gap-3 p-3 bg-[#131d32] border border-slate-700/80 rounded-xl mt-4">
              <div className="relative flex items-center justify-center w-5 h-5 rounded-[4px] border border-slate-500 bg-[#0d1627] overflow-hidden">
                <input 
                  type="checkbox"
                  required
                  id="robotCheckReg"
                  checked={isNotRobot}
                  onChange={(e) => setIsNotRobot(e.target.checked)}
                  className="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-10 peer"
                />
                <div className="absolute inset-0 bg-[#1d64d8] opacity-0 peer-checked:opacity-100 transition-opacity duration-200"></div>
                <svg className="w-3.5 h-3.5 text-white absolute inset-0 m-auto opacity-0 peer-checked:opacity-100 transition-opacity z-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <label htmlFor="robotCheckReg" className="text-sm font-medium text-white cursor-pointer select-none">
                Pas un robot
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || isBlockedByIP}
              className="w-full py-3.5 px-4 bg-[#1d64d8] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-full flex items-center justify-center gap-2 text-sm transition-all cursor-pointer mt-6"
            >
              {loading ? 'Création en cours...' : 'Créer un compte gratuit'}
            </button>
          </form>

          {/* Policy & Login Link */}
          <div className="pt-2 text-center space-y-4">
            <p className="text-[11px] text-slate-400 leading-relaxed px-4">
              En continuant vous acceptez les{' '}
              <a href="#" className="text-amber-500 hover:text-amber-400 transition-colors border-b border-amber-500 hover:border-amber-400 pb-0.5">conditions</a>
              {' '}et la{' '}
              <a href="#" className="text-amber-500 hover:text-amber-400 transition-colors border-b border-amber-500 hover:border-amber-400 pb-0.5">politique de confidentialité</a>.
            </p>
            
            <p className="text-sm text-slate-300">
              Déjà un compte ?{' '}
              <Link 
                to="/login" 
                className="text-amber-500 hover:text-amber-400 font-medium transition-colors border-b border-amber-500 hover:border-amber-400 pb-0.5"
              >
                Se connecter
              </Link>
            </p>
          </div>

        </div>

      </div>

      {/* Paid License Selection Modal */}
      <PaidLicenseModal 
        isOpen={showPaidModal}
        onClose={() => setShowPaidModal(false)}
        onSuccess={() => navigate('/login')}
      />
    </div>
  );
}

