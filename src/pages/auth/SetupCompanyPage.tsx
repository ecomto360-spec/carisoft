import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { ShieldCheck, Lock, Globe } from 'lucide-react';
import { generate3DayTrialLicense } from '../../lib/security';
import { firestore, auth } from '../../lib/firebase';
import { collection, doc, setDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';

export function SetupCompanyPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [companyName, setCompanyName] = useState('');
  const [language, setLanguage] = useState<'fr' | 'ar'>('fr');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-generate slug
  const slug = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError("Le nom de la carrière est obligatoire.");
      return;
    }

    if (!user) {
      setError("Utilisateur non connecté.");
      return;
    }

    setLoading(true);
    try {
      let companyId: string = crypto.randomUUID(); // Fallback ID

      // Récupérer les paramètres locaux avant toute opération
      const settings = await db.settings.get(1);

      // Tentative de synchronisation Cloud si connecté
      if (auth.currentUser && auth.currentUser.uid === user.id) {
        try {
          const companiesRef = collection(firestore, 'companies');
          const newCompanyRef = doc(companiesRef);
          companyId = newCompanyRef.id; // Utilise l'ID Firebase si disponible
          
          const finalSlug = `${slug}-${companyId.substring(0, 5)}`;

          // On met un timeout au cas où Firestore tourne dans le vide
          const firestoreOps = Promise.all([
            setDoc(newCompanyRef, {
              id: companyId,
              name: companyName.trim().toUpperCase(),
              slug: finalSlug,
              ownerId: user.id,
              ownerEmail: user.email || '',
              licenseKey: settings?.licenseKey || '',
              licensePlan: settings?.licensePlan || 'Essai Gratuit',
              licenseExpiry: settings?.licenseExpiry || '',
              licenseStatus: settings?.licenseStatus || 'active',
              createdAt: serverTimestamp()
            }),
            setDoc(doc(firestore, 'users', user.id), {
              companyId: companyId,
              email: user.email,
              name: user.name,
              role: 'admin',
              active: true,
              createdAt: serverTimestamp()
            }, { merge: true })
          ]);

          // Timeout de 5 secondes pour éviter le gel de l'interface
          await Promise.race([
            firestoreOps,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Délai d'attente Firestore dépassé")), 5000))
          ]);
        } catch (firebaseErr) {
          console.warn("Avertissement: Impossible d'écrire dans Firebase, passage en mode hors-ligne.", firebaseErr);
          // On génère un nouvel ID local en cas d'échec
          companyId = crypto.randomUUID();
        }
      } else {
        console.warn("Aucune session cloud active. Création en mode local uniquement.");
      }

      // Mettre à jour les paramètres de l'entreprise locale (Dexie)
      await db.settings.put({
        ...settings,
        id: 1,
        name: companyName.trim().toUpperCase(),
      });

      // Mettre à jour l'utilisateur dans la base locale (Dexie)
      await db.users.update(user.id, { 
        companyId: companyId,
        role: 'admin' 
      });

      // Mettre à jour l'état d'authentification pour débloquer la navigation
      useAuthStore.getState().updateUser({ companyId, role: 'admin' });

      // Rediriger vers le tableau de bord
      navigate('/', { replace: true });
    } catch (err) {
      console.warn(err);
      setError("Erreur inattendue lors de la configuration locale. Veuillez réessayer.");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0a1120] flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden text-white" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Background Subtle Gradient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10 space-y-8 my-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-slate-700/60 bg-[#0d1627] text-slate-300 text-[11px] font-medium tracking-wide">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            PORTAIL SÉCURISÉ & DONNÉES CHIFFRÉES
          </div>
          
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center">
            {language === 'ar' ? 'أنشئ بوابة محجرك' : 'Configurez votre portail'}
          </h1>
          <p className="text-sm text-slate-400 font-light">
            {language === 'ar' ? 'الاسم + رابط البوابة جاهز في ثانية!' : 'Nom + lien de votre espace prêts en un clic !'}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-[#0d1627] border border-slate-800/60 rounded-[24px] p-7 shadow-2xl space-y-7">
          
          <form onSubmit={handleSetup} className="space-y-6">
            
            {/* 1. Nom de la carrière */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-bold">1</span>
                <label className="text-sm font-semibold text-slate-200">
                  {language === 'ar' ? 'اسم المحجر *' : 'Nom de la carrière *'}
                </label>
              </div>
              <input
                type="text"
                required
                placeholder={language === 'ar' ? 'مثال: محجر الصفا' : 'Exemple: Carrière Les Alpes'}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 bg-[#131d32] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
              />
            </div>

            <div className="h-px w-full bg-slate-800/80" />

            {/* 2. Lien de la carrière */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-bold">2</span>
                <label className="text-sm font-semibold text-slate-200">
                  {language === 'ar' ? 'رابط البوابة' : 'Lien de votre portail'}
                </label>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {language === 'ar' 
                  ? 'يُكتب تلقائياً من الاسم - حروف إنجليزية صغيرة وأرقام و (-). سيتم إنشاء الرابط الآمن الخاص بك.' 
                  : "Généré automatiquement à partir du nom. Il s'agira de l'adresse d'accès à votre portail CARISOFT."}
              </p>
              <div className="relative flex items-center">
                <div className="absolute left-0 pl-4 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="w-full pl-10 pr-4 py-3 bg-[#0a1120] border border-slate-800 rounded-xl text-sm font-mono text-slate-300 flex items-center overflow-hidden">
                  <span className="text-slate-500">https://</span>
                  <span className="text-amber-500/90 font-medium truncate ml-0.5">
                    {slug || 'mon-portail'}
                  </span>
                  <span className="text-slate-500">.carisoft.next</span>
                </div>
              </div>
            </div>

            <div className="h-px w-full bg-slate-800/80" />

            {/* 3. Langue */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-bold">3</span>
                <label className="text-sm font-semibold text-slate-200">
                  {language === 'ar' ? 'لغة الواجهة' : 'Langue de l\'interface'}
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'لغة البوابة أمام فريقك، ويمكنك تغييرها لاحقاً.' : 'Langue par défaut pour votre équipe. Modifiable plus tard.'}
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLanguage('fr')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all ${
                    language === 'fr' 
                      ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                      : 'bg-[#131d32] border-slate-700/80 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full border-2 ${language === 'fr' ? 'border-blue-500 bg-blue-500' : 'border-slate-600'}`}></span>
                  <span className="font-medium">Français</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setLanguage('ar')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all ${
                    language === 'ar' 
                      ? 'bg-amber-500/10 border-amber-500 text-amber-500' 
                      : 'bg-[#131d32] border-slate-700/80 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full border-2 ${language === 'ar' ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}></span>
                  <span className="font-medium font-arabic">العربية</span>
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800/50 rounded-xl text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 bg-[#1d64d8] hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-2xl flex items-center justify-center gap-2 text-base transition-all mt-6 shadow-lg shadow-blue-900/20"
            >
              {loading ? (language === 'ar' ? 'جاري الإنشاء...' : 'Création en cours...') : (language === 'ar' ? 'إنشاء المحجر' : 'Créer ma carrière')}
            </button>
          </form>
        </div>

        {/* Logout Link */}
        <div className="text-center pt-2">
          <button 
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors font-medium"
          >
            {language === 'ar' ? 'تسجيل الخروج' : 'Déconnexion'}
          </button>
        </div>
      </div>
    </div>
  );
}
