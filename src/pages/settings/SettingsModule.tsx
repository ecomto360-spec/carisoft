import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { 
  Save, ShieldCheck, KeyRound, CheckCircle2, 
  Clock, Crown, Copy, Check, AlertTriangle,
  Upload, Image as ImageIcon, Trash2, Building2, Globe
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { generateSignedLicenseKey, verifyLicenseKey } from '../../lib/security';
import { useTranslation } from '../../i18n';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { SuperAdminPanel } from '../admin/SuperAdminPanel';

export function SettingsModule() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';
  const settingsDb = useLiveQuery(() => db.settings.get(1));

  const { t, language } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

    const hasLicense = Boolean(user?.companyId && localStorage.getItem(`carisoft_tenant_${user.companyId}_license_key`));
  const isSuperAdmin = Boolean(
    user?.role === 'superadmin' || 
    user?.email?.toLowerCase() === 'nabsterzero@gmail.com' || 
    user?.username?.toLowerCase() === 'nabsterzero'
  );
  
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [nif, setNif] = useState('');
  const [nis, setNis] = useState('');
  const [rc, setRc] = useState('');
  const [article, setArticle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [licensePlan, setLicensePlan] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);

  // Super Admin Generator States
  const [genCompanyName, setGenCompanyName] = useState('SARL MAHAJIR SIDAR');
  const [genDurationDays, setGenDurationDays] = useState(365);
  const [genPlan, setGenPlan] = useState('SaaS Entreprise (1 An)');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedExpiry, setGeneratedExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (settingsDb) {
      setName(settingsDb.name);
      setAddress(settingsDb.address);
      setNif(settingsDb.nif);
      setNis(settingsDb.nis);
      setRc(settingsDb.rc);
      setArticle(settingsDb.article || '');
      setPhone(settingsDb.phone || '');
      setEmail(settingsDb.email || '');
      setLogoUrl(settingsDb.logoUrl || null);
      setLicenseKey(hasLicense ? (settingsDb.licenseKey || 'CARI-2026-SAAS-PRO-8942-X1') : '');
      setLicensePlan(hasLicense ? (settingsDb.licensePlan || 'SaaS Entreprise (1 An)') : 'Période d\'essai (Non Activée)');
      setLicenseExpiry(hasLicense ? (settingsDb.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) : '');
    }
  }, [settingsDb]);

  // Handle Logo Upload with image compression & Base64 conversion
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (!result) return;

      // Optimize image size via canvas to prevent database bloat
      const img = new Image();
      img.onload = () => {
        const maxWidth = 500;
        const maxHeight = 300;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL(file.type === 'png' ? 'image/png' : 'image/jpeg', 0.92);
          setLogoUrl(compressedDataUrl);
        } else {
          setLogoUrl(result);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Activate / Verify License Key entered by Admin
  const handleActivateLicense = async () => {
    setLicenseError(null);
    setLicenseSuccess(null);

    const verification = await verifyLicenseKey(licenseKey.trim(), name || 'SARL MAHAJIR SIDAR');
    if (!verification.valid) {
      setLicenseError(verification.reason || 'Clé de licence invalide ou non signée par le Super Admin.');
      return;
    }

    try {
      const updatedExpiry = verification.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      await db.settings.update(1, {
        licenseKey: licenseKey.trim(),
        licenseExpiry: updatedExpiry,
        licenseStatus: 'active'
      });
      setLicenseExpiry(updatedExpiry);
      setLicenseSuccess(`Licence 1 An validée et activée avec succès (${verification.daysRemaining || 365} jours restants) !`);
    } catch (e) {
      setLicenseError('Erreur lors de la mise à jour de la licence.');
    }
  };

  // Super Admin: Generate a brand new cryptographically signed key
  const handleGenerateKey = async () => {
    const res = await generateSignedLicenseKey(genCompanyName, genDurationDays, genPlan);
    setGeneratedKey(res.licenseKey);
    setGeneratedExpiry(new Date(res.expiryDate).toLocaleDateString('fr-FR'));
    setCopied(false);
  };

  const handleApplyGeneratedKey = async () => {
    if (!generatedKey) return;
    setLicenseKey(generatedKey);
    setLicensePlan(genPlan);
    
    const verification = await verifyLicenseKey(generatedKey, name);
    const updatedExpiry = verification.expiryDate || new Date(Date.now() + genDurationDays * 24 * 60 * 60 * 1000).toISOString();
    
    await db.settings.update(1, {
      licenseKey: generatedKey,
      licensePlan: genPlan,
      licenseExpiry: updatedExpiry,
      licenseStatus: 'active'
    });
    setLicenseExpiry(updatedExpiry);
    setLicenseSuccess('Nouvelle clé générée et appliquée immédiatement sur cette instance.');
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    try {
      await db.settings.put({ 
        id: 1, 
        name, 
        address, 
        nif, 
        nis, 
        rc, 
        article, 
        phone, 
        email,
        logoUrl: logoUrl || undefined,
        activity: settingsDb?.activity || "Production D'Agrégats",
        bank: settingsDb?.bank || '',
        capital: settingsDb?.capital || 1000000,
        tvaRate: settingsDb?.tvaRate || 19,
        timbre: settingsDb?.timbre || 1,
        timbreLimit: settingsDb?.timbreLimit || 2500,
        licenseKey,
        licensePlan,
        licenseExpiry: licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        licenseStatus: 'active'
      });
      alert('Paramètres de l\'entreprise et logo enregistrés avec succès !');
    } catch (error) {
      console.error(error);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  const formattedExpiry = licenseExpiry 
    ? new Date(licenseExpiry).toLocaleDateString('fr-FR')
    : '19/08/2027';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isSuperAdmin ? 'Paramètres Généraux & Licence SaaS' : t.settings.title}
        </h1>
        <p className="text-slate-500">
          {isSuperAdmin 
            ? 'Logo société, coordonnées fiscales, configuration entreprise et gestion de l\'abonnement 1 An'
            : t.settings.subtitle}
        </p>
      </div>

      {/* Language Selection Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              {t.settings.languageSection}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.settings.languageNotice}
            </p>
          </div>
        </div>

        <LanguageSelector variant="settings" />
      </div>

      {/* SaaS 1-Year License Status Card - VISIBLE ONLY TO SUPER ADMIN */}
      {isSuperAdmin && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-white">{hasLicense ? "Licence SaaS 1 An" : "Licence SaaS"}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${hasLicense ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                    {hasLicense ? "ACTIVE" : "NON ACTIVÉE"}
                  </span>
                </div>
                <p className="text-xs text-slate-300">Formule : {licensePlan || 'SaaS Entreprise (1 An)'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>Valable jusqu'au : <strong className="text-white">{formattedExpiry}</strong></span>
            </div>
          </div>

          {licenseSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{licenseSuccess}</span>
            </div>
          )}

          {licenseError && (
            <div className="p-3 bg-red-950/60 border border-red-800/50 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{licenseError}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Clé de Licence Activée
              </label>
              <input 
                type="text" 
                value={licenseKey} 
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="CARI-2026-XXXX-XXXX"
                className="w-full bg-slate-950/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-blue-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleActivateLicense}
                className="w-full text-xs h-9 bg-blue-600 hover:bg-blue-500"
              >
                Vérifier & Activer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SUPER ADMIN CUSTOMER LIST PANEL */}
      {isSuperAdmin && (
        <div className="bg-slate-900 rounded-2xl overflow-hidden mt-8 shadow-xl">
          <SuperAdminPanel />
        </div>
      )}

      {/* EXCLUSIVE SUPER ADMIN LICENSE GENERATOR */}
      {isSuperAdmin ? (
        <div className="bg-gradient-to-br from-purple-950/80 via-slate-900 to-slate-950 border border-purple-800/60 rounded-2xl p-6 text-white space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-purple-800/40 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-purple-200">
                  Console Éditeur : Générateur de Clé de Licence SaaS (1 An)
                </h3>
                <p className="text-xs text-purple-300/80">
                  Réservé au Super Administrateur (<strong>nabsterzero@gmail.com</strong>)
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-md text-xs font-bold border border-purple-500/30">
              ÉDITEUR OFFICIEL
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-xs text-purple-200 font-semibold">Société Bénéficiaire</label>
              <input 
                type="text" 
                value={genCompanyName}
                onChange={(e) => setGenCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-purple-800/60 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-purple-200 font-semibold">Durée de Validité</label>
              <select 
                value={genDurationDays}
                onChange={(e) => setGenDurationDays(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950/80 border border-purple-800/60 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                <option value={365}>1 An (365 Jours - Pack Annuel Standard)</option>
                <option value={180}>6 Mois (180 Jours - Pack Semestriel)</option>
                <option value={90}>3 Mois (90 Jours - Pack Trimestriel)</option>
                <option value={5}>5 Jours (Essai Gratuit)</option>
                <option value={730}>2 Ans (730 Jours - Multi-Années)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-purple-200 font-semibold">Formule / Plan</label>
              <select 
                value={genPlan}
                onChange={(e) => setGenPlan(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-purple-800/60 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                <option value="SaaS Entreprise (1 An)">SaaS Entreprise (1 An)</option>
                <option value="SaaS Pro Illimité">SaaS Pro Illimité</option>
                <option value="SaaS Carrière Multi-Sites">SaaS Carrière Multi-Sites</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleGenerateKey}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2"
            >
              <KeyRound className="h-4 w-4" />
              Générer la Clé de Licence Cryptée (1 An)
            </Button>
          </div>

          {generatedKey && (
            <div className="p-4 bg-slate-950/90 border border-purple-700/60 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Clé de Licence 1 An Signée avec Succès
                </span>
                <span className="text-xs text-slate-400">Expire le {generatedExpiry}</span>
              </div>

              <div className="p-3 bg-purple-950/50 rounded-lg border border-purple-800 font-mono text-sm font-bold text-purple-300 flex items-center justify-between">
                <span className="select-all">{generatedKey}</span>
                <button 
                  onClick={handleCopyKey}
                  className="p-1.5 hover:bg-purple-900/60 rounded-md text-purple-300 transition-colors flex items-center gap-1 text-xs"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button 
                  onClick={handleApplyGeneratedKey}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  Appliquer & Activer sur cette Carrière
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Company Logo Upload & Preview Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              {t.settings.companyLogo}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.settings.logoNotice}
            </p>
          </div>
          {logoUrl && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {t.settings.logoConfigured}
            </span>
          )}
        </div>

        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleLogoFileChange}
          accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
          className="hidden"
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Logo Preview Area */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl min-h-[160px]">
            {logoUrl ? (
              <div className="relative group w-full flex flex-col items-center">
                <img 
                  src={logoUrl} 
                  alt="Logo Entreprise" 
                  className="max-h-28 max-w-full object-contain drop-shadow-xs bg-white p-2 rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="mt-3 px-2.5 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t.settings.removeLogo}
                </button>
              </div>
            ) : (
              <div className="text-center text-slate-400 space-y-2">
                <Building2 className="h-10 w-10 mx-auto text-slate-300" />
                <p className="text-xs font-medium">{t.settings.noLogo}</p>
              </div>
            )}
          </div>

          {/* Upload Drop Zone & Controls */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
            onDragLeave={() => setIsDraggingLogo(false)}
            onDrop={handleLogoDrop}
            className={`md:col-span-8 p-6 rounded-xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center space-y-3 ${
              isDraggingLogo 
                ? 'border-blue-500 bg-blue-50/70 scale-[1.01]' 
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Upload className="h-6 w-6" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800">
                {t.settings.dragDropLogo}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Formats acceptés : <strong>PNG, JPG, WebP, SVG</strong> (Résolution conseillée : 400x200px)
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                {logoUrl ? t.settings.changeLogo : t.settings.selectImage}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Company Details Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2">{t.settings.legalFiscal}</h2>

        <Input label={t.settings.companyName} value={name} onChange={e => setName(e.target.value)} />
        <Input label={t.settings.address} value={address} onChange={e => setAddress(e.target.value)} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="NIF" value={nif} onChange={e => setNif(e.target.value)} />
          <Input label="NIS" value={nis} onChange={e => setNis(e.target.value)} />
          <Input label="Registre de Commerce (RC)" value={rc} onChange={e => setRc(e.target.value)} />
          <Input label="Article d'Imposition (AI)" value={article} onChange={e => setArticle(e.target.value)} />
          <Input label={t.phone} value={phone} onChange={e => setPhone(e.target.value)} />
          <Input label={t.email} value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} className="bg-blue-700 hover:bg-blue-600 text-white">
            <Save className="h-4 w-4 mr-2" /> {t.settings.saveSettings}
          </Button>
        </div>
      </div>
    </div>
  );
}

