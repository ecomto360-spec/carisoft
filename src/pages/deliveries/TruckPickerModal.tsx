import { useState, useMemo } from 'react';
import { Truck, Driver } from '../../types';
import { Search, X, Check, Truck as TruckIcon, Phone, Star } from 'lucide-react';

interface TruckPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (truck: Truck, driverName?: string) => void;
  trucks: Truck[];
  drivers: Driver[];
  selectedTruckId?: string;
  companyName?: string;
}

export function TruckPickerModal({
  isOpen,
  onClose,
  onSelect,
  trucks,
  drivers,
  selectedTruckId,
  companyName = 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'
}: TruckPickerModalProps) {
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string>(selectedTruckId || (trucks[0]?.id || ''));

  const driverMap = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string }>();
    drivers.forEach(d => map.set(d.id, { name: d.name, phone: d.phone }));
    return map;
  }, [drivers]);

  const filteredTrucks = useMemo(() => {
    return trucks.filter(t => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const driverInfo = t.driverId ? driverMap.get(t.driverId) : undefined;
      const driverName = t.driverName || driverInfo?.name || '';
      const driverPhone = t.driverPhone || driverInfo?.phone || '';
      return (
        t.matricule.toLowerCase().includes(q) ||
        driverName.toLowerCase().includes(q) ||
        driverPhone.includes(q)
      );
    });
  }, [trucks, search, driverMap]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const truck = trucks.find(t => t.id === highlightedId);
    if (truck) {
      const driverInfo = truck.driverId ? driverMap.get(truck.driverId) : undefined;
      const driverName = truck.driverName || driverInfo?.name || '';
      onSelect(truck, driverName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Window Title Bar */}
        <div className="bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between shadow-sm select-none">
          <div className="flex items-center gap-2">
            <TruckIcon className="h-4 w-4 text-blue-200" />
            <span className="font-semibold text-xs sm:text-sm tracking-tight truncate">
              {companyName} - Sélection Camion (Liaison Pont-Bascule)
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
              placeholder="Rechercher par Matricule, Chauffeur ou Téléphone..."
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
          Liste des Camions
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
                <th className="py-2 px-3 font-semibold text-right border-r border-slate-700 w-24">Mn Tonne</th>
                <th className="py-2 px-3 font-semibold text-right w-24">Volume (m³)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Aucun camion trouvé pour &quot;{search}&quot;
                  </td>
                </tr>
              ) : (
                filteredTrucks.map((truck) => {
                  const isSelected = truck.id === highlightedId;
                  const driverInfo = truck.driverId ? driverMap.get(truck.driverId) : undefined;
                  const driverName = truck.driverName || driverInfo?.name || '-';
                  const driverPhone = truck.driverPhone || driverInfo?.phone;

                  return (
                    <tr
                      key={truck.id}
                      onClick={() => setHighlightedId(truck.id)}
                      onDoubleClick={() => {
                        onSelect(truck, driverName);
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
                          {truck.imageUrl ? (
                            <img src={truck.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <TruckIcon className="h-3.5 w-3.5 text-amber-400" />
                          )}
                        </div>
                      </td>

                      {/* Matricule */}
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold tracking-wider text-slate-950">
                        <div className="flex items-center gap-1.5">
                          <span>{truck.matricule}</span>
                          {truck.isFavorite && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-sans font-bold px-1.5 py-0.5 rounded shadow-2xs">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              Favori
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Driver & Phone */}
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{driverName}</div>
                        {driverPhone && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5 text-slate-400" />
                            {driverPhone}
                          </div>
                        )}
                      </td>

                      {/* Tare */}
                      <td className="py-2 px-3 text-right font-mono font-black text-blue-900 border-r border-slate-200">
                        {truck.tare.toFixed(2).replace('.', ',')} T
                      </td>

                      {/* Mn tonne */}
                      <td className="py-2 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                        {truck.mnTonne !== undefined ? Number(truck.mnTonne).toFixed(2).replace('.', ',') : '0,00'}
                      </td>

                      {/* Volume m3 */}
                      <td className="py-2 px-3 text-right font-mono font-semibold text-amber-900">
                        {truck.volumeM3 ? `${truck.volumeM3} m³` : '-'}
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
            {filteredTrucks.length} camion(s) - Double-cliquez pour sélectionner
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer shadow-xs"
            >
              J&apos;annule
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
