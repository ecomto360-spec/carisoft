import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { db } from '../../db/db';
import { Truck, Driver } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { 
  Plus, Search, Truck as TruckIcon, UserCircle, Edit, Trash2, X, 
  AlertCircle, Star, FileSpreadsheet, Phone, User, CheckCircle2,
  Sparkles, ChevronLeft, ChevronRight
} from 'lucide-react';
import { LogisticsExcelModal } from '../../components/logistics/LogisticsExcelModal';
import { useAuthStore } from '../../store/authStore';
import { useDebounce } from '../../hooks/useDebounce';

const PAGE_SIZE = 50;

// Memoized Truck Row Component
interface TruckRowProps {
  truck: Truck;
  onToggleFavorite: (id: string, isFav?: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (truck: { id: string; matricule: string }) => void;
}

const TruckRow = React.memo(function TruckRow({ truck, onToggleFavorite, onEdit, onDelete }: TruckRowProps) {
  const resolvedDriverName = truck.driverName || '-';
  const hasDriver = Boolean(resolvedDriverName && resolvedDriverName !== '-');

  return (
    <TableRow className="hover:bg-slate-50/80 transition-colors h-[64px]">
      {/* Truck Photo Thumbnail */}
      <TableCell className="text-center py-2">
        <div className="w-12 h-10 rounded-lg bg-slate-900 border border-slate-200 overflow-hidden flex items-center justify-center mx-auto shadow-2xs">
          {truck.imageUrl ? (
            <img 
              src={truck.imageUrl} 
              alt={truck.matricule} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <TruckIcon className="h-5 w-5 text-amber-400" />
          )}
        </div>
      </TableCell>

      {/* Matricule & Brand */}
      <TableCell>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleFavorite(truck.id, truck.isFavorite)}
            title={truck.isFavorite ? "Camion favori (cliquez pour retirer)" : "Marquer comme camion favori"}
            className="cursor-pointer p-0.5 rounded hover:bg-slate-100 transition-colors"
          >
            <Star className={`h-4 w-4 ${
              truck.isFavorite 
                ? 'fill-amber-500 text-amber-500' 
                : 'text-slate-300 hover:text-amber-400'
            }`} />
          </button>
          <span className="font-black font-mono text-slate-900 text-sm tracking-wider">
            {truck.matricule}
          </span>
          {truck.isFavorite && (
            <span className="inline-flex text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded shadow-2xs">
              Favori
            </span>
          )}
        </div>
        {truck.brand && (
          <div className="text-[11px] text-slate-500 font-medium ml-6">
            {truck.brand}
          </div>
        )}
      </TableCell>

      {/* Tare (T) */}
      <TableCell className="text-right font-mono font-black text-blue-800 text-sm">
        {truck.tare ? truck.tare.toFixed(2).replace('.', ',') : '0,00'} T
      </TableCell>

      {/* Mn tonne */}
      <TableCell className="text-right font-mono font-bold text-slate-700">
        {truck.mnTonne !== undefined ? Number(truck.mnTonne).toFixed(2).replace('.', ',') : '0,00'}
      </TableCell>

      {/* Mètre cube */}
      <TableCell className="text-right font-mono font-bold text-amber-900">
        {truck.volumeM3 !== undefined && truck.volumeM3 !== null && truck.volumeM3 > 0 
          ? `${truck.volumeM3} m³` 
          : '-'}
      </TableCell>

      {/* Driver & Phone */}
      <TableCell>
        {hasDriver ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{resolvedDriverName}</span>
            </div>
            {truck.driverPhone && (
              <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1 pl-5">
                <Phone className="h-2.5 w-2.5 text-slate-400" />
                <span>{truck.driverPhone}</span>
              </div>
            )}
            {truck.driverLicense && (
              <div className="text-[10px] text-slate-400 font-mono pl-5">
                Permis: {truck.driverLicense}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Non assigné</span>
        )}
      </TableCell>

      {/* Allow Discount */}
      <TableCell className="text-center">
        <span className={`inline-flex px-2 py-0.5 text-[11px] rounded-full font-bold ${
          truck.allowDiscount 
            ? 'bg-blue-100 text-blue-800 border border-blue-200' 
            : 'bg-slate-100 text-slate-600'
        }`}>
          {truck.allowDiscount ? 'Oui' : 'Non'}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell>
        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-semibold ${
          truck.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
        }`}>
          {truck.active ? 'Actif' : 'Inactif'}
        </span>
      </TableCell>

      {/* Actions */}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onEdit(truck.id)} 
            title="Modifier Camion & Chauffeur"
            className="cursor-pointer text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            <Edit className="h-4 w-4 mr-1" />
            <span className="text-xs font-semibold">Modifier</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete({ id: truck.id, matricule: truck.matricule })} 
            title="Supprimer"
            className="cursor-pointer text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

// Memoized Driver Row Component
interface DriverRowProps {
  driver: Driver;
  onEdit: (id: string) => void;
  onDelete: (driver: { id: string; name: string }) => void;
}

const DriverRow = React.memo(function DriverRow({ driver, onEdit, onDelete }: DriverRowProps) {
  return (
    <TableRow className="h-[52px]">
      <TableCell className="font-bold text-slate-800">{driver.name}</TableCell>
      <TableCell className="font-mono text-slate-600">{driver.phone || '-'}</TableCell>
      <TableCell>
        <span className={`inline-flex px-2 py-0.5 text-xs rounded-full font-semibold ${
          driver.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
        }`}>
          {driver.active ? 'Actif' : 'Inactif'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onEdit(driver.id)} 
            title="Modifier"
            className="cursor-pointer text-slate-600 hover:text-slate-900"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete({ id: driver.id, name: driver.name })} 
            title="Supprimer"
            className="cursor-pointer text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function LogisticsList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'trucks' | 'drivers') || 'trucks';
  
  const [activeTab, setActiveTab] = useState<'trucks' | 'drivers'>(initialTab);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);

  const [truckToDelete, setTruckToDelete] = useState<{ id: string; matricule: string } | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);

  // Virtualizer scroll container refs
  const trucksScrollRef = useRef<HTMLDivElement>(null);
  const driversScrollRef = useRef<HTMLDivElement>(null);

  // Dexie .count() queries (O(1) index count, zero heap memory)
  const totalTrucksCount = useLiveQuery(
    () => currentCompanyId ? db.trucks.where('companyId').equals(currentCompanyId).count() : 0,
    [currentCompanyId]
  ) || 0;

  const totalDriversCount = useLiveQuery(
    () => currentCompanyId ? db.drivers.where('companyId').equals(currentCompanyId).count() : 0,
    [currentCompanyId]
  ) || 0;

  // Reset page when search changes
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch, activeTab]);

  // Targeted queries for Trucks (offset/limit or search with limit)
  const trucks = useLiveQuery(async () => {
    if (!currentCompanyId) return [];
    const q = debouncedSearch.trim().toLowerCase();

    if (q) {
      // Search index with max 100 results for instantaneous performance
      return await db.trucks
        .where('companyId')
        .equals(currentCompanyId)
        .filter((t) => {
          const mat = t.matricule?.toLowerCase() || '';
          const dName = t.driverName?.toLowerCase() || '';
          const brand = t.brand?.toLowerCase() || '';
          const phone = t.driverPhone || '';
          return mat.includes(q) || dName.includes(q) || brand.includes(q) || phone.includes(q);
        })
        .limit(100)
        .toArray();
    }

    // Paginated load: only loads 50 records at a time
    return await db.trucks
      .where('companyId')
      .equals(currentCompanyId)
      .offset(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();
  }, [currentCompanyId, debouncedSearch, page]);

  // Targeted queries for Drivers
  const drivers = useLiveQuery(async () => {
    if (!currentCompanyId) return [];
    const q = debouncedSearch.trim().toLowerCase();

    if (q) {
      return await db.drivers
        .where('companyId')
        .equals(currentCompanyId)
        .filter((d) => {
          const name = d.name?.toLowerCase() || '';
          const phone = d.phone || '';
          return name.includes(q) || phone.includes(q);
        })
        .limit(100)
        .toArray();
    }

    return await db.drivers
      .where('companyId')
      .equals(currentCompanyId)
      .offset(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();
  }, [currentCompanyId, debouncedSearch, page]);

  const truckItems = useMemo(() => trucks || [], [trucks]);
  const driverItems = useMemo(() => drivers || [], [drivers]);

  // Virtualizers for fixed row heights
  const truckVirtualizer = useVirtualizer({
    count: truckItems.length,
    getScrollElement: () => trucksScrollRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const driverVirtualizer = useVirtualizer({
    count: driverItems.length,
    getScrollElement: () => driversScrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const handleToggleFavorite = useCallback(async (truckId: string, currentStatus?: boolean) => {
    try {
      await db.trucks.update(truckId, { isFavorite: !currentStatus });
    } catch (e) {
      console.error('Failed to toggle favorite status', e);
    }
  }, []);

  const handleEditTruck = useCallback((id: string) => {
    navigate(`/logistics/truck/${id}`);
  }, [navigate]);

  const handleDeleteTruck = useCallback((truck: { id: string; matricule: string }) => {
    setTruckToDelete(truck);
  }, []);

  const handleEditDriver = useCallback((id: string) => {
    navigate(`/logistics/driver/${id}`);
  }, [navigate]);

  const handleDeleteDriver = useCallback((driver: { id: string; name: string }) => {
    setDriverToDelete(driver);
  }, []);

  const handleTabChange = (tab: 'trucks' | 'drivers') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setPage(0);
  };

  const confirmDeleteTruck = async () => {
    if (!truckToDelete) return;
    try {
      await db.trucks.delete(truckToDelete.id);
      setTruckToDelete(null);
    } catch (err) {
      console.error('Error deleting truck', err);
    }
  };

  const confirmDeleteDriver = async () => {
    if (!driverToDelete) return;
    try {
      await db.drivers.delete(driverToDelete.id);
      setDriverToDelete(null);
    } catch (err) {
      console.error('Error deleting driver', err);
    }
  };

  const isSearchActive = Boolean(debouncedSearch.trim());
  const currentTotal = activeTab === 'trucks' ? totalTrucksCount : totalDriversCount;
  const totalPages = Math.ceil(currentTotal / PAGE_SIZE) || 1;

  // Virtual items & spacers for Trucks
  const virtualTrucks = truckVirtualizer.getVirtualItems();
  const truckPaddingTop = virtualTrucks.length > 0 ? virtualTrucks[0].start : 0;
  const truckPaddingBottom = virtualTrucks.length > 0 
    ? truckVirtualizer.getTotalSize() - virtualTrucks[virtualTrucks.length - 1].end 
    : 0;

  // Virtual items & spacers for Drivers
  const virtualDrivers = driverVirtualizer.getVirtualItems();
  const driverPaddingTop = virtualDrivers.length > 0 ? virtualDrivers[0].start : 0;
  const driverPaddingBottom = virtualDrivers.length > 0 
    ? driverVirtualizer.getTotalSize() - virtualDrivers[virtualDrivers.length - 1].end 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">Camions & Chauffeurs</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3 w-3" />
              Mode Haute Performance (6000+)
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Gérez le parc de camions, leurs tares fixes et leurs conducteurs attitrés pour le pont-bascule
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={() => setShowExcelModal(true)}
            className="text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 cursor-pointer"
            title="Gérer les imports et exports Excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Gestion Excel
          </Button>

          <Button 
            onClick={() => navigate('/logistics/truck/new')}
            className="bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-sm text-white font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nouveau Camion & Chauffeur
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => handleTabChange('trucks')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold text-sm transition-colors cursor-pointer ${
              activeTab === 'trucks' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <TruckIcon className="h-4 w-4" />
            Camions & Chauffeurs ({totalTrucksCount})
          </button>
          <button
            onClick={() => handleTabChange('drivers')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-sm transition-colors cursor-pointer ${
              activeTab === 'drivers' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <UserCircle className="h-4 w-4" />
            Annuaire Chauffeurs ({totalDriversCount})
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Search bar with debounce */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder={activeTab === 'trucks' ? "Rechercher matricule, chauffeur, marque..." : "Rechercher nom, téléphone..."} 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Pagination Controls */}
            {!isSearchActive && currentTotal > PAGE_SIZE && (
              <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold self-end sm:self-auto">
                <span>Page {page + 1} sur {totalPages} ({currentTotal} éléments)</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {isSearchActive && (
              <div className="text-xs text-slate-500 font-medium">
                {truckItems.length} résultat(s) trouvé(s) pour « {debouncedSearch} »
              </div>
            )}
          </div>

          {/* Virtualized Trucks Table */}
          {activeTab === 'trucks' && (
            <div 
              ref={trucksScrollRef}
              className="overflow-x-auto overflow-y-auto max-h-[620px] border border-slate-200 rounded-lg"
            >
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-2xs">
                  <TableRow>
                    <TableHead className="w-16 text-center">Photo</TableHead>
                    <TableHead>Matricule & Marque</TableHead>
                    <TableHead className="text-right">Tare (T)</TableHead>
                    <TableHead className="text-right">Mn tonne</TableHead>
                    <TableHead className="text-right">Volume (m³)</TableHead>
                    <TableHead>Chauffeur & Contact</TableHead>
                    <TableHead className="text-center">Remise</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {truckPaddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${truckPaddingTop}px` }} colSpan={9} />
                    </tr>
                  )}
                  {virtualTrucks.map((virtualRow) => {
                    const truck = truckItems[virtualRow.index];
                    if (!truck) return null;
                    return (
                      <TruckRow
                        key={truck.id}
                        truck={truck}
                        onToggleFavorite={handleToggleFavorite}
                        onEdit={handleEditTruck}
                        onDelete={handleDeleteTruck}
                      />
                    );
                  })}
                  {truckPaddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${truckPaddingBottom}px` }} colSpan={9} />
                    </tr>
                  )}
                  {truckItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                        <TruckIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">Aucun camion trouvé</p>
                        <p className="text-xs text-slate-400 mt-1">Cliquez sur « Nouveau Camion & Chauffeur » pour en créer un.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </tbody>
              </Table>
            </div>
          )}

          {/* Virtualized Drivers Table */}
          {activeTab === 'drivers' && (
            <div 
              ref={driversScrollRef}
              className="overflow-x-auto overflow-y-auto max-h-[620px] border border-slate-200 rounded-lg"
            >
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-2xs">
                  <TableRow>
                    <TableHead>Nom et Prénom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {driverPaddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${driverPaddingTop}px` }} colSpan={4} />
                    </tr>
                  )}
                  {virtualDrivers.map((virtualRow) => {
                    const driver = driverItems[virtualRow.index];
                    if (!driver) return null;
                    return (
                      <DriverRow
                        key={driver.id}
                        driver={driver}
                        onEdit={handleEditDriver}
                        onDelete={handleDeleteDriver}
                      />
                    );
                  })}
                  {driverPaddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${driverPaddingBottom}px` }} colSpan={4} />
                    </tr>
                  )}
                  {driverItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                        Aucun chauffeur trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Truck Modal */}
      {truckToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Confirmer la suppression</h3>
            </div>
            <p className="text-slate-600 text-sm">
              Êtes-vous sûr de vouloir supprimer le camion avec le matricule{' '}
              <strong className="text-slate-900">{truckToDelete.matricule}</strong> ?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setTruckToDelete(null)}>
                Annuler
              </Button>
              <Button onClick={confirmDeleteTruck} className="bg-red-600 hover:bg-red-500 text-white font-bold">
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Driver Modal */}
      {driverToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold">Confirmer la suppression</h3>
            </div>
            <p className="text-slate-600 text-sm">
              Êtes-vous sûr de vouloir supprimer le chauffeur{' '}
              <strong className="text-slate-900">{driverToDelete.name}</strong> ?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setDriverToDelete(null)}>
                Annuler
              </Button>
              <Button onClick={confirmDeleteDriver} className="bg-red-600 hover:bg-red-500 text-white font-bold">
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Modal */}
      <LogisticsExcelModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        targetType={activeTab}
        trucks={truckItems}
        drivers={driverItems}
        companyId={currentCompanyId}
      />
    </div>
  );
}
