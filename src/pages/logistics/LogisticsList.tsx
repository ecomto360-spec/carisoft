import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, Truck as TruckIcon, UserCircle, Edit, Trash2, X, AlertCircle, Star, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { LogisticsExcelModal } from '../../components/logistics/LogisticsExcelModal';
import { useAuthStore } from '../../store/authStore';

export function LogisticsList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'trucks' | 'drivers') || 'trucks';
  
  const [activeTab, setActiveTab] = useState<'trucks' | 'drivers'>(initialTab);
  const [search, setSearch] = useState('');
  const [truckToDelete, setTruckToDelete] = useState<{ id: string; matricule: string } | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const currentUser = useAuthStore(state => state.user);

  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());

  const getDriverName = (id?: string) => {

    return drivers?.find(d => d.id === id)?.name || '-';
  };

  const handleToggleFavorite = async (truckId: string, currentStatus?: boolean) => {
    try {
      await db.trucks.update(truckId, { isFavorite: !currentStatus });
    } catch (e) {
      console.error('Failed to toggle favorite status', e);
    }
  };

  const handleTabChange = (tab: 'trucks' | 'drivers') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const filteredTrucks = trucks?.filter(t => 
    t.matricule.toLowerCase().includes(search.toLowerCase()) ||
    getDriverName(t.driverId).toLowerCase().includes(search.toLowerCase())
  );

  const filteredDrivers = drivers?.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone && d.phone.includes(search))
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Camions & Chauffeurs</h1>
          <p className="text-slate-500">Gérez le parc de transport et les conducteurs de la carrière</p>
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
            onClick={() => navigate(activeTab === 'trucks' ? '/logistics/truck/new' : '/logistics/driver/new')}
            className="bg-blue-600 hover:bg-blue-500 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            {activeTab === 'trucks' ? 'Nouveau Camion' : 'Nouveau Chauffeur'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => handleTabChange('trucks')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 font-semibold text-sm transition-colors cursor-pointer ${
              activeTab === 'trucks' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <TruckIcon className="h-4 w-4" />
            Camions ({trucks?.length || 0})
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
            Chauffeurs ({drivers?.length || 0})
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={activeTab === 'trucks' ? "Rechercher matricule, chauffeur..." : "Rechercher nom, téléphone..."} 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {activeTab === 'trucks' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">Photo</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead className="text-right">Tare (T)</TableHead>
                    <TableHead className="text-right">Mn tonne</TableHead>
                    <TableHead className="text-right">Mètre cube (m³)</TableHead>
                    <TableHead>Chauffeur & Téléphone</TableHead>
                    <TableHead className="text-center">Remise</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {filteredTrucks?.map(truck => {
                    const resolvedDriverName = truck.driverName || getDriverName(truck.driverId);
                    return (
                      <TableRow key={truck.id} className="hover:bg-slate-50/80">
                        
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

                        {/* Matricule */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(truck.id, truck.isFavorite)}
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
                          {truck.tare.toFixed(2).replace('.', ',')} T
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
                          <div className="font-bold text-slate-800 text-xs">
                            {resolvedDriverName}
                          </div>
                          {truck.driverPhone && (
                            <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                              <span>📞</span> {truck.driverPhone}
                            </div>
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
                              onClick={() => navigate(`/logistics/truck/${truck.id}`)} 
                              title="Modifier dans la Fiche Camion"
                              className="cursor-pointer text-slate-600 hover:text-slate-900"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setTruckToDelete({ id: truck.id, matricule: truck.matricule })} 
                              title="Supprimer"
                              className="cursor-pointer text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredTrucks?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        Aucun camion trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </tbody>
              </Table>
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom et Prénom</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {filteredDrivers?.map(driver => (
                    <TableRow key={driver.id}>
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
                            onClick={() => navigate(`/logistics/driver/${driver.id}`)} 
                            title="Modifier"
                            className="cursor-pointer text-slate-600 hover:text-slate-900"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDriverToDelete({ id: driver.id, name: driver.name })} 
                            title="Supprimer"
                            className="cursor-pointer text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDrivers?.length === 0 && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Supprimer le Camion</h3>
              </div>
              <button 
                onClick={() => setTruckToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Voulez-vous vraiment supprimer le camion avec le matricule <strong className="text-slate-900 font-mono">{truckToDelete.matricule}</strong> ?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setTruckToDelete(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={confirmDeleteTruck} className="bg-red-600 hover:bg-red-500 text-white">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Oui, Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Driver Modal */}
      {driverToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Supprimer le Chauffeur</h3>
              </div>
              <button 
                onClick={() => setDriverToDelete(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Voulez-vous vraiment supprimer le chauffeur <strong className="text-slate-900">{driverToDelete.name}</strong> ?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDriverToDelete(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={confirmDeleteDriver} className="bg-red-600 hover:bg-red-500 text-white">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Oui, Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Logistics Excel Modal */}
      <LogisticsExcelModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        targetType={activeTab}
        trucks={trucks || []}
        drivers={drivers || []}
        companyId={currentUser?.companyId}
      />

    </div>
  );
}
