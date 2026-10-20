import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CustomerActivity } from '../../types';
import { 
  X, Plus, Edit2, Trash2, Check, AlertCircle, 
  Briefcase, Save, Sparkles, Building2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

export interface CustomerActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectActivity?: (activityId: string, activityName: string) => void;
  companyId?: string;
}

export function CustomerActivityModal({
  isOpen,
  onClose,
  onSelectActivity,
  companyId
}: CustomerActivityModalProps) {
  const { user } = useAuthStore();
  const currentCompanyId = companyId || user?.companyId || '';

  const activities = useLiveQuery(() => 
    db.customerActivities.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()
  ) || [];

  // Edit / Add Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<CustomerActivity | null>(null);

  if (!isOpen) return null;

  const handleStartEdit = (act: CustomerActivity) => {
    setEditingId(act.id);
    setName(act.name);
    setCode(act.code || '');
    setDescription(act.description || '');
    setIsAddingNew(false);
    setFormError(null);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setDescription('');
    setIsAddingNew(true);
    setFormError(null);
  };

  const handleCancelForm = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setName('');
    setCode('');
    setDescription('');
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Le nom de l\'activité est obligatoire.');
      return;
    }

    try {
      if (editingId) {
        await db.customerActivities.update(editingId, {
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
        });

        // Also update any customers that reference this activity name
        const linkedCustomers = await db.customers.where('activityId').equals(editingId).toArray();
        for (const cust of linkedCustomers) {
          await db.customers.update(cust.id, {
            activityName: name.trim()
          });
        }
      } else {
        const newId = `ACT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await db.customerActivities.add({
          id: newId,
          name: name.trim(),
          code: code.trim().toUpperCase() || undefined,
          description: description.trim() || undefined,
          companyId: currentCompanyId
        });

        if (onSelectActivity) {
          onSelectActivity(newId, name.trim());
        }
      }

      handleCancelForm();
    } catch (err) {
      console.error('Failed to save customer activity:', err);
      setFormError('Erreur lors de l\'enregistrement de l\'activité.');
    }
  };

  const handleDelete = async () => {
    if (!activityToDelete) return;
    try {
      await db.customerActivities.delete(activityToDelete.id);
      
      // Update customers that used this activity
      const linkedCustomers = await db.customers.where('activityId').equals(activityToDelete.id).toArray();
      for (const cust of linkedCustomers) {
        await db.customers.update(cust.id, {
          activityId: undefined,
          activityName: undefined
        });
      }

      setActivityToDelete(null);
      if (editingId === activityToDelete.id) {
        handleCancelForm();
      }
    } catch (err) {
      console.error('Failed to delete activity:', err);
      setFormError('Erreur lors de la suppression de l\'activité.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Gestion des Types d&apos;Activité Clients
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {activities.length} type{activities.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                ETB, Centrale à béton, Transporteur, Poste d&apos;enrobage, Bâtiment...
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          
          {/* Top Add Button & Subheader */}
          {!isAddingNew && !editingId && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                Liste des activités disponibles
              </span>
              <Button
                type="button"
                size="sm"
                onClick={handleStartAdd}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Ajouter une activité
              </Button>
            </div>
          )}

          {/* Form (Add or Edit) */}
          {(isAddingNew || editingId) && (
            <form onSubmit={handleSave} className="bg-white p-4 rounded-xl border-2 border-indigo-300 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-tight flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  {editingId ? "Modifier l'activité" : "Ajouter une nouvelle activité"}
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Nom de l&apos;activité <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Centrale à Béton, ETB, Transporteur..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Code court (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: BETON, ETB, TP..."
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Description ou Remarque (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Précisions sur cette catégorie de client..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelForm}
                  className="cursor-pointer text-xs"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {editingId ? 'Mettre à jour' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          )}

          {/* Activities List */}
          <div className="space-y-2">
            {activities.map((act) => {
              const isSelected = editingId === act.id;

              return (
                <div 
                  key={act.id} 
                  className={`bg-white p-3 sm:p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected ? 'border-indigo-400 bg-indigo-50/40 shadow-xs' : 'border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                      <Briefcase className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {act.name}
                        </span>
                        {act.code && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            {act.code}
                          </span>
                        )}
                      </div>
                      {act.description && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {act.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onSelectActivity && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onSelectActivity(act.id, act.name);
                          onClose();
                        }}
                        className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 text-xs px-2.5 py-1 cursor-pointer font-bold hidden sm:inline-flex"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Choisir
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(act)}
                      className="text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 cursor-pointer rounded-lg"
                      title="Modifier cette activité"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActivityToDelete(act)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 cursor-pointer rounded-lg"
                      title="Supprimer cette activité"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {activities.length === 0 && (
              <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                <Briefcase className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-xs text-slate-600">Aucune activité enregistrée</p>
                <p className="text-[11px] text-slate-400 mt-1">Cliquez sur « Ajouter une activité » pour commencer.</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer text-xs font-bold">
            Fermer
          </Button>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {activityToDelete && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-red-200 max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-600">
              <div className="p-2 bg-red-100 rounded-xl">
                <Trash2 className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-sm text-slate-900">Supprimer l&apos;activité ?</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Voulez-vous vraiment supprimer l&apos;activité <strong className="text-slate-900">{activityToDelete.name}</strong> ?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer shadow-xs"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
