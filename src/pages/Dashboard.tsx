import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { 
  TrendingUp, Truck, FileText, Receipt, Users, 
  Plus, Scale, ChevronRight, Wallet,
  PackageCheck, Layers, BarChart3,
  ArrowRight, DollarSign
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Button } from '../components/ui/Button';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { useTranslation, formatLocalizedCurrency, formatLocalizedDate } from '../i18n';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export function Dashboard() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';
  const navigate = useNavigate();

  const { t, language } = useTranslation();
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('month');

  // Live queries
  const deliveries = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const deliveryItems = useLiveQuery(() => db.deliveryNoteItems.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const invoices = useLiveQuery(() => db.invoices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const payments = useLiveQuery(() => db.payments.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const company = useLiveQuery(() => db.settings.get(1));

  // Date filtering logic
  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return deliveries.filter(d => {
      if (d.status === 'cancelled') return false;
      if (period === 'all') return true;
      if (period === 'today') return d.date === todayStr;
      
      const itemDate = new Date(d.date);
      if (period === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return itemDate >= sevenDaysAgo;
      }
      if (period === 'month') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [deliveries, period]);

  // Financial & Operational Computations
  const stats = useMemo(() => {
    const totalTonnage = filteredDeliveries.reduce((sum, d) => sum + (Number(d.netWeight) || 0), 0);
    const totalTurnoverBL = filteredDeliveries.reduce((sum, d) => sum + (Number(d.totalTTC) || 0), 0);
    
    // Invoices stats
    const validInvoices = invoices?.filter(i => i.status !== 'cancelled') || [];
    const totalInvoicedTTC = validInvoices.reduce((sum, i) => sum + (Number(i.totalTTC) || 0), 0);
    
    // Payments
    const totalPaymentsReceived = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    // Unbilled BLs
    const pendingInvoicingBL = (deliveries || []).filter(d => d.status === 'validated' && !d.invoiceId);
    const pendingInvoicingAmount = pendingInvoicingBL.reduce((sum, d) => sum + (Number(d.totalTTC) || 0), 0);

    // Active customers
    const activeCustCount = (customers || []).filter(c => c.active).length;
    const activeTrucksCount = (trucks || []).filter(t => t.active).length;

    // Remaining customer balances
    const customerDebts = (customers || []).reduce((sum, c) => sum + (Number(c.balance) || 0), 0);

    return {
      totalTonnage: Math.round(totalTonnage * 100) / 100,
      totalTurnover: totalTurnoverBL,
      totalInvoiced: totalInvoicedTTC,
      totalPayments: totalPaymentsReceived,
      blCount: filteredDeliveries.length,
      pendingBLCount: pendingInvoicingBL.length,
      pendingBLAmount: pendingInvoicingAmount,
      activeCustomers: activeCustCount,
      activeTrucks: activeTrucksCount,
      customerDebts
    };
  }, [filteredDeliveries, invoices, payments, customers, trucks, deliveries]);

  // Chart: Daily tonnage and turnover breakdown
  const chartTimelineData = useMemo(() => {
    if (!filteredDeliveries.length) return [];
    
    const dayMap = new Map<string, { date: string; tonnage: number; montant: number; rotations: number }>();

    filteredDeliveries.forEach(d => {
      const dateKey = d.date;
      const current = dayMap.get(dateKey) || { date: dateKey, tonnage: 0, montant: 0, rotations: 0 };
      current.tonnage += Number(d.netWeight) || 0;
      current.montant += Number(d.totalTTC) || 0;
      current.rotations += 1;
      dayMap.set(dateKey, current);
    });

    return Array.from(dayMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        dateLabel: formatLocalizedDate(item.date, language),
        tonnage: Math.round(item.tonnage * 10) / 10,
        montant: Math.round(item.montant)
      }));
  }, [filteredDeliveries, language]);

  // Chart: Product Share by tonnage
  const productDistribution = useMemo(() => {
    if (!deliveryItems || !filteredDeliveries.length || !products) return [];
    
    const validBLIds = new Set(filteredDeliveries.map(d => d.id));
    const prodMap = new Map<string, { name: string; tonnage: number; totalHT: number }>();

    deliveryItems.forEach(item => {
      if (!validBLIds.has(item.deliveryNoteId)) return;
      const prod = products.find(p => p.id === item.productId);
      const prodName = prod ? prod.name : 'Autre';
      
      const current = prodMap.get(prodName) || { name: prodName, tonnage: 0, totalHT: 0 };
      current.tonnage += Number(item.quantity) || 0;
      current.totalHT += Number(item.totalHT) || 0;
      prodMap.set(prodName, current);
    });

    return Array.from(prodMap.values())
      .sort((a, b) => b.tonnage - a.tonnage)
      .map(item => ({
        ...item,
        tonnage: Math.round(item.tonnage * 10) / 10
      }));
  }, [deliveryItems, filteredDeliveries, products]);

  // Recent 5 Deliveries
  const recentDeliveries = useMemo(() => {
    if (!deliveries) return [];
    return [...deliveries]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [deliveries]);

  // Helpers
  const getCustomerName = (id: string) => customers?.find(c => c.id === id)?.name || id;
  const getTruckMatricule = (id: string) => trucks?.find(t => t.id === id)?.matricule || id;

  const getStatusLabel = (status: string) => {
    if (status === 'invoiced') return t.invoices.statusInvoiced;
    if (status === 'validated') return t.deliveries.statusValidated;
    if (status === 'cancelled') return t.deliveries.statusCancelled;
    return t.deliveries.statusDraft;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Bar & Action Hub */}
      <div className="bg-gradient-to-r from-[#070d18] via-[#0b1b36] to-[#0f284e] text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t.dashboard.liveWeighbridge}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            {t.dashboard.title}
            <span className="text-xs bg-blue-500/30 text-blue-300 font-semibold px-2.5 py-0.5 rounded-full border border-blue-400/30">
              {company?.name || 'CARRIÈRE SIDAR'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            {t.dashboard.welcomeUser}, <strong className="text-white">{user?.name || user?.username || 'Administrateur'}</strong>. {t.dashboard.overviewNotice}
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80">
          {[
            { id: 'today', label: t.dashboard.today },
            { id: '7days', label: t.dashboard.sevenDays },
            { id: 'month', label: t.dashboard.thisMonth },
            { id: 'all', label: t.dashboard.allTime },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                period === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* QUICK SHORTCUTS BAR (Raccourcis Indispensables) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => navigate('/deliveries/new')}
          className="group p-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex flex-col items-start gap-2 text-left rtl:text-right cursor-pointer border border-blue-500 active:scale-98"
        >
          <div className="p-2 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-tight">{t.dashboard.quickNewDelivery}</span>
            <span className="text-[10px] text-blue-100 opacity-90">{t.deliveries.weighingTab}</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/invoices/new')}
          className="group p-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-2 text-left rtl:text-right cursor-pointer active:scale-98"
        >
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-tight">{t.dashboard.quickNewInvoice}</span>
            <span className="text-[10px] text-slate-500">{t.menu.invoices}</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/payments/new')}
          className="group p-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-2 text-left rtl:text-right cursor-pointer active:scale-98"
        >
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-tight">{t.dashboard.quickNewPayment}</span>
            <span className="text-[10px] text-slate-500">{t.menu.payments}</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/clients/new')}
          className="group p-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-2 text-left rtl:text-right cursor-pointer active:scale-98"
        >
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-tight">{t.dashboard.quickNewClient}</span>
            <span className="text-[10px] text-slate-500">{t.menu.clients}</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/products/new')}
          className="group p-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-2 text-left rtl:text-right cursor-pointer active:scale-98"
        >
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-tight">{t.dashboard.quickNewProduct}</span>
            <span className="text-[10px] text-slate-500">{t.menu.products}</span>
          </div>
        </button>

        <button
          onClick={() => navigate('/reports')}
          className="group p-3.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col items-start gap-2 text-left rtl:text-right cursor-pointer active:scale-98"
        >
          <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg group-hover:scale-110 transition-transform">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-tight">{t.dashboard.quickReports}</span>
            <span className="text-[10px] text-slate-500">{t.menu.reports}</span>
          </div>
        </button>
      </div>

      {/* CORE OPERATIONAL & FINANCIAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Chiffre d'affaires */}
        <div 
          onClick={() => navigate('/deliveries')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.turnover}</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {formatLocalizedCurrency(stats.totalTurnover, language)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
              <span>{stats.blCount} {t.dashboard.deliveriesCount}</span>
              <span className="font-semibold text-blue-600 flex items-center gap-0.5">
                {t.dashboard.viewDetails} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </div>
          </div>
        </div>

        {/* Tonnage Expédié */}
        <div 
          onClick={() => navigate('/deliveries')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.totalTonnage}</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-700 tracking-tight">
              {stats.totalTonnage.toLocaleString(language === 'ar' ? 'ar-DZ' : language === 'en' ? 'en-US' : 'fr-FR')} <span className="text-base font-bold text-emerald-600">{t.dashboard.tonnes}</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
              <span>{t.dashboard.averageTrip} : {stats.blCount > 0 ? (stats.totalTonnage / stats.blCount).toFixed(1) : 0} T</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                {t.menu.deliveries} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </div>
          </div>
        </div>

        {/* BL à Facturer */}
        <div 
          onClick={() => navigate('/deliveries')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.pendingInvoices}</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-600 tracking-tight">
              {stats.pendingBLCount} <span className="text-sm font-semibold text-slate-500">{t.dashboard.unbilledBL}</span>
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
              <span>{formatLocalizedCurrency(stats.pendingBLAmount, language)}</span>
              <span className="font-semibold text-amber-600 flex items-center gap-0.5">
                {t.dashboard.createInvoice} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </div>
          </div>
        </div>

        {/* Encaissements & Créances */}
        <div 
          onClick={() => navigate('/payments')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.dashboard.totalPayments}</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-purple-700 tracking-tight">
              {formatLocalizedCurrency(stats.totalPayments, language)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
              <span>{stats.activeCustomers} {t.dashboard.activeClients}</span>
              <span className="font-semibold text-purple-600 flex items-center gap-0.5">
                {t.menu.payments} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ANALYTICS & CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Timeline Chart: Tonnage & Chiffre d'Affaires */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                {t.dashboard.salesTonnageEvolution}
              </h3>
              <p className="text-xs text-slate-500">{t.dashboard.salesTonnageSub}</p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            {chartTimelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTonnage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMontant" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip 
                    formatter={(val: any, name: any) => [
                      name === 'tonnage' ? `${val} T` : formatLocalizedCurrency(val, language), 
                      name === 'tonnage' ? t.dashboard.totalTonnage : t.dashboard.turnover
                    ]}
                    labelFormatter={(label) => `${t.date} : ${label}`}
                    contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '12px', border: 'none', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <Area yAxisId="left" type="monotone" dataKey="tonnage" name={t.dashboard.totalTonnage} stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTonnage)" />
                  <Area yAxisId="right" type="monotone" dataKey="montant" name={t.dashboard.turnover} stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMontant)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2 border-2 border-dashed border-slate-100 rounded-xl">
                <Scale className="h-8 w-8 text-slate-300" />
                <span>{t.dashboard.noData}</span>
                <Button size="sm" onClick={() => navigate('/deliveries/new')} className="mt-1 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> {t.deliveries.newDelivery}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Product Distribution Pie Chart */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              {t.dashboard.productDistribution}
            </h3>
            <p className="text-xs text-slate-500">{t.dashboard.productDistributionSub}</p>
          </div>

          <div className="h-52 w-full flex-1">
            {productDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productDistribution}
                    dataKey="tonnage"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {productDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [`${val} Tonnes`, 'Tonnage']}
                    contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                {t.dashboard.noData}
              </div>
            )}
          </div>

          {/* Product legend list */}
          <div className="space-y-2 pt-2 border-t border-slate-100 max-h-36 overflow-y-auto pr-1">
            {productDistribution.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="font-semibold text-slate-700 truncate">{p.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-900 shrink-0">{p.tonnage} T</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RECENT OPERATIONAL ACTIVITY (Table des derniers BL & Accès rapide) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Deliveries Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{t.dashboard.recentDeliveries}</h3>
                <p className="text-xs text-slate-500">{t.dashboard.recentDeliveriesSub}</p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => navigate('/deliveries')} className="text-xs">
              {t.dashboard.viewAll} ({deliveries?.length || 0})
              <ChevronRight className="h-4 w-4 ml-1 rtl:rotate-180" />
            </Button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left rtl:text-right text-sm">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">{t.deliveries.blNumber} & {t.date}</th>
                  <th className="py-3 px-4">{t.client}</th>
                  <th className="py-3 px-4">{t.deliveries.truck}</th>
                  <th className="py-3 px-4 text-right rtl:text-left">{t.deliveries.netWeight}</th>
                  <th className="py-3 px-4 text-right rtl:text-left">{t.totalTTC}</th>
                  <th className="py-3 px-4 text-center">{t.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentDeliveries.map(bl => (
                  <tr 
                    key={bl.id} 
                    onClick={() => navigate('/deliveries')}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-blue-600">{bl.number}</div>
                      <div className="text-[11px] text-slate-400">{formatLocalizedDate(bl.date, language)}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 truncate max-w-[150px]">
                      {getCustomerName(bl.customerId)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {getTruckMatricule(bl.truckId)}
                    </td>
                    <td className="py-3 px-4 text-right rtl:text-left font-bold text-emerald-700 font-mono">
                      {bl.netWeight ? `${bl.netWeight} T` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right rtl:text-left font-bold text-slate-900">
                      {formatLocalizedCurrency(bl.totalTTC || 0, language)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        bl.status === 'invoiced'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : bl.status === 'validated'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {getStatusLabel(bl.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {t.dashboard.noData}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Operations Bento Cards */}
        <div className="space-y-4">
          
          {/* Action Card: Pesée Rapide */}
          <div 
            onClick={() => navigate('/deliveries/new')}
            className="p-5 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-white/20 rounded-xl">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <ArrowRight className="h-5 w-5 text-blue-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-lg text-white">{t.deliveries.newDelivery}</h4>
              <p className="text-xs text-blue-100 mt-1">
                {t.deliveries.weighingSubtitle}
              </p>
            </div>
          </div>

          {/* Action Card: Facturation */}
          <div 
            onClick={() => navigate('/invoices')}
            className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Receipt className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-base text-slate-800">{t.invoices.title}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {t.invoices.subtitle}
              </p>
            </div>
          </div>

          {/* Action Card: Stock Produits */}
          <div 
            onClick={() => navigate('/products')}
            className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <PackageCheck className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
            </div>
            <div className="mt-4">
              <h4 className="font-bold text-base text-slate-800">{t.products.title}</h4>
              <p className="text-xs text-slate-500 mt-1">
                {t.products.subtitle}
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

