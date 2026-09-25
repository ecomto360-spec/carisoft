import React, { useState, useEffect } from 'react';
import { Copy, CheckCircle2, AlertTriangle, ShieldCheck, Key, Lock, Loader2 } from 'lucide-react';
// Imports Tauri mockés pour la compatibilité avec l'environnement web
// Dans votre vrai projet Tauri, décommentez les lignes suivantes :
// import { invoke } from '@tauri-apps/api/core';
// import { Store } from '@tauri-apps/plugin-store';

export function TauriLicenseModal() {
  const [machineId, setMachineId] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Initialisation : Récupération du MachineID via Rust
    const fetchMachineId = async () => {
      try {
        // MOCK POUR ENVIRONNEMENT WEB : 
        // const id = await invoke<string>('get_machine_id');
        const id = "A1B2C3D4-5678-90EF-GHIJ-KLMNOPQRSTUV"; 
        setMachineId(id);
      } catch (err) {
        setErrorMessage("Impossible de lire l'identifiant matériel de ce PC.");
        setStatus('error');
      }
    };
    fetchMachineId();
  }, []);

  const handleCopyId = async () => {
    if (!machineId) return;
    await navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setErrorMessage("Veuillez saisir une clé de licence.");
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      // VRAI APPEL TAURI :
      // const payload = await invoke('verify_license', { licenseKey });
      
      // MOCK POUR ENVIRONNEMENT WEB : Simulation d'une vérification locale
      await new Promise(r => setTimeout(r, 1000));
      if (!licenseKey.includes('.')) throw new Error("Format de licence invalide.");
      
      // Sauvegarde sécurisée dans le Store Tauri
      // const store = new Store('license.dat');
      // await store.set('license_key', licenseKey);
      // await store.save();

      setStatus('success');
      
      // Recharger l'app ou débloquer l'UI après 2 secondes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.toString());
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800/50 p-6 border-b border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Activation requise</h2>
            <p className="text-sm text-slate-400">Application verrouillée. Saisissez votre clé hors-ligne.</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Étape 1 : Machine ID */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs border border-slate-700">1</span>
              Identifiant de ce PC
            </label>
            <p className="text-xs text-slate-400">
              Copiez cet identifiant et transmettez-le à l'administrateur pour générer votre clé de licence unique.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-sm tracking-wide break-all">
                {machineId || "Génération en cours..."}
              </code>
              <button
                onClick={handleCopyId}
                disabled={!machineId}
                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                title="Copier l'identifiant"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Étape 2 : Saisie Licence */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
             <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-xs border border-slate-700">2</span>
              Clé de licence (Ed25519)
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <textarea
                value={licenseKey}
                onChange={(e) => {
                  setLicenseKey(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="Collez la clé de licence reçue ici..."
                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none min-h-[100px] font-mono text-xs"
              />
            </div>
          </div>

          {/* Messages d'erreur ou succès */}
          {status === 'error' && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm leading-snug">{errorMessage}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Licence validée avec succès ! Redémarrage...</p>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={handleActivate}
            disabled={status === 'loading' || status === 'success' || !licenseKey.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
          >
            {status === 'loading' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Vérification cryptographique...</>
            ) : (
              <><Lock className="w-5 h-5" /> Déverrouiller l'application</>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}
