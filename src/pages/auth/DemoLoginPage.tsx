import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Sparkles, CheckCircle2, ArrowRight, 
  Bug, Copy, Check, ExternalLink, Loader2 
} from 'lucide-react';
import { launchDemoSession, getShareableDemoUrl } from '../../lib/demoAuth';

export function DemoLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Initialisation de l'espace démo...");

  useEffect(() => {
    let isCancelled = false;

    async function autoLogin() {
      try {
        setStatusMessage("Vérification des données de démonstration...");
        await new Promise((r) => setTimeout(r, 400));
        
        setStatusMessage("Configuration du profil Client Testeur...");
        await launchDemoSession();

        if (isCancelled) return;

        setStatusMessage("Prêt ! Redirection vers le tableau de bord...");
        await new Promise((r) => setTimeout(r, 400));

        if (!isCancelled) {
          navigate('/', { replace: true });
        }
      } catch (err: any) {
        console.error("Demo login error:", err);
        if (!isCancelled) {
          setError("Impossible de charger la session démo automatique.");
          setLoading(false);
        }
      }
    }

    autoLogin();

    return () => {
      isCancelled = true;
    };
  }, [navigate]);

  const handleManualEnter = async () => {
    setLoading(true);
    setError(null);
    try {
      await launchDemoSession();
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'accès à la démo.");
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const url = getShareableDemoUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#0a1120] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[460px] relative z-10 space-y-6 text-center">
        
        {/* Brand */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold tracking-wide">
            <Sparkles className="h-4 w-4 text-amber-400" />
            ACCÈS DÉMO DIRECT SANS MOT DE PASSE
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2 pt-2">
            <span className="text-blue-500 font-black">CARISOFT</span>
            <span className="text-white font-bold">.next</span>
          </h1>
          <p className="text-sm text-slate-400">
            Plateforme complète de gestion de carrières & pesage
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-[#0d1627] border border-slate-800/80 rounded-2xl p-7 shadow-2xl space-y-6">
          
          {loading ? (
            <div className="py-8 space-y-5">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-amber-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-white">Connexion à l'espace Démo</h3>
                <p className="text-xs text-blue-400 animate-pulse font-medium">
                  {statusMessage}
                </p>
              </div>

              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Aucun mot de passe requis. Le système configure automatiquement un compte testeur et des données d'exemple.
              </p>
            </div>
          ) : error ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-red-950/60 border border-red-800/60 rounded-xl text-red-200 text-xs">
                {error}
              </div>
              <button
                type="button"
                onClick={handleManualEnter}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Réessayer l'accès Démo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-emerald-200 text-xs text-start flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Espace Démo prêt !</p>
                  <p className="text-emerald-300/80 text-[11px] mt-0.5">
                    Vous pouvez explorer les bons de pesage, la facturation, les clients et les commandes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualEnter}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
              >
                <span>Accéder immédiatement à l'application</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Share Link Box */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Lien direct à envoyer à votre client :</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-amber-400 hover:text-amber-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
              </button>
            </div>

            <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 select-all break-all text-start">
              {getShareableDemoUrl()}
            </div>
          </div>

        </div>

        {/* Inform anomalies notice */}
        <div className="p-3.5 bg-slate-900/60 border border-slate-800/60 rounded-xl flex items-center gap-3 text-start text-xs text-slate-300">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Bug className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-white">Remontée des anomalies intégrée</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Un bouton "Signaler une anomalie" permet au client de décrire facilement tout dysfonctionnement ou suggestion.
            </p>
          </div>
        </div>

        {/* Back to normal login */}
        <div className="pt-2 text-center text-xs text-slate-400">
          <a href="/login" className="hover:text-white transition-colors underline">
            Accéder à la page de connexion standard
          </a>
        </div>

      </div>
    </div>
  );
}
