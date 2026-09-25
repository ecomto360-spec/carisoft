import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  ArrowLeft, Check, Trash2, X, Upload, Camera, Image as ImageIcon, 
  Truck as TruckIcon, Phone, User, AlertTriangle, Star
} from 'lucide-react';
import { Truck } from '../../types';
import { useAuthStore } from '../../store/authStore';

export function TruckForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];

  // Form State matching "Fiche Camion Liaison PC"
  const [matricule, setMatricule] = useState('');
  const [mnTonne, setMnTonne] = useState<number | string>(0);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverId, setDriverId] = useState('');
  const [tare, setTare] = useState<number | string>('');
  const [volumeM3, setVolumeM3] = useState<number | string>('');
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
          setMnTonne(truck.mnTonne !== undefined ? truck.mnTonne : 0);
          setDriverName(truck.driverName || '');
          setDriverPhone(truck.driverPhone || '');
          setDriverId(truck.driverId || '');
          setTare(truck.tare !== undefined ? truck.tare : '');
          setVolumeM3(truck.volumeM3 !== undefined ? truck.volumeM3 : '');
          setAllowDiscount(Boolean(truck.allowDiscount));
          setIsFavorite(Boolean(truck.isFavorite));
          setImageUrl(truck.imageUrl || '');
          setActive(truck.active !== undefined ? truck.active : true);
        }
      });
    }
  }, [id, isEditing]);

  // When a driver is selected from existing drivers list, auto-fill driverName and driverPhone
  const handleDriverSelect = (selectedDriverId: string) => {

    setDriverId(selectedDriverId);
    if (selectedDriverId) {
      const found = drivers.find(d => d.id === selectedDriverId);
      if (found) {
        setDriverName(found.name);
        if (found.phone) setDriverPhone(found.phone);
      }
    }
  };

  // Image Upload handler (convert to Base64 data URL)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("L'image est trop volumineuse (max 5 Mo).");
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
        alert("L'image est trop volumineuse (max 5 Mo).");
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
      setFormError('Veuillez saisir une tare valide en tonnes.');
      return;
    }

    setIsSubmitting(true);
    try {
      const truckPayload: Truck = {
        id: isEditing && id ? id : crypto.randomUUID(),
        matricule: matricule.trim(),
        tare: Number(tare),
        mnTonne: mnTonne === '' ? 0 : Number(mnTonne),
        volumeM3: volumeM3 === '' ? undefined : Number(volumeM3),
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        driverId: driverId || undefined,
        allowDiscount: Boolean(allowDiscount),
        isFavorite: Boolean(isFavorite),
        imageUrl: imageUrl || undefined,
        active
      };

      if (isEditing && id) {
        await db.trucks.update(id, truckPayload);
      } else {
        await db.trucks.add(truckPayload);
      }

      // Also if driverName is new and not in drivers list, optionally create/update driver
      if (driverName.trim()) {
        const existingDriver = drivers.find(
          d => d.name.toLowerCase().trim() === driverName.toLowerCase().trim()
        );
        if (!existingDriver) {
          await db.drivers.add({
            id: crypto.randomUUID(),
            name: driverName.trim(),
            phone: driverPhone.trim(),
            active: true
          });
        }
      }

      navigate('/logistics?tab=trucks');
    } catch (error) {
      console.error('Failed to save truck:', error);
      setFormError('Erreur lors de la sauvegarde du camion.');
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
      alert('Erreur lors de la suppression du camion.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200">
      
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/logistics?tab=trucks')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste des camions
        </button>
        <span className="text-xs font-mono font-bold text-slate-500">
          Système Liaison Pont-Bascule PC
        </span>
      </div>

      {formError && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Form Container in standard application theme */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Form Header */}
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
              <TruckIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {isEditing ? 'Modifier le Camion' : 'Nouveau Camion'}
              </h1>
              <p className="text-xs text-slate-500">
                Paramétrage du camion et tare pour la liaison pont-bascule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
              active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {active ? 'Camion en service' : 'Inactif / Hors service'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Form Fields (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Section 1: Informations Générales */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Informations Générales
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Matricule */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      Matricule du Camion <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Ex: 000082 25 26"
                      value={matricule}
                      onChange={(e) => setMatricule(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs"
                    />
                  </div>

                  {/* Mn tonne */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Mn Tonne (T)
                      </label>
                      <span className="text-[11px] text-slate-400">Poids minimum</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={mnTonne}
                        onChange={(e) => setMnTonne(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        T
                      </span>
                    </div>
                  </div>

                  {/* Tare (Fixe) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        Tare fixe (T) <span className="text-red-500 font-bold">*</span>
                      </label>
                      <span className="text-[11px] text-blue-600 font-medium">Poids à vide</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={tare}
                        onChange={(e) => setTare(e.target.value)}
                        className="w-full px-3.5 py-2 bg-blue-50/50 border border-blue-200 rounded-lg text-sm font-mono font-black text-blue-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-700">
                        T
                      </span>
                    </div>
                  </div>

                  {/* Volume (m³) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Volume / Mètre cube (m³)
                      </label>
                      <span className="text-[11px] text-slate-400">Capacité benne</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="0.00"
                        value={volumeM3}
                        onChange={(e) => setVolumeM3(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        m³
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Section 2: Chauffeur & Contact */}
              <div className="space-y-4 pt-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Chauffeur & Contact
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Chauffeur Nom */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                        Nom du Chauffeur
                      </label>
                      {drivers.length > 0 && (
                        <span className="text-[11px] text-blue-600">ou liste déroulante</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Mohamed Kaci"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs"
                      />
                      {drivers.length > 0 && (
                        <select
                          value={driverId}
                          onChange={(e) => handleDriverSelect(e.target.value)}
                          className="px-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 rounded-lg shadow-2xs cursor-pointer focus:outline-none shrink-0 max-w-[130px]"
                          title="Choisir parmi les chauffeurs existants"
                        >
                          <option value="">Sélection...</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Téléphone Chauffeur */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-500" />
                      Numéro de Téléphone
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 0550 12 34 56"
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs"
                    />
                  </div>

                </div>
              </div>

              {/* Section 3: Options commerciales & Statut */}
              <div className="space-y-4 pt-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Options & Statut
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Camion Favori */}
                  <div className={`p-3.5 rounded-xl border flex items-center transition-all ${
                    isFavorite 
                      ? 'bg-amber-50/80 border-amber-300 shadow-2xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}>
                    <label className="flex items-center gap-3 text-xs font-bold text-slate-800 cursor-pointer select-none w-full">
                      <input
                        type="checkbox"
                        checked={isFavorite}
                        onChange={(e) => setIsFavorite(e.target.checked)}
                        className="h-4 w-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="flex items-center gap-1.5 text-amber-950 font-black">
                          <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : 'text-amber-400'}`} />
                          Camion favori
                        </span>
                        <p className="text-[10.5px] text-amber-900/80 font-normal leading-tight mt-0.5">
                          S'affiche dans les camions favoris en Bon de Livraison
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Accorder remise */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      Accorder une Remise
                    </label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="allowDiscount"
                          checked={allowDiscount === true}
                          onChange={() => setAllowDiscount(true)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Oui</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="allowDiscount"
                          checked={allowDiscount === false}
                          onChange={() => setAllowDiscount(false)}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Non</span>
                      </label>
                    </div>
                  </div>

                  {/* Camion Actif */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center">
                    <label className="flex items-center gap-3 text-xs font-bold text-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => setActive(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <span>Camion Actif en service</span>
                        <p className="text-[11px] text-slate-500 font-normal leading-tight mt-0.5">
                          Visible lors de la sélection des camions
                        </p>
                      </div>
                    </label>
                  </div>

                </div>
              </div>

            </div>

            {/* Right Column: Photo Area & Quick Summary (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span>Photo du Camion</span>
                  <Camera className="h-3.5 w-3.5 text-slate-400" />
                </h3>

                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group w-full h-44 bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 overflow-hidden shadow-2xs cursor-pointer flex flex-col items-center justify-center transition-all"
                  title="Cliquer ou glisser-déposer pour uploader une photo du camion"
                >
                  {imageUrl ? (
                    <>
                      <img 
                        src={imageUrl} 
                        alt="Photo du camion" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-2xs">
                        <Upload className="h-5 w-5 text-blue-300" />
                        <span>Changer la photo</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4 text-slate-500 group-hover:text-blue-600">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <Camera className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-bold block text-slate-800">Ajouter une photo</span>
                      <span className="text-[11px] text-slate-400 mt-0.5">Glisser-déposer ou cliquer (max 5 Mo)</span>
                    </div>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />

                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="w-full py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 text-center transition-colors cursor-pointer"
                  >
                    Supprimer la photo
                  </button>
                )}
              </div>

              {/* Quick Info Box */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2 text-xs text-blue-900">
                <span className="font-bold block text-blue-950">Liaison Pont-Bascule</span>
                <p className="text-[11px] text-blue-800/80 leading-relaxed">
                  La tare renseignée sur cette fiche sera automatiquement pré-remplie et verrouillée lors de la pesée sur les bons de livraison.
                </p>
              </div>

            </div>

          </div>

          {/* Action Buttons Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            
            {/* Delete button on the left if editing */}
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer le camion
                </button>
              )}
            </div>

            {/* Right action buttons: Annuler + Valider */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/logistics?tab=trucks')}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                Annuler / Quitter
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="h-4 w-4 stroke-[2.5]" />
                {isEditing ? 'Enregistrer les modifications' : 'Valider & Enregistrer'}
              </button>
            </div>

          </div>

        </form>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Supprimer le camion ?</h3>
            </div>
            <p className="text-xs text-slate-600">
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

