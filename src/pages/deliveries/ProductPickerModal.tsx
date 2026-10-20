import { useState, useMemo } from 'react';
import { Product, ProductPrice } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Layers, X, Check, Search } from 'lucide-react';

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product, priceHT: number) => void;
  products: Product[];
  productPrices: ProductPrice[];
  conventionId?: string;
  customPrices?: Record<string, number>;
}

export function ProductPickerModal({
  isOpen,
  onClose,
  onSelect,
  products,
  productPrices,
  conventionId,
  customPrices
}: ProductPickerModalProps) {
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string>(products[0]?.id || '');

  const getProductPrice = (productId: string) => {
    if (customPrices && customPrices[productId] !== undefined && customPrices[productId] > 0) {
      return customPrices[productId];
    }
    if (conventionId) {
      const p = productPrices.find(pr => pr.productId === productId && pr.conventionId === conventionId);
      if (p) return p.priceHT;
    }
    const defaultP = productPrices.find(pr => pr.productId === productId && pr.conventionId === 'C_CONV1')
      || productPrices.find(pr => pr.productId === productId);
    return defaultP ? defaultP.priceHT : 650;
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.familyId && p.familyId.toLowerCase().includes(q))
      );
    });
  }, [products, search]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const prod = products.find(p => p.id === highlightedId);
    if (prod) {
      const priceHT = getProductPrice(prod.id);
      onSelect(prod, priceHT);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Window Title Bar */}
        <div className="bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-200" />
            <span className="font-semibold text-xs sm:text-sm tracking-tight truncate">
              Choix du Produit / Agrégat
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white hover:bg-blue-600/50 p-1 rounded-md transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Search Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Rechercher un agrégat (ex: Sable 0/3, Gravier 3/8...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 bg-slate-200 rounded cursor-pointer"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Blue Table Header Title */}
        <div className="bg-blue-600 text-white text-center py-1 text-xs font-bold uppercase tracking-wider">
          Catalogue des Produits de Carrière
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white sticky top-0 z-10 select-none">
              <tr>
                <th className="py-2 px-3 font-semibold border-r border-slate-700 w-32">Code</th>
                <th className="py-2 px-3 font-semibold border-r border-slate-700">Désignation</th>
                <th className="py-2 px-3 font-semibold border-r border-slate-700 w-28">Famille</th>
                <th className="py-2 px-3 font-semibold text-right w-28">Prix U. HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    Aucun produit trouvé
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isSelected = prod.id === highlightedId;
                  const price = getProductPrice(prod.id);
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => setHighlightedId(prod.id)}
                      onDoubleClick={() => {
                        onSelect(prod, price);
                        onClose();
                      }}
                      className={`cursor-pointer transition-colors select-none ${
                        isSelected 
                          ? 'bg-[#d9f99d] text-slate-950 font-bold border-y border-lime-400' 
                          : 'hover:bg-blue-50/70 text-slate-700'
                      }`}
                    >
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold">
                        {prod.code}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium">
                        {prod.name}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600">
                        {prod.familyId || 'AGRÉGATS'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(price)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Double-cliquez pour insérer ce produit dans le bon de livraison
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Sélectionner
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
