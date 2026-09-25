import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { 
  Plus, Edit2, Trash2, Check, X, 
  AlertCircle, Scale
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

interface ProductUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUnit?: (unitName: string) => void;
}

export function ProductUnitModal({ isOpen, onClose, onSelectUnit }: ProductUnitModalProps) {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const units = useLiveQuery(() => db.productUnits.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];

  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingSymbol, setEditingSymbol] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddUnit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = newUnitName.trim();
    const symbol = (newUnitSymbol.trim() || name).trim();

    if (!name) {
      setError('Veuillez saisir un nom d\'unité.');
      return;
    }

    // Check duplicate
    if (units.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      setError('Cette unité de mesure existe déjà.');
      return;
    }

    try {
      const id = 'UNIT_' + Date.now().toString(36).toUpperCase();
      const code = symbol.toUpperCase().slice(0, 4);

      await db.productUnits.put({
        id,
        code,
        name,
        symbol
      });

      setNewUnitName('');
      setNewUnitSymbol('');
      if (onSelectUnit) {
        onSelectUnit(name);
      }
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'ajout de l\'unité.');
    }
  };

  const handleStartEdit = (id: string, name: string, symbol: string) => {

    setEditingId(id);
    setEditingName(name);
    setEditingSymbol(symbol);
    setConfirmDeleteId(null);
    setError(null);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    const name = editingName.trim();
    const symbol = (editingSymbol.trim() || name).trim();

    if (!name) {
      setError('Le nom de l\'unité ne peut pas être vide.');
      return;
    }

    try {
      await db.productUnits.update(id, {
        name,
        symbol,
        code: symbol.toUpperCase().slice(0, 4)
      });
      setEditingId(null);
      setEditingName('');
      setEditingSymbol('');
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la modification.');
    }
  };

  const handleRequestDelete = (id: string, name: string) => {
    setError(null);
    setEditingId(null);

    // Check if any active products use this unit
    const usedCount = products.filter(p => p.unit?.toLowerCase() === name.toLowerCase() && p.active).length;
    if (usedCount > 0) {
      setError(`Impossible de supprimer "${name}" : ${usedCount} produit(s) utilisent cette unité.`);
      return;
    }

    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await db.productUnits.delete(id);
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
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base">Gestion des Unités de Mesure</h2>
              <p className="text-xs text-slate-500">Ajouter, modifier ou supprimer des unités (Tonne, m³, etc.)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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

          {/* Add New Unit Form */}
          <form onSubmit={handleAddUnit} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Nouvelle Unité de Mesure
            </label>
            <div className="grid grid-cols-5 gap-2">
              <input
                type="text"
                placeholder="Nom (ex: Mètre cube)"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="col-span-3 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800"
              />
              <input
                type="text"
                placeholder="Symbole (m³)"
                value={newUnitSymbol}
                onChange={(e) => setNewUnitSymbol(e.target.value)}
                className="col-span-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800 font-mono text-center"
              />
              <Button type="submit" size="sm" className="col-span-1 bg-emerald-600 hover:bg-emerald-500 text-xs px-2">
                <Plus className="h-4 w-4 mr-0.5" />
                Ajouter
              </Button>
            </div>
          </form>

          {/* Units List */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Unités Existantes ({units.length})
            </label>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {units.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Aucune unité enregistrée.
                </div>
              ) : (
                units.map((unit) => {
                  const isEditingThis = editingId === unit.id;
                  const isDeletingThis = confirmDeleteId === unit.id;
                  const count = products.filter(p => p.unit?.toLowerCase() === unit.name.toLowerCase() && p.active).length;

                  return (
                    <div 
                      key={unit.id}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors gap-2"
                    >
                      {isEditingThis ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Nom"
                            className="flex-1 px-2.5 py-1 text-xs border border-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                            autoFocus
                          />
                          <input
                            type="text"
                            value={editingSymbol}
                            onChange={(e) => setEditingSymbol(e.target.value)}
                            placeholder="Symbole"
                            className="w-16 px-2 py-1 text-xs border border-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-mono text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(unit.id)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                            title="Valider"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition-colors cursor-pointer"
                            title="Annuler"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : isDeletingThis ? (
                        <div className="flex items-center justify-between w-full bg-red-50 p-2 rounded-lg border border-red-200 animate-in fade-in">
                          <span className="text-xs text-red-700 font-medium">
                            Supprimer l'unité <strong>{unit.name}</strong> ?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(unit.id)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer"
                            >
                              Oui, Supprimer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono font-bold text-xs">
                              {unit.symbol || unit.code || unit.name}
                            </span>
                            <span className="font-semibold text-xs text-slate-800">
                              {unit.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {count} produit(s)
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {onSelectUnit && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectUnit(unit.name);
                                  onClose();
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-medium transition-colors mr-1 cursor-pointer"
                              >
                                Sélectionner
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStartEdit(unit.id, unit.name, unit.symbol || unit.code || '')}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRequestDelete(unit.id, unit.name)}
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
