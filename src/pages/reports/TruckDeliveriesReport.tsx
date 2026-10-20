import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { Customer, Truck, Driver, DeliveryNote, Product, ProductPrice, DeliveryNoteItem } from '../../types';
import { ClientPickerModal } from '../deliveries/ClientPickerModal';
import { TruckPickerModal } from '../deliveries/TruckPickerModal';
import { ProductPickerModal } from '../deliveries/ProductPickerModal';
import { executePrintAttachment, AttachmentPrintData } from '../../lib/printReceipt';
import { useAuthStore } from '../../store/authStore';
import { 
  Truck as TruckIcon, Printer, Search, Calendar, 
  ArrowLeft, RotateCcw, FileText, CheckCircle2, 
  Layers, Download, Eye, AlertCircle, Users, BarChart3, Package,
  Filter, Box, X
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
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const productPrices = useLiveQuery(() => db.productPrices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const deliveryNotes = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const deliveryNoteItems = useLiveQuery(() => db.deliveryNoteItems.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
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

  // Truck Selection State (Belonging to selected client)
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [truckCodeInput, setTruckCodeInput] = useState<string>('');
  const [showTruckPicker, setShowTruckPicker] = useState<boolean>(false);

  // Product Selection State (Belonging to selected client)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productCodeInput, setProductCodeInput] = useState<string>('');
  const [showProductPicker, setShowProductPicker] = useState<boolean>(false);

  // Result display state
  const [isCalculated, setIsCalculated] = useState<boolean>(true);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState<boolean>(false);

  // Dynamic Trucks belonging to the selected client
  const clientTrucks = useMemo(() => {
    if (!selectedCustomer) return [];
    const truckIdSet = new Set<string>();

    // 1. Trucks from delivery notes for this customer
    deliveryNotes.forEach(bl => {
      if (bl.customerId === selectedCustomer.id && bl.status !== 'cancelled' && bl.truckId) {
        truckIdSet.add(bl.truckId);
      }
    });

    // 2. Favorite trucks of this customer
    if (selectedCustomer.favoriteTruckIds) {
      selectedCustomer.favoriteTruckIds.forEach(id => truckIdSet.add(id));
    }
    if (selectedCustomer.lastTruckId) {
      truckIdSet.add(selectedCustomer.lastTruckId);
    }

    const matched = trucks.filter(t => truckIdSet.has(t.id));
    if (matched.length > 0) return matched;
    // Fallback to all trucks if none recorded in history yet
    return trucks;
  }, [selectedCustomer, deliveryNotes, trucks]);

  // Dynamic Products delivered / assigned to the selected client
  const clientProducts = useMemo(() => {
    if (!selectedCustomer) return [];
    const prodIdSet = new Set<string>();

    // 1. Products from delivery notes for this customer
    const customerBlIds = new Set(
      deliveryNotes
        .filter(bl => bl.customerId === selectedCustomer.id && bl.status !== 'cancelled')
        .map(bl => bl.id)
    );

    deliveryNoteItems.forEach(item => {
      if (customerBlIds.has(item.deliveryNoteId) && item.productId) {
        prodIdSet.add(item.productId);
      }
    });

    // 2. Products from customPrices if set for this customer
    if (selectedCustomer.customPrices) {
      Object.keys(selectedCustomer.customPrices).forEach(pId => prodIdSet.add(pId));
    }

    const matched = products.filter(p => prodIdSet.has(p.id));
    if (matched.length > 0) return matched;
    // Fallback to all active products if none in history yet
    return products.filter(p => p.active !== false);
  }, [selectedCustomer, deliveryNotes, deliveryNoteItems, products]);

  // Auto-match client code on input change
  const handleClientCodeChange = (code: string) => {
    setClientCodeInput(code);
    const found = customers.find(c => c.code.toLowerCase() === code.trim().toLowerCase());
    if (found) {
      setSelectedCustomer(found);
      setSelectedTruck(null);
      setTruckCodeInput('');
      setSelectedProduct(null);
      setProductCodeInput('');
    } else if (code.trim() === '') {
      setSelectedCustomer(null);
      setSelectedTruck(null);
      setTruckCodeInput('');
      setSelectedProduct(null);
      setProductCodeInput('');
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setClientCodeInput(customer.code);
    setSelectedTruck(null);
    setTruckCodeInput('');
    setSelectedProduct(null);
    setProductCodeInput('');
  };

  // Auto-match truck matricule on input change
  const handleTruckCodeChange = (matricule: string) => {
    setTruckCodeInput(matricule);
    const found = clientTrucks.find(t => t.matricule.toLowerCase() === matricule.trim().toLowerCase());
    if (found) {
      setSelectedTruck(found);
    } else if (matricule.trim() === '') {
      setSelectedTruck(null);
    }
  };

  const handleSelectTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    setTruckCodeInput(truck.matricule);
  };

  // Auto-match product code on input change
  const handleProductCodeChange = (code: string) => {
    setProductCodeInput(code);
    const found = clientProducts.find(p => p.code.toLowerCase() === code.trim().toLowerCase());
    if (found) {
      setSelectedProduct(found);
    } else if (code.trim() === '') {
      setSelectedProduct(null);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductCodeInput(product.code);
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

  // Aggregation of deliveries by Truck for the SELECTED Client, with optional Truck and Product filters
  const reportData = useMemo(() => {
    // If no client is selected, do not compute/show trucks until a client is chosen
    if (!selectedCustomer || !deliveryNotes) {
      return { items: [], totalDeliveries: 0, totalQuantity: 0, hasClient: false };
    }

    // Map items by delivery note ID
    const itemsByNote = new Map<string, DeliveryNoteItem[]>();
    deliveryNoteItems.forEach(item => {
      const list = itemsByNote.get(item.deliveryNoteId) || [];
      list.push(item);
      itemsByNote.set(item.deliveryNoteId, list);
    });

    const prodMap = new Map(products.map(p => [p.id, p]));
    const truckMapObj = new Map(trucks.map(t => [t.id, t]));

    // Filter by the selected client, date interval, and optional truck & product
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

      // Optional Truck Filter (belongs to client)
      if (selectedTruck && bl.truckId !== selectedTruck.id) {
        return false;
      }

      // Optional Product Filter (belongs to client)
      if (selectedProduct) {
        const noteItems = itemsByNote.get(bl.id) || [];
        const hasProduct = noteItems.some(item => item.productId === selectedProduct.id);
        if (!hasProduct) return false;
      }

      return true;
    });

    // Special Case: Specific Truck selected AND All Products ("Tous les produits") -> Group by product
    // to provide detailed visibility on materials hauled by this specific truck
    if (selectedTruck && !selectedProduct) {
      const prodBreakdown: Record<string, {
        productName: string;
        deliveryCount: number;
        totalQuantity: number;
      }> = {};

      filteredBLs.forEach(bl => {
        const noteItems = itemsByNote.get(bl.id) || [];
        if (noteItems.length > 0) {
          noteItems.forEach(it => {
            const prod = prodMap.get(it.productId);
            const pName = prod?.name || 'Agrégats';
            if (!prodBreakdown[pName]) {
              prodBreakdown[pName] = { productName: pName, deliveryCount: 0, totalQuantity: 0 };
            }
            const q = it.quantity > 100 ? it.quantity / 1000 : (it.quantity || 0);
            prodBreakdown[pName].deliveryCount += 1;
            prodBreakdown[pName].totalQuantity += q;
          });
        } else {
          const pName = 'Agrégats';
          if (!prodBreakdown[pName]) {
            prodBreakdown[pName] = { productName: pName, deliveryCount: 0, totalQuantity: 0 };
          }
          const q = bl.netWeight ? (bl.netWeight > 100 ? bl.netWeight / 1000 : bl.netWeight) : 0;
          prodBreakdown[pName].deliveryCount += 1;
          prodBreakdown[pName].totalQuantity += q;
        }
      });

      const items = Object.values(prodBreakdown).map(val => ({
        matricule: selectedTruck.matricule,
        driverName: selectedTruck.driverName || 'CHAUFFEUR',
        productName: val.productName,
        deliveryCount: val.deliveryCount,
        totalQuantity: val.totalQuantity,
      })).sort((a, b) => b.totalQuantity - a.totalQuantity);

      const totalDeliveries = items.reduce((acc, curr) => acc + curr.deliveryCount, 0);
      const totalQuantity = items.reduce((acc, curr) => acc + curr.totalQuantity, 0);

      return { items, totalDeliveries, totalQuantity, hasClient: true };
    }

    // Standard Case: Group by Truck
    const truckMap: Record<string, {
      matricule: string;
      driverName: string;
      productNamesSet: Set<string>;
      deliveryCount: number;
      totalQuantity: number;
    }> = {};

    filteredBLs.forEach(bl => {
      const truck = truckMapObj.get(bl.truckId);
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

      const noteItems = itemsByNote.get(bl.id) || [];
      let calculatedWeight = 0;

      const key = `${matricule}___${driverName}`;
      if (!truckMap[key]) {
        truckMap[key] = {
          matricule,
          driverName,
          productNamesSet: new Set<string>(),
          deliveryCount: 0,
          totalQuantity: 0,
        };
      }

      if (selectedProduct) {
        truckMap[key].productNamesSet.add(selectedProduct.name);
        const matchingItems = noteItems.filter(it => it.productId === selectedProduct.id);
        if (matchingItems.length > 0) {
          calculatedWeight = matchingItems.reduce((acc, it) => {
            const q = it.quantity > 100 ? it.quantity / 1000 : (it.quantity || 0);
            return acc + q;
          }, 0);
        } else {
          const q = bl.netWeight ? (bl.netWeight > 100 ? bl.netWeight / 1000 : bl.netWeight) : 0;
          calculatedWeight = q;
        }
      } else {
        if (noteItems.length > 0) {
          noteItems.forEach(it => {
            const p = prodMap.get(it.productId);
            if (p) truckMap[key].productNamesSet.add(p.name);
            const q = it.quantity > 100 ? it.quantity / 1000 : (it.quantity || 0);
            calculatedWeight += q;
          });
        } else {
          const q = bl.netWeight ? (bl.netWeight > 100 ? bl.netWeight / 1000 : bl.netWeight) : 0;
          calculatedWeight = q;
        }
      }

      truckMap[key].deliveryCount += 1;
      truckMap[key].totalQuantity += calculatedWeight;
    });

    const items = Object.values(truckMap).map(val => ({
      matricule: val.matricule,
      driverName: val.driverName,
      productName: Array.from(val.productNamesSet).join(', ') || (selectedProduct?.name || 'Agrégats'),
      deliveryCount: val.deliveryCount,
      totalQuantity: val.totalQuantity,
    })).sort((a, b) => b.totalQuantity - a.totalQuantity);

    const totalDeliveries = items.reduce((acc, curr) => acc + curr.deliveryCount, 0);
    const totalQuantity = items.reduce((acc, curr) => acc + curr.totalQuantity, 0);

    return { items, totalDeliveries, totalQuantity, hasClient: true };
  }, [deliveryNotes, deliveryNoteItems, products, selectedCustomer, selectedTruck, selectedProduct, startDate, endDate, trucks, drivers]);

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
      truckFilter: selectedTruck ? `${selectedTruck.matricule} (${selectedTruck.driverName || 'Chauffeur'})` : undefined,
      productFilter: selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : undefined,
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

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-0">
        <button
          onClick={() => navigate('/reports')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <BarChart3 className="h-4 w-4" /> Tableau de Bord
        </button>
        <button
          onClick={() => navigate('/reports/etat-104')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <FileText className="h-4 w-4 text-blue-600" /> État 104 (Fiscal & Impôts)
        </button>
        <button
          className="px-5 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2 bg-blue-50/40 rounded-t-lg cursor-pointer"
        >
          <Users className="h-4 w-4" /> Enlèvements / Client
        </button>
        <button
          onClick={() => navigate('/reports/truck-only-deliveries')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <TruckIcon className="h-4 w-4" /> Enlèvements / Camion
        </button>
        <button
          onClick={() => navigate('/reports/product-deliveries')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <Package className="h-4 w-4" /> Enlèvements / Produit
        </button>
        <button
          onClick={() => navigate('/reports/periodic-deliveries')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <FileText className="h-4 w-4" /> Rapport Périodique
        </button>
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
              {!selectedCustomer ? (
                <span className="text-xs font-semibold text-blue-700">
                  Choisissez le client pour charger ses camions et ses produits
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-700">
                  Client sélectionné avec succès
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
                        setSelectedTruck(null);
                        setTruckCodeInput('');
                        setSelectedProduct(null);
                        setProductCodeInput('');
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

          {/* Row 2: Filtres Spécifiques au Client (Camions et Produits appartenant au client) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Filtre par Camion */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              selectedCustomer ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-dashed border-slate-200 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <TruckIcon className="h-4 w-4 text-blue-600" />
                  <span>2. Filtrer par Camion (du Client) :</span>
                </label>
                {selectedCustomer && (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                    {clientTrucks.length} camion{clientTrucks.length > 1 ? 's' : ''} trouvé{clientTrucks.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {/* Select Dropdown */}
                <select
                  disabled={!selectedCustomer}
                  value={selectedTruck?.id || ''}
                  onChange={(e) => {
                    const trId = e.target.value;
                    if (!trId) {
                      setSelectedTruck(null);
                      setTruckCodeInput('');
                    } else {
                      const tr = clientTrucks.find(t => t.id === trId);
                      if (tr) {
                        setSelectedTruck(tr);
                        setTruckCodeInput(tr.matricule);
                      }
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">Tous les camions ({clientTrucks.length})</option>
                  {clientTrucks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.matricule} — {t.driverName || 'Chauffeur'}
                    </option>
                  ))}
                </select>

                {/* Quick Matricule Search & Picker Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={!selectedCustomer}
                    value={truckCodeInput}
                    onChange={(e) => handleTruckCodeChange(e.target.value)}
                    placeholder="Matricule rapide..."
                    className="flex-1 font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={!selectedCustomer}
                    onClick={() => setShowTruckPicker(true)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                    title="Choisir parmi les camions du client"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Choisir Camion</span>
                  </button>
                  {selectedTruck && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTruck(null);
                        setTruckCodeInput('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      title="Effacer le filtre camion (Tous les camions)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {selectedTruck && (
                  <div className="flex items-center justify-between text-xs bg-blue-100/80 text-blue-900 px-2.5 py-1 rounded-md font-medium border border-blue-200">
                    <span className="truncate">
                      Filtré sur : <strong>{selectedTruck.matricule}</strong> ({selectedTruck.driverName || 'Chauffeur'})
                    </span>
                    <button
                      onClick={() => { setSelectedTruck(null); setTruckCodeInput(''); }}
                      className="text-blue-700 hover:text-blue-900 font-bold ml-1.5 cursor-pointer hover:underline"
                    >
                      ✕ Tous
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Filtre par Produit */}
            <div className={`p-4 rounded-xl border-2 transition-all ${
              selectedCustomer ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-dashed border-slate-200 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-emerald-600" />
                  <span>3. Filtrer par Produit (du Client) :</span>
                </label>
                {selectedCustomer && (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                    {clientProducts.length} produit{clientProducts.length > 1 ? 's' : ''} trouvé{clientProducts.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {/* Select Dropdown */}
                <select
                  disabled={!selectedCustomer}
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const pId = e.target.value;
                    if (!pId) {
                      setSelectedProduct(null);
                      setProductCodeInput('');
                    } else {
                      const prod = clientProducts.find(p => p.id === pId);
                      if (prod) {
                        setSelectedProduct(prod);
                        setProductCodeInput(prod.code);
                      }
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                >
                  <option value="">Tous les produits ({clientProducts.length})</option>
                  {clientProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>

                {/* Quick Product Code Search & Picker Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={!selectedCustomer}
                    value={productCodeInput}
                    onChange={(e) => handleProductCodeChange(e.target.value)}
                    placeholder="Code produit rapide..."
                    className="flex-1 font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs focus:border-emerald-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <button
                    type="button"
                    disabled={!selectedCustomer}
                    onClick={() => setShowProductPicker(true)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                    title="Choisir parmi les produits du client"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Choisir Produit</span>
                  </button>
                  {selectedProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductCodeInput('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      title="Effacer le filtre produit (Tous les produits)"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {selectedProduct && (
                  <div className="flex items-center justify-between text-xs bg-emerald-100/80 text-emerald-900 px-2.5 py-1 rounded-md font-medium border border-emerald-200">
                    <span className="truncate">
                      Filtré sur : <strong>{selectedProduct.name}</strong> ({selectedProduct.code})
                    </span>
                    <button
                      onClick={() => { setSelectedProduct(null); setProductCodeInput(''); }}
                      className="text-emerald-700 hover:text-emerald-900 font-bold ml-1.5 cursor-pointer hover:underline"
                    >
                      ✕ Tous
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 3: Date Interval & Preset Dropdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Start Date "Du" */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-slate-700 uppercase">4. Du (Date Début) :</span>
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span>Période active : <strong>{formatDateDisplay(startDate)}</strong> au <strong>{formatDateDisplay(endDate)}</strong></span>
              {selectedTruck && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                  Camion : {selectedTruck.matricule}
                </span>
              )}
              {selectedProduct && (
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  Produit : {selectedProduct.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {selectedCustomer && (selectedTruck || selectedProduct) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTruck(null);
                    setTruckCodeInput('');
                    setSelectedProduct(null);
                    setProductCodeInput('');
                  }}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Réinitialiser les Filtres
                </button>
              )}

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
                    <span>Actualiser les Enlèvements</span>
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

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-mono">
            {selectedTruck && (
              <span className="bg-blue-900/80 border border-blue-500/80 text-blue-200 px-2.5 py-1 rounded font-sans font-bold flex items-center gap-1.5">
                <TruckIcon className="h-3.5 w-3.5 text-blue-300" />
                <span>Camion : {selectedTruck.matricule}</span>
              </span>
            )}
            {selectedProduct && (
              <span className="bg-emerald-900/80 border border-emerald-500/80 text-emerald-200 px-2.5 py-1 rounded font-sans font-bold flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-emerald-300" />
                <span>Produit : {selectedProduct.name}</span>
              </span>
            )}
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
                <th className="py-3 px-4 border-b border-slate-700 text-left w-1/5">Matricule</th>
                <th className="py-3 px-4 border-b border-slate-700 text-left w-1/4">Chauffeur</th>
                <th className="py-3 px-4 border-b border-slate-700 text-left w-1/3">Produit(s) Transporté(s)</th>
                <th className="py-3 px-4 border-b border-slate-700 text-center w-28">Nbre Enlèv.</th>
                <th className="py-3 px-4 border-b border-slate-700 text-right w-36">Qtés (T)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {!selectedCustomer ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 bg-slate-50/50">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
                        <TruckIcon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-base">Aucun client sélectionné</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Veuillez sélectionner un client en haut pour afficher la liste des camions et produits ayant effectué le transport pour ce client.
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
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                    <p className="font-bold text-slate-700">
                      Aucun enlèvement trouvé pour le client <span className="text-blue-700 uppercase">"{selectedCustomer.name}"</span>
                      {selectedTruck && <span> avec le camion <strong className="text-blue-800 font-mono">{selectedTruck.matricule}</strong></span>}
                      {selectedProduct && <span> pour le produit <strong className="text-emerald-800">{selectedProduct.name}</strong></span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Aucun enregistrement ne correspond aux filtres appliqués entre le {formatDateDisplay(startDate)} et le {formatDateDisplay(endDate)}.
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

                    {/* Produit(s) Transporté(s) */}
                    <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                      {row.productName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-medium">
                          <Package className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[280px]" title={row.productName}>{row.productName}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Non spécifié</span>
                      )}
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
                  <td colSpan={3} className="py-4 px-4 text-base uppercase tracking-wide text-slate-900 font-black">
                    Total Général ({selectedCustomer.name})
                    {selectedTruck && (
                      <span className="text-blue-700 ml-2 font-mono text-xs font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        Camion: {selectedTruck.matricule}
                      </span>
                    )}
                    {selectedProduct && (
                      <span className="text-emerald-700 ml-2 font-mono text-xs font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        Produit: {selectedProduct.name}
                      </span>
                    )}
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
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <span>Lignes affichées : <strong>{reportData.items.length}</strong></span>
              {selectedTruck && <span>• Filtré par camion : <strong className="text-slate-800">{selectedTruck.matricule}</strong></span>}
              {selectedProduct && <span>• Filtré par produit : <strong className="text-slate-800">{selectedProduct.name}</strong></span>}
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

      {/* Truck Picker Modal (Filtered to client's trucks) */}
      <TruckPickerModal
        isOpen={showTruckPicker}
        onClose={() => setShowTruckPicker(false)}
        onSelect={(truck) => {
          handleSelectTruck(truck);
          setShowTruckPicker(false);
        }}
        trucks={clientTrucks}
        drivers={drivers}
        selectedTruckId={selectedTruck?.id}
        customerName={selectedCustomer?.name}
        customerFavoriteTruckIds={selectedCustomer?.favoriteTruckIds}
        companyName={companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'}
      />

      {/* Product Picker Modal (Filtered to client's products) */}
      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onSelect={(prod) => {
          handleSelectProduct(prod);
          setShowProductPicker(false);
        }}
        products={clientProducts}
        productPrices={productPrices}
        customPrices={selectedCustomer?.customPrices}
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
                    <div>
                      <span className="text-xs font-bold uppercase text-slate-500 mr-2">Client :</span>
                      <span className="text-base font-black text-slate-900 uppercase">
                        {selectedCustomer ? selectedCustomer.name : 'TOUS LES CLIENTS'}
                      </span>
                    </div>
                    {selectedTruck && (
                      <div className="text-xs text-blue-800 font-bold mt-1">
                        Filtre Camion : {selectedTruck.matricule} ({selectedTruck.driverName || 'Chauffeur'})
                      </div>
                    )}
                    {selectedProduct && (
                      <div className="text-xs text-emerald-800 font-bold mt-0.5">
                        Filtre Produit : {selectedProduct.code} - {selectedProduct.name}
                      </div>
                    )}
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
                      <th className="p-2 text-left border border-slate-400">Produit(s)</th>
                      <th className="p-2 text-center border border-slate-400">Nbre Enlèv.</th>
                      <th className="p-2 text-right border border-slate-400">Quantité (T)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2 font-mono font-bold border border-slate-300">{item.matricule}</td>
                        <td className="p-2 font-semibold uppercase border border-slate-300">{item.driverName}</td>
                        <td className="p-2 font-medium text-emerald-800 border border-slate-300">{item.productName || '-'}</td>
                        <td className="p-2 text-center font-mono font-bold border border-slate-300">{item.deliveryCount}</td>
                        <td className="p-2 text-right font-mono font-bold text-blue-700 border border-slate-300">
                          {item.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-800 text-sm">
                      <td colSpan={3} className="p-2 uppercase">Total Général</td>
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
