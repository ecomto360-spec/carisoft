import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, initDemoData } from '../../db/db';
import { auth } from '../../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { 
  Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Mail
} from 'lucide-react';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Email, 2: Simulated Link, 3: New Password
  const [email, setEmail] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isRealEmail, setIsRealEmail] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [throttle, setThrottle] = useState(false);

  // Step 1: Check Email and show simulated link
  const handleRequestLink = async (e: FormEvent) => {
    e.preventDefault();
    if (throttle) return;
    
    setError(null);
    setLoading(true);
    setThrottle(true);

    const term = email.trim().toLowerCase();
    if (!term) {
      setError("Veuillez saisir votre adresse email.");
      setLoading(false);
      setThrottle(false);
      return;
    }

    try {
      await initDemoData();
      const allUsers = await db.users.toArray();
      const foundUser = allUsers.find(
        (u) => u.email?.toLowerCase() === term || u.username?.toLowerCase() === term
      );

      if (!foundUser) {
        setError("Aucun compte n'est associé à cette adresse email.");
        setLoading(false);
        setThrottle(false);
        return;
      }

      setTargetUserId(foundUser.id);
      
      try {
        // Envoi réel via Firebase avec redirection vers notre app
        const actionCodeSettings = {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(auth, foundUser.email || term, actionCodeSettings);
        setIsRealEmail(true);
        setStep(2);
      } catch (fbErr: any) {
        console.warn("Firebase email error:", fbErr);
        if (fbErr.code === 'auth/operation-not-allowed') {
          // Fallback offline (mode démo)
          setIsRealEmail(false);
          setStep(2);
        } else {
          setError("Erreur lors de l'envoi de l'email : " + fbErr.message);
          setLoading(false);
          setThrottle(false);
          return;
        }
      }
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue lors de la recherche du compte.");
    } finally {
      setLoading(false);
      setTimeout(() => setThrottle(false), 5000); // 5 seconds debounce
    }
  };

  // Step 3: Set and confirm new password
  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe saisis ne sont pas identiques.");
      return;
    }

    if (!targetUserId) {
      setError("Session expirée. Veuillez recommencer.");
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      await db.users.update(targetUserId, {
        password: newPassword.trim()
      });

      // Redirect immediately or show short success
      navigate('/login', { replace: true });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1120] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden text-white">
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative z-10 space-y-8 my-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/60 bg-transparent text-slate-300 text-[11px] font-medium tracking-wide">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            PORTAIL SÉCURISÉ & DONNÉES CHIFFRÉES
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-[#0d1627] border border-slate-800/60 rounded-[20px] p-7 shadow-2xl space-y-6">
          
          <h2 className="text-[22px] font-semibold text-white tracking-wide">
            {step === 1 && "Mot de passe oublié ?"}
            {step === 2 && "E-mail envoyé"}
            {step === 3 && "Nouveau mot de passe"}
          </h2>

          {/* Alerts */}
          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-800/50 rounded-xl flex items-start gap-3 text-red-200 text-sm animate-in fade-in">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === 1 && (
            <form onSubmit={handleRequestLink} className="space-y-5">
              <div className="space-y-1">
                <input
                  type="email"
                  required
                  placeholder="Adresse email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                />
              </div>

              {/* Checkbox Pas un robot */}
              <div className="flex items-center gap-3 p-3 bg-[#131d32] border border-slate-700/80 rounded-xl">
                <div className="relative flex items-center justify-center w-5 h-5 rounded-[4px] border border-slate-500 bg-[#0d1627] overflow-hidden">
                  <input 
                    type="checkbox"
                    required
                    id="robotCheck"
                    className="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-10 peer"
                  />
                  <div className="absolute inset-0 bg-[#3ea8ff] opacity-0 peer-checked:opacity-100 transition-opacity duration-200"></div>
                  <svg className="w-3.5 h-3.5 text-slate-900 absolute inset-0 m-auto opacity-0 peer-checked:opacity-100 transition-opacity z-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <label htmlFor="robotCheck" className="text-sm font-medium text-white cursor-pointer select-none">
                  Pas un robot
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#3ea8ff] hover:bg-[#3ea8ff]/90 active:bg-[#3ea8ff]/80 disabled:opacity-50 text-slate-900 font-bold rounded-full flex items-center justify-center gap-2 text-sm transition-all cursor-pointer mt-2"
              >
                {loading ? 'Recherche...' : 'Envoyer le lien'}
              </button>
            </form>
          )}

          {/* STEP 2: Simulated Link Sent */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-4 bg-[#131d32] border border-slate-700/80 rounded-xl space-y-3">
                <div className="flex justify-center mb-2">
                  <Mail className="h-10 w-10 text-[#3ea8ff]" />
                </div>
                <p className="text-sm text-slate-300 text-center leading-relaxed">
                  Un lien de réinitialisation sécurisé a été envoyé à l'adresse :<br/>
                  <strong className="text-white font-medium">{email}</strong>
                </p>
                {!isRealEmail && (
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => setStep(3)}
                      className="text-xs px-4 py-2 bg-[#0a1120] border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                    >
                      Simuler le clic sur le lien (Demo)
                    </button>
                  </div>
                )}
                {isRealEmail && (
                  <p className="text-xs text-amber-500 text-center mt-4">
                    Veuillez vérifier votre boîte de réception (et vos spams) pour réinitialiser votre mot de passe, puis retournez à la page de connexion.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Enter New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
              </div>

              <div className="space-y-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirmez le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#3ea8ff] hover:bg-[#3ea8ff]/90 active:bg-[#3ea8ff]/80 disabled:opacity-50 text-slate-900 font-bold rounded-full flex items-center justify-center gap-2 text-sm transition-all cursor-pointer mt-4"
              >
                {loading ? 'Mise à jour...' : 'Enregistrer le mot de passe'}
              </button>
            </form>
          )}

          {/* Return to Login */}
          <div className="pt-2 text-center">
            <Link
              to="/login"
              className="text-[13px] text-amber-500 hover:text-amber-400 font-medium transition-colors border-b border-amber-500/70 hover:border-amber-400 pb-0.5"
            >
              Retour à la connexion
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

