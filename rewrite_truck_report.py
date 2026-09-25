import sys

content = """import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { Customer, Truck, Product } from '../../types';
import { TruckPickerModal } from '../deliveries/TruckPickerModal';
import { ClientPickerModal } from '../deliveries/ClientPickerModal';
import { ProductPickerModal } from '../deliveries/ProductPickerModal';
import { executePrintAttachment, AttachmentPrintData, TruckReportPrintData } from '../../lib/printReceipt';
import { 
  Truck as TruckIcon, Printer, Search, Calendar, 
  ArrowLeft, FileText, AlertCircle, X, Users, Package, CheckCircle2
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

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD' }).format(amount);
}

export function TruckOnlyDeliveriesReport() {
  const navigate = useNavigate();

  // Queries
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.toArray()) || [];
  const drivers = useLiveQuery(() => db.drivers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const deliveryNotes = useLiveQuery(() => db.deliveryNotes.toArray()) || [];
  const deliveryItems = useLiveQuery(() => db.deliveryNoteItems.toArray()) || [];
  const companySettings = useLiveQuery(() => db.settings.get(1));

  // Date State - Default to beginning of year to today
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfYear = `${new Date().getFullYear()}-01-01`;

  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('current_year');

  // Filters State
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Modals
  const [showTruckPicker, setShowTruckPicker] = useState<boolean>(false);
  const [showClientPicker, setShowClientPicker] = useState<boolean>(false);
  const [showProductPicker, setShowProductPicker] = useState<boolean>(false);

  // Computed data
  const reportData = useMemo(() => {
    if (!selectedTruck || !deliveryNotes || !deliveryItems) {
      return { items: [], totalQuantity: 0, totalHT: 0 };
    }

    const filteredNotes = deliveryNotes.filter(note => {
      if (note.truckId !== selectedTruck.id) return false;
      if (note.date < startDate || note.date > endDate) return false;
      if (selectedCustomer && note.customerId !== selectedCustomer.id) return false;
      return true;
    });

    const noteIds = new Set(filteredNotes.map(n => n.id));
    let filteredItems = deliveryItems.filter(item => noteIds.has(item.deliveryNoteId));

    if (selectedProduct) {
      filteredItems = filteredItems.filter(item => item.productId === selectedProduct.id);
    }

    const items = filteredItems.map(item => {
      const note = filteredNotes.find(n => n.id === item.deliveryNoteId)!;
      const customer = customers.find(c => c.id === note.customerId);
      const product = products.find(p => p.id === item.productId);
      return {
        blNumber: String(note.number),
        date: note.date,
        customerName: customer?.name || 'Inconnu',
        productName: product?.name || 'Inconnu',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalHT: item.totalHT
      };
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return parseInt(a.blNumber) - parseInt(b.blNumber);
    });

    const totalQuantity = items.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalHT = items.reduce((acc, curr) => acc + curr.totalHT, 0);

    return { items, totalQuantity, totalHT };
  }, [selectedTruck, selectedCustomer, selectedProduct, startDate, endDate, deliveryNotes, deliveryItems, customers, products]);

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
        const currentDay = now.getDay();
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
        const firstOfYear = new Date(y, 0, 1);
        setStartDate(formatISO(firstOfYear));
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
        const firstOfLastYear = new Date(y - 1, 0, 1);
        const lastOfLastYear = new Date(y - 1, 11, 31);
        setStartDate(formatISO(firstOfLastYear));
        setEndDate(formatISO(lastOfLastYear));
        break;
      }
    }
  };

  const handlePrint = async () => {
    if (!selectedTruck) return;

    const driverName = selectedTruck.driverId 
        ? drivers.find(d => d.id === selectedTruck.driverId)?.name 
        : selectedTruck.driverName;

    const printData: TruckReportPrintData = {
      companyName: companySettings?.companyName,
      companyAddress: companySettings?.address,
      companyPhone: companySettings?.phone,
      companyNif: companySettings?.nif,
      truckMatricule: selectedTruck.matricule,
      driverName: driverName || '-',
      tare: selectedTruck.tare || 0,
      customerName: selectedCustomer?.name,
      productName: selectedProduct?.name,
      startDate: formatDateDisplay(startDate),
      endDate: formatDateDisplay(endDate),
      items: reportData.items,
      totalQuantity: reportData.totalQuantity,
      totalAmountHT: reportData.totalHT,
    };

    try {
      await executePrintAttachment(null, printData);
    } catch (e) {
      console.error('Failed to print', e);
    }
  };

  const driverName = useMemo(() => {
    if (!selectedTruck) return '';
    if (selectedTruck.driverId) {
      const driver = drivers.find(d => d.id === selectedTruck.driverId);
      if (driver) return driver.name;
    }
    return selectedTruck.driverName || '';
  }, [selectedTruck, drivers]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back Button & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-6 w-6 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                Rapport Détaillé
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Enlèvements par Camion
            </h1>
          </div>
        </div>
      </div>

      {/* Main Filter Card (matching screenshot visual structure) */}
      <div className="bg-slate-50 rounded-2xl border border-slate-300 shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Truck, Client, Product */}
          <div className="lg:col-span-8 space-y-4">
            {/* Truck Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="font-bold text-sm text-slate-700 sm:w-20 shrink-0">Camion</label>
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-[200px]">
                  <input
                    type="text"
                    value={selectedTruck?.matricule || ''}
                    readOnly
                    onClick={() => setShowTruckPicker(true)}
                    className="w-full h-10 bg-white border-2 border-amber-500 rounded-lg pl-3 pr-10 text-sm font-bold cursor-pointer"
                    placeholder="Choisir camion..."
                  />
                  <button 
                    onClick={() => setShowTruckPicker(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    <Search className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
                {/* Auto-filled Chauffeur & Tare */}
                <div className="hidden sm:flex items-center gap-2 flex-1 ml-4 bg-slate-200/50 px-3 py-2 rounded-lg border border-slate-300">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chauffeur</span>
                  <span className="text-sm font-black text-slate-800 truncate flex-1">{driverName || '-'}</span>
                  <div className="w-px h-4 bg-slate-300 mx-2"></div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tare</span>
                  <span className="text-sm font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">{selectedTruck?.tare || '0'}</span>
                </div>
              </div>
            </div>

            {/* Mobile-only Driver & Tare display */}
            <div className="sm:hidden flex items-center gap-2 bg-slate-200/50 px-3 py-2 rounded-lg border border-slate-300">
              <span className="text-xs font-bold text-slate-500 uppercase">Chauffeur</span>
              <span className="text-sm font-black text-slate-800 truncate flex-1">{driverName || '-'}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Tare</span>
              <span className="text-sm font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">{selectedTruck?.tare || '0'}</span>
            </div>

            {/* Client Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="font-bold text-sm text-slate-700 sm:w-20 shrink-0">Client</label>
              <div className="relative flex-1 max-w-[400px] flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={selectedCustomer?.name || ''}
                    readOnly
                    onClick={() => setShowClientPicker(true)}
                    className="w-full h-10 bg-white border-2 border-slate-300 rounded-lg pl-3 pr-10 text-sm font-bold cursor-pointer"
                    placeholder="Tous les clients (Optionnel)"
                  />
                  {selectedCustomer ? (
                    <button 
                      onClick={() => setSelectedCustomer(null)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-red-50 text-red-500 rounded cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowClientPicker(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                    >
                      <Search className="h-4 w-4 text-slate-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Produit Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="font-bold text-sm text-slate-700 sm:w-20 shrink-0">Produit</label>
              <div className="relative flex-1 max-w-[300px] flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={selectedProduct?.name || ''}
                    readOnly
                    onClick={() => setShowProductPicker(true)}
                    className="w-full h-10 bg-white border-2 border-slate-300 rounded-lg pl-3 pr-10 text-sm font-bold text-blue-700 cursor-pointer"
                    placeholder="Tous les produits (Optionnel)"
                  />
                  {selectedProduct ? (
                    <button 
                      onClick={() => setSelectedProduct(null)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-red-50 text-red-500 rounded cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowProductPicker(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                    >
                      <Search className="h-4 w-4 text-slate-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Date Selection */}
          <div className="lg:col-span-4 bg-slate-200/50 rounded-xl p-4 border border-slate-300 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="font-bold text-sm text-slate-700 w-8">Du</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSelectedPreset('custom');
                  }}
                  className="flex-1 h-10 border-2 border-slate-300 rounded-lg px-3 font-mono text-sm font-bold bg-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="font-bold text-sm text-slate-700 w-8">Au</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setSelectedPreset('custom');
                  }}
                  className="flex-1 h-10 border-2 border-slate-300 rounded-lg px-3 font-mono text-sm font-bold bg-white"
                />
              </div>
              <div>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetChange(e.target.value as PresetPeriod)}
                  className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="custom">Période personnalisée</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="yesterday">Hier</option>
                  <option value="current_week">Semaine en cours</option>
                  <option value="floating_week">7 derniers jours</option>
                  <option value="previous_week">Semaine dernière</option>
                  <option value="current_month">Mois en cours</option>
                  <option value="floating_month">30 derniers jours</option>
                  <option value="previous_month">Mois dernier</option>
                  <option value="current_year">Année en cours</option>
                  <option value="floating_year">12 derniers mois</option>
                  <option value="previous_year">Année précédente</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table Section */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-md overflow-hidden">
        {/* Table Title Banner */}
        <div className="bg-slate-100 text-slate-800 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300">
          <h2 className="text-base sm:text-lg font-black tracking-tight text-blue-800 flex items-center gap-2">
            <TruckIcon className="h-5 w-5" />
            Enlèvements du camion {selectedTruck?.matricule || '...'}
          </h2>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-emerald-700/80 text-white text-xs font-black uppercase tracking-wider">
                <th className="py-2.5 px-4 border-b border-r border-emerald-800 text-left w-24">N° B.L</th>
                <th className="py-2.5 px-4 border-b border-r border-emerald-800 text-left w-32">Date</th>
                <th className="py-2.5 px-4 border-b border-r border-emerald-800 text-left">Client</th>
                <th className="py-2.5 px-4 border-b border-r border-emerald-800 text-left">Produit</th>
                <th className="py-2.5 px-4 border-b border-r border-emerald-800 text-right w-24">Qté</th>
                <th className="py-2.5 px-4 border-b border-r border-emerald-800 text-right w-32">Prix Unit.</th>
                <th className="py-2.5 px-4 border-b border-emerald-800 text-right w-36">Mnt H.T.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {!selectedTruck ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                        <TruckIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-base">Aucun camion sélectionné</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Veuillez sélectionner un camion pour afficher ses enlèvements.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : reportData.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 bg-slate-50">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    <p className="font-bold text-slate-700">
                      Aucun enlèvement trouvé pour ce camion.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      (Modifiez les filtres de date, client ou produit)
                    </p>
                  </td>
                </tr>
              ) : (
                reportData.items.map((row, idx) => (
                  <tr 
                    key={`${row.blNumber}-${idx}`}
                    className={`hover:bg-slate-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    {/* N° BL */}
                    <td className="py-2 px-4 border-r border-slate-200 font-mono font-bold text-slate-800">
                      {row.blNumber}
                    </td>

                    {/* Date */}
                    <td className="py-2 px-4 border-r border-slate-200 text-slate-700 font-mono text-sm">
                      {formatDateDisplay(row.date)}
                    </td>

                    {/* Client */}
                    <td className="py-2 px-4 border-r border-slate-200 font-bold text-slate-700 text-sm">
                      {row.customerName}
                    </td>

                    {/* Produit */}
                    <td className="py-2 px-4 border-r border-slate-200 font-bold text-blue-700 text-sm">
                      {row.productName}
                    </td>

                    {/* Qté */}
                    <td className="py-2 px-4 border-r border-slate-200 text-right font-mono font-black text-emerald-700">
                      {row.quantity.toFixed(3)}
                    </td>

                    {/* Prix Unit */}
                    <td className="py-2 px-4 border-r border-slate-200 text-right font-mono font-semibold text-slate-600 text-sm">
                      {row.unitPrice.toFixed(2)}
                    </td>

                    {/* Mnt H.T. */}
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900">
                      {row.totalHT.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Footer Row */}
            {selectedTruck && reportData.items.length > 0 && (
              <tfoot className="bg-slate-100 font-black text-slate-800 border-t-2 border-slate-400 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <tr>
                  <td colSpan={4} className="py-3 px-4 border-r border-slate-300 text-left text-sm">
                    Total camion
                  </td>
                  <td className="py-3 px-4 border-r border-slate-300 text-right font-mono text-emerald-700 text-base">
                    {reportData.totalQuantity.toFixed(3)}
                  </td>
                  <td className="py-3 px-4 border-r border-slate-300 text-right"></td>
                  <td className="py-3 px-4 text-right font-mono text-base">
                    {reportData.totalHT.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="flex flex-col sm:flex-row justify-center sm:justify-center items-center gap-4 py-4">
        <button
          onClick={handlePrint}
          disabled={!selectedTruck || reportData.items.length === 0}
          className="w-full sm:w-auto px-10 py-3 bg-slate-100 border border-slate-300 hover:bg-white text-slate-800 font-black rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Printer className="h-5 w-5" />
          <span>Imprimer</span>
        </button>
        
        <button
          onClick={() => navigate('/reports')}
          className="w-full sm:w-auto px-10 py-3 bg-slate-50 border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          Annuler
        </button>
      </div>

      {/* Pickers */}
      <TruckPickerModal
        isOpen={showTruckPicker}
        onClose={() => setShowTruckPicker(false)}
        onSelect={(truck) => {
          setSelectedTruck(truck);
          setShowTruckPicker(false);
        }}
        trucks={trucks}
        drivers={drivers}
      />

      <ClientPickerModal
        isOpen={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        onSelect={(client) => {
          setSelectedCustomer(client);
          setShowClientPicker(false);
        }}
        customers={customers}
      />

      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={(product) => {
          setSelectedProduct(product);
          setShowProductPicker(false);
        }}
        products={products}
      />

    </div>
  );
}
"""

with open("src/pages/reports/TruckOnlyDeliveriesReport.tsx", "w") as f:
    f.write(content)
