import { CompanySettings } from '../types';
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
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
        }
        .header-logo {
            max-height: 70px;
            max-width: 150px;
            object-fit: contain;
            margin-right: 15px;
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
        <div style="display: flex; align-items: center;">
            ${companySettings.logoUrl ? `<img src="${companySettings.logoUrl}" alt="Logo" class="header-logo" />` : ''}
            <div class="company-info">
                <h1>${companySettings.name}</h1>
                ${companySettings.activity ? `<p>${companySettings.activity}</p>` : ''}
                ${companySettings.address ? `<p>${companySettings.address}</p>` : ''}
                ${companySettings.phone ? `<p>Tél: ${companySettings.phone}</p>` : ''}
            </div>
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
