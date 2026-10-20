import { useState, useMemo } from 'react';
import { Customer } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { Search, X, Check, User } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface ClientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: Customer) => void;
  customers: Customer[];
  selectedCustomerId?: string;
  companyName?: string;
}

export function ClientPickerModal({
  isOpen,
  onClose,
  onSelect,
  customers,
  selectedCustomerId,
  companyName = 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'
}: ClientPickerModalProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const [highlightedId, setHighlightedId] = useState<string>(selectedCustomerId || (customers[0]?.id || ''));

  const filteredCustomers = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 50);

    return customers.filter(c => {
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.type && c.type.toLowerCase().includes(q)) ||
        (c.familyId && c.familyId.toLowerCase().includes(q))
      );
    });
  }, [customers, debouncedSearch]);

  const displayedCustomers = useMemo(() => {
    return filteredCustomers.slice(0, 30);
  }, [filteredCustomers]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const cust = customers.find(c => c.id === highlightedId);
    if (cust) {
      onSelect(cust);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Window Title Bar */}
        <div className="bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-200" />
            <span className="font-semibold text-xs sm:text-sm tracking-tight truncate">
              {companyName} - Choix des clients
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
              placeholder="Rechercher par Code, Nom, ou Type de convention..."
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
          Client
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white sticky top-0 z-10 select-none">
              <tr>
                <th className="py-2 px-3 font-semibold border-r border-slate-700 w-20 text-center">Client</th>
                <th className="py-2 px-3 font-semibold border-r border-slate-700">Nom ou Raison sociale</th>
                <th className="py-2 px-3 font-semibold border-r border-slate-700 w-32">Type de client</th>
                <th className="py-2 px-3 font-semibold text-right w-36">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {displayedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    Aucun client trouvé pour &quot;{search}&quot;
                  </td>
                </tr>
              ) : (
                displayedCustomers.map((cust) => {
                  const isSelected = cust.id === highlightedId;
                  const balance = cust.balance || 0;
                  return (
                    <tr
                      key={cust.id}
                      onClick={() => setHighlightedId(cust.id)}
                      onDoubleClick={() => {
                        onSelect(cust);
                        onClose();
                      }}
                      className={`cursor-pointer transition-colors select-none ${
                        isSelected 
                          ? 'bg-[#d9f99d] text-slate-950 font-bold border-y border-lime-400' 
                          : 'hover:bg-blue-50/70 text-slate-700'
                      }`}
                    >
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-mono font-bold">
                        {cust.code}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium">
                        {cust.name}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono text-slate-600">
                        {cust.type || cust.familyId || 'DIVERS'}
                      </td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${
                        balance < 0 ? 'text-red-600' : balance > 0 ? 'text-emerald-700' : 'text-slate-800'
                      }`}>
                        {balance === 0 ? '0,00' : formatCurrency(balance)}
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
            {filteredCustomers.length} client(s) répertorié(s) - Double-cliquez pour sélectionner
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
              OK
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
