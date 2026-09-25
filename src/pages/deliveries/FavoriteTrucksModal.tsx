import { useState, useMemo } from 'react';
import { Truck, Driver, DeliveryNote } from '../../types';
import { Star, X, Check, Search, Truck as TruckIcon, Phone } from 'lucide-react';

interface FavoriteTrucksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (truck: Truck, driverName?: string) => void;
  customerName: string;
  customerId?: string;
  trucks: Truck[];
  drivers: Driver[];
  deliveries: DeliveryNote[];
  selectedTruckId?: string;
}

interface FavoriteTruckItem {
  truck: Truck;
  driverName: string;
  driverPhone?: string;
  removalCount: number;
}

export function FavoriteTrucksModal({
  isOpen,
  onClose,
  onSelect,
  customerName,
  customerId,
  trucks,
  drivers,
  deliveries,
  selectedTruckId
}: FavoriteTrucksModalProps) {
  const [search, setSearch] = useState('');

  const driverMap = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string }>();
    drivers.forEach(d => map.set(d.id, { name: d.name, phone: d.phone }));
    return map;
  }, [drivers]);

  // Compute removal count (Nbre d'enlèvement) and prioritize favorite trucks
  const favoriteItems = useMemo<FavoriteTruckItem[]>(() => {
    const countByTruck = new Map<string, number>();
    
    if (customerId && deliveries) {
      deliveries.forEach(del => {
        if (del.customerId === customerId && del.truckId) {
          countByTruck.set(del.truckId, (countByTruck.get(del.truckId) || 0) + 1);
        }
      });
    }

    // Include trucks marked as favorite OR trucks that have delivered for this customer
    const candidateTrucks = trucks.filter(t => t.active !== false && (t.isFavorite || (countByTruck.get(t.id) || 0) > 0));
    // If none are marked favorite and no deliveries yet, show all active trucks
    const targetTrucks = candidateTrucks.length > 0 ? candidateTrucks : trucks.filter(t => t.active !== false);

    return targetTrucks.map(truck => {
      const realCount = countByTruck.get(truck.id) || 0;
      const driverInfo = truck.driverId ? driverMap.get(truck.driverId) : undefined;
      const driverName = truck.driverName || driverInfo?.name || '-';
      const driverPhone = truck.driverPhone || driverInfo?.phone;

      return {
        truck,
        driverName,
        driverPhone,
        removalCount: realCount
      };
    }).sort((a, b) => {
      // 1. Trucks explicitly marked with isFavorite checkbox at the very top
      if (a.truck.isFavorite && !b.truck.isFavorite) return -1;
      if (!a.truck.isFavorite && b.truck.isFavorite) return 1;
      // 2. Then sort by removal count descending
      if (b.removalCount !== a.removalCount) {
        return b.removalCount - a.removalCount;
      }
      // 3. Fallback alphabetical by matricule
      return a.truck.matricule.localeCompare(b.truck.matricule);
    });
  }, [trucks, customerId, deliveries, driverMap]);

  const [highlightedId, setHighlightedId] = useState<string>(
    selectedTruckId || (favoriteItems[0]?.truck.id || '')
  );

  const filteredItems = useMemo(() => {
    return favoriteItems.filter(item => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        item.truck.matricule.toLowerCase().includes(q) ||
        item.driverName.toLowerCase().includes(q) ||
        (item.driverPhone && item.driverPhone.includes(q))
      );
    });
  }, [favoriteItems, search]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const item = favoriteItems.find(i => i.truck.id === highlightedId);
    if (item) {
      onSelect(item.truck, item.driverName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Window Title Bar */}
        <div className="bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-300 fill-amber-300" />
            <span className="font-semibold text-xs sm:text-sm tracking-tight truncate">
              Camions habituels / favoris de M {customerName || 'DEVERS'}
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
              placeholder="Filtrer parmi les camions habituels (Matricule, Chauffeur...)..."
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
          Camions habituels de M {customerName || 'DEVERS'}
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto min-h-[300px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800 text-white sticky top-0 z-10 select-none">
              <tr>
                <th className="py-2 px-2.5 font-semibold border-r border-slate-700 w-12 text-center">Photo</th>
                <th className="py-2 px-3 font-semibold border-r border-slate-700 w-32">Matricule</th>
                <th className="py-2 px-3 font-semibold border-r border-slate-700">Chauffeur & Téléphone</th>
                <th className="py-2 px-3 font-semibold text-right border-r border-slate-700 w-24">Tare (T)</th>
                <th className="py-2 px-3 font-semibold text-right border-r border-slate-700 w-24">Volume (m³)</th>
                <th className="py-2 px-3 font-semibold text-center w-24 bg-blue-900/60">Enlèvements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Aucun camion favori trouvé
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = item.truck.id === highlightedId;
                  return (
                    <tr
                      key={item.truck.id}
                      onClick={() => setHighlightedId(item.truck.id)}
                      onDoubleClick={() => {
                        onSelect(item.truck, item.driverName);
                        onClose();
                      }}
                      className={`cursor-pointer transition-colors select-none ${
                        isSelected 
                          ? 'bg-[#d9f99d] text-slate-950 font-bold border-y border-lime-400' 
                          : 'hover:bg-blue-50/70 text-slate-700'
                      }`}
                    >
                      {/* Photo Thumbnail */}
                      <td className="py-1 px-2 border-r border-slate-200 text-center">
                        <div className="w-9 h-7 rounded bg-slate-900 overflow-hidden flex items-center justify-center mx-auto border border-slate-300">
                          {item.truck.imageUrl ? (
                            <img src={item.truck.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <TruckIcon className="h-3.5 w-3.5 text-amber-400" />
                          )}
                        </div>
                      </td>

                      {/* Matricule */}
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold tracking-wider text-slate-950">
                        <div className="flex items-center gap-1.5">
                          <span>{item.truck.matricule}</span>
                          {item.truck.isFavorite && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-sans font-black px-1.5 py-0.5 rounded shadow-2xs">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              Favori
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Driver & Phone */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{item.driverName}</div>
                        {item.driverPhone && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5 text-slate-400" />
                            {item.driverPhone}
                          </div>
                        )}
                      </td>

                      {/* Tare */}
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-black text-blue-900">
                        {item.truck.tare.toFixed(2).replace('.', ',')} T
                      </td>

                      {/* Volume m3 */}
                      <td className="py-2 px-3 text-right border-r border-slate-200 font-mono font-semibold text-amber-900">
                        {item.truck.volumeM3 ? `${item.truck.volumeM3} m³` : '-'}
                      </td>

                      {/* Removal count */}
                      <td className="py-2 px-3 text-center font-mono font-black text-blue-800 bg-blue-50/40">
                        {item.removalCount}
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
            Double-cliquez pour sélectionner et charger la tare automatiquement
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              Quitter
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              Valider
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

