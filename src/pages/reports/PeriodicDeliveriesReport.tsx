import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { FileText, Printer, ArrowLeft, Search, Filter, BarChart3, Users, Truck, Package } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { executePrintPeriodicReport } from '../../lib/printPeriodicReport';
import { useAuthStore } from '../../store/authStore';

type DisplayMode = 'ht' | 'ttc' | 'quantity';

export function PeriodicDeliveriesReport() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>('ht');

  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const allDeliveryNotes = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const allDeliveryNoteItems = useLiveQuery(() => db.deliveryNoteItems.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const companySettings = useLiveQuery(() => db.settings.get(1));

  const reportData = useMemo(() => {
    if (!products || !customers || !allDeliveryNotes || !allDeliveryNoteItems) {
      return null;
    }

    const filteredNotes = allDeliveryNotes.filter(
      (note) => note.date >= startDate && note.date <= endDate && note.status !== 'cancelled'
    );

    const noteIds = new Set(filteredNotes.map((n) => n.id));
    const filteredItems = allDeliveryNoteItems.filter((item) => noteIds.has(item.deliveryNoteId));

    const noteMap = new Map(filteredNotes.map(n => [n.id, n]));
    const productMap = new Map(products.map(p => [p.id, p]));
    const customerMap = new Map(customers.map(c => [c.id, c]));

    const aggregated: Record<string, Record<string, number>> = {};

    filteredItems.forEach((item) => {
      const note = noteMap.get(item.deliveryNoteId);
      if (!note) return;
      const product = productMap.get(item.productId);
      if (!product) return;

      const customerId = note.customerId;
      
      let value = 0;
      if (displayMode === 'ht') {
        value = item.totalHT;
      } else if (displayMode === 'ttc') {
        value = item.totalHT * (1 + (product.tva || 19) / 100);
      } else if (displayMode === 'quantity') {
        value = item.quantity;
      }

      if (!aggregated[item.productId]) {
        aggregated[item.productId] = {};
      }
      if (!aggregated[item.productId][customerId]) {
        aggregated[item.productId][customerId] = 0;
      }
      aggregated[item.productId][customerId] += value;
    });

    const reportRows: {
      productId: string;
      productName: string;
      customers: { customerId: string; customerName: string; value: number }[];
      productTotal: number;
    }[] = [];

    let grandTotal = 0;

    Object.entries(aggregated).forEach(([productId, customerData]) => {
      const productName = productMap.get(productId)?.name || 'Produit Inconnu';
      const custArray: { customerId: string; customerName: string; value: number }[] = [];
      let productTotal = 0;

      Object.entries(customerData).forEach(([customerId, value]) => {
        const customerName = customerMap.get(customerId)?.name || 'Client Inconnu';
        custArray.push({ customerId, customerName, value });
        productTotal += value;
        grandTotal += value;
      });

      custArray.sort((a, b) => a.customerName.localeCompare(b.customerName));

      reportRows.push({
        productId,
        productName,
        customers: custArray,
        productTotal
      });
    });

    reportRows.sort((a, b) => a.productName.localeCompare(b.productName));

    return {
      rows: reportRows,
      grandTotal,
    };
  }, [startDate, endDate, displayMode, products, customers, allDeliveryNotes, allDeliveryNoteItems]);

  const handlePrint = () => {

    if (!reportData) return;
    executePrintPeriodicReport({
      startDate,
      endDate,
      displayMode,
      reportData,
      companySettings: companySettings || { 
        id: 1, 
        name: 'SARL MAHAJIR SIDAR', 
        address: 'Extraction & Commercialisation de Matériaux de Construction',
        activity: '',
        rc: '', nif: '', nis: '', article: '', bank: '', capital: 0, phone: '', email: '', tvaRate: 19, timbre: 0, timbreLimit: 0 
      } as any,
    });
  };

  const getColumnTitle = () => {
    if (displayMode === 'ht') return 'VALEUR H.T.';
    if (displayMode === 'ttc') return 'MNT T.T.C';
    return 'Qtés';
  };

  const formatValue = (val: number) => {
    if (displayMode === 'quantity') {
      return val.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return formatCurrency(val);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Rapport d'Enlèvement
            </h1>
            <p className="text-slate-500 text-sm">
              Rapports périodiques des enlèvements d'agrégats
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          disabled={!reportData || reportData.rows.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          Imprimer le Rapport
        </button>
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
          <Truck className="h-4 w-4" /> Enlèvements / Camion
        </button>
        <button
          onClick={() => navigate('/reports/product-deliveries')}
          className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors flex items-center gap-2 rounded-t-lg cursor-pointer"
        >
          <Package className="h-4 w-4" /> Enlèvements / Produit
        </button>
        <button
          className="px-5 py-3 text-sm font-bold text-blue-600 border-b-2 border-blue-600 flex items-center gap-2 bg-blue-50/40 rounded-t-lg cursor-pointer"
        >
          <FileText className="h-4 w-4" /> Rapport Périodique
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date de début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Afficher le rapport par :
            </label>
            <div className="flex items-center gap-6 p-2 bg-slate-50 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="displayMode"
                  value="ht"
                  checked={displayMode === 'ht'}
                  onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">HT hors taxe</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="displayMode"
                  value="ttc"
                  checked={displayMode === 'ttc'}
                  onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">TTC</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="displayMode"
                  value="quantity"
                  checked={displayMode === 'quantity'}
                  onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-slate-700">en Quantité</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-6 py-4 font-bold text-sm">DÉSIGNATION</th>
                <th className="px-6 py-4 font-bold text-sm">CLIENTS</th>
                <th className="px-6 py-4 font-bold text-sm text-right">{getColumnTitle()}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportData?.rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Filter className="h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-lg font-medium text-slate-600">Aucun enlèvement trouvé</p>
                      <p className="text-sm">Ajustez les dates pour voir les résultats.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                reportData?.rows.map((productGroup) => (
                  <React.Fragment key={productGroup.productId}>
                    {productGroup.customers.map((cust, idx) => (
                      <tr key={`${productGroup.productId}-${cust.customerId}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 text-sm font-medium text-slate-900 border-r border-slate-100">
                          {idx === 0 ? productGroup.productName : ''}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-600">
                          {cust.customerName}
                        </td>
                        <td className="px-6 py-3 text-sm font-bold text-slate-800 text-right font-mono">
                          {formatValue(cust.value)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
            {reportData && reportData.rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-black text-slate-800 text-right">
                    TOTAL GÉNÉRAL
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-blue-700 text-right font-mono">
                    {formatValue(reportData.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
