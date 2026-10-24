import React, { useState } from 'react';
import { X, Calendar, Key, Shield, Phone, Mail, Building, MapPin, User, Sparkles, Check, Clock } from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { firestore, auth } from '../../lib/firebase';
import { db } from '../../db/db';

interface EditCompanyModalProps {
  customer: any;
  onClose: () => void;
  onRefresh: () => void;
}

export function EditCompanyModal({ customer, onClose, onRefresh }: EditCompanyModalProps) {
  const [name, setName] = useState(customer.name || customer.nom || '');
  const [email, setEmail] = useState(customer.ownerEmail || customer.email || '');
  const [contactName, setContactName] = useState(customer.contactName || customer.ownerName || '');
  const [phone, setPhone] = useState(customer.phone || customer.telephone || '');
  const [address, setAddress] = useState(customer.address || customer.wilaya || '');
  const [licensePlan, setLicensePlan] = useState(customer.licensePlan || 'PRO 1 An');
  const [licenseStatus, setLicenseStatus] = useState<'actif' | 'essai' | 'expire' | 'suspendu'>(
    customer.licenseStatus === 'active' || customer.status === 'actif' ? 'actif' :
    customer.licenseStatus === 'trial' || customer.status === 'essai' ? 'essai' :
    customer.status === 'suspendu' ? 'suspendu' : 'expire'
  );

  // Expiry date formatting for input type="date"
  const getInitialDate = () => {
    if (!customer.licenseExpiry) return '';
    try {
      const d = new Date(customer.licenseExpiry);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const [expiryDate, setExpiryDate] = useState<string>(getInitialDate());
  const [licenseKey, setLicenseKey] = useState<string>(customer.licenseKey || '');
  const [loading, setLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate live days remaining
  const calculateDaysRemaining = () => {
    if (!expiryDate) return null;
    const expTime = new Date(expiryDate).getTime();
    if (isNaN(expTime)) return null;
    const diff = expTime - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = calculateDaysRemaining();

  // Quick add days
  const addDaysToExpiry = (days: number) => {
    const base = expiryDate && !isNaN(new Date(expiryDate).getTime()) 
      ? Math.max(Date.now(), new Date(expiryDate).getTime()) 
      : Date.now();
    const newDate = new Date(base + days * 24 * 60 * 60 * 1000);
    setExpiryDate(newDate.toISOString().split('T')[0]);
    if (licenseStatus === 'expire' || licenseStatus === 'suspendu') {
      setLicenseStatus('actif');
    }
  };

  // Generate a new secure formatted key via admin API
  const handleGenerateKey = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("SuperAdmin non authentifié");
      const idToken = await currentUser.getIdToken();
      const docId = customer.uid || customer.id || email;
      const days = licensePlan.toLowerCase().includes('3 mois') ? 90 :
                   licensePlan.toLowerCase().includes('6 mois') ? 180 :
                   licensePlan.toLowerCase().includes('essai') ? 30 : 365;

      const resp = await fetch('https://carisoft.vercel.app/api/admin-licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          action: 'create',
          tenantId: docId,
          durationDays: days,
          maxMachines: 1
        })
      });
      const data = await resp.json();
      if (data.success && data.key) {
        setLicenseKey(data.key);
      }
    } catch (e) {
      console.warn("Erreur génération clé via API:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const docId = customer.uid || customer.id;
      const finalExpiry = expiryDate ? new Date(`${expiryDate}T23:59:59Z`).toISOString() : '';

      const updatedPayload: any = {
        name: name.trim().toUpperCase(),
        ownerEmail: email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        licensePlan,
        licenseStatus: licenseStatus === 'actif' ? 'active' : licenseStatus,
        status: licenseStatus,
        licenseExpiry: finalExpiry,
        licenseKey: licenseKey.trim(),
        updatedAt: new Date().toISOString()
      };

      // 1. Update in Firestore companies
      if (docId) {
        try {
          const companyRef = doc(firestore, 'companies', docId);
          await setDoc(companyRef, updatedPayload, { merge: true });
        } catch (e) {
          console.warn("Erreur mise à jour Firestore company:", e);
        }

        // 2. Also try to update associated user doc
        try {
          const userRef = doc(firestore, 'users', docId);
          await setDoc(userRef, {
            name: contactName.trim() || name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.warn("Erreur mise à jour Firestore user:", e);
        }
      }

      // 3. Update in Dexie db.users if matching user exists locally
      try {
        const localUser = await db.users.where('email').equalsIgnoreCase(email.trim()).first();
        if (localUser) {
          await db.users.update(localUser.id, {
            name: contactName.trim() || name.trim(),
            email: email.trim().toLowerCase()
          });
        }
      } catch (dexieErr) {
        console.warn("Note: mise à jour locale Dexie ignorée:", dexieErr);
      }

      setSuccessNotice(true);
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 600);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "Une erreur est survenue lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 rounded-2xl w-full max-w-2xl border border-slate-800 shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Modifier la Fiche Client & Licence</h2>
              <p className="text-xs text-slate-400">Coordonnées, durée de validité et clés SaaS</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
              {errorMessage}
            </div>
          )}
          
          {/* Section 1: Informations Générales & Coordonnées */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              <span>Coordonnées de l'Entreprise & Client</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Raison Sociale / Entreprise <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Ex: CARRIÈRE SIDI MOUSSA"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Inscrit (Compte d'accès) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="client@domaine.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nom du Responsable / Contact
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="text" 
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Ex: M. Ahmed Benali"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Téléphone de contact
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Ex: 0550 12 34 56"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Adresse / Wilaya / Commune
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Ex: Zone Industrielle, Wilaya d'Alger"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Licence & Temps Restant */}
          <div className="pt-3 border-t border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Temps de Licence & Durée de Validité</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Formule / Plan de Licence
                </label>
                <select
                  value={licensePlan}
                  onChange={(e) => setLicensePlan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="PRO 1 An">PRO Annuel (1 An)</option>
                  <option value="PRO 6 Mois">PRO Semestriel (6 Mois)</option>
                  <option value="PRO 3 Mois">PRO Trimestriel (3 Mois)</option>
                  <option value="Essai Gratuit (30 Jours)">Essai Gratuit (30 Jours)</option>
                  <option value="Essai Gratuit (5 Jours)">Essai Gratuit (5 Jours)</option>
                  <option value="Permanent Illimité">Permanent Illimité</option>
                  <option value="Personnalisé">Personnalisé</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Statut du Compte
                </label>
                <select
                  value={licenseStatus}
                  onChange={(e) => setLicenseStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="actif">🟢 Actif (Accès autorisé)</option>
                  <option value="essai">🟡 Essai (Période d'évaluation)</option>
                  <option value="expire">🔴 Expiré (Accès restreint)</option>
                  <option value="suspendu">⛔ Suspendu / Bloqué</option>
                </select>
              </div>
            </div>

            {/* Expiry Date & Days Remaining Box */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-xs font-medium text-slate-300">
                  Date d'expiration de la licence
                </label>
                
                {daysRemaining !== null && (
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                    daysRemaining > 30 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : daysRemaining > 0 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                    {daysRemaining > 0 
                      ? `${daysRemaining} jour(s) restant(s)` 
                      : daysRemaining === 0 
                      ? `Expire aujourd'hui` 
                      : `Expiré depuis ${Math.abs(daysRemaining)} jour(s)`}
                  </span>
                )}
              </div>

              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                <input 
                  type="date" 
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                />
              </div>

              {/* Quick extension pills */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">
                  Prolonger rapidement la licence de :
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addDaysToExpiry(7)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    +7 Jours
                  </button>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiry(30)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    +30 Jours (1 Mois)
                  </button>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiry(90)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    +90 Jours (3 Mois)
                  </button>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiry(180)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
                  >
                    +180 Jours (6 Mois)
                  </button>
                  <button
                    type="button"
                    onClick={() => addDaysToExpiry(365)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-semibold transition-colors"
                  >
                    +365 Jours (1 An)
                  </button>
                </div>
              </div>
            </div>

            {/* License Key Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Clé de Licence CARISOFT
                </label>
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Générer nouvelle clé</span>
                </button>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input 
                  type="text" 
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9.5 pr-3 py-2.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="CARI-XXXX-XXXX-XXXX-XXXX"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-700 text-slate-300 rounded-xl hover:bg-slate-800 font-medium text-xs transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 font-semibold text-xs transition-all disabled:opacity-50 shadow-md shadow-blue-600/20 inline-flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Enregistrement...</span>
              ) : successNotice ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Modifications enregistrées !</span>
                </>
              ) : (
                <span>Enregistrer les modifications</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
