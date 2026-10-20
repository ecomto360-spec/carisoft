import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import {
  Truck, Receipt, FileText, BarChart3, Calendar, Filter,
  Plus, Scale, Activity, Users, Package
} from 'lucide-react';

export function ReportsDashboard() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();

  // Date Filters (Default: current month)
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedClient, setSelectedClient] = useState<string>('all');

  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const deliveryNotes = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const deliveryNoteItems = useLiveQuery(() => db.deliveryNoteItems.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const invoices = useLiveQuery(() => db.invoices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());

  // Memos for filtering
  const filteredNotes = useMemo(() => {
    if (!deliveryNotes) return [];
    return deliveryNotes.filter(n => {
      if (n.status === 'cancelled') return false;
      const d = n.date.split('T')[0];
      if (d < startDate || d > endDate) return false;
      if (selectedClient !== 'all' && n.customerId !== selectedClient) return false;
      return true;
    });
  }, [deliveryNotes, startDate, endDate, selectedClient]);

  const filteredNoteItems = useMemo(() => {
    if (!deliveryNoteItems || !filteredNotes) return [];
    const noteIds = new Set(filteredNotes.map(n => n.id));
    return deliveryNoteItems.filter(item => noteIds.has(item.deliveryNoteId));
  }, [deliveryNoteItems, filteredNotes]);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      const d = inv.date.split('T')[0];
      if (d < startDate || d > endDate) return false;
      if (selectedClient !== 'all' && inv.customerId !== selectedClient) return false;
      return true;
    });
  }, [invoices, startDate, endDate, selectedClient]);

  // KPIs Calculations
  const caHT = filteredInvoices.reduce((acc, inv) => acc + (inv.totalHT || 0), 0);
  const totalVoyages = filteredNotes.length;
  const totalEnlevements = filteredNoteItems.length;
  const totalTonnage = filteredNoteItems.reduce((acc, item) => acc + (item.quantity || 0), 0);

  // Chart 1: Top 5 Products
  const productStats = useMemo(() => {
    if (!filteredNoteItems || !products) return [];
    const stats: Record<string, number> = {};
    filteredNoteItems.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      const name = p ? p.name : 'Inconnu';
      stats[name] = (stats[name] || 0) + item.quantity;
    });
    return Object.entries(stats)
      .map(([name, Quantité]) => ({ name, Quantité }))
      .sort((a, b) => b.Quantité - a.Quantité)
      .slice(0, 5);
  }, [filteredNoteItems, products]);

  // Chart 2: Evolution (Tonnage per day)
  const evolutionStats = useMemo(() => {
    if (!filteredNotes || !filteredNoteItems) return [];
    const stats: Record<string, number> = {};

    // Initialize all dates in range to 0 for a smooth line
    let currDate = new Date(startDate);
    const eDate = new Date(endDate);
    while (currDate <= eDate) {
      const dStr = currDate.toISOString().split('T')[0];
      stats[dStr] = 0;
      currDate.setDate(currDate.getDate() + 1);
    }

    filteredNoteItems.forEach(item => {
      const note = filteredNotes.find(n => n.id === item.deliveryNoteId);
      if (note) {
        const d = note.date.split('T')[0];
        if (stats[d] !== undefined) {
           stats[d] += item.quantity;
        }
      }
    });

    return Object.entries(stats)
      .map(([date, Tonnage]) => {
        const parts = date.split('-');
        return { date: `${parts[2]}/${parts[1]}`, fullDate: date, Tonnage };
      })
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [filteredNotes, filteredNoteItems, startDate, endDate]);

  const KPICard = ({ title, value, icon, iconBg }: any) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
      <div className={`p-3.5 rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rapports & Statistiques</h1>
        <p className="text-slate-500 text-sm mt-1">
          Tableau de bord analytique et génération de rapports officiels.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-0">
        <button className="px-5 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2 cursor-pointer">
          <BarChart3 className="h-4 w-4" /> Tableau de Bord
        </button>
        <button onClick={() => navigate('/reports/etat-104')} className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer">
          <FileText className="h-4 w-4 text-blue-600" /> État 104 (Fiscal & Impôts)
        </button>
        <button onClick={() => navigate('/reports/truck-deliveries')} className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer">
          <Users className="h-4 w-4" /> Enlèvements / Client
        </button>
        <button onClick={() => navigate('/reports/truck-only-deliveries')} className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer">
          <Truck className="h-4 w-4" /> Enlèvements / Camion
        </button>
        <button onClick={() => navigate('/reports/product-deliveries')} className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer">
          <Package className="h-4 w-4" /> Enlèvements / Produit
        </button>
        <button onClick={() => navigate('/reports/periodic-deliveries')} className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer">
          <FileText className="h-4 w-4" /> Rapport Périodique
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-auto">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
            </div>
            <span className="text-slate-400 text-sm font-medium">au</span>
            <div className="relative w-full md:w-auto">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              />
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option value="all">Tous les clients</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Chiffre d'Affaires (H.T)"
          value={formatCurrency(caHT)}
          icon={<Receipt className="h-6 w-6 text-emerald-600"/>}
          iconBg="bg-emerald-100/50"
        />
        <KPICard
          title="Total Enlèvements"
          value={totalEnlevements}
          icon={<Package className="h-6 w-6 text-blue-600"/>}
          iconBg="bg-blue-100/50"
        />
        <KPICard
          title="Tonnage Transporté"
          value={`${totalTonnage.toLocaleString('fr-FR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} T`}
          icon={<Scale className="h-6 w-6 text-indigo-600"/>}
          iconBg="bg-indigo-100/50"
        />
        <KPICard
          title="Nombre de Voyages"
          value={totalVoyages}
          icon={<Truck className="h-6 w-6 text-amber-600"/>}
          iconBg="bg-amber-100/50"
        />
      </div>

      {/* Main Content Grid 70/30 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Charts) - 70% */}
        <div className="lg:col-span-8 space-y-6">
          {/* Top 5 Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Top 5 Produits (En Quantité)
            </h3>
            <div className="h-[280px]">
              {productStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} />
                    <Tooltip
                      cursor={{ fill: '#F8FAFC' }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="Quantité" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <BarChart3 className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Aucune donnée sur cette période</p>
                </div>
              )}
            </div>
          </div>

          {/* Evolution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Évolution des Enlèvements (Tonnage)
            </h3>
            <div className="h-[280px]">
              {evolutionStats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Tonnage"
                      stroke="#10B981"
                      strokeWidth={4}
                      dot={{ r: 0 }}
                      activeDot={{ r: 6, fill: '#10B981', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Activity className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Aucune donnée sur cette période</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Quick Actions) - 30% */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 ml-1">
            Génération de Rapports
          </h3>

          {/* Card 0: État 104 */}
          <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-5 rounded-2xl border border-blue-800 shadow-md flex flex-col h-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-400/30">
                <FileText className="h-6 w-6" />
              </div>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white rounded-md">
                Officiel DGI
              </span>
            </div>
            <div>
              <h4 className="text-base font-black text-white leading-tight">État 104 — Chiffre d'Affaires</h4>
              <p className="text-xs text-slate-300 font-normal mt-1 leading-relaxed">
                Relevé fiscal officiel nominatif des clients (Art. 224 CIDTA) avec NIF, NIS, RC, montants HT et TVA pour la déclaration d'impôts du comptable.
              </p>
            </div>
            <button
              onClick={() => navigate('/reports/etat-104')}
              className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Générer l'État 104
            </button>
          </div>

          {/* Card 1 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col h-full">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 leading-tight">Enlèvements par Client</h4>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Attachement contradictoire détaillé avec volumes et totaux groupés par transporteur.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/reports/truck-deliveries')}
              className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-blue-700 text-sm font-bold rounded-xl border border-slate-200 hover:border-blue-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Générer
            </button>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group flex flex-col h-full">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 leading-tight">Enlèvements par Camion</h4>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Historique complet des rotations et voyages d'un transporteur spécifique.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/reports/truck-only-deliveries')}
              className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-indigo-50 text-indigo-700 text-sm font-bold rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Générer
            </button>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col h-full">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 leading-tight">Rapport Périodique</h4>
                <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Bilan global (HT, TTC, Qté) agrégé par produit et par client sur une période.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/reports/periodic-deliveries')}
              className="mt-auto w-full py-2.5 bg-slate-50 hover:bg-emerald-50 text-emerald-700 text-sm font-bold rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Générer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
