import React, { useState, useEffect } from 'react';
import { 
  X, AlertTriangle, Bug, Lightbulb, CheckCircle2, 
  Send, MessageSquare, Mail, Copy, Check, Info, Sparkles 
} from 'lucide-react';
import { useAnomalyStore } from '../../store/anomalyStore';

const MODULES = [
  'Bons de Livraison / Pesage',
  'Facturation & Avoirs',
  'Commandes Clients',
  'Clients & Conventions',
  'Produits, Granulats & Tarifs',
  'Logistique (Camions & Chauffeurs)',
  'Règlements & Créances',
  'Statistiques & Rapports',
  'Impression & Export PDF/Excel',
  'Interface & Ergonomie',
  'Autre / Général'
];

export function AnomalyReportModal() {
  const { isReportModalOpen, closeReportModal, selectedModule, addAnomaly } = useAnomalyStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [module, setModule] = useState(selectedModule || MODULES[0]);
  const [severity, setSeverity] = useState<'bloquant' | 'moyen' | 'mineur' | 'suggestion'>('moyen');
  const [type, setType] = useState<'bug' | 'calcul' | 'affichage' | 'suggestion' | 'autre'>('bug');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedModule) {
      setModule(selectedModule);
    }
  }, [selectedModule]);

  if (!isReportModalOpen) return null;

  const currentPath = window.location.pathname;
  const systemInfo = `${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Ordinateur'} (${window.innerWidth}x${window.innerHeight})`;

  const generateReportText = () => {
    return `🚨 *SIGNALEMENT ANOMALIE CARISOFT*
━━━━━━━━━━━━━━━━━━━━
📌 *Module :* ${module}
🏷️ *Type :* ${type.toUpperCase()}
⚡ *Gravité :* ${severity.toUpperCase()}
📝 *Titre :* ${title || 'Sans titre'}
📄 *Description :*
${description || 'Aucune description fournie.'}

👤 *Testeur :* ${reporterName || 'Client Testeur Démo'}
📞 *Contact :* ${reporterContact || 'Non renseigné'}
🌐 *Page :* ${currentPath}
💻 *Système :* ${systemInfo}
🕒 *Date :* ${new Date().toLocaleString('fr-FR')}
━━━━━━━━━━━━━━━━━━━━`;
  };

  const handleCopy = () => {
    const text = generateReportText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Veuillez saisir un titre et une brève description de l'anomalie.");
      return;
    }
    await addAnomaly({
      title,
      description,
      module,
      severity,
      type,
      reporterName,
      reporterContact,
      currentUrl: currentPath,
      systemInfo,
    });
    const text = encodeURIComponent(generateReportText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setIsSuccess(true);
  };

  const handleEmail = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Veuillez saisir un titre et une brève description de l'anomalie.");
      return;
    }
    await addAnomaly({
      title,
      description,
      module,
      severity,
      type,
      reporterName,
      reporterContact,
      currentUrl: currentPath,
      systemInfo,
    });
    const subject = encodeURIComponent(`[CARISOFT DÉMO] Anomalie signalée : ${module} - ${title}`);
    const body = encodeURIComponent(generateReportText());
    window.location.href = `mailto:nabsterzero@gmail.com?subject=${subject}&body=${body}`;
    setIsSuccess(true);
  };

  const handleSubmitInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await addAnomaly({
        title,
        description,
        module,
        severity,
        type,
        reporterName,
        reporterContact,
        currentUrl: currentPath,
        systemInfo,
      });
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setReporterName('');
    setReporterContact('');
    setIsSuccess(false);
    closeReportModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400">
              <Bug className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">Signaler une anomalie</h3>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Test Client
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Aidez notre équipe à corriger ou améliorer cette fonctionnalité
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900">Anomalie transmise avec succès !</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Merci pour votre retour précieux. Nos développeurs analysent ce point pour y apporter un correctif rapide.
                </p>
              </div>
              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copié !' : 'Copier le résumé'}
                </button>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Fermer la fenêtre
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitInternal} className="space-y-4 text-start">
              
              {/* Module & Type grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Module ou Écran concerné <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={module}
                    onChange={(e) => setModule(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MODULES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nature du problème
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bug">🐛 Bug / Dysfonctionnement</option>
                    <option value="calcul">🔢 Erreur de calcul (Prix / Poids / TVA)</option>
                    <option value="affichage">👁️ Problème d'affichage ou ergonomie</option>
                    <option value="suggestion">💡 Suggestion d'amélioration</option>
                    <option value="autre">❓ Autre</option>
                  </select>
                </div>
              </div>

              {/* Gravity selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Degré de gravité
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'bloquant', label: 'Bloquant', desc: 'Empêche de travailler', color: 'border-red-500 bg-red-50 text-red-700' },
                    { id: 'moyen', label: 'Gênant', desc: 'Problème notable', color: 'border-amber-500 bg-amber-50 text-amber-700' },
                    { id: 'mineur', label: 'Mineur', desc: 'Détail / Cosmétique', color: 'border-blue-500 bg-blue-50 text-blue-700' },
                    { id: 'suggestion', label: 'Idée', desc: 'Proposition', color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSeverity(item.id as any)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        severity === item.id
                          ? `${item.color} font-bold shadow-xs ring-2 ring-offset-1 ring-blue-400`
                          : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs">{item.label}</div>
                      <div className="text-[10px] opacity-75 hidden sm:block">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Titre */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Résumé de l'anomalie <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Erreur lors de l'enregistrement du bon de livraison"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
              </div>

              {/* Description détaillée */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description détaillée des étapes pour reproduire <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Décrivez ce que vous faisiez, le bouton cliqué et ce qui s'est produit d'anormal..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Coordonnées optionnelles du testeur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Votre Nom ou Entreprise <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : M. Ahmed (Carrière Sidi Bel Abbès)"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Téléphone ou Email <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex : 0550 00 00 00"
                    value={reporterContact}
                    onChange={(e) => setReporterContact(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Diagnostics badge */}
              <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span className="flex items-center gap-1.5 truncate">
                  <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  Contexte auto-détecté : <strong className="text-slate-700">{currentPath}</strong>
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {/* WhatsApp send button */}
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                    title="Envoyer le rapport sur WhatsApp"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Email send button */}
                  <button
                    type="button"
                    onClick={handleEmail}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                    title="Envoyer le rapport par Email"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email</span>
                  </button>

                  {/* Copy button */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title="Copier le texte"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetAndClose}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !description.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</span>
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
