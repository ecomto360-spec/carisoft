import os

with open('src/pages/reports/TruckDeliveriesReport.tsx', 'r') as f:
    client_report_content = f.read()

# I will write a completely new TruckOnlyDeliveriesReport.tsx
# using the exact UI classes from TruckDeliveriesReport.tsx

new_content = """import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { Customer, Truck, Product, DeliveryNote, DeliveryNoteItem } from '../../types';
import { TruckPickerModal } from '../deliveries/TruckPickerModal';
import { ClientPickerModal } from '../deliveries/ClientPickerModal';
import { ProductPickerModal } from '../deliveries/ProductPickerModal';
import { executePrintTruckReport, TruckReportPrintData } from '../../lib/printReceipt';
import { 
  Truck as TruckIcon, Printer, Search, Calendar, 
  ArrowLeft, FileText, CheckCircle2, 
  AlertCircle, Users, Box, X
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

export function TruckOnlyDeliveriesReport() {
  const navigate = useNavigate();

  // Queries
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.toArray()) || [];
  const drivers = useLiveQuery(() => db.drivers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const deliveryNotes = useLiveQuery(() => db.deliveryNotes.toArray()) || [];
  const deliveryNoteItems = useLiveQuery(() => db.deliveryNoteItems.toArray()) || [];
  const companySettings = useLiveQuery(() => db.settings.get(1));

  // Date State - Default to beginning of year to today
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfYear = `${new Date().getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('current_year');

  // Selection State
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [truckCodeInput, setTruckCodeInput] = useState<string>('');
  
  // Modals
  const [showTruckPicker, setShowTruckPicker] = useState<boolean>(false);
  const [showClientPicker, setShowClientPicker] = useState<boolean>(false);
  const [showProductPicker, setShowProductPicker] = useState<boolean>(false);

  // Result display state
  const [isCalculated, setIsCalculated] = useState<boolean>(true);

  // Auto-match truck code on input change
  const handleTruckCodeChange = (code: string) => {
    setTruckCodeInput(code);
    const found = trucks.find(t => t.matricule.toLowerCase() === code.trim().toLowerCase());
    if (found) {
      setSelectedTruck(found);
    } else if (code.trim() === '') {
      setSelectedTruck(null);
    }
  };

  const handleSelectTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    setTruckCodeInput(truck.matricule);
  };

  // Period Preset calculation
  const handlePresetChange = (preset: PresetPeriod) => {
    setSelectedPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    
    const formatISO = (date: Date) => {
        // Adjust for timezone offset to get local YYYY-MM-DD
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().split('T')[0];
    };

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

  // Driver string resolution helper
  const getDriverNameForTruck = (truck: Truck | null) => {
      if (!truck) return '---';
      if (truck.driverName) return truck.driverName;
      if (truck.driverId) {
          const drv = drivers.find(d => d.id === truck.driverId);
          return drv ? drv.name : '---';
      }
      return '---';
  };

  const getDriverNameForBL = (bl: DeliveryNote, truck: Truck) => {
    let dName = '';
    if (bl.driverId) {
        const d = drivers.find(drv => drv.id === bl.driverId);
        if (d) dName = d.name;
    }
    if (!dName && truck.driverName) dName = truck.driverName;
    if (!dName && truck.driverId) {
        const d = drivers.find(drv => drv.id === truck.driverId);
        if (d) dName = d.name;
    }
    return dName || 'CHAUFFEUR';
  };

  // Aggregation of deliveries by Truck for the SELECTED Truck
  const reportData = useMemo(() => {
    if (!selectedTruck || !deliveryNotes || !deliveryNoteItems) {
      return { items: [], totalQuantity: 0, totalHT: 0, hasTruck: false };
    }

    // Filter BLs by Truck, Customer (optional), and Date
    const filteredBLs = deliveryNotes.filter(bl => {
      if (bl.status === 'cancelled') return false;
      if (bl.truckId !== selectedTruck.id) return false;
      if (selectedCustomer && bl.customerId !== selectedCustomer.id) return false;
      
      const blDate = bl.date.split('T')[0];
      if (startDate && blDate < startDate) return false;
      if (endDate && blDate > endDate) return false;
      
      return true;
    });

    const reportItems: any[] = [];
    let totalQuantity = 0;
    let totalHT = 0;

    filteredBLs.forEach(bl => {
      // Find items for this BL
      let itemsForBL = deliveryNoteItems.filter(item => item.deliveryNoteId === bl.id);
      
      // Filter by product if selected
      if (selectedProduct) {
        itemsForBL = itemsForBL.filter(item => item.productId === selectedProduct.id);
      }

      if (itemsForBL.length === 0) return;

      const customer = customers.find(c => c.id === bl.customerId);
      const customerName = customer ? customer.name : 'CLIENT INCONNU';

      itemsForBL.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const productName = product ? product.name : 'PRODUIT INCONNU';
        const unit = product ? product.unit : 'T';

        reportItems.push({
          blNumber: bl.number,
          date: bl.date.split('T')[0],
          customerName,
          productName,
          quantity: item.quantity,
          priceHT: item.priceHT,
          totalHT: item.totalHT,
          unit
        });

        totalQuantity += item.quantity;
        totalHT += item.totalHT;
      });
    });

    // Sort items by Date, then BL Number
    reportItems.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.blNumber.localeCompare(b.blNumber);
    });

    return { 
      items: reportItems, 
      totalQuantity, 
      totalHT, 
      hasTruck: true 
    };
  }, [deliveryNotes, deliveryNoteItems, selectedTruck, selectedCustomer, selectedProduct, startDate, endDate, customers, products]);

  // Handle Print Action
  const handlePrint = () => {
    if (!selectedTruck) {
      setShowTruckPicker(true);
      return;
    }

    const printData: TruckReportPrintData = {
      companyName: companySettings?.name,
      companyAddress: companySettings?.address,
      companyPhone: companySettings?.phone,
      startDate: formatDateDisplay(startDate),
      endDate: formatDateDisplay(endDate),
      truckMatricule: selectedTruck.matricule,
      driverName: getDriverNameForTruck(selectedTruck),
      tare: selectedTruck.tare || 0,
      customerName: selectedCustomer ? selectedCustomer.name : undefined,
      productName: selectedProduct ? selectedProduct.name : undefined,
      items: reportData.items,
      totalQuantity: reportData.totalQuantity,
      totalAmountHT: reportData.totalHT,
      unit: 'T'
    };

    executePrintTruckReport(printData);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports')}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <TruckIcon className="h-6 w-6 text-blue-600" />
              Enlèvements par Camion
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Consultez l'historique détaillé des enlèvements effectués par un camion spécifique
            </p>
          </div>
        </div>
      </div>

      {/* Main Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
        {/* Step Indicator Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              1
            </div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              SÉLECTION DU CAMION & PÉRIODE
            </h2>
          </div>
          
          {!selectedTruck && (
            <div className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
              * Veuillez sélectionner un camion d'abord
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Left: Illustration / Instructions */}
          <div className="hidden md:flex flex-col items-center justify-center bg-blue-600 p-8 w-1/3 min-w-[280px] max-w-[320px] text-white">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <TruckIcon className="h-12 w-12 text-blue-100" />
            </div>
            <h3 className="text-xl font-black text-center mb-3">Enlèvements<br/>Par Camion</h3>
            <p className="text-center text-blue-100 text-sm mb-6 leading-relaxed">
              Sélectionnez un camion pour afficher la liste de tous ses bons de livraison sur une période donnée.
            </p>
            <div className="space-y-3 w-full max-w-[240px]">
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className={`h-5 w-5 ${selectedTruck ? 'text-green-300' : 'text-blue-300/50'}`} />
                <span className={selectedTruck ? 'font-bold' : 'opacity-70'}>Camion (Obligatoire)</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className={`h-5 w-5 ${startDate && endDate ? 'text-green-300' : 'text-blue-300/50'}`} />
                <span className={startDate && endDate ? 'font-bold' : 'opacity-70'}>Période (Requise)</span>
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="p-5 md:p-6 bg-white flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* 1. Camion Selection (Mandatory) */}
              <div className="lg:col-span-12">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <label className="text-sm font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
                    <TruckIcon className="h-4 w-4 text-blue-600" />
                    1. Camion (Obligatoire) :
                  </label>
                  <span className="text-xs font-semibold text-blue-600/70 hidden sm:inline-block">
                    Choisissez le camion pour charger son historique
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <div className="relative w-full sm:w-1/3">
                    <input
                      type="text"
                      value={truckCodeInput}
                      onChange={(e) => handleTruckCodeChange(e.target.value)}
                      placeholder="Matricule"
                      className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm uppercase transition-shadow shadow-sm"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                  
                  <button
                    onClick={() => setShowTruckPicker(true)}
                    className="whitespace-nowrap px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    Choisir Camion
                  </button>

                  <div className={`flex-1 flex items-center justify-center sm:justify-start px-4 py-2.5 rounded-lg border ${selectedTruck ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-100 border-slate-200 border-dashed text-slate-400'}`}>
                    {selectedTruck ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
                         <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-blue-800 text-lg">{selectedTruck.matricule}</span>
                         </div>
                         <div className="flex items-center gap-4 text-sm font-medium">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-md text-slate-700 border border-slate-200">
                                <span className="text-xs uppercase text-slate-500">Chauffeur:</span>
                                <span className="font-bold">{getDriverNameForTruck(selectedTruck)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-md text-slate-700 border border-slate-200">
                                <span className="text-xs uppercase text-slate-500">Tare:</span>
                                <span className="font-bold font-mono text-emerald-700">{selectedTruck.tare || '0'} T</span>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold tracking-wide">— CLIQUEZ SUR "CHOISIR CAMION" OU ENTREZ UN MATRICULE —</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Optional Filters */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Client Selection (Optional) */}
                 <div>
                    <label className="text-sm font-black text-slate-700 uppercase tracking-tight flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        2. Client (Optionnel) :
                    </label>
                    <div className="flex gap-2">
                         <button
                            onClick={() => setShowClientPicker(true)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-sm font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                        >
                            <Search className="h-4 w-4" />
                            Choisir Client
                        </button>
                        <div className={`flex-1 flex items-center px-3 py-2 rounded-lg border ${selectedCustomer ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                            {selectedCustomer ? (
                                <div className="flex items-center justify-between w-full">
                                    <span className="font-bold text-slate-800 text-sm truncate">{selectedCustomer.name}</span>
                                    <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-red-500 p-1">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400 italic">Tous les clients</span>
                            )}
                        </div>
                    </div>
                 </div>

                 {/* Product Selection (Optional) */}
                 <div>
                    <label className="text-sm font-black text-slate-700 uppercase tracking-tight flex items-center gap-2 mb-2">
                        <Box className="h-4 w-4 text-slate-400" />
                        3. Produit (Optionnel) :
                    </label>
                    <div className="flex gap-2">
                         <button
                            onClick={() => setShowProductPicker(true)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-sm font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                        >
                            <Search className="h-4 w-4" />
                            Choisir Produit
                        </button>
                        <div className={`flex-1 flex items-center px-3 py-2 rounded-lg border ${selectedProduct ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                            {selectedProduct ? (
                                <div className="flex items-center justify-between w-full">
                                    <span className="font-bold text-slate-800 text-sm truncate">{selectedProduct.name}</span>
                                    <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-red-500 p-1">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <span className="text-sm text-slate-400 italic">Tous les produits</span>
                            )}
                        </div>
                    </div>
                 </div>
              </div>

              {/* 3. Dates */}
              <div className="lg:col-span-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Start Date */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between mb-1.5">
                      <span>4. Du (Date début) :</span>
                      <span className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">{getDayOfWeekName(startDate)}</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setSelectedPreset('custom');
                        }}
                        className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold shadow-sm"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center justify-between mb-1.5">
                      <span>Au (Date fin) :</span>
                      <span className="text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded text-[10px]">{getDayOfWeekName(endDate)}</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setSelectedPreset('custom');
                        }}
                        className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-bold shadow-sm"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Presets */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
                      Période prédéfinie :
                    </label>
                    <select
                      value={selectedPreset}
                      onChange={(e) => handlePresetChange(e.target.value as PresetPeriod)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold shadow-sm cursor-pointer"
                    >
                      <option value="custom">Personnalisée</option>
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
        </div>
        
        {/* Generate / Status Bar */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500 font-medium">
            Période active : <span className="font-bold text-slate-700">{formatDateDisplay(startDate)}</span> au <span className="font-bold text-slate-700">{formatDateDisplay(endDate)}</span>
          </div>
          
          <button
            onClick={() => setIsCalculated(true)}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 w-full sm:w-auto
              ${selectedTruck 
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
                : 'bg-blue-400 text-white/90 cursor-not-allowed opacity-80'}`}
            disabled={!selectedTruck}
          >
            <Search className="h-4 w-4" />
            {selectedTruck ? "Afficher les Enlèvements" : "Sélectionner un Camion pour Afficher"}
          </button>
        </div>
      </div>

      {/* Results Table Section */}
      <div className="bg-slate-900 rounded-xl shadow-xl overflow-hidden border border-slate-800">
        {/* Dark Title Banner */}
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-1">
              ÉTAT DES ENLÈVEMENTS DU CAMION
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              {selectedTruck ? `ENLÈVEMENTS DU CAMION ${selectedTruck.matricule}` : 'EN ATTENTE DE SÉLECTION DU CAMION'}
            </h2>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 text-slate-300 text-sm font-mono self-start md:self-auto min-w-[200px] shadow-inner">
            Du <span className="text-white font-bold">{formatDateDisplay(startDate)}</span> au <br className="hidden md:block" />
            <span className="text-white font-bold md:ml-6">{formatDateDisplay(endDate)}</span>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800 text-slate-200 text-xs font-black uppercase tracking-wider">
                <th className="py-3 px-4 border-b border-r border-slate-700 text-left w-24">N° B.L</th>
                <th className="py-3 px-4 border-b border-r border-slate-700 text-center w-28">Date</th>
                <th className="py-3 px-4 border-b border-r border-slate-700 text-left">Client</th>
                <th className="py-3 px-4 border-b border-r border-slate-700 text-left">Produit</th>
                <th className="py-3 px-4 border-b border-r border-slate-700 text-right w-24">Qté</th>
                <th className="py-3 px-4 border-b border-r border-slate-700 text-right w-28">Prix Unit.</th>
                <th className="py-3 px-4 border-b border-slate-700 text-right w-32">Mnt H.T.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {!selectedTruck ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
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
                      Aucun enlèvement trouvé.
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
                    className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                  >
                    {/* N° BL */}
                    <td className="py-2.5 px-4 border-r border-slate-200 font-mono font-bold text-slate-800">
                      {row.blNumber}
                    </td>
                    {/* Date */}
                    <td className="py-2.5 px-4 border-r border-slate-200 text-center text-slate-600 font-mono text-xs">
                      {formatDateDisplay(row.date)}
                    </td>
                    {/* Client */}
                    <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-700 text-sm truncate max-w-[200px]">
                      {row.customerName}
                    </td>
                    {/* Produit */}
                    <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-blue-700 text-sm truncate max-w-[150px]">
                      {row.productName}
                    </td>
                    {/* Qté */}
                    <td className="py-2.5 px-4 border-r border-slate-200 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                      {row.quantity.toFixed(3)}
                    </td>
                    {/* Prix Unit */}
                    <td className="py-2.5 px-4 border-r border-slate-200 text-right font-mono font-semibold text-slate-600 text-sm">
                      {row.priceHT.toFixed(2)}
                    </td>
                    {/* Mnt H.T. */}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                      {row.totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Footer Row */}
            {selectedTruck && reportData.items.length > 0 && (
              <tfoot className="bg-slate-200 font-black text-slate-900 border-t-2 border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-sm">
                <tr>
                  <td colSpan={4} className="py-3 px-4 border-r border-slate-300 text-left">
                    Total camion
                  </td>
                  <td className="py-3 px-4 border-r border-slate-300 text-right font-mono text-emerald-800">
                    {reportData.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  </td>
                  <td className="py-3 px-4 border-r border-slate-300 text-right"></td>
                  <td className="py-3 px-4 text-right font-mono text-slate-900">
                    {reportData.totalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="flex justify-center items-center gap-4 py-4">
        <button
          onClick={handlePrint}
          disabled={!selectedTruck || reportData.items.length === 0}
          className="px-8 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-black rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Printer className="h-5 w-5 text-blue-600" />
          <span>Imprimer</span>
        </button>
        
        <button
          onClick={() => navigate('/reports')}
          className="px-8 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Annuler
        </button>
      </div>

      {/* Pickers */}
      <TruckPickerModal
        isOpen={showTruckPicker}
        onClose={() => setShowTruckPicker(false)}
        onSelect={handleSelectTruck}
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
        productPrices={[]}
      />
    </div>
  );
}
"""

with open('src/pages/reports/TruckOnlyDeliveriesReport.tsx', 'w') as f:
    f.write(new_content)

