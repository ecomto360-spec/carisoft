import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { Customer, Truck, Product, DeliveryNote, DeliveryNoteItem } from '../../types';
import { TruckPickerModal } from '../deliveries/TruckPickerModal';
import { ClientPickerModal } from '../deliveries/ClientPickerModal';
import { ProductPickerModal } from '../deliveries/ProductPickerModal';
import { executePrintProductReport, ProductDeliveryRow, ProductDeliveryItemDetail } from '../../lib/printProductReport';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import * as XLSX from 'xlsx';
import { 
  Package, Printer, Search, Calendar, 
  ArrowLeft, FileText, CheckCircle2, 
  AlertCircle, Users, Truck as TruckIcon, 
  Download, BarChart3, ChevronDown, ChevronRight,
  Layers, Filter, RotateCcw, Scale, Building2
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

export function ProductDeliveriesReport() {
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

  // Date State - Default to current year
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfYear = `${new Date().getFullYear()}-01-01`;
  const [startDate, setStartDate] = useState<string>(firstDayOfYear);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('current_year');

  // Filters State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productCodeInput, setProductCodeInput] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);

  // Modals State
  const [showProductPicker, setShowProductPicker] = useState<boolean>(false);
  const [showClientPicker, setShowClientPicker] = useState<boolean>(false);
  const [showTruckPicker, setShowTruckPicker] = useState<boolean>(false);

  // Active View Tab: 'summary' (Synthèse par Produit) | 'details' (Détail BLs)
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

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
        const past7 = new Date(y, m, d - 6);
        setStartDate(formatISO(past7));
        setEndDate(formatISO(now));
        break;
      }
      case 'previous_week': {
        const currentDay = now.getDay();
        const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const prevMonday = new Date(y, m, d + diffToMonday - 7);
        const prevSunday = new Date(y, m, d + diffToMonday - 1);
        setStartDate(formatISO(prevMonday));
        setEndDate(formatISO(prevSunday));
        break;
      }
      case 'current_month': {
        const firstDay = new Date(y, m, 1);
        setStartDate(formatISO(firstDay));
        setEndDate(formatISO(now));
        break;
      }
      case 'floating_month': {
        const past30 = new Date(y, m, d - 29);
        setStartDate(formatISO(past30));
        setEndDate(formatISO(now));
        break;
      }
      case 'previous_month': {
        const firstPrev = new Date(y, m - 1, 1);
        const lastPrev = new Date(y, m, 0);
        setStartDate(formatISO(firstPrev));
        setEndDate(formatISO(lastPrev));
        break;
      }
      case 'current_year': {
        const firstYear = new Date(y, 0, 1);
        setStartDate(formatISO(firstYear));
        setEndDate(formatISO(now));
        break;
      }
      case 'floating_year': {
        const past365 = new Date(y - 1, m, d);
        setStartDate(formatISO(past365));
        setEndDate(formatISO(now));
        break;
      }
      case 'previous_year': {
        const firstPrevYear = new Date(y - 1, 0, 1);
        const lastPrevYear = new Date(y - 1, 11, 31);
        setStartDate(formatISO(firstPrevYear));
        setEndDate(formatISO(lastPrevYear));
        break;
      }
      default:
        break;
    }
  };

  // Auto-match product on code input
  const handleProductCodeChange = (code: string) => {
    setProductCodeInput(code);
    const found = products.find(p => p.code.toLowerCase() === code.trim().toLowerCase());
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

  // Toggle row expand for a product
  const toggleProductExpand = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Filter Delivery Notes and Items
  const filteredData = useMemo(() => {
    const custMap = new Map<string, Customer>();
    customers.forEach(c => custMap.set(c.id, c));

    const prodMap = new Map<string, Product>();
    products.forEach(p => prodMap.set(p.id, p));

    const truckMap = new Map<string, Truck>();
    trucks.forEach(t => truckMap.set(t.id, t));

    // 1. Filter Delivery Notes
    const validNotes = deliveryNotes.filter(dn => {
      if (dn.status === 'cancelled') return false;
      const dnDate = dn.date.split('T')[0];
      if (dnDate < startDate || dnDate > endDate) return false;
      if (selectedCustomer && dn.customerId !== selectedCustomer.id) return false;
      if (selectedTruck && dn.truckId !== selectedTruck.id) return false;
      return true;
    });

    const validNoteIds = new Set(validNotes.map(n => n.id));
    const validNoteMap = new Map(validNotes.map(n => [n.id, n]));

    // 2. Filter Delivery Note Items
    const relevantItems: {
      item: DeliveryNoteItem;
      dn: DeliveryNote;
      product: Product;
      customer: Customer | undefined;
    }[] = [];

    deliveryNoteItems.forEach(item => {
      if (!validNoteIds.has(item.deliveryNoteId)) return;
      if (selectedProduct && item.productId !== selectedProduct.id) return;

      const dn = validNoteMap.get(item.deliveryNoteId);
      if (!dn) return;

      const product = prodMap.get(item.productId) || {
        id: item.productId,
        code: 'PROD',
        name: 'Produit Inconnu',
        unit: 'Tonne',
        familyId: '',
        tva: 19,
        stock: 0,
        minStock: 0,
        active: true
      };

      const customer = custMap.get(dn.customerId);

      relevantItems.push({
        item,
        dn,
        product,
        customer
      });
    });

    // 3. Aggregate by Product for Summary View
    const productAggregates = new Map<string, {
      product: Product;
      deliveryCount: number;
      totalQuantity: number;
      totalHT: number;
      totalTVA: number;
      totalTTC: number;
      details: ProductDeliveryItemDetail[];
    }>();

    const detailRows: ProductDeliveryItemDetail[] = [];

    relevantItems.forEach(({ item, dn, product, customer }) => {
      const q = item.quantity || (dn.netWeight ? dn.netWeight / 1000 : 0);
      const priceHT = item.priceHT || 0;
      const totalHT = item.totalHT || (q * priceHT);
      const totalTVA = totalHT * 0.19;
      const totalTTC = totalHT + totalTVA;

      const truck = truckMap.get(dn.truckId);
      const driver = drivers.find(d => d.id === dn.driverId);
      const driverName = driver?.name || truck?.driverName || '';

      const detail: ProductDeliveryItemDetail = {
        blNumber: dn.number,
        date: dn.date.split('T')[0],
        time: dn.time || dn.date.split('T')[1]?.substring(0, 5) || '',
        customerCode: customer?.code,
        customerName: customer?.name || 'Client Inconnu',
        truckMatricule: truck?.matricule || 'CAMION',
        driverName: driverName,
        productCode: product.code,
        productName: product.name,
        productUnit: product.unit || 'Tonne',
        tare: dn.tare || 0,
        grossWeight: dn.grossWeight || 0,
        netWeight: dn.netWeight ? dn.netWeight / 1000 : q,
        priceHT,
        totalHT,
        totalTTC
      };

      detailRows.push(detail);

      const current = productAggregates.get(product.id) || {
        product,
        deliveryCount: 0,
        totalQuantity: 0,
        totalHT: 0,
        totalTVA: 0,
        totalTTC: 0,
        details: []
      };

      current.deliveryCount += 1;
      current.totalQuantity += q;
      current.totalHT += totalHT;
      current.totalTVA += totalTVA;
      current.totalTTC += totalTTC;
      current.details.push(detail);

      productAggregates.set(product.id, current);
    });

    // Sort detail rows by date desc
    detailRows.sort((a, b) => b.date.localeCompare(a.date) || b.blNumber.localeCompare(a.blNumber));

    // Summary Rows
    const summaryRows: ProductDeliveryRow[] = [];
    productAggregates.forEach(agg => {
      const avgPrice = agg.totalQuantity > 0 ? agg.totalHT / agg.totalQuantity : 0;
      summaryRows.push({
        productId: agg.product.id,
        productCode: agg.product.code,
        productName: agg.product.name,
        productUnit: agg.product.unit || 'Tonne',
        deliveryCount: agg.deliveryCount,
        totalQuantity: agg.totalQuantity,
        avgPriceHT: avgPrice,
        totalHT: agg.totalHT,
        totalTVA: agg.totalTVA,
        totalTTC: agg.totalTTC
      });
    });

    // Sort summary by Total Quantity desc
    summaryRows.sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Totals
    const totals = summaryRows.reduce((acc, r) => {
      acc.totalDeliveries += r.deliveryCount;
      acc.totalQuantity += r.totalQuantity;
      acc.totalHT += r.totalHT;
      acc.totalTVA += r.totalTVA;
      acc.totalTTC += r.totalTTC;
      return acc;
    }, {
      totalDeliveries: 0,
      totalQuantity: 0,
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0
    });

    return {
      summaryRows,
      detailRows,
      totals,
      productAggregates
    };
  }, [customers, products, trucks, deliveryNotes, deliveryNoteItems, startDate, endDate, selectedProduct, selectedCustomer, selectedTruck]);

  // Filtered rows for table search query
  const filteredSummaryRows = useMemo(() => {
    if (!tableSearch.trim()) return filteredData.summaryRows;
    const q = tableSearch.toLowerCase().trim();
    return filteredData.summaryRows.filter(r =>
      r.productName.toLowerCase().includes(q) ||
      r.productCode.toLowerCase().includes(q)
    );
  }, [filteredData.summaryRows, tableSearch]);

  const filteredDetailRows = useMemo(() => {
    if (!tableSearch.trim()) return filteredData.detailRows;
    const q = tableSearch.toLowerCase().trim();
    return filteredData.detailRows.filter(d =>
      d.blNumber.toLowerCase().includes(q) ||
      d.customerName.toLowerCase().includes(q) ||
      d.truckMatricule.toLowerCase().includes(q) ||
      d.productName.toLowerCase().includes(q) ||
      d.productCode.toLowerCase().includes(q)
    );
  }, [filteredData.detailRows, tableSearch]);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Synthèse
    const summaryExportData = filteredData.summaryRows.map((r, idx) => ({
      'N°': idx + 1,
      'Code Produit': r.productCode,
      'Désignation': r.productName,
      'Unité': r.productUnit,
      'Nombre de Voyages': r.deliveryCount,
      'Quantité Totale (T / m³)': r.totalQuantity,
      'Prix Moyen HT (DA)': r.avgPriceHT,
      'Montant HT (DA)': r.totalHT,
      'TVA 19% (DA)': r.totalTVA,
      'Total TTC (DA)': r.totalTTC,
    }));

    summaryExportData.push({
      'N°': 0,
      'Code Produit': 'TOTAL',
      'Désignation': 'TOTAL GÉNÉRAL',
      'Unité': 'T',
      'Nombre de Voyages': filteredData.totals.totalDeliveries,
      'Quantité Totale (T / m³)': filteredData.totals.totalQuantity,
      'Prix Moyen HT (DA)': 0,
      'Montant HT (DA)': filteredData.totals.totalHT,
      'TVA 19% (DA)': filteredData.totals.totalTVA,
      'Total TTC (DA)': filteredData.totals.totalTTC,
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryExportData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Synthese_Produits');

    // Sheet 2: Détail Rotations
    const detailExportData = filteredData.detailRows.map((d, idx) => ({
      'N°': idx + 1,
      'N° BL': d.blNumber,
      'Date': formatDate(d.date),
      'Heure': d.time,
      'Client': d.customerName,
      'Camion': d.truckMatricule,
      'Chauffeur': d.driverName || '',
      'Code Produit': d.productCode,
      'Désignation': d.productName,
      'Tare (T)': d.tare / 1000,
      'Poids Brut (T)': d.grossWeight / 1000,
      'Poids Net (T)': d.netWeight,
      'Prix HT (DA)': d.priceHT,
      'Montant HT (DA)': d.totalHT,
      'Montant TTC (DA)': d.totalTTC,
    }));

    const wsDetail = XLSX.utils.json_to_sheet(detailExportData);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail_Rotations');

    XLSX.writeFile(wb, `Rapport_Enlevements_Produits_${startDate}_au_${endDate}.xlsx`);
  };

  // Print Official Product Report
  const handlePrint = () => {
    executePrintProductReport({
      company: {
        name: companySettings?.name || 'SARL MAHAJIR SIDAR',
        activity: companySettings?.activity || 'Exploitation de Carrière & Vente d\'Agrégats',
        address: companySettings?.address || 'Zone Industrielle',
        city: companySettings?.city || '',
        wilaya: companySettings?.wilaya || '',
        rc: companySettings?.rc || '',
        nif: companySettings?.nif || '',
        nis: companySettings?.nis || '',
        article: companySettings?.article || '',
        phone: companySettings?.phone || '',
        email: companySettings?.email || ''
      },
      productFilterName: selectedProduct ? `${selectedProduct.name} (${selectedProduct.code})` : 'Tous les Produits',
      clientFilterName: selectedCustomer ? selectedCustomer.name : 'Tous les Clients',
      truckFilterName: selectedTruck ? selectedTruck.matricule : 'Tous les Camions',
      periodLabel: `Du ${formatDate(startDate)} au ${formatDate(endDate)}`,
      startDate,
      endDate,
      generationDate: new Date().toLocaleDateString('fr-DZ'),
      summaryRows: filteredData.summaryRows,
      detailRows: filteredData.detailRows,
      totals: filteredData.totals
    });
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-blue-600" />
              Enlèvements par Produit & Agrégat
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-800 rounded-full border border-blue-200">
              Extraction & Ventes
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Bilan récapitulatif des tonnages extraits, rotations de camions et chiffre d'affaires par produit.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-xl hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Exporter Excel (.xlsx)</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimer le Rapport</span>
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
          onClick={() => navigate('/reports/truck-deliveries')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
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
          className="px-5 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2 bg-blue-50/40 rounded-t-lg cursor-pointer"
        >
          <Package className="h-4 w-4 text-blue-600" /> Enlèvements / Produit
        </button>
        <button
          onClick={() => navigate('/reports/periodic-deliveries')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <FileText className="h-4 w-4" /> Rapport Périodique
        </button>
      </div>

      {/* Main Filter & Selection Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" />
            Critères de Filtrage & Période d'Analyse
          </h2>
          {(selectedProduct || selectedCustomer || selectedTruck) && (
            <button
              onClick={() => {
                setSelectedProduct(null);
                setProductCodeInput('');
                setSelectedCustomer(null);
                setSelectedTruck(null);
              }}
              className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Row 1: Fast Presets */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight block mb-1.5">
            Sélection Rapide de Période :
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: "Aujourd'hui" },
              { id: 'yesterday', label: 'Hier' },
              { id: 'current_week', label: 'Semaine en cours' },
              { id: 'floating_week', label: 'Semaine glissante (7j)' },
              { id: 'current_month', label: 'Mois en cours' },
              { id: 'previous_month', label: 'Mois précédent' },
              { id: 'current_year', label: 'Exercice / Année en cours' },
              { id: 'previous_year', label: 'Année précédente' },
              { id: 'custom', label: 'Période libre' }
            ].map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetChange(preset.id as PresetPeriod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedPreset === preset.id
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Dates & Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {/* Date Début */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Date Début (JJ/MM/AAAA)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset('custom');
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Date Fin */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Date Fin (JJ/MM/AAAA)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset('custom');
              }}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Produit Selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Package className="h-3.5 w-3.5 text-blue-600" />
                Produit / Agrégat
              </label>
              {selectedProduct && (
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductCodeInput('');
                  }}
                  className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Tous
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Code (ex: 0/4)"
                value={productCodeInput}
                onChange={(e) => handleProductCodeChange(e.target.value)}
                className="w-20 px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowProductPicker(true)}
                className="flex-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-left truncate cursor-pointer"
              >
                {selectedProduct ? `${selectedProduct.name}` : 'Tous les produits (F4)'}
              </button>
            </div>
          </div>

          {/* Client Filter (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                Filtre Client (Optionnel)
              </label>
              {selectedCustomer && (
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Tous
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowClientPicker(true)}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 text-left truncate cursor-pointer"
            >
              {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.code})` : 'Tous les clients'}
            </button>
          </div>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tonnage */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tonnage Total Extrait</p>
            <p className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {filteredData.totals.totalQuantity.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-bold text-slate-400">T</span>
            </p>
          </div>
        </div>

        {/* Voyages */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <TruckIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre de Voyages</p>
            <p className="text-2xl font-black text-slate-900 font-mono mt-0.5">
              {filteredData.totals.totalDeliveries} <span className="text-sm font-bold text-slate-400">B.L</span>
            </p>
          </div>
        </div>

        {/* CA HT */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chiffre d'Affaires HT</p>
            <p className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5 text-emerald-800">
              {formatCurrency(filteredData.totals.totalHT)}
            </p>
          </div>
        </div>

        {/* CA TTC */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-900 text-white rounded-xl">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Montant Total TTC</p>
            <p className="text-xl sm:text-2xl font-black text-blue-950 font-mono mt-0.5">
              {formatCurrency(filteredData.totals.totalTTC)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Results Table Section with Sub-Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        
        {/* Table Top Controls & Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'summary'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Synthèse par Produit ({filteredData.summaryRows.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Détail des Rotations BL ({filteredData.detailRows.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher produit, client, BL..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* TAB 1: SYNTHÈSE PAR PRODUIT */}
        {activeTab === 'summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-tight">
                  <th className="p-3 w-10 text-center">N°</th>
                  <th className="p-3 w-24">Code</th>
                  <th className="p-3">Désignation de l'Agrégat</th>
                  <th className="p-3 text-center w-20">Unité</th>
                  <th className="p-3 text-center w-24">Voyages</th>
                  <th className="p-3 text-right w-32">Quantité Totale</th>
                  <th className="p-3 text-right w-28">Prix Moyen HT</th>
                  <th className="p-3 text-right w-32">Montant HT</th>
                  <th className="p-3 text-right w-28">TVA 19%</th>
                  <th className="p-3 text-right w-32">Total TTC</th>
                  <th className="p-3 text-center w-16">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredSummaryRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-semibold">
                      Aucun enlèvement trouvé pour les critères sélectionnés.
                    </td>
                  </tr>
                ) : (
                  filteredSummaryRows.map((row, idx) => {
                    const isExpanded = expandedProducts.has(row.productId);
                    const aggData = filteredData.productAggregates.get(row.productId);

                    return (
                      <React.Fragment key={row.productId}>
                        <tr className={`hover:bg-blue-50/40 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                          <td className="p-3 text-center font-bold text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-3">
                            <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                              {row.productCode}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 text-xs sm:text-[13px]">
                              {row.productName}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {row.productUnit}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-800">
                            {row.deliveryCount}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-slate-950 text-[13px]">
                            {row.totalQuantity.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-700">
                            {formatCurrency(row.avgPriceHT)}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(row.totalHT)}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-700">
                            {formatCurrency(row.totalTVA)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-blue-950 text-[13px]">
                            {formatCurrency(row.totalTTC)}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => toggleProductExpand(row.productId)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                            >
                              {isExpanded ? 'Fermer' : 'Voir BLs'}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable row with individual rotations */}
                        {isExpanded && aggData && aggData.details.length > 0 && (
                          <tr className="bg-slate-50/90 border-y border-blue-100">
                            <td colSpan={11} className="p-4 pl-10">
                              <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                                    <span>Rotations du produit : {row.productName} ({aggData.details.length} BLs)</span>
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    Sous-total : <strong>{row.totalQuantity.toFixed(2)} T</strong> ({formatCurrency(row.totalTTC)} TTC)
                                  </span>
                                </div>

                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="text-[10px] font-bold uppercase text-slate-500 border-b border-slate-100 pb-1">
                                      <th className="py-1">N° BL</th>
                                      <th className="py-1">Date</th>
                                      <th className="py-1">Client</th>
                                      <th className="py-1">Camion</th>
                                      <th className="py-1 text-right">Tare (T)</th>
                                      <th className="py-1 text-right">Brut (T)</th>
                                      <th className="py-1 text-right">Net (T)</th>
                                      <th className="py-1 text-right">Prix HT</th>
                                      <th className="py-1 text-right">Total HT</th>
                                      <th className="py-1 text-right">Total TTC</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                    {aggData.details.map((d, dIdx) => (
                                      <tr key={d.blNumber || dIdx} className="hover:bg-slate-50">
                                        <td className="py-1 font-bold text-blue-900">{d.blNumber}</td>
                                        <td className="py-1 text-slate-600">{formatDate(d.date)}</td>
                                        <td className="py-1 font-sans font-bold text-slate-800">{d.customerName}</td>
                                        <td className="py-1 text-slate-700">{d.truckMatricule}</td>
                                        <td className="py-1 text-right text-slate-500">{(d.tare / 1000).toFixed(2)}</td>
                                        <td className="py-1 text-right text-slate-500">{(d.grossWeight / 1000).toFixed(2)}</td>
                                        <td className="py-1 text-right font-bold text-slate-900">{d.netWeight.toFixed(2)}</td>
                                        <td className="py-1 text-right text-slate-600">{formatCurrency(d.priceHT)}</td>
                                        <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(d.totalHT)}</td>
                                        <td className="py-1 text-right font-bold text-blue-950">{formatCurrency(d.totalTTC)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td colSpan={4} className="p-3 text-right uppercase text-slate-700 text-xs">
                    TOTAL GÉNÉRAL :
                  </td>
                  <td className="p-3 text-center font-mono font-black text-slate-900">
                    {filteredData.totals.totalDeliveries}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-slate-950 text-sm">
                    {filteredData.totals.totalQuantity.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T
                  </td>
                  <td className="p-3 text-right font-mono text-slate-400">-</td>
                  <td className="p-3 text-right font-mono font-black text-slate-900">
                    {formatCurrency(filteredData.totals.totalHT)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700">
                    {formatCurrency(filteredData.totals.totalTVA)}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-blue-950 text-sm">
                    {formatCurrency(filteredData.totals.totalTTC)}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* TAB 2: DÉTAIL DES BONS DE LIVRAISON */}
        {activeTab === 'details' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-tight">
                  <th className="p-3 w-10 text-center">N°</th>
                  <th className="p-3 w-24">N° BL</th>
                  <th className="p-3 w-24">Date</th>
                  <th className="p-3">Client</th>
                  <th className="p-3 w-28">Camion</th>
                  <th className="p-3">Produit</th>
                  <th className="p-3 text-right w-20">Tare (T)</th>
                  <th className="p-3 text-right w-20">Brut (T)</th>
                  <th className="p-3 text-right w-24">Net (T)</th>
                  <th className="p-3 text-right w-24">Prix HT</th>
                  <th className="p-3 text-right w-28">Total HT</th>
                  <th className="p-3 text-right w-28">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 font-mono">
                {filteredDetailRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400 font-sans font-semibold">
                      Aucune rotation trouvée pour ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredDetailRows.map((d, idx) => (
                    <tr key={d.blNumber || idx} className="hover:bg-blue-50/40">
                      <td className="p-3 text-center text-slate-500 font-bold">{idx + 1}</td>
                      <td className="p-3 font-bold text-blue-900">{d.blNumber}</td>
                      <td className="p-3 text-slate-600">{formatDate(d.date)}</td>
                      <td className="p-3 font-sans font-bold text-slate-900">{d.customerName}</td>
                      <td className="p-3 text-slate-700">{d.truckMatricule}</td>
                      <td className="p-3 font-sans font-semibold text-slate-800">{d.productName}</td>
                      <td className="p-3 text-right text-slate-500">{(d.tare / 1000).toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-500">{(d.grossWeight / 1000).toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-slate-950 text-xs">{d.netWeight.toFixed(2)}</td>
                      <td className="p-3 text-right text-slate-600">{formatCurrency(d.priceHT)}</td>
                      <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(d.totalHT)}</td>
                      <td className="p-3 text-right font-black text-blue-950">{formatCurrency(d.totalTTC)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Product Picker Modal */}
      {showProductPicker && (
        <ProductPickerModal
          isOpen={showProductPicker}
          onClose={() => setShowProductPicker(false)}
          onSelect={(prod) => handleSelectProduct(prod)}
          products={products}
          productPrices={productPrices}
        />
      )}

      {/* Client Picker Modal */}
      {showClientPicker && (
        <ClientPickerModal
          isOpen={showClientPicker}
          onClose={() => setShowClientPicker(false)}
          onSelect={(cust) => setSelectedCustomer(cust)}
          customers={customers}
        />
      )}

      {/* Truck Picker Modal */}
      {showTruckPicker && (
        <TruckPickerModal
          isOpen={showTruckPicker}
          onClose={() => setShowTruckPicker(false)}
          onSelect={(trk) => setSelectedTruck(trk)}
          trucks={trucks}
          drivers={drivers}
        />
      )}
    </div>
  );
}
