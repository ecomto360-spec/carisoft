import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { db } from '../../db/db';
import { Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('oobCode');
    const mode = params.get('mode');
    
    if (mode !== 'resetPassword' || !code) {
      setError("Lien de réinitialisation invalide ou manquant.");
      setLoading(false);
      return;
    }

    setOobCode(code);

    // Verify the code
    verifyPasswordResetCode(auth, code)
      .then((email) => {
        setUserEmail(email);
        setLoading(false);
      })
      .catch((err) => {
        console.error("verifyPasswordResetCode error:", err);
        if (err.code === 'auth/invalid-action-code') {
          setError("Ce lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.");
        } else if (err.code === 'auth/expired-action-code') {
          setError("Ce lien de réinitialisation a expiré. Veuillez demander un nouveau lien.");
        } else {
          setError("Erreur lors de la vérification du lien : " + err.message);
        }
        setLoading(false);
      });
  }, [location]);

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!oobCode || !userEmail) return;

    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe saisis ne sont pas identiques.");
      return;
    }

    setLoading(true);
    try {
      // 1. Reset in Firebase
      await confirmPasswordReset(auth, oobCode, newPassword);

      // 2. Synchronize in local Dexie DB
      const allUsers = await db.users.toArray();
      const localUser = allUsers.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
      
      if (localUser) {
        await db.users.update(localUser.id, {
          password: newPassword.trim()
        });
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
      
    } catch (err: any) {
      console.error("confirmPasswordReset error:", err);
      setError("Erreur lors de la réinitialisation: " + err.message);
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
            RÉINITIALISATION SÉCURISÉE
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-[#0d1627] border border-slate-800/60 rounded-[20px] p-7 shadow-2xl space-y-6">
          <h2 className="text-[22px] font-semibold text-white tracking-wide">
            Nouveau mot de passe
          </h2>

          {error && (
            <div className="p-3.5 bg-red-950/60 border border-red-800/50 rounded-xl flex items-start gap-3 text-red-200 text-sm animate-in fade-in">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-green-950/60 border border-green-800/50 rounded-xl flex items-start gap-3 text-green-200 text-sm animate-in fade-in">
              <ShieldCheck className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
              <span>Mot de passe mis à jour avec succès. Redirection...</span>
            </div>
          )}

          {!error && !success && loading && (
            <div className="text-center text-slate-400 py-4">Vérification du lien sécurisé...</div>
          )}

          {!error && !success && !loading && oobCode && (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in">
              <div className="space-y-1">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Nouveau mot de passe (min 6 caractères)"
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

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-[13px] text-amber-500 hover:text-amber-400 font-medium transition-colors border-b border-amber-500/70 hover:border-amber-400 pb-0.5"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
