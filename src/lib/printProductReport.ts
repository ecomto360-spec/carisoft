import { formatCurrency, formatDate } from './utils';

export interface ProductDeliveryRow {
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  deliveryCount: number;
  totalQuantity: number;
  avgPriceHT: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
}

export interface ProductDeliveryItemDetail {
  blNumber: string;
  date: string;
  time?: string;
  customerCode?: string;
  customerName: string;
  truckMatricule: string;
  driverName?: string;
  productCode: string;
  productName: string;
  productUnit: string;
  tare: number;
  grossWeight: number;
  netWeight: number;
  priceHT: number;
  totalHT: number;
  totalTTC: number;
}

export interface ProductReportPrintData {
  company: {
    name: string;
    activity?: string;
    address?: string;
    city?: string;
    wilaya?: string;
    rc?: string;
    nif?: string;
    nis?: string;
    article?: string;
    phone?: string;
    email?: string;
  };
  productFilterName: string;
  clientFilterName: string;
  truckFilterName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  generationDate: string;
  summaryRows: ProductDeliveryRow[];
  detailRows: ProductDeliveryItemDetail[];
  totals: {
    totalDeliveries: number;
    totalQuantity: number;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
  };
}

export function executePrintProductReport(data: ProductReportPrintData) {
  const printWindow = window.open('', '_blank', 'width=1200,height=850');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer le rapport.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport des Enlèvements par Produit — ${data.periodLabel}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 8mm 8mm 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 9.5px;
      line-height: 1.3;
      padding: 10px;
    }
    .header-box {
      border: 1.5px solid #0f172a;
      padding: 8px 12px;
      margin-bottom: 8px;
      background: #f8fafc;
      border-radius: 4px;
    }
    .official-header {
      text-align: center;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px dashed #94a3b8;
    }
    .republic-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
    }
    .doc-main-title {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      margin-top: 2px;
      letter-spacing: 0.3px;
    }
    .doc-sub-title {
      font-size: 9px;
      color: #475569;
      font-weight: 600;
    }
    .company-grid {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 8px;
      font-size: 9px;
    }
    .info-group strong {
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      border-radius: 3px;
      font-size: 9px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #1e293b;
      margin-top: 10px;
      margin-bottom: 4px;
      padding-bottom: 2px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 8px;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      font-weight: 800;
      text-align: left;
      padding: 5px 4px;
      font-size: 8.5px;
      border: 1px solid #0f172a;
      text-transform: uppercase;
    }
    th.num { text-align: right; }
    th.center { text-align: center; }
    td {
      padding: 4px 4px;
      border: 1px solid #cbd5e1;
      font-size: 8.5px;
      vertical-align: middle;
    }
    td.num {
      text-align: right;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      white-space: nowrap;
    }
    td.center { text-align: center; }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .tfoot-row {
      background: #e2e8f0;
      font-weight: 900;
      border-top: 2px solid #0f172a;
    }
    .tfoot-row td {
      border: 1px solid #0f172a;
      font-size: 9px;
      padding: 6px 4px;
    }
    .signatures-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .sig-box {
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      height: 65px;
      padding: 6px 8px;
      position: relative;
    }
    .sig-title {
      font-weight: 700;
      font-size: 9px;
      color: #334155;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .sig-date {
      position: absolute;
      bottom: 6px;
      left: 8px;
      font-size: 8px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <!-- HEADER OFFICIEL -->
  <div class="header-box">
    <div class="official-header">
      <div class="republic-title">Système de Gestion Commerciale & Pont-Bascule</div>
      <div class="doc-main-title">ÉTAT RÉCAPITULATIF DES ENLÈVEMENTS PAR PRODUIT</div>
      <div class="doc-sub-title">Extraction, Tonnages, Rotations et Chiffre d'Affaires — Période : <strong>${data.periodLabel}</strong></div>
    </div>

    <div class="company-grid">
      <div class="info-group">
        <div><strong>Société / Carrière :</strong> ${data.company.name || 'SARL MAHAJIR SIDAR'}</div>
        <div><strong>Activité :</strong> ${data.company.activity || 'Exploitation de Carrière & Vente d\'Agrégats'}</div>
        <div><strong>Adresse :</strong> ${data.company.address || ''} ${data.company.city ? '- ' + data.company.city : ''} (${data.company.wilaya || ''})</div>
      </div>
      <div class="info-group">
        <div><strong>Filtre Produit :</strong> <span class="badge">${data.productFilterName}</span></div>
        <div style="margin-top: 3px;"><strong>Filtre Client :</strong> ${data.clientFilterName}</div>
        <div style="margin-top: 3px;"><strong>Filtre Camion :</strong> ${data.truckFilterName}</div>
      </div>
      <div class="info-group" style="text-align: right;">
        <div><strong>Période :</strong> <span class="badge">${formatDate(data.startDate)} au ${formatDate(data.endDate)}</span></div>
        <div style="margin-top: 3px; font-size: 8px; color: #64748b;">Édité le : ${data.generationDate}</div>
        <div style="margin-top: 3px; font-weight: 700; color: #1e293b;">Total : ${data.totals.totalQuantity.toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} T (${data.totals.totalDeliveries} voyages)</div>
      </div>
    </div>
  </div>

  <!-- SYNTHÈSE PAR PRODUIT -->
  <div class="section-title">1. Synthèse par Produit / Agrégat</div>
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 30px;">N°</th>
        <th style="width: 80px;">Code</th>
        <th>Désignation de l'Agrégat</th>
        <th class="center" style="width: 50px;">Unité</th>
        <th class="center" style="width: 60px;">Voyages</th>
        <th class="num" style="width: 100px;">Quantité Totale</th>
        <th class="num" style="width: 80px;">Prix Moyen HT</th>
        <th class="num" style="width: 100px;">Montant HT (DA)</th>
        <th class="num" style="width: 90px;">TVA 19% (DA)</th>
        <th class="num" style="width: 110px;">Total TTC (DA)</th>
      </tr>
    </thead>
    <tbody>
      ${data.summaryRows.map((r, idx) => `
        <tr>
          <td class="center" style="font-weight: 700; color: #475569;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: 700;">${r.productCode}</td>
          <td><strong>${r.productName}</strong></td>
          <td class="center">${r.productUnit}</td>
          <td class="center" style="font-weight: 700;">${r.deliveryCount}</td>
          <td class="num" style="font-weight: 800; color: #0f172a;">${r.totalQuantity.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="num">${formatCurrency(r.avgPriceHT)}</td>
          <td class="num" style="font-weight: 700;">${formatCurrency(r.totalHT)}</td>
          <td class="num">${formatCurrency(r.totalTVA)}</td>
          <td class="num" style="font-weight: 900; color: #1e3a8a;">${formatCurrency(r.totalTTC)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr class="tfoot-row">
        <td colspan="4" style="text-align: right; text-transform: uppercase;"><strong>TOTAL GÉNÉRAL :</strong></td>
        <td class="center"><strong>${data.totals.totalDeliveries}</strong></td>
        <td class="num"><strong>${data.totals.totalQuantity.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T</strong></td>
        <td class="num">-</td>
        <td class="num"><strong>${formatCurrency(data.totals.totalHT)}</strong></td>
        <td class="num"><strong>${formatCurrency(data.totals.totalTVA)}</strong></td>
        <td class="num"><strong>${formatCurrency(data.totals.totalTTC)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <!-- DÉTAIL DES ROTATIONS (Si moins de 500 lignes pour éviter surcharge) -->
  ${data.detailRows.length > 0 && data.detailRows.length <= 400 ? `
    <div class="section-title" style="margin-top: 12px;">2. Détail des Bons de Livraison (${data.detailRows.length} rotations)</div>
    <table>
      <thead>
        <tr>
          <th class="center" style="width: 25px;">N°</th>
          <th style="width: 70px;">N° BL</th>
          <th style="width: 65px;">Date</th>
          <th style="width: 140px;">Client</th>
          <th style="width: 85px;">Camion</th>
          <th style="width: 90px;">Produit</th>
          <th class="num" style="width: 55px;">Tare (T)</th>
          <th class="num" style="width: 55px;">Brut (T)</th>
          <th class="num" style="width: 65px;">Net (T)</th>
          <th class="num" style="width: 65px;">P.U HT</th>
          <th class="num" style="width: 80px;">Total HT (DA)</th>
          <th class="num" style="width: 85px;">Total TTC (DA)</th>
        </tr>
      </thead>
      <tbody>
        ${data.detailRows.map((d, idx) => `
          <tr>
            <td class="center" style="color: #64748b;">${idx + 1}</td>
            <td style="font-family: monospace; font-weight: 700; color: #1e3a8a;">${d.blNumber}</td>
            <td>${formatDate(d.date)}</td>
            <td><strong>${d.customerName}</strong></td>
            <td style="font-family: monospace;">${d.truckMatricule}</td>
            <td>${d.productName}</td>
            <td class="num">${(d.tare / 1000).toFixed(2)}</td>
            <td class="num">${(d.grossWeight / 1000).toFixed(2)}</td>
            <td class="num" style="font-weight: 800; color: #0f172a;">${d.netWeight.toFixed(2)}</td>
            <td class="num">${formatCurrency(d.priceHT)}</td>
            <td class="num" style="font-weight: 700;">${formatCurrency(d.totalHT)}</td>
            <td class="num" style="font-weight: 800;">${formatCurrency(d.totalTTC)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <!-- SIGNATURES -->
  <div class="signatures-block">
    <div class="sig-box">
      <div class="sig-title">Le Responsable Pont-Bascule / Expédition</div>
      <div class="sig-date">Date & Visa :</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">La Direction / Service Commercial</div>
      <div class="sig-date">Date & Cachet :</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
