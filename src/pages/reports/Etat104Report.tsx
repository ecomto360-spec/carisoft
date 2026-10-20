import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency, formatDate } from '../../lib/utils';
import { executePrintEtat104, Etat104ClientRow } from '../../lib/printEtat104';
import * as XLSX from 'xlsx';
import {
  FileText, Printer, ArrowLeft, Search, Filter, Download,
  CheckCircle2, AlertTriangle, Building2, Calendar, ChevronDown,
  ChevronRight, Users, ExternalLink, RefreshCw, BarChart3, Truck, ShieldAlert,
  Edit3, Package
} from 'lucide-react';
import { ClientForm } from '../clients/ClientForm';

type SourceBasis = 'invoices' | 'deliveries' | 'all';
type FiscalFilter = 'all' | 'complete' | 'missing_nif';

export function Etat104Report() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';
  const navigate = useNavigate();

  // Current year default
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [periodPreset, setPeriodPreset] = useState<string>('year');
  const [startDate, setStartDate] = useState<string>(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${currentYear}-12-31`);
  const [sourceBasis, setSourceBasis] = useState<SourceBasis>('invoices');
  const [fiscalFilter, setFiscalFilter] = useState<FiscalFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Edit client modal
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // Queries
  const customers = useLiveQuery(() => 
    db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()
  ) || [];
  
  const invoices = useLiveQuery(() => 
    db.invoices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()
  ) || [];

  const deliveryNotes = useLiveQuery(() => 
    db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()
  ) || [];

  const companySettings = useLiveQuery(() => db.settings.get(1));

  // Quick Preset Change Handlers
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setPeriodPreset('year');
    setStartDate(`${year}-01-01`);
    setEndDate(`${year}-12-31`);
  };

  const handleQuarterChange = (q: 'T1' | 'T2' | 'T3' | 'T4') => {
    setPeriodPreset(q);
    const yr = selectedYear;
    if (q === 'T1') {
      setStartDate(`${yr}-01-01`);
      setEndDate(`${yr}-03-31`);
    } else if (q === 'T2') {
      setStartDate(`${yr}-04-01`);
      setEndDate(`${yr}-06-30`);
    } else if (q === 'T3') {
      setStartDate(`${yr}-07-01`);
      setEndDate(`${yr}-09-30`);
    } else if (q === 'T4') {
      setStartDate(`${yr}-10-01`);
      setEndDate(`${yr}-12-31`);
    }
  };

  // Toggle Client Expansion
  const toggleClientExpand = (customerId: string) => {
    const next = new Set(expandedClients);
    if (next.has(customerId)) {
      next.delete(customerId);
    } else {
      next.add(customerId);
    }
    setExpandedClients(next);
  };

  const expandAll = () => {
    setExpandedClients(new Set(reportRows.map(r => r.customerId)));
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
  };

  // Aggregate Data for État 104
  const reportRows: Etat104ClientRow[] = useMemo(() => {
    if (!customers) return [];

    const customerMap = new Map(customers.map(c => [c.id, c]));
    const clientAggregates: Map<string, {
      totalHT: number;
      totalTVA: number;
      totalTimbre: number;
      totalTTC: number;
      invoices: any[];
    }> = new Map();

    // 1. Process Invoices (Official Billing Basis)
    if (sourceBasis === 'invoices' || sourceBasis === 'all') {
      invoices.forEach(inv => {
        if (inv.status === 'cancelled') return;
        const invDate = inv.date.split('T')[0];
        if (invDate < startDate || invDate > endDate) return;

        const custId = inv.customerId;
        if (!custId) return;

        const current = clientAggregates.get(custId) || {
          totalHT: 0,
          totalTVA: 0,
          totalTimbre: 0,
          totalTTC: 0,
          invoices: []
        };

        const isAvoir = inv.type === 'avoir';
        const multiplier = isAvoir ? -1 : 1;

        current.totalHT += (inv.totalHT || 0) * multiplier;
        current.totalTVA += (inv.totalTVA || 0) * multiplier;
        current.totalTimbre += (inv.timbre || 0) * multiplier;
        current.totalTTC += (inv.totalTTC || 0) * multiplier;
        current.invoices.push({
          id: inv.id,
          number: inv.number,
          date: inv.date.split('T')[0],
          totalHT: (inv.totalHT || 0) * multiplier,
          totalTVA: (inv.totalTVA || 0) * multiplier,
          timbre: (inv.timbre || 0) * multiplier,
          totalTTC: (inv.totalTTC || 0) * multiplier,
          paymentMode: inv.paymentMode || 'especes',
          status: inv.status,
          type: inv.type || 'standard'
        });

        clientAggregates.set(custId, current);
      });
    }

    // 2. Process Delivery Notes (BLs Basis if requested)
    if (sourceBasis === 'deliveries') {
      deliveryNotes.forEach(bl => {
        if (bl.status === 'cancelled') return;
        const blDate = bl.date.split('T')[0];
        if (blDate < startDate || blDate > endDate) return;

        const custId = bl.customerId;
        if (!custId) return;

        const current = clientAggregates.get(custId) || {
          totalHT: 0,
          totalTVA: 0,
          totalTimbre: 0,
          totalTTC: 0,
          invoices: []
        };

        current.totalHT += (bl.totalHT || 0);
        current.totalTVA += (bl.totalTVA || 0);
        current.totalTTC += (bl.totalTTC || 0);
        current.invoices.push({
          id: bl.id,
          number: bl.number,
          date: bl.date.split('T')[0],
          totalHT: bl.totalHT || 0,
          totalTVA: bl.totalTVA || 0,
          timbre: 0,
          totalTTC: bl.totalTTC || 0,
          paymentMode: 'BL Livré',
          status: bl.status,
          type: 'BL'
        });

        clientAggregates.set(custId, current);
      });
    }

    // Build raw list of rows
    const rows: Etat104ClientRow[] = [];
    let order = 1;

    clientAggregates.forEach((agg, custId) => {
      const cust = customerMap.get(custId);
      if (!cust) return;

      // Filter out zero CA if any
      if (Math.abs(agg.totalHT) < 0.01 && Math.abs(agg.totalTTC) < 0.01) return;

      const nifClean = cust.nif ? cust.nif.trim() : '';
      const rcClean = cust.rc ? cust.rc.trim() : '';
      const nisClean = cust.nis ? cust.nis.trim() : '';
      const artClean = cust.article ? cust.article.trim() : '';

      // Fiscal completeness filter
      const isMissingFiscal = !nifClean || !rcClean;
      if (fiscalFilter === 'complete' && isMissingFiscal) return;
      if (fiscalFilter === 'missing_nif' && !isMissingFiscal) return;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          cust.name.toLowerCase().includes(q) ||
          cust.code.toLowerCase().includes(q) ||
          (cust.nif && cust.nif.toLowerCase().includes(q)) ||
          (cust.rc && cust.rc.toLowerCase().includes(q)) ||
          (cust.article && cust.article.toLowerCase().includes(q)) ||
          (cust.wilaya && cust.wilaya.toLowerCase().includes(q)) ||
          (cust.city && cust.city.toLowerCase().includes(q));
        if (!matches) return;
      }

      // Sort invoices by date desc
      agg.invoices.sort((a, b) => b.date.localeCompare(a.date));

      rows.push({
        orderNumber: order++,
        customerId: cust.id,
        customerCode: cust.code,
        customerName: cust.name,
        activity: cust.activityName || cust.type,
        address: cust.address,
        city: cust.city,
        wilaya: cust.wilaya,
        rc: rcClean,
        nif: nifClean,
        nis: nisClean,
        article: artClean,
        phone: cust.phone || cust.mobile,
        invoiceCount: agg.invoices.length,
        totalHT: agg.totalHT,
        totalTVA: agg.totalTVA,
        totalTimbre: agg.totalTimbre,
        totalTTC: agg.totalTTC,
        invoices: agg.invoices
      });
    });

    // Sort by Total HT descending (Largest clients first)
    return rows.sort((a, b) => b.totalHT - a.totalHT);
  }, [customers, invoices, deliveryNotes, startDate, endDate, sourceBasis, fiscalFilter, searchQuery]);

  // General Totals
  const totals = useMemo(() => {
    return reportRows.reduce(
      (acc, r) => {
        acc.totalHT += r.totalHT;
        acc.totalTVA += r.totalTVA;
        acc.totalTimbre += r.totalTimbre;
        acc.totalTTC += r.totalTTC;
        acc.totalInvoices += r.invoiceCount;
        if (!r.nif || !r.rc) {
          acc.missingFiscalCount += 1;
        }
        return acc;
      },
      {
        totalHT: 0,
        totalTVA: 0,
        totalTimbre: 0,
        totalTTC: 0,
        totalInvoices: 0,
        missingFiscalCount: 0,
        clientCount: reportRows.length
      }
    );
  }, [reportRows]);

  // Export to Excel
  const handleExportExcel = () => {
    const dataForExport = reportRows.map((r, idx) => ({
      'N° Ordre': idx + 1,
      'Code Client': r.customerCode,
      'Raison Sociale / Nom': r.customerName,
      'N.I.F': r.nif || '',
      'N.I.S': r.nis || '',
      'R.C': r.rc || '',
      'Article d\'Imposition (AI)': r.article || '',
      'Activité': r.activity || '',
      'Adresse': r.address || '',
      'Ville': r.city || '',
      'Wilaya': r.wilaya || '',
      'Nbre Factures': r.invoiceCount,
      'Chiffre d\'Affaires HT (DA)': r.totalHT,
      'TVA 19% (DA)': r.totalTVA,
      'Droit de Timbre (DA)': r.totalTimbre,
      'Total TTC (DA)': r.totalTTC
    }));

    // Add Totals row
    dataForExport.push({
      'N° Ordre': '' as any,
      'Code Client': '',
      'Raison Sociale / Nom': 'TOTAUX GÉNÉRAUX',
      'N.I.F': '',
      'N.I.S': '',
      'R.C': '',
      'Article d\'Imposition (AI)': '',
      'Activité': '',
      'Adresse': '',
      'Ville': '',
      'Wilaya': '',
      'Nbre Factures': totals.totalInvoices,
      'Chiffre d\'Affaires HT (DA)': totals.totalHT,
      'TVA 19% (DA)': totals.totalTVA,
      'Droit de Timbre (DA)': totals.totalTimbre,
      'Total TTC (DA)': totals.totalTTC
    });

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    ws['!cols'] = [
      { wch: 8 },  // N°
      { wch: 12 }, // Code
      { wch: 32 }, // Raison Sociale
      { wch: 18 }, // NIF
      { wch: 16 }, // NIS
      { wch: 16 }, // RC
      { wch: 16 }, // AI
      { wch: 18 }, // Activite
      { wch: 25 }, // Adresse
      { wch: 14 }, // Ville
      { wch: 14 }, // Wilaya
      { wch: 12 }, // Factures
      { wch: 18 }, // HT
      { wch: 16 }, // TVA
      { wch: 14 }, // Timbre
      { wch: 20 }, // TTC
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Etat_104_${selectedYear}`);
    XLSX.writeFile(wb, `Etat_104_Fiscal_Clients_${selectedYear}_${startDate}_au_${endDate}.xlsx`);
  };

  // Print Official État 104
  const handlePrint = () => {
    executePrintEtat104({
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
      fiscalYear: selectedYear,
      periodLabel: periodPreset === 'year' ? `Exercice ${selectedYear}` : `${periodPreset} ${selectedYear} (du ${startDate} au ${endDate})`,
      startDate,
      endDate,
      generationDate: new Date().toLocaleDateString('fr-DZ'),
      basisLabel: sourceBasis === 'invoices' ? 'Facturation Officielle Validée' : sourceBasis === 'deliveries' ? 'Bons de Livraison Réalisés' : 'Factures & BLs',
      rows: reportRows,
      totals: {
        totalHT: totals.totalHT,
        totalTVA: totals.totalTVA,
        totalTimbre: totals.totalTimbre,
        totalTTC: totals.totalTTC,
        totalInvoices: totals.totalInvoices,
        clientCount: totals.clientCount
      }
    });
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              État 104 — Déclaration Fiscale & Chiffre d'Affaires
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 text-blue-800 rounded-full border border-blue-200">
              DGI Art. 224
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Relevé récapitulatif annuel des clients pour le comptable, la liasse fiscale et la déclaration aux impôts.
          </p>
        </div>

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
            <span>Imprimer l'État 104 Officiel</span>
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
          className="px-5 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2 bg-blue-50/40 rounded-t-lg cursor-pointer"
        >
          <FileText className="h-4 w-4" /> État 104 (Fiscal & Impôts)
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
          <Truck className="h-4 w-4" /> Enlèvements / Camion
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

      {/* Top KPI Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chiffre d'Affaires HT</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-blue-950 font-mono mt-2">
            {formatCurrency(totals.totalHT)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Base brute imposable</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TVA Collectée (19%)</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-2">
            {formatCurrency(totals.totalTVA)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">TVA à déclarer (G50 / Bilan)</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total TTC Facturé</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FileText className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-purple-950 font-mono mt-2">
            {formatCurrency(totals.totalTTC)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Dont {formatCurrency(totals.totalTimbre)} DA de timbre</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clients Déclarés</span>
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Users className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-2">
            {totals.clientCount} <span className="text-xs font-normal text-slate-500">clients ({totals.totalInvoices} factures)</span>
          </div>
          <div className="mt-1">
            {totals.missingFiscalCount > 0 ? (
              <button
                onClick={() => setFiscalFilter(fiscalFilter === 'missing_nif' ? 'all' : 'missing_nif')}
                className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 hover:bg-amber-100 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                <span>{totals.missingFiscalCount} client(s) avec NIF/RC incomplet</span>
              </button>
            ) : (
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> 100% Identifiants fiscaux complets
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Control & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Year Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Exercice :</span>
            {['2026', '2025', '2024', '2023'].map(yr => (
              <button
                key={yr}
                onClick={() => handleYearChange(yr)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedYear === yr && periodPreset === 'year'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Quick Quarter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => handleYearChange(selectedYear)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                periodPreset === 'year' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annuel
            </button>
            {(['T1', 'T2', 'T3', 'T4'] as const).map(q => (
              <button
                key={q}
                onClick={() => handleQuarterChange(q)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  periodPreset === q ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Source Basis Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600">Base :</span>
            <select
              value={sourceBasis}
              onChange={(e) => setSourceBasis(e.target.value as SourceBasis)}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="invoices">Factures Validées (Fiscal Officiel)</option>
              <option value="deliveries">Bons de Livraison (BLs valorisés)</option>
              <option value="all">Factures + BLs non facturés</option>
            </select>
          </div>
        </div>

        {/* Detailed Date Picker & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Période du</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold"
            />
            <span className="text-xs text-slate-500 font-medium">au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-semibold"
            />
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer par nom client, NIF, RC, Article, Wilaya..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Fiscal Filter Toggle */}
            <select
              value={fiscalFilter}
              onChange={(e) => setFiscalFilter(e.target.value as FiscalFilter)}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 shrink-0"
            >
              <option value="all">Tous les clients</option>
              <option value="complete">NIF & RC complets</option>
              <option value="missing_nif">⚠️ NIF ou RC manquant</option>
            </select>
          </div>

          {/* Expand/Collapse All Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={expandAll}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
            >
              Tout Déplier
            </button>
            <button
              onClick={collapseAll}
              className="text-[11px] text-slate-600 hover:text-slate-800 font-semibold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Tout Replier
            </button>
          </div>
        </div>
      </div>

      {/* Main État 104 Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <span>Relevé Nominatif des Clients (État 104)</span>
              <span className="text-xs font-mono bg-blue-600 px-2 py-0.5 rounded text-white font-bold">
                {reportRows.length} Lignes
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Conforme aux exigences de la Direction Générale des Impôts (DGI) - Exercice {selectedYear}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">Total Chiffre d'Affaires HT</div>
            <div className="text-lg font-black text-amber-400 font-mono">
              {formatCurrency(totals.totalHT)} DA
            </div>
          </div>
        </div>

        {reportRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="font-bold text-sm text-slate-600">Aucune donnée trouvée pour cette sélection.</p>
            <p className="text-xs mt-1">Vérifiez la période ou les critères de recherche.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-tight">
                  <th className="p-2.5 w-9 text-center">N°</th>
                  <th className="p-2.5">Client & Dénomination</th>
                  <th className="p-2.5 min-w-[155px]">N.I.F</th>
                  <th className="p-2.5 min-w-[135px]">N.I.S</th>
                  <th className="p-2.5 min-w-[110px]">R.C</th>
                  <th className="p-2.5 min-w-[100px]">Art. Imp.</th>
                  <th className="p-2.5">Wilaya / Adresse</th>
                  <th className="p-2.5 text-center w-12">Fact.</th>
                  <th className="p-2 text-right w-24 whitespace-nowrap">Montant HT</th>
                  <th className="p-2 text-right w-20 whitespace-nowrap">TVA 19%</th>
                  <th className="p-2 text-right w-16 whitespace-nowrap">Timbre</th>
                  <th className="p-2 text-right w-24 whitespace-nowrap">Total TTC</th>
                  <th className="p-2.5 text-center w-14">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {reportRows.map((row) => {
                  const isExpanded = expandedClients.has(row.customerId);
                  const isMissingFiscal = !row.nif || !row.rc;

                  return (
                    <React.Fragment key={row.customerId}>
                      <tr className={`hover:bg-blue-50/40 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                        <td className="p-2.5 text-center font-bold text-slate-500 font-mono">
                          {row.orderNumber}
                        </td>

                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleClientExpand(row.customerId)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="font-bold text-slate-900 text-[13px] flex items-center gap-1.5">
                                <span>{row.customerName}</span>
                                {isMissingFiscal && (
                                  <span
                                    title="NIF ou RC manquant - Cliquez pour compléter"
                                    onClick={() => setEditingClientId(row.customerId)}
                                    className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-sans font-bold cursor-pointer hover:bg-amber-200"
                                  >
                                    <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                                    Incomplet
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                                <span>Code: {row.customerCode}</span>
                                {row.activity && <span className="font-sans text-slate-400">• {row.activity}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* NIF - Enriched and enlarged font */}
                        <td className="p-2.5">
                          {row.nif ? (
                            <span className="font-mono font-black text-slate-950 bg-slate-100/90 border border-slate-300/80 px-2 py-1 rounded text-xs sm:text-[13px] tracking-wide inline-block shadow-2xs">
                              {row.nif}
                            </span>
                          ) : (
                            <button
                              onClick={() => setEditingClientId(row.customerId)}
                              className="text-red-600 hover:text-red-800 text-[11px] font-semibold underline decoration-dashed flex items-center gap-1 cursor-pointer"
                            >
                              <span>Non renseigné</span>
                              <Edit3 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </td>

                        {/* NIS - Enriched and enlarged font */}
                        <td className="p-2.5">
                          {row.nis ? (
                            <span className="font-mono font-bold text-slate-900 bg-slate-100/70 border border-slate-200 px-2 py-1 rounded text-xs sm:text-[13px] tracking-wide inline-block">
                              {row.nis}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>

                        <td className="p-2.5 font-mono font-semibold text-slate-700 text-xs">
                          {row.rc || <span className="text-red-600 font-semibold text-[11px]">Non renseigné</span>}
                        </td>

                        <td className="p-2.5 font-mono font-semibold text-slate-700 text-xs">
                          {row.article || <span className="text-slate-400">-</span>}
                        </td>

                        <td className="p-2.5">
                          <div className="text-slate-800 font-medium truncate max-w-[160px]">{row.address || '-'}</div>
                          {row.wilaya && (
                            <div className="text-[10px] text-slate-500 font-bold uppercase">{row.wilaya}</div>
                          )}
                        </td>

                        <td className="p-2.5 text-center">
                          <span className="font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                            {row.invoiceCount}
                          </span>
                        </td>

                        {/* Compact width Montant HT, TVA, Timbre, Total TTC */}
                        <td className="p-2 text-right font-mono font-bold text-slate-900 text-xs whitespace-nowrap">
                          {formatCurrency(row.totalHT)}
                        </td>

                        <td className="p-2 text-right font-mono font-semibold text-emerald-700 text-xs whitespace-nowrap">
                          {formatCurrency(row.totalTVA)}
                        </td>

                        <td className="p-2 text-right font-mono text-slate-600 text-xs whitespace-nowrap">
                          {formatCurrency(row.totalTimbre)}
                        </td>

                        <td className="p-2 text-right font-mono font-black text-blue-950 text-xs sm:text-[13px] whitespace-nowrap">
                          {formatCurrency(row.totalTTC)}
                        </td>

                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => toggleClientExpand(row.customerId)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                          >
                            {isExpanded ? 'Fermer' : 'Voir'}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Invoice Breakdown */}
                      {isExpanded && row.invoices && row.invoices.length > 0 && (
                        <tr className="bg-slate-50/90 border-y border-blue-100">
                          <td colSpan={13} className="p-4 pl-12">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                                  <span>Détail des {row.invoices.length} factures / pièces de {row.customerName}</span>
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  Sous-total Client : <strong>{formatCurrency(row.totalTTC)} DA TTC</strong>
                                </span>
                              </div>

                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="text-[10px] font-bold uppercase text-slate-500 border-b border-slate-100 pb-1">
                                    <th className="py-1">N° Pièce</th>
                                    <th className="py-1">Date</th>
                                    <th className="py-1">Type</th>
                                    <th className="py-1">Paiement</th>
                                    <th className="py-1 text-right">Montant HT</th>
                                    <th className="py-1 text-right">TVA 19%</th>
                                    <th className="py-1 text-right">Timbre</th>
                                    <th className="py-1 text-right">Total TTC</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono">
                                  {row.invoices.map((inv, iIdx) => (
                                    <tr key={inv.id || iIdx} className="hover:bg-slate-50">
                                      <td className="py-1 font-bold text-blue-900">{inv.number}</td>
                                      <td className="py-1 text-slate-600">{formatDate(inv.date)}</td>
                                      <td className="py-1 font-sans">
                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          inv.type === 'avoir' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                          {inv.type === 'avoir' ? 'AVOIR' : 'FACTURE'}
                                        </span>
                                      </td>
                                      <td className="py-1 font-sans text-slate-600 capitalize">{inv.paymentMode || '-'}</td>
                                      <td className="py-1 text-right font-semibold text-slate-800">{formatCurrency(inv.totalHT)}</td>
                                      <td className="py-1 text-right text-emerald-700">{formatCurrency(inv.totalTVA)}</td>
                                      <td className="py-1 text-right text-slate-500">{formatCurrency(inv.timbre)}</td>
                                      <td className="py-1 text-right font-bold text-slate-900">{formatCurrency(inv.totalTTC)}</td>
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
                })}
              </tbody>

              {/* Table Footer Totals */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                  <td colSpan={7} className="p-4 text-right uppercase tracking-wider text-slate-300">
                    TOTAUX GÉNÉRAUX ({totals.clientCount} Clients déclarés) :
                  </td>
                  <td className="p-4 text-center font-mono font-bold text-amber-400">
                    {totals.totalInvoices}
                  </td>
                  <td className="p-4 text-right font-mono font-black text-amber-400 text-sm">
                    {formatCurrency(totals.totalHT)}
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-emerald-400">
                    {formatCurrency(totals.totalTVA)}
                  </td>
                  <td className="p-4 text-right font-mono text-slate-300">
                    {formatCurrency(totals.totalTimbre)}
                  </td>
                  <td className="p-4 text-right font-mono font-black text-white text-base">
                    {formatCurrency(totals.totalTTC)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal to Quick Edit Customer Fiscal Info */}
      {editingClientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Compléter les informations fiscales du client
                </h3>
                <p className="text-xs text-slate-500">
                  Renseignez le NIF, NIS, RC et Article pour la conformité de l'État 104
                </p>
              </div>
              <button
                onClick={() => setEditingClientId(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                ✕
              </button>
            </div>

            <QuickClientFiscalEditor
              customerId={editingClientId}
              onClose={() => setEditingClientId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Quick Fiscal Editor
function QuickClientFiscalEditor({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const [nif, setNif] = useState('');
  const [nis, setNis] = useState('');
  const [rc, setRc] = useState('');
  const [article, setArticle] = useState('');
  const [address, setAddress] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (customer) {
      setNif(customer.nif || '');
      setNis(customer.nis || '');
      setRc(customer.rc || '');
      setArticle(customer.article || '');
      setAddress(customer.address || '');
      setWilaya(customer.wilaya || '');
    }
  }, [customer]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setSaving(true);
    try {
      await db.customers.update(customer.id, {
        nif: nif.trim(),
        nis: nis.trim(),
        rc: rc.trim(),
        article: article.trim(),
        address: address.trim(),
        wilaya: wilaya.trim()
      });
      onClose();
    } catch (err) {
      console.error('Erreur lors de la mise à jour fiscale du client', err);
    } finally {
      setSaving(false);
    }
  };

  if (!customer) return <div>Chargement...</div>;

  return (
    <form onSubmit={handleSave} className="space-y-4 text-xs">
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="font-bold text-slate-900 text-sm">{customer.name}</div>
        <div className="text-slate-500 font-mono mt-0.5">Code: {customer.code} • Type: {customer.type}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="font-bold text-slate-700 block mb-1">N.I.F (Numéro d'Identification Fiscale) *</label>
          <input
            type="text"
            placeholder="15 chiffres (ex: 000116000000000)"
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">R.C (Registre de Commerce) *</label>
          <input
            type="text"
            placeholder="Ex: 16/00-1234567B18"
            value={rc}
            onChange={(e) => setRc(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">N.I.S (Numéro Statistique)</label>
          <input
            type="text"
            placeholder="Ex: 000116012345678"
            value={nis}
            onChange={(e) => setNis(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">Article d'Imposition (AI)</label>
          <input
            type="text"
            placeholder="Ex: 16011234567"
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">Wilaya</label>
          <input
            type="text"
            placeholder="Ex: Alger, Tipaza, Blida..."
            value={wilaya}
            onChange={(e) => setWilaya(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">Adresse Complète</label>
          <input
            type="text"
            placeholder="Ex: Zone Industrielle, Lot 12..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer shadow-xs disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer les identifiants'}
        </button>
      </div>
    </form>
  );
}
