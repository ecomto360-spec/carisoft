import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  ArrowLeft, Check, Trash2, X, Upload, Camera, Image as ImageIcon, 
  Truck as TruckIcon, Phone, User, AlertTriangle, Star, Save, 
  CreditCard, FileText, UserCheck, Sparkles, CheckCircle2
} from 'lucide-react';
import { Truck } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { 
  validateAlgerianMobile, 
  validateAlgerianPhone, 
  sanitizePhoneNumber,
  formatAlgerianMobileInput,
  hasAlgerianIndicatif
} from '../../utils/algerianValidation';

export function TruckForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drivers = useLiveQuery(() => 
    db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()
  ) || [];

  // Form State: Truck fields
  const [matricule, setMatricule] = useState('');
  const [brand, setBrand] = useState('');
  const [tare, setTare] = useState<number | string>('');
  const [mnTonne, setMnTonne] = useState<number | string>(0);
  const [volumeM3, setVolumeM3] = useState<number | string>('');
  
  // Form State: Integrated Driver fields
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverNotes, setDriverNotes] = useState('');
  const [driverId, setDriverId] = useState('');

  // Form State: Options & Status
  const [allowDiscount, setAllowDiscount] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      db.trucks.get(id).then(truck => {
        if (truck) {
          setMatricule(truck.matricule || '');
          setBrand(truck.brand || '');
          setTare(truck.tare !== undefined ? truck.tare : '');
          setMnTonne(truck.mnTonne !== undefined ? truck.mnTonne : 0);
          setVolumeM3(truck.volumeM3 !== undefined ? truck.volumeM3 : '');
          
          setDriverName(truck.driverName || '');
          setDriverPhone(truck.driverPhone || '');
          setDriverLicense(truck.driverLicense || '');
          setDriverNotes(truck.driverNotes || '');
          setDriverId(truck.driverId || '');

          setAllowDiscount(Boolean(truck.allowDiscount));
          setIsFavorite(Boolean(truck.isFavorite));
          setImageUrl(truck.imageUrl || '');
          setActive(truck.active !== undefined ? truck.active : true);
        }
      });
    }
  }, [id, isEditing]);

  // When a driver is selected from existing suggestions, auto-fill driver details
  const handleDriverChange = (nameInput: string) => {
    setDriverName(nameInput);
    const found = drivers.find(d => d.name.toLowerCase().trim() === nameInput.toLowerCase().trim());
    if (found) {
      setDriverId(found.id);
      if (found.phone && !driverPhone) {
        setDriverPhone(found.phone);
      }
    }
  };

  const handleSelectExistingDriver = (selectedDrvId: string) => {
    setDriverId(selectedDrvId);
    const found = drivers.find(d => d.id === selectedDrvId);
    if (found) {
      setDriverName(found.name);
      setDriverPhone(found.phone || '');
    }
  };

  // Image Upload handler (Base64)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError("L'image est trop volumineuse (max 5 Mo).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        setFormError("L'image est trop volumineuse (max 5 Mo).");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!matricule.trim()) {
      setFormError('Veuillez saisir le matricule du camion.');
      return;
    }

    if (tare === '' || isNaN(Number(tare)) || Number(tare) < 0) {
      setFormError('Veuillez saisir une tare valide en tonnes (ex: 12.50).');
      return;
    }

    if (driverPhone.trim() && !validateAlgerianMobile(driverPhone) && !validateAlgerianPhone(driverPhone)) {
      setFormError('Numéro de téléphone chauffeur invalide (10 chiffres max commençant par 05, 06 ou 07, sauf si on utilise l\'indicatif (213)).');
      return;
    }

    const cleanDriverPhone = driverPhone.trim() ? sanitizePhoneNumber(driverPhone) : '';

    setIsSubmitting(true);
    try {
      let resolvedDriverId = driverId;

      // Integrated driver sync: if driverName is provided, ensure driver exists or create it
      if (driverName.trim()) {
        const existingDriver = drivers.find(
          d => d.name.toLowerCase().trim() === driverName.toLowerCase().trim()
        );

        if (existingDriver) {
          resolvedDriverId = existingDriver.id;
          // Update phone if changed
          if (cleanDriverPhone && existingDriver.phone !== cleanDriverPhone) {
            await db.drivers.update(existingDriver.id, {
              phone: cleanDriverPhone
            });
          }
        } else {
          // Auto-create new driver record seamlessly
          const newDriverId = `DRV_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await db.drivers.add({
            id: newDriverId,
            name: driverName.trim(),
            phone: cleanDriverPhone,
            active: true,
            companyId: currentCompanyId
          });
          resolvedDriverId = newDriverId;
        }
      }

      const truckPayload: Truck = {
        id: isEditing && id ? id : `TRK_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        matricule: matricule.trim().toUpperCase(),
        brand: brand.trim() || undefined,
        tare: Number(tare),
        mnTonne: mnTonne === '' ? 0 : Number(mnTonne),
        volumeM3: volumeM3 === '' ? undefined : Number(volumeM3),
        driverName: driverName.trim() || undefined,
        driverPhone: cleanDriverPhone || undefined,
        driverLicense: driverLicense.trim() || undefined,
        driverNotes: driverNotes.trim() || undefined,
        driverId: resolvedDriverId || undefined,
        allowDiscount: Boolean(allowDiscount),
        isFavorite: Boolean(isFavorite),
        imageUrl: imageUrl || undefined,
        active,
        companyId: currentCompanyId
      };

      if (isEditing && id) {
        await db.trucks.update(id, truckPayload);
      } else {
        await db.trucks.add(truckPayload);
      }

      navigate('/logistics?tab=trucks');
    } catch (error) {
      console.error('Failed to save truck and driver:', error);
      setFormError('Erreur lors de la sauvegarde du camion et de son chauffeur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await db.trucks.delete(id);
      navigate('/logistics?tab=trucks');
    } catch (err) {
      console.error('Failed to delete truck', err);
      setFormError('Erreur lors de la suppression du camion.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in duration-200 pb-12">
      
      {/* Top Navigation & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => navigate('/logistics?tab=trucks')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900">
                  {isEditing ? `Modifier : ${matricule || 'Camion'}` : 'Nouveau Camion & Chauffeur'}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Sparkles className="h-3 w-3" />
                  Formulaire Tout-en-un
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Saisie directe du camion, de la tare fixe et du chauffeur attitré
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/logistics?tab=trucks')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {formError && (
        <div className="p-3.5 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span className="font-medium">{formError}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setFormError(null)} 
            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Main 2-Column Grid: Left (Camion / Pont-Bascule) & Right (Chauffeur Intégré) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* SECTION 1: CAMION & PONT-BASCULE (7 cols) */}
          <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
                  <TruckIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight">
                    1. Fiche Technique du Camion
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Paramètres de pesée au pont-bascule
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-mono font-black bg-blue-100 text-blue-800 rounded">
                Pont-Bascule
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Matricule */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Matricule Camion <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: 000082 25 26"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-black text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs placeholder:font-normal"
                />
              </div>

              {/* Marque / Modèle */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Marque / Modèle
                </label>
                <input
                  type="text"
                  placeholder="Ex: Renault Kerax 440, Shacman..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              {/* Tare fixe (Poids à vide) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Tare Fixe (T) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-600 font-bold">Poids à vide</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={tare}
                    onChange={(e) => setTare(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50/60 border border-blue-300 rounded-lg text-xs font-mono font-black text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-blue-700 pointer-events-none">
                    T
                  </span>
                </div>
              </div>

              {/* Mn Tonne */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Mn Tonne (T)
                  </label>
                  <span className="text-[10px] text-slate-400">Charge min.</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={mnTonne}
                    onChange={(e) => setMnTonne(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8 shadow-2xs"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    T
                  </span>
                </div>
              </div>

              {/* Volume Benne */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Volume Benne (m³)
                  </label>
                  <span className="text-[10px] text-slate-400">Pour conversion cubage / tonnage</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Ex: 16.0 ou 22.0"
                    value={volumeM3}
                    onChange={(e) => setVolumeM3(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9 shadow-2xs"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                    m³
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Favorites & Status inside truck card */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="h-4 w-4 text-amber-500 rounded border-amber-300 focus:ring-amber-400 cursor-pointer"
                />
                <span className="flex items-center gap-1 text-slate-800 font-bold">
                  <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                  Camion Favori (accès rapide pont-bascule)
                </span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>En service (Actif)</span>
              </label>
            </div>
          </div>

          {/* SECTION 2: CHAUFFEUR ATTITRÉ (INTÉGRÉ) (5 cols) */}
          <div className="lg:col-span-5 bg-linear-to-b from-slate-50 to-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <UserCheck className="h-4 w-4 text-emerald-700" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-tight">
                    2. Chauffeur Attitré
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Conducteur régulier & coordonnées directes
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Intégré
              </span>
            </div>

            <div className="space-y-3">
              
              {/* Nom du chauffeur avec autocomplete datalist */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    Nom et Prénom du Chauffeur
                  </label>
                  {drivers.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      ({drivers.length} enregistré{drivers.length > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                
                <div className="relative">
                  <input
                    type="text"
                    list="drivers-datalist"
                    placeholder="Tapez un nom ou sélectionnez..."
                    value={driverName}
                    onChange={(e) => handleDriverChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs placeholder:font-normal"
                  />
                  <datalist id="drivers-datalist">
                    {drivers.map(d => (
                      <option key={d.id} value={d.name}>
                        {d.phone ? `${d.name} (${d.phone})` : d.name}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Sélecteur rapide si chauffeurs existants */}
              {drivers.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                    Ou choisir :
                  </span>
                  <select
                    value={driverId}
                    onChange={(e) => handleSelectExistingDriver(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white text-slate-700 text-xs font-medium border border-slate-300 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
                  >
                    <option value="">-- Sélectionner dans la liste existante --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.phone ? `• ${d.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Téléphone Chauffeur */}
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  N° Téléphone / Mobile
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ex: 0550 12 34 56 / 0661 00 00 00"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(formatAlgerianMobileInput(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Permis / Pièce d'identité */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                    Permis / CIN (Opt.)
                  </label>
                  <input
                    type="text"
                    placeholder="N° Permis..."
                    value={driverLicense}
                    onChange={(e) => setDriverLicense(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <FileText className="h-3.5 w-3.5 text-slate-400" />
                    Remarque / Type
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Régulier, Client..."
                    value={driverNotes}
                    onChange={(e) => setDriverNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 leading-relaxed">
                💡 <strong>Optimisation automatique :</strong> Le chauffeur saisi est synchronisé en temps réel et sera proposé automatiquement lors de la pesée des Bons de Livraison.
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Section: Commercial Options & Photo */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Camera className="h-4 w-4 text-indigo-600" />
              Options Commerciales & Photo du Véhicule
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            
            {/* Remise commerciale */}
            <div className="sm:col-span-6 space-y-2">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Accorder une Remise commerciale sur ce camion ?
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="allowDiscount"
                      checked={allowDiscount === true}
                      onChange={() => setAllowDiscount(true)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Oui (Autorisée en caisse/BL)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="allowDiscount"
                      checked={allowDiscount === false}
                      onChange={() => setAllowDiscount(false)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Non (Prix standard)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Photo du Camion */}
            <div className="sm:col-span-6">
              <div className="flex items-center gap-3">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group w-32 h-20 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 overflow-hidden cursor-pointer flex flex-col items-center justify-center transition-all shrink-0"
                  title="Cliquer ou glisser une photo"
                >
                  {imageUrl ? (
                    <>
                      <img 
                        src={imageUrl} 
                        alt="Photo du camion" 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                        <Upload className="h-3 w-3" />
                        <span>Changer</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-2 text-slate-500">
                      <Camera className="h-4 w-4 mx-auto text-slate-400 mb-0.5" />
                      <span className="text-[10px] font-bold block text-slate-700">Photo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="text-xs font-bold text-slate-700">
                    Photo d&apos;identification du camion
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Format PNG, JPG ou WebP (max 5 Mo). Affichée sur le pont-bascule.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors border border-blue-200"
                    >
                      {imageUrl ? 'Modifier l’image' : 'Parcourir...'}
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer transition-colors border border-red-200"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => navigate('/logistics?tab=trucks')}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-sm cursor-pointer transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Enregistrement en cours...' : 'Enregistrer le Camion & Chauffeur'}</span>
          </button>
        </div>

      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Supprimer le camion ?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le camion matricule <strong className="font-mono text-slate-900">{matricule}</strong> ?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg cursor-pointer shadow-md"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
