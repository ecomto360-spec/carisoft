import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  FolderTree, Plus, Edit2, Trash2, Check, X, 
  AlertCircle, Layers
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

interface ProductFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFamily?: (familyId: string) => void;
}

export function ProductFamilyModal({ isOpen, onClose, onSelectFamily }: ProductFamilyModalProps) {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const families = useLiveQuery(() => db.productFamilies.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];

  const [newFamilyName, setNewFamilyName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddFamily = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = newFamilyName.trim();
    if (!name) {
      setError('Veuillez saisir un nom de famille.');
      return;
    }

    // Check duplicate
    if (families.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      setError('Cette famille de produit existe déjà.');
      return;
    }

    try {
      const id = 'FAM_' + Date.now().toString(36).toUpperCase();
      await db.productFamilies.put({
        id,
        name: name.toUpperCase()
      });
      setNewFamilyName('');
      if (onSelectFamily) {
        onSelectFamily(id);
      }
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'ajout de la famille.');
    }
  };

  const handleStartEdit = (id: string, name: string) => {

    setEditingId(id);
    setEditingName(name);
    setConfirmDeleteId(null);
    setError(null);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    const name = editingName.trim();
    if (!name) {
      setError('Le nom ne peut pas être vide.');
      return;
    }

    try {
      await db.productFamilies.update(id, { name: name.toUpperCase() });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la modification.');
    }
  };

  const handleRequestDelete = (id: string, name: string) => {
    setError(null);
    setEditingId(null);
    
    // Check if products use this family
    const usedCount = products.filter(p => p.familyId === id && p.active).length;
    if (usedCount > 0) {
      setError(`Impossible de supprimer "${name}" : ${usedCount} produit(s) y sont rattaché(s).`);
      return;
    }

    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await db.productFamilies.delete(id);
      setConfirmDeleteId(null);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la suppression.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Gestion des Familles de Produits</h2>
              <p className="text-xs text-slate-500">Ajouter, modifier ou supprimer des catégories</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Add New Family Form */}
          <form onSubmit={handleAddFamily} className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Nouvelle Famille de Produit
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: SABLES SPÉCIAUX, BALLAST..."
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 uppercase"
              />
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs px-4">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            </div>
          </form>

          {/* Family List */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Familles Existantes ({families.length})
            </label>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {families.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Aucune famille enregistrée.
                </div>
              ) : (
                families.map((family) => {
                  const isEditingThis = editingId === family.id;
                  const isDeletingThis = confirmDeleteId === family.id;
                  const count = products.filter(p => p.familyId === family.id && p.active).length;

                  return (
                    <div 
                      key={family.id}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors gap-2"
                    >
                      {isEditingThis ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 uppercase"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(family.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                            title="Valider"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors"
                            title="Annuler"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : isDeletingThis ? (
                        <div className="flex items-center justify-between w-full bg-red-50 p-2 rounded-lg border border-red-200 animate-in fade-in">
                          <span className="text-xs text-red-700 font-medium">
                            Supprimer définitivement <strong>{family.name}</strong> ?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(family.id)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold shadow-xs"
                            >
                              Oui, Supprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="font-semibold text-xs text-slate-800 uppercase">
                              {family.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {count} produit(s)
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {onSelectFamily && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectFamily(family.id);
                                  onClose();
                                }}
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-medium transition-colors mr-1"
                              >
                                Sélectionner
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(family.id, family.name)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRequestDelete(family.id, family.name)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
          <Button onClick={onClose} variant="outline" size="sm">
            Fermer
          </Button>
        </div>

      </div>
    </div>
  );
}
