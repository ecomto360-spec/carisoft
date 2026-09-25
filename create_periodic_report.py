import os

report_content = """import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { FileText, Printer, ArrowLeft, Search, Filter } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { executePrintPeriodicReport } from '../../lib/printPeriodicReport';

type DisplayMode = 'ht' | 'ttc' | 'quantity';

export function PeriodicDeliveriesReport() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>('ht');

  const products = useLiveQuery(() => db.products.toArray());
  const customers = useLiveQuery(() => db.customers.toArray());
  const allDeliveryNotes = useLiveQuery(() => db.deliveryNotes.toArray());
  const allDeliveryNoteItems = useLiveQuery(() => db.deliveryNoteItems.toArray());
  const companySettings = useLiveQuery(() => db.companySettings.toCollection().first());

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
    if (!reportData || !companySettings) return;
    executePrintPeriodicReport({
      startDate,
      endDate,
      displayMode,
      reportData,
      companySettings,
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
"""

with open("src/pages/reports/PeriodicDeliveriesReport.tsx", "w", encoding="utf-8") as f:
    f.write(report_content)

print("Created src/pages/reports/PeriodicDeliveriesReport.tsx")

print_logic_content = """import { CompanySettings } from '../types';
import { formatCurrency } from './utils';

type DisplayMode = 'ht' | 'ttc' | 'quantity';

export interface PeriodicReportData {
  startDate: string;
  endDate: string;
  displayMode: DisplayMode;
  reportData: {
    rows: {
      productId: string;
      productName: string;
      customers: { customerId: string; customerName: string; value: number }[];
      productTotal: number;
    }[];
    grandTotal: number;
  };
  companySettings: CompanySettings;
}

export const generatePeriodicReportHtml = (data: PeriodicReportData) => {
  const { startDate, endDate, displayMode, reportData, companySettings } = data;

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
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
    return val.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  let rowsHtml = '';
  reportData.rows.forEach(productGroup => {
    productGroup.customers.forEach((cust, idx) => {
      rowsHtml += `
        <tr>
          <td class="col-designation">${idx === 0 ? productGroup.productName : ''}</td>
          <td class="col-client">${cust.customerName}</td>
          <td class="col-value">${formatValue(cust.value)}</td>
        </tr>
      `;
    });
  });

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>RAPPORT PÉRIODIQUE DES ENLÈVEMENTS D'AGRÉGATS</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm;
        }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
            color: #000;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .company-info h1 {
            font-size: 18px;
            margin: 0 0 5px 0;
            text-transform: uppercase;
        }
        .company-info p {
            margin: 2px 0;
            font-size: 12px;
        }
        .report-title-container {
            text-align: center;
            margin: 30px 0;
        }
        .report-title {
            font-size: 18px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 10px;
        }
        .report-dates {
            font-size: 14px;
            font-weight: bold;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        th, td {
            border: 1px solid #000;
            padding: 8px 10px;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: left;
            font-size: 12px;
        }
        th.col-value, td.col-value {
            text-align: right;
            width: 150px;
            font-weight: bold;
        }
        th.col-designation, td.col-designation {
            width: 300px;
            font-weight: bold;
        }
        .total-row td {
            font-weight: bold;
            font-size: 13px;
        }
        .total-label {
            text-align: right;
        }
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <h1>${companySettings.name}</h1>
            ${companySettings.activity ? `<p>${companySettings.activity}</p>` : ''}
            ${companySettings.address ? `<p>${companySettings.address}</p>` : ''}
        </div>
    </div>

    <div class="report-title-container">
        <div class="report-title">RAPPORT PERIODIQUES DES ENLEVEMENTS D'AGREGATS</div>
        <div class="report-dates">Du : ${formatDate(startDate)} Au : ${formatDate(endDate)}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="col-designation">DÉSIGNATION</th>
                <th class="col-client">CLIENTS</th>
                <th class="col-value">${getColumnTitle()}</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="2" class="total-label">TOTAL GÉNÉRAL</td>
                <td class="col-value">${formatValue(reportData.grandTotal)}</td>
            </tr>
        </tfoot>
    </table>
</body>
</html>
  `;
};

export const executePrintPeriodicReport = (data: PeriodicReportData) => {
  const html = generatePeriodicReportHtml(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
};
"""

with open("src/lib/printPeriodicReport.ts", "w", encoding="utf-8") as f:
    f.write(print_logic_content)

print("Created src/lib/printPeriodicReport.ts")

