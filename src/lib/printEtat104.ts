import { formatCurrency } from './utils';

export interface Etat104ClientRow {
  orderNumber: number;
  customerId: string;
  customerCode: string;
  customerName: string;
  activity?: string;
  address?: string;
  city?: string;
  wilaya?: string;
  rc?: string;
  nif?: string;
  nis?: string;
  article?: string;
  phone?: string;
  invoiceCount: number;
  totalHT: number;
  totalTVA: number;
  totalTimbre: number;
  totalTTC: number;
  paymentMode?: string;
  invoices?: {
    id?: string;
    number: string;
    date: string;
    totalHT: number;
    totalTVA: number;
    timbre: number;
    totalTTC: number;
    paymentMode?: string;
    type?: string;
    status?: string;
  }[];
}

export interface Etat104PrintData {
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
  fiscalYear: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  generationDate: string;
  basisLabel: string;
  rows: Etat104ClientRow[];
  totals: {
    totalHT: number;
    totalTVA: number;
    totalTimbre: number;
    totalTTC: number;
    totalInvoices: number;
    clientCount: number;
  };
}

export function executePrintEtat104(data: Etat104PrintData) {
  const printWindow = window.open('', '_blank', 'width=1200,height=850');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer l\'État 104.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>État 104 - Relevé Récapitulatif des Clients - ${data.fiscalYear}</title>
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
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
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
    .fiscal-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.3px;
      color: #0f172a;
      white-space: nowrap;
    }
    .missing {
      color: #dc2626;
      font-style: italic;
      font-size: 7.5px;
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
    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
      font-size: 9px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 6px 8px;
      background: #f8fafc;
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
      height: 70px;
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
  <!-- HEADER OFFICIEL IMPOTS / DGI -->
  <div class="header-box">
    <div class="official-header">
      <div class="republic-title">République Algérienne Démocratique et Populaire</div>
      <div class="doc-sub-title">MINISTÈRE DES FINANCES — DIRECTION GÉNÉRALE DES IMPÔTS</div>
      <div class="doc-main-title">ÉTAT 104 — RELEVÉ RÉCAPITULATIF DES CLIENTS</div>
      <div class="doc-sub-title">Article 224 du Code des Impôts Directs et Taxes Assimilées (C.I.D.T.A.) — Exercice : <strong>${data.fiscalYear}</strong></div>
    </div>

    <div class="company-grid">
      <div class="info-group">
        <div><strong>Société / Déclarant :</strong> ${data.company.name || 'SARL MAHAJIR SIDAR'}</div>
        <div><strong>Activité :</strong> ${data.company.activity || 'Exploitation de Carrière & Vente d\'Agrégats'}</div>
        <div><strong>Adresse :</strong> ${data.company.address || ''} ${data.company.city ? '- ' + data.company.city : ''} (${data.company.wilaya || ''})</div>
      </div>
      <div class="info-group">
        <div><strong>N.I.F :</strong> <span class="fiscal-id">${data.company.nif || '-'}</span></div>
        <div><strong>N.I.S :</strong> <span class="fiscal-id">${data.company.nis || '-'}</span></div>
        <div><strong>R.C :</strong> <span class="fiscal-id">${data.company.rc || '-'}</span></div>
        <div><strong>Art. Imp. :</strong> <span class="fiscal-id">${data.company.article || '-'}</span></div>
      </div>
      <div class="info-group" style="text-align: right;">
        <div><strong>Période :</strong> <span class="badge">${data.periodLabel}</span></div>
        <div style="margin-top: 3px;"><strong>Base :</strong> ${data.basisLabel}</div>
        <div style="margin-top: 3px; font-size: 8px; color: #64748b;">Édité le : ${data.generationDate}</div>
      </div>
    </div>
  </div>

  <!-- TABLEAU ÉTAT 104 -->
  <table>
    <thead>
      <tr>
        <th class="center" style="width: 25px;">N°</th>
        <th style="width: 160px;">Raison Sociale / Nom Client</th>
        <th style="width: 145px;">N.I.F</th>
        <th style="width: 115px;">N.I.S</th>
        <th style="width: 80px;">R.C</th>
        <th style="width: 75px;">Article Imp.</th>
        <th style="width: 110px;">Adresse / Wilaya</th>
        <th class="center" style="width: 30px;">Fact.</th>
        <th class="num" style="width: 68px;">Montant HT (DA)</th>
        <th class="num" style="width: 60px;">TVA 19% (DA)</th>
        <th class="num" style="width: 48px;">Timbre (DA)</th>
        <th class="num" style="width: 76px;">Total TTC (DA)</th>
      </tr>
    </thead>
    <tbody>
      ${data.rows.map(row => `
        <tr>
          <td class="center" style="font-weight: 700; color: #475569;">${row.orderNumber}</td>
          <td>
            <strong>${row.customerName}</strong>
            ${row.customerCode ? `<div style="font-size: 7.5px; color: #64748b;">Code: ${row.customerCode}</div>` : ''}
          </td>
          <td><span class="fiscal-id">${row.nif || '<span class="missing">Non renseigné</span>'}</span></td>
          <td><span class="fiscal-id">${row.nis || '<span class="missing">-</span>'}</span></td>
          <td><span class="fiscal-id">${row.rc || '<span class="missing">Non renseigné</span>'}</span></td>
          <td><span class="fiscal-id">${row.article || '<span class="missing">-</span>'}</span></td>
          <td>
            <div>${row.address || '-'}</div>
            ${row.wilaya ? `<div style="font-size: 7.5px; color: #64748b; font-weight: 600;">${row.wilaya}</div>` : ''}
          </td>
          <td class="center" style="font-weight: 700;">${row.invoiceCount}</td>
          <td class="num">${formatCurrency(row.totalHT)}</td>
          <td class="num">${formatCurrency(row.totalTVA)}</td>
          <td class="num">${formatCurrency(row.totalTimbre)}</td>
          <td class="num" style="font-weight: 800; color: #0f172a;">${formatCurrency(row.totalTTC)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr class="tfoot-row">
        <td colspan="7" style="text-align: right; text-transform: uppercase;">
          <strong>TOTAUX GÉNÉRAUX (${data.totals.clientCount} Clients déclarés) :</strong>
        </td>
        <td class="center"><strong>${data.totals.totalInvoices}</strong></td>
        <td class="num"><strong>${formatCurrency(data.totals.totalHT)}</strong></td>
        <td class="num"><strong>${formatCurrency(data.totals.totalTVA)}</strong></td>
        <td class="num"><strong>${formatCurrency(data.totals.totalTimbre)}</strong></td>
        <td class="num" style="color: #0f172a; font-size: 10px;"><strong>${formatCurrency(data.totals.totalTTC)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <!-- RÉCAPITULATIF COMPTABLE -->
  <div class="summary-grid">
    <div class="summary-card">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Chiffre d'Affaires Fiscal (HT) :</div>
      <div style="font-size: 13px; font-weight: 900; color: #1e3a8a; font-family: monospace;">${formatCurrency(data.totals.totalHT)} DA</div>
      <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Base imposable déclarée au titre de l'exercice.</div>
    </div>
    <div class="summary-card">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">TVA Collectée (19%) :</div>
      <div style="font-size: 13px; font-weight: 900; color: #047857; font-family: monospace;">${formatCurrency(data.totals.totalTVA)} DA</div>
      <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Total TVA facturée aux clients.</div>
    </div>
    <div class="summary-card">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Montant Global Toutes Taxes (TTC) :</div>
      <div style="font-size: 13px; font-weight: 900; color: #0f172a; font-family: monospace;">${formatCurrency(data.totals.totalTTC)} DA</div>
      <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Incluant Droits de Timbre fiscaux.</div>
    </div>
  </div>

  <!-- BLOC DE SIGNATURE & ATTESTATION -->
  <div class="signatures-block">
    <div class="sig-box">
      <div class="sig-title">Le Déclarant / Gérant de l'Entreprise</div>
      <div style="font-size: 8px; color: #64748b; margin-top: 4px;">Certifié exact et conforme aux écritures comptables.</div>
      <div class="sig-date">Date : ____ / ____ / ________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Cachet & Signature :</div>
    </div>
    <div class="sig-box">
      <div class="sig-title">L'Expert-Comptable / Commissaire aux Comptes</div>
      <div style="font-size: 8px; color: #64748b; margin-top: 4px;">Visa & Vérification des pièces justificatives.</div>
      <div class="sig-date">Date : ____ / ____ / ________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Cachet & Visa :</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
