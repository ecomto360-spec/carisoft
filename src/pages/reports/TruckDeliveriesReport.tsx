import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { Customer, Truck, Driver, DeliveryNote } from '../../types';
import { ClientPickerModal } from '../deliveries/ClientPickerModal';
import { executePrintAttachment, AttachmentPrintData } from '../../lib/printReceipt';
import { useAuthStore } from '../../store/authStore';
import { 
  Truck as TruckIcon, Printer, Search, Calendar, 
  ArrowLeft, RotateCcw, FileText, CheckCircle2, 
  Layers, Download, Eye, AlertCircle, Users
} from 'lucide-react';

type PresetPeriod = 
  | 'custom'
  | 'today'
  | 'yesterday'
  | 'current_week'
  | 'floating_week'
  | 'previous_week'
  | 'current_month'
  | 'floating_month'
  | 'previous_month'
  | 'current_year'
  | 'floating_year'
  | 'previous_year';

function getDayOfWeekName(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[date.getDay()];
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function TruckDeliveriesReport() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();

  // Queries
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const deliveryNotes = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const companySettings = useLiveQuery(() => db.settings.get(1));

  // Date State - Default to beginning of year to today
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfYear = `${new Date().getFullYear()}-01-01`;

  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('current_year');

  // Client Selection State
  const [clientCodeInput, setClientCodeInput] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showClientPicker, setShowClientPicker] = useState<boolean>(false);

  // Result display state
  const [isCalculated, setIsCalculated] = useState<boolean>(true);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState<boolean>(false);

  // Auto-match client code on input change
  const handleClientCodeChange = (code: string) => {

    setClientCodeInput(code);
    const found = customers.find(c => c.code.toLowerCase() === code.trim().toLowerCase());
    if (found) {
      setSelectedCustomer(found);
    } else if (code.trim() === '') {
      setSelectedCustomer(null);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setClientCodeInput(customer.code);
  };

  // Period Preset calculation
  const handlePresetChange = (preset: PresetPeriod) => {
    setSelectedPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    const formatISO = (date: Date) => date.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        setStartDate(formatISO(now));
        setEndDate(formatISO(now));
        break;
      case 'yesterday': {
        const yest = new Date(y, m, d - 1);
        setStartDate(formatISO(yest));
        setEndDate(formatISO(yest));
        break;
      }
      case 'current_week': {
        const currentDay = now.getDay(); // 0 is Sunday
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(y, m, d + diffToMonday);
        setStartDate(formatISO(monday));
        setEndDate(formatISO(now));
        break;
      }
      case 'floating_week': {
        const weekAgo = new Date(y, m, d - 7);
        setStartDate(formatISO(weekAgo));
        setEndDate(formatISO(now));
        break;
      }
      case 'previous_week': {
        const currentDay = now.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const lastMonday = new Date(y, m, d + diffToMonday - 7);
        const lastSunday = new Date(y, m, d + diffToMonday - 1);
        setStartDate(formatISO(lastMonday));
        setEndDate(formatISO(lastSunday));
        break;
      }
      case 'current_month': {
        const firstOfMonth = new Date(y, m, 1);
        setStartDate(formatISO(firstOfMonth));
        setEndDate(formatISO(now));
        break;
      }
      case 'floating_month': {
        const monthAgo = new Date(y, m, d - 30);
        setStartDate(formatISO(monthAgo));
        setEndDate(formatISO(now));
        break;
      }
      case 'previous_month': {
        const firstOfLastMonth = new Date(y, m - 1, 1);
        const lastOfLastMonth = new Date(y, m, 0);
        setStartDate(formatISO(firstOfLastMonth));
        setEndDate(formatISO(lastOfLastMonth));
        break;
      }
      case 'current_year': {
        setStartDate(`${y}-01-01`);
        setEndDate(formatISO(now));
        break;
      }
      case 'floating_year': {
        const yearAgo = new Date(y - 1, m, d);
        setStartDate(formatISO(yearAgo));
        setEndDate(formatISO(now));
        break;
      }
      case 'previous_year': {
        setStartDate(`${y - 1}-01-01`);
        setEndDate(`${y - 1}-12-31`);
        break;
      }
      case 'custom':
      default:
        break;
    }
  };

  // Aggregation of deliveries by Truck for the SELECTED Client
  const reportData = useMemo(() => {
    // If no client is selected, do not compute/show trucks until a client is chosen
    if (!selectedCustomer || !deliveryNotes) {
      return { items: [], totalDeliveries: 0, totalQuantity: 0, hasClient: false };
    }

    // Filter by the selected client and date interval
    const filteredBLs = deliveryNotes.filter(bl => {
      if (bl.status === 'cancelled') return false;

      // STRICTLY filter by the selected client
      if (bl.customerId !== selectedCustomer.id) {
        return false;
      }

      // Filter by date
      const blDate = bl.date.split('T')[0];
      if (startDate && blDate < startDate) return false;
      if (endDate && blDate > endDate) return false;

      return true;
    });

    // Group by truck
    const truckMap: Record<string, {
      matricule: string;
      driverName: string;
      deliveryCount: number;
      totalQuantity: number;
    }> = {};

    filteredBLs.forEach(bl => {
      const truck = trucks.find(t => t.id === bl.truckId);
      const matricule = truck?.matricule || bl.truckId || 'CAMION NON DÉFINI';
      
      // Resolve driver
      let driverName = '';
      if (bl.driverId) {
        const drv = drivers.find(d => d.id === bl.driverId);
        if (drv) driverName = drv.name;
      }
      if (!driverName && truck?.driverName) {
        driverName = truck.driverName;
      }
      if (!driverName && truck?.driverId) {
        const drv = drivers.find(d => d.id === truck.driverId);
        if (drv) driverName = drv.name;
      }
      if (!driverName) {
        driverName = 'CHAUFFEUR';
      }

      const key = `${matricule}___${driverName}`;
      if (!truckMap[key]) {
        truckMap[key] = {
          matricule,
          driverName,
          deliveryCount: 0,
          totalQuantity: 0,
        };
      }

      truckMap[key].deliveryCount += 1;
      truckMap[key].totalQuantity += (bl.netWeight || 0);
    });

    const items = Object.values(truckMap).sort((a, b) => b.totalQuantity - a.totalQuantity);
    const totalDeliveries = items.reduce((acc, curr) => acc + curr.deliveryCount, 0);
    const totalQuantity = items.reduce((acc, curr) => acc + curr.totalQuantity, 0);

    return { items, totalDeliveries, totalQuantity, hasClient: true };
  }, [deliveryNotes, selectedCustomer, startDate, endDate, trucks, drivers]);

  // Handle Print Action
  const handlePrint = () => {
    if (!selectedCustomer) {
      setShowClientPicker(true);
      return;
    }

    const printPayload: AttachmentPrintData = {
      companyName: companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS',
      companyAddress: companySettings?.address || 'CITE 150 BT E CAGE 01 N8 EL HACHIMIA .W BOURA',
      companyPhone: companySettings?.phone || '0554252579',
      companyLogo: companySettings?.logoUrl,
      customerName: selectedCustomer.name,
      customerCode: selectedCustomer.code || '',
      startDate: formatDateDisplay(startDate),
      endDate: formatDateDisplay(endDate),
      items: reportData.items,
      totalDeliveries: reportData.totalDeliveries,
      totalQuantity: reportData.totalQuantity,
      unit: 'T'
    };

    executePrintAttachment(printPayload);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Retour aux rapports"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                Attachement Contradictoire
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Enlèvements par Client
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              État récapitulatif des voyages et tonnages transportés par camion pour le client sélectionné
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowPrintPreviewModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
          >
            <Eye className="h-4 w-4 text-slate-500" />
            <span>Aperçu</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimer l'État</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <span>Quitter</span>
          </button>
        </div>
      </div>

      {/* Main Filter & Selection Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wide">
            <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white rounded-full text-xs font-black">1</span>
            <span>Sélection du Client & Période</span>
          </div>
          {selectedCustomer ? (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Client sélectionné : {selectedCustomer.name}</span>
            </span>
          ) : (
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md animate-pulse">
              * Veuillez sélectionner un client d'abord
            </span>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Row 1: Client Selection (Mandatory Step 1) */}
          <div className="bg-blue-50/40 p-4 rounded-xl border-2 border-blue-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-700" />
                <span>1. Client (Obligatoire) :</span>
              </label>
              {!selectedCustomer && (
                <span className="text-xs font-semibold text-blue-700">
                  Choisissez le client pour charger ses camions
                </span>
              )}
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Client Code Box */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={clientCodeInput}
                  onChange={(e) => handleClientCodeChange(e.target.value)}
                  placeholder="Code"
                  className="w-28 text-center font-mono font-bold text-slate-900 bg-white border-2 border-blue-300 rounded-lg py-2 px-2 text-sm focus:border-blue-600 focus:outline-none shadow-xs"
                />

                {/* Picker Button */}
                <button
                  type="button"
                  onClick={() => setShowClientPicker(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                  title="Choisir dans la liste des clients"
                >
                  <Search className="h-4 w-4" />
                  <span>Choisir Client</span>
                </button>
              </div>

              {/* Customer Name Display Field */}
              <div className="flex-1">
                <div className={`flex items-center justify-between px-3.5 py-2 rounded-lg text-sm border ${
                  selectedCustomer 
                    ? 'bg-white border-emerald-400 text-slate-900 shadow-xs' 
                    : 'bg-white/80 border-slate-300 text-slate-400'
                }`}>
                  <span className="font-extrabold text-sm truncate uppercase">
                    {selectedCustomer ? selectedCustomer.name : '— Cliquez sur "Choisir Client" ou entrez un code —'}
                  </span>
                  {selectedCustomer && (
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setClientCodeInput('');
                      }}
                      className="text-xs text-slate-400 hover:text-red-600 font-bold ml-2 cursor-pointer bg-slate-100 hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                    >
                      Changer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Date Interval & Preset Dropdown (Step 2) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Start Date "Du" */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-slate-700 uppercase">2. Du (Date Début) :</span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {getDayOfWeekName(startDate) || '—'}
                </span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedPreset('custom');
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date "Au" */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-slate-700 uppercase">Au (Date Fin) :</span>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {getDayOfWeekName(endDate) || '—'}
                </span>
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedPreset('custom');
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Period Preset Dropdown */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <span className="text-xs font-black text-slate-700 uppercase mb-1.5 block">
                Période prédéfinie :
              </span>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value as PresetPeriod)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Aujourd'hui</option>
                <option value="yesterday">Hier</option>
                <option value="current_week">Semaine en cours</option>
                <option value="floating_week">Semaine flottante (7j)</option>
                <option value="previous_week">Semaine précédente</option>
                <option value="current_month">Mois en cours</option>
                <option value="floating_month">Mois flottant (30j)</option>
                <option value="previous_month">Mois précédent</option>
                <option value="current_year">Année en cours</option>
                <option value="floating_year">Année flottante (365j)</option>
                <option value="previous_year">Année précédente</option>
                <option value="custom">Période personnalisée</option>
              </select>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Période active : <strong>{formatDateDisplay(startDate)}</strong> au <strong>{formatDateDisplay(endDate)}</strong>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (!selectedCustomer) {
                    setShowClientPicker(true);
                  }
                }}
                className={`w-full sm:w-auto px-6 py-2.5 text-sm font-black rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  selectedCustomer
                    ? 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {selectedCustomer ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Actualiser les Camions de {selectedCustomer.name}</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>Sélectionner un Client pour Afficher l'Attachement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table Section */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-md overflow-hidden">
        {/* Table Title Banner (Matching Screenshot "Attachement de SPA EPE EPTRC") */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700">
          <div>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block">
              État des Enlèvements par Client
            </span>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
              {selectedCustomer 
                ? `Attachement de ${selectedCustomer.name}` 
                : 'Attachement Contradictoire — En attente de sélection du client'}
            </h2>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
            <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded">
              Du {formatDateDisplay(startDate)} au {formatDateDisplay(endDate)}
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white text-xs font-black uppercase tracking-wider">
                <th className="py-3 px-4 border-b border-slate-700 text-left w-1/4">Matricule</th>
                <th className="py-3 px-4 border-b border-slate-700 text-left w-2/5">Chauffeur</th>
                <th className="py-3 px-4 border-b border-slate-700 text-center w-1/6">Nbre Enlèv.</th>
                <th className="py-3 px-4 border-b border-slate-700 text-right w-1/5">Qtés (T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {!selectedCustomer ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-500 bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                        <TruckIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-base">Aucun client sélectionné</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Veuillez sélectionner un client en haut pour afficher la liste des camions ayant effectué le transport pour ce client.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClientPicker(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>Sélectionner le Client</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : reportData.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    <p className="font-bold text-slate-700">
                      Aucun enlèvement trouvé pour le client <span className="text-blue-700 uppercase">"{selectedCustomer.name}"</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Aucun camion n'a transporté de matériaux pour ce client entre le {formatDateDisplay(startDate)} et le {formatDateDisplay(endDate)}.
                    </p>
                  </td>
                </tr>
              ) : (
                reportData.items.map((row, idx) => (
                  <tr 
                    key={idx}
                    className={`hover:bg-blue-50/70 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                  >
                    {/* Matricule */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-xs sm:text-sm">
                        {row.matricule}
                      </span>
                    </td>

                    {/* Chauffeur */}
                    <td className="py-3 px-4 font-bold text-slate-800 uppercase tracking-tight">
                      {row.driverName}
                    </td>

                    {/* Nbre Enlèvements */}
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 text-base">
                      <span className="inline-block min-w-8 py-0.5 px-2 bg-blue-50 text-blue-700 border border-blue-200 rounded font-black">
                        {row.deliveryCount}
                      </span>
                    </td>

                    {/* Quantité totale en Tonnes */}
                    <td className="py-3 px-4 text-right font-mono font-black text-blue-700 text-base">
                      {row.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-slate-500 font-sans font-medium">T</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Total Général Footer */}
            {selectedCustomer && reportData.items.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-400 text-slate-900 font-black">
                  <td colSpan={2} className="py-4 px-4 text-base uppercase tracking-wide text-slate-900 font-black">
                    Total Général ({selectedCustomer.name})
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-lg text-slate-900 font-black">
                    {reportData.totalDeliveries} <span className="text-xs font-sans text-slate-500">voyages</span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-xl text-blue-800 font-black">
                    {reportData.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-sans text-slate-600">T</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer info bar */}
        {selectedCustomer && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Nombre de camions transporteurs : <strong>{reportData.items.length}</strong>
            </div>
            <div>
              Tonnage total transporté pour le client : <strong>{reportData.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tonnes</strong>
            </div>
          </div>
        )}
      </div>

      {/* Client Picker Modal */}
      <ClientPickerModal
        isOpen={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        onSelect={handleSelectCustomer}
        customers={customers}
        selectedCustomerId={selectedCustomer?.id}
        companyName={companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'}
      />

      {/* Print Preview Modal */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-blue-400" />
                <span className="font-bold text-sm tracking-tight">
                  Aperçu Document - Enlèvements par Client
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handlePrint();
                    setShowPrintPreviewModal(false);
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimer</span>
                </button>
                <button
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body / A4 Visual Canvas */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
              <div className="bg-white w-full max-w-[760px] p-8 rounded-lg shadow-lg border border-slate-300 font-sans text-slate-800">
                {/* Header Table */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 uppercase">
                      {companySettings?.name || 'SARL MAHAJIR SIDAR'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      {companySettings?.address || 'Extraction & Commercialisation de Matériaux de Construction'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tél : {companySettings?.phone || '0554252579'}
                    </p>
                  </div>

                  <div className="border-2 border-slate-900 rounded-lg p-3 text-center min-w-[240px] bg-slate-50">
                    <p className="text-xs font-bold text-slate-900 uppercase">
                      Enlèvements par client DU
                    </p>
                    <p className="font-mono text-sm font-extrabold text-blue-700 mt-0.5">
                      {formatDateDisplay(startDate)} AU {formatDateDisplay(endDate)}
                    </p>
                  </div>
                </div>

                {/* Client Box */}
                <div className="bg-slate-100 border-l-4 border-blue-600 p-3 rounded-r-md mb-6 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold uppercase text-slate-500 mr-2">Client :</span>
                    <span className="text-base font-black text-slate-900 uppercase">
                      {selectedCustomer ? selectedCustomer.name : 'TOUS LES CLIENTS'}
                    </span>
                  </div>
                  {selectedCustomer?.code && (
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Code : {selectedCustomer.code}
                    </span>
                  )}
                </div>

                {/* Document Table */}
                <table className="w-full border-collapse border border-slate-300 text-xs mb-6">
                  <thead>
                    <tr className="bg-slate-800 text-white font-bold uppercase">
                      <th className="p-2 text-left border border-slate-400">Matricule</th>
                      <th className="p-2 text-left border border-slate-400">Chauffeur</th>
                      <th className="p-2 text-center border border-slate-400">Nbre Enlèv.</th>
                      <th className="p-2 text-right border border-slate-400">Quantité (T)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2 font-mono font-bold border border-slate-300">{item.matricule}</td>
                        <td className="p-2 font-semibold uppercase border border-slate-300">{item.driverName}</td>
                        <td className="p-2 text-center font-mono font-bold border border-slate-300">{item.deliveryCount}</td>
                        <td className="p-2 text-right font-mono font-bold text-blue-700 border border-slate-300">
                          {item.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-800 text-sm">
                      <td colSpan={2} className="p-2 uppercase">Total Général</td>
                      <td className="p-2 text-center font-mono">{reportData.totalDeliveries}</td>
                      <td className="p-2 text-right font-mono text-blue-800">
                        {reportData.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 mt-12 pt-4 border-t border-slate-300 text-center text-xs font-bold text-slate-600 uppercase">
                  <div>Visa Responsable Expédition / Pont Bascule</div>
                  <div>Visa & Cachet du Client / Transporteur</div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowPrintPreviewModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  handlePrint();
                  setShowPrintPreviewModal(false);
                }}
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                <span>Lancer l'Impression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
