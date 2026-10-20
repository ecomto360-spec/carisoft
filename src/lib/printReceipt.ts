import { formatCurrency, formatDate } from './utils';

export interface DeliveryPrintData {
  number: string;
  date: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerRC?: string;
  customerNIF?: string;
  productName: string;
  productCode?: string;
  productUnit: string;
  truckMatricule: string;
  driverName?: string;
  grossWeight: number;
  tare: number;
  netWeight: number;
  priceHT: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  tvaRate: number;
  destination?: string;
  remarks?: string;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyNif?: string;
  companyRc?: string;
  companyLogo?: string;
  hidePrices?: boolean;
}

export interface AttachmentItemData {
  matricule: string;
  driverName: string;
  deliveryCount: number;
  totalQuantity: number;
  productName?: string;
}

export interface AttachmentPrintData {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyLogo?: string;
  customerName: string;
  customerCode?: string;
  truckFilter?: string;
  productFilter?: string;
  startDate: string;
  endDate: string;
  items: AttachmentItemData[];
  totalDeliveries: number;
  totalQuantity: number;
  unit?: string;
}

export interface TruckDeliveryItemData {
  blNumber: string;
  date: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalHT: number;
}

export interface TruckReportPrintData {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyNif?: string;
  companyLogo?: string;
  truckMatricule: string;
  driverName: string;
  tare: number | string;
  customerName?: string;
  productName?: string;
  startDate: string;
  endDate: string;
  items: TruckDeliveryItemData[];
  totalQuantity: number;
  totalAmountHT: number;
  unit?: string;
}

export interface InvoiceItemPrintData {
  designation: string;
  unit: string;
  quantity: number;
  priceHT: number;
  totalHT: number;
}

export interface InvoicePrintData {
  number: string;
  date: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerRC?: string;
  customerNIF?: string;
  customerNIS?: string;
  customerArticle?: string;
  customerPhone?: string;
  paymentMode?: string;
  items: InvoiceItemPrintData[];
  totalHT: number;
  tvaRate: number;
  totalTVA: number;
  timbre: number;
  totalTTC: number;
  status?: string;
  isCancelled?: boolean;
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  orderNumber?: string;
  type?: 'standard' | 'avoir';
  notes?: string;
  companyName?: string;
  companyActivity?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyNif?: string;
  companyNis?: string;
  companyRc?: string;
  companyArticle?: string;
  companyBank?: string;
  companyCapital?: number;
  companyLogo?: string;
}

export interface OrderItemPrintData {
  designation: string;
  unit?: string;
  quantity: number;
  priceHT: number;
  totalHT: number;
}

export interface OrderPrintData {
  number: string;
  date: string;
  status: string;
  customerName: string;
  customerCode?: string;
  customerAddress?: string;
  customerPhone?: string;
  customerNIF?: string;
  customerRC?: string;
  truckMatricule?: string;
  items: OrderItemPrintData[];
  totalHT: number;
  tvaRate: number;
  totalTVA: number;
  totalTTC: number;
  companyName?: string;
  companyActivity?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyNif?: string;
  companyRc?: string;
  companyLogo?: string;
}

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export type DeliveryPrintFormat = 'landscape2' | 'label' | 'ticket' | 'A4' | 'A5';

export function getStoredPrintFormat(): DeliveryPrintFormat {
  try {
    const val = localStorage.getItem('carisoft_bl_print_format');
    if (val === 'landscape2' || val === 'label' || val === 'ticket' || val === 'A4' || val === 'A5') {
      return val;
    }
  } catch (e) {}
  return 'landscape2'; // Par défaut: A4 Paysage 2 copies (économie papier demandée par le client)
}

export function setStoredPrintFormat(format: DeliveryPrintFormat): void {
  try {
    localStorage.setItem('carisoft_bl_print_format', format);
  } catch (e) {}
}

function generateSvgBarcode(code: string): string {
  const widths = [1.2, 2.2, 1.0, 2.8, 1.8];
  const spaces = [1.2, 0.8, 1.8, 1.0, 1.4];
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0;
  }
  let svgBars = '';
  let x = 4;
  for (let i = 0; i < 28; i++) {
    const w = widths[Math.abs(hash + i * 7) % widths.length];
    const s = spaces[Math.abs(hash + i * 11) % spaces.length];
    svgBars += `<rect x="${x.toFixed(1)}" y="0" width="${w}" height="24" fill="#000" />`;
    x += w + s;
  }
  return `<svg width="${(x + 4).toFixed(0)}" height="24" viewBox="0 0 ${(x + 4).toFixed(0)} 24" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">${svgBars}</svg>`;
}

function renderBLHalfCopy(data: DeliveryPrintData, copyTitle: string, badgeBg: string): string {
  const timeStr = new Date(data.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return `
    <div class="half-copy-inner">
      <!-- En-tête -->
      <div class="h-header">
        <div class="h-header-left">
          ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Logo" class="h-logo" />` : ''}
          <div>
            <div class="h-company-name">${data.companyName || 'CARISOFT.next CARRIÈRE'}</div>
            <div class="h-company-sub">Carrière d'Agrégats & Matériaux de Construction</div>
            <div class="h-company-meta">${data.companyAddress || 'Zone Industrielle'} | Tél: ${data.companyPhone || '025 00 00 00'}</div>
          </div>
        </div>
        <div class="h-header-right">
          <div class="h-copy-badge" style="background-color: ${badgeBg};">${copyTitle}</div>
          <div class="h-bl-number">${data.number}</div>
          <div class="h-date">${formatDate(data.date)} ${timeStr}</div>
        </div>
      </div>

      <!-- Client & Transport (2 colonnes) -->
      <div class="h-info-grid">
        <div class="h-info-box">
          <div class="h-box-label">CLIENT FACTURÉ</div>
          <div class="h-box-main">${data.customerName}</div>
          <div class="h-box-sub">Code: <strong>${data.customerCode || '-'}</strong> ${data.destination ? `| Chantier: <strong>${data.destination}</strong>` : ''}</div>
        </div>
        <div class="h-info-box">
          <div class="h-box-label">VÉHICULE & TRANSPORT</div>
          <div class="h-box-main font-mono">${data.truckMatricule}</div>
          <div class="h-box-sub">Chauffeur: <strong>${data.driverName || 'Non spécifié'}</strong></div>
        </div>
      </div>

      <!-- Marchandise (Hero Table) -->
      <div class="h-table-wrap">
        <table class="h-table">
          <thead>
            <tr>
              <th style="text-align: left;">Désignation Marchandise</th>
              <th style="text-align: right; width: 110px;">Quantité (T)</th>
              ${data.hidePrices ? '' : `
              <th style="text-align: right; width: 85px;">P.U HT</th>
              <th style="text-align: right; width: 95px;">Total HT</th>
              `}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="h-prod-title">${data.productName}</div>
                ${data.productCode ? `<div class="h-prod-code">Réf: ${data.productCode}</div>` : ''}
              </td>
              <td class="h-prod-qty">
                ${data.netWeight.toFixed(2)} ${data.productUnit}
              </td>
              ${data.hidePrices ? '' : `
              <td class="h-prod-price">${formatCurrency(data.priceHT)}</td>
              <td class="h-prod-total">${formatCurrency(data.totalHT)}</td>
              `}
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pesée Pont-Bascule (Barre discrète) -->
      <div class="h-weights-bar">
        <span class="h-weights-title">PESÉE :</span>
        <span>Brut: <strong>${data.grossWeight.toFixed(2)} T</strong></span>
        <span>|</span>
        <span>Tare: <strong>${data.tare.toFixed(2)} T</strong></span>
        <span>|</span>
        <span>Net: <strong style="color: #1d4ed8;">${data.netWeight.toFixed(2)} T</strong></span>
      </div>

      <!-- Totaux financiers -->
      ${data.hidePrices ? '' : `
      <div class="h-totals-row">
        <div class="h-total-item">Total HT: <strong>${formatCurrency(data.totalHT)}</strong></div>
        <div class="h-total-item">TVA (${data.tvaRate}%): <strong>${formatCurrency(data.totalTVA)}</strong></div>
        <div class="h-total-ttc">TOTAL TTC: <strong>${formatCurrency(data.totalTTC)}</strong></div>
      </div>
      `}

      ${data.remarks ? `<div class="h-remarks">OBS: ${data.remarks}</div>` : ''}

      <!-- Signatures -->
      <div class="h-signatures">
        <div class="h-sign-col">
          <div class="h-sign-label">Visa Pont-Bascule</div>
          <div class="h-sign-line"></div>
        </div>
        <div class="h-sign-col">
          <div class="h-sign-label">Visa Chauffeur / Client</div>
          <div class="h-sign-line"></div>
        </div>
      </div>
    </div>
  `;
}

export function generateBLHtml(data: DeliveryPrintData, rawFormat: DeliveryPrintFormat | string = 'landscape2'): string {
  // Normalisation du format
  const norm = String(rawFormat).toLowerCase();
  const isLandscape2 = norm === 'landscape2' || norm === 'landscape' || norm === 'a4_landscape_2copies' || norm === 'eco';
  const isLabel = norm === 'label' || norm === 'etiquette' || norm === 'sticker';
  const isTicket = norm === 'ticket' || norm === '80mm';
  const isA5 = norm === 'a5';

  // 1. FORMAT ÉTIQUETTE (Petite taille 58mm / 60mm pour imprimante étiquettes autocollantes)
  if (isLabel) {
    const timeStr = new Date(data.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Étiquette Pesée - ${data.number}</title>
  <style>
    @page {
      size: 58mm auto;
      margin: 1.5mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      width: 55mm;
      margin: 0 auto;
      padding: 2mm;
      color: #000;
      background: #fff;
      font-size: 10px;
      line-height: 1.25;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .label-header { text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 3px; }
    .company-title { font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .badge-tag { display: inline-block; background: #000; color: #fff; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 2px; margin-top: 2px; }
    .bl-code { font-size: 14px; font-weight: 900; font-family: monospace; text-align: center; margin: 3px 0; border: 1px dashed #000; padding: 2px; }
    .meta-row { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 2px; }
    .prod-box { border: 2px solid #000; padding: 4px; margin: 4px 0; text-align: center; background: #f4f4f4; }
    .prod-name { font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .prod-weight { font-size: 13px; font-weight: 900; margin-top: 1px; }
    .weights-row { font-size: 8.5px; border-top: 1px dotted #888; border-bottom: 1px dotted #888; padding: 2px 0; margin: 3px 0; display: flex; justify-content: space-between; }
    .barcode-area { margin: 4px 0 2px 0; text-align: center; }
    @media print {
      body { width: 100%; margin: 0; padding: 1mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="label-header">
    <div class="company-title">${data.companyName || 'CARISOFT.next CARRIERE'}</div>
    <div class="badge-tag">TICKET DE PESÉE</div>
  </div>

  <div class="bl-code">${data.number}</div>
  <div class="meta-row"><span>Date:</span> <span>${formatDate(data.date)} ${timeStr}</span></div>
  <div class="meta-row"><span>Client:</span> <span class="font-bold">${data.customerName}</span></div>
  <div class="meta-row"><span>Camion:</span> <span class="font-bold" style="font-family: monospace;">${data.truckMatricule}</span></div>
  ${data.driverName ? `<div class="meta-row"><span>Chauffeur:</span> <span>${data.driverName}</span></div>` : ''}
  ${data.destination ? `<div class="meta-row"><span>Chantier:</span> <span>${data.destination}</span></div>` : ''}

  <!-- Marchandise / Poids Hero -->
  <div class="prod-box">
    <div class="prod-name">${data.productName}</div>
    <div class="prod-weight">NET: ${data.netWeight.toFixed(2)} ${data.productUnit}</div>
  </div>

  <!-- Détail pesée -->
  <div class="weights-row">
    <span>Brut: ${data.grossWeight.toFixed(2)}T</span>
    <span>Tare: ${data.tare.toFixed(2)}T</span>
  </div>

  ${data.hidePrices ? '' : `
  <div class="meta-row" style="font-weight: bold; font-size: 10px; margin-top: 3px; border-top: 1px solid #000; padding-top: 2px;">
    <span>TTC:</span> <span>${formatCurrency(data.totalTTC)}</span>
  </div>
  `}

  <div class="barcode-area">
    ${generateSvgBarcode(data.number)}
    <div style="font-size: 8px; font-family: monospace; letter-spacing: 1px;">${data.number}</div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 8px; margin-top: 6px; text-align: center;">
    <div>Visa Bascule<br>______</div>
    <div>Visa Chauffeur<br>______</div>
  </div>
</body>
</html>
    `;
  }

  // 2. FORMAT TICKET 80MM (Imprimante de caisse thermique standard)
  if (isTicket) {
    const timeStr = new Date(data.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ticket de Pesée - ${data.number}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      width: 76mm;
      margin: 2mm auto;
      padding: 2mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.3;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .border-top { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; }
    .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 5px; padding-bottom: 5px; }
    .double-border { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .title { font-size: 14px; font-weight: bold; text-align: center; }
    .subtitle { font-size: 10px; text-align: center; margin-bottom: 6px; }
    .logo-container { text-align: center; margin-bottom: 6px; }
    .logo-img { max-height: 50px; max-width: 140px; object-fit: contain; }
    .product-box { border: 2px solid #000; padding: 6px 4px; margin: 6px 0; background: #fafafa; }
    .product-name { font-size: 15px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
    .product-qty { font-size: 13px; font-weight: bold; text-align: center; }
    .weights-small { font-size: 9px; color: #333; margin: 4px 0; padding: 2px 0; border-top: 1px dotted #888; border-bottom: 1px dotted #888; }
    @media print {
      body { width: 100%; margin: 0; padding: 2mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${data.companyLogo ? `<div class="logo-container"><img src="${data.companyLogo}" alt="Logo" class="logo-img" /></div>` : ''}
  <div class="title">${data.companyName || 'CARISOFT.next CARRIERE'}</div>
  <div class="subtitle">BON DE LIVRAISON</div>
  <div class="text-center font-bold" style="font-size: 13px;">${data.number}</div>
  <div class="text-center" style="font-size: 9px;">${formatDate(data.date)} - ${timeStr}</div>
  
  <div class="border-top">
    <div class="row"><span class="font-bold">CLIENT:</span> <span>${data.customerName}</span></div>
    <div class="row"><span>CODE:</span> <span>${data.customerCode || '-'}</span></div>
    ${data.destination ? `<div class="row"><span>DESTINATION:</span> <span>${data.destination}</span></div>` : ''}
  </div>

  <div class="border-top">
    <div class="row"><span class="font-bold">CAMION:</span> <span class="font-bold">${data.truckMatricule}</span></div>
    <div class="row"><span>CHAUFFEUR:</span> <span>${data.driverName || 'Non spécifié'}</span></div>
  </div>

  <!-- MARCHANDISE (HERO) -->
  <div class="product-box">
    <div style="font-size: 9px; text-transform: uppercase; text-align: center; color: #555; margin-bottom: 1px;">Marchandise livrée</div>
    <div class="product-name">${data.productName}</div>
    <div class="product-qty">QUANTITÉ : ${data.netWeight.toFixed(2)} ${data.productUnit}</div>
  </div>

  <!-- DETAILS PESEE EN PETIT CARACTERE -->
  <div class="weights-small">
    <div class="row"><span>Pesée brut: ${data.grossWeight.toFixed(2)}T</span> <span>Tare: ${data.tare.toFixed(2)}T</span> <span>Net: ${data.netWeight.toFixed(2)}T</span></div>
  </div>

  <div>
    ${data.hidePrices ? '' : `
    <div class="row"><span>P.U HT:</span> <span>${formatCurrency(data.priceHT)}</span></div>
    <div class="row"><span>TOTAL HT:</span> <span>${formatCurrency(data.totalHT)}</span></div>
    <div class="row"><span>TVA (${data.tvaRate}%):</span> <span>${formatCurrency(data.totalTVA)}</span></div>
    <div class="row double-border" style="font-size: 13px;">
      <span class="font-bold">TOTAL TTC:</span>
      <span class="font-bold">${formatCurrency(data.totalTTC)}</span>
    </div>
    `}
  </div>

  ${data.remarks ? `<div style="font-size: 9px; margin-top: 4px;">OBS: ${data.remarks}</div>` : ''}

  <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 9px; text-align: center;">
    <div>Visa Bascule<br><br>_________</div>
    <div>Visa Chauffeur<br><br>_________</div>
  </div>
  <div class="subtitle" style="margin-top: 15px;">Merci de votre confiance !</div>
</body>
</html>
    `;
  }

  // 3. FORMAT PRINCIPAL : A4 PAYSAGE 2 COPIES (DEMI-PAGE ÉCONOMIE PAPIER)
  // 1 feuille A4 paysage = 2 exemplaires complets côte à côte avec ligne de découpe !
  if (isLandscape2) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bons de Livraison (2 Copies) - ${data.number}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 4mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.3;
    }
    .sheet-landscape {
      display: flex;
      flex-direction: row;
      width: 100%;
      height: 198mm;
      max-height: 198mm;
      overflow: hidden;
    }
    .half-copy {
      flex: 1;
      width: calc(50% - 7mm);
      padding: 3mm 4mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .half-copy-inner {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cut-divider {
      width: 14mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .cut-line {
      flex: 1;
      width: 1px;
      border-right: 1.5px dashed #94a3b8;
    }
    .cut-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 8px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 2px;
      padding: 6px 0;
      white-space: nowrap;
    }
    
    /* En-tête */
    .h-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 5px;
    }
    .h-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .h-logo {
      max-height: 36px;
      max-width: 80px;
      object-fit: contain;
    }
    .h-company-name {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .h-company-sub {
      font-size: 8px;
      color: #64748b;
      font-weight: 600;
    }
    .h-company-meta {
      font-size: 7.5px;
      color: #64748b;
    }
    .h-header-right {
      text-align: right;
    }
    .h-copy-badge {
      display: inline-block;
      color: #ffffff;
      font-size: 7.5px;
      font-weight: 800;
      padding: 1.5px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .h-bl-number {
      font-size: 13px;
      font-weight: 900;
      font-family: monospace;
      color: #0f172a;
      line-height: 1.2;
      margin-top: 1px;
    }
    .h-date {
      font-size: 8px;
      color: #475569;
    }

    /* Grille infos Client / Camion */
    .h-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 5px;
    }
    .h-info-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px 6px;
    }
    .h-box-label {
      font-size: 7px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .h-box-main {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .h-box-sub {
      font-size: 8px;
      color: #475569;
    }

    /* Table Marchandise (Hero) */
    .h-table-wrap {
      border: 1px solid #0f172a;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .h-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .h-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 3px 6px;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .h-table td {
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .h-prod-title {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
    }
    .h-prod-code {
      font-size: 7.5px;
      color: #64748b;
      font-family: monospace;
    }
    .h-prod-qty {
      text-align: right;
      font-size: 12px;
      font-weight: 900;
      color: #1d4ed8;
      font-family: monospace;
    }
    .h-prod-price {
      text-align: right;
      font-family: monospace;
      font-size: 9.5px;
    }
    .h-prod-total {
      text-align: right;
      font-family: monospace;
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
    }

    /* Barre discrète de pesée */
    .h-weights-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 3px;
      padding: 2px 6px;
      margin-bottom: 4px;
      font-size: 8.5px;
      color: #475569;
    }
    .h-weights-bar strong {
      font-family: monospace;
      font-size: 9.5px;
      color: #0f172a;
    }
    .h-weights-title {
      font-size: 7.5px;
      font-weight: 800;
      color: #64748b;
    }

    /* Ligne Totaux financiers */
    .h-totals-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px 8px;
      margin-bottom: 4px;
      font-size: 9px;
    }
    .h-total-item strong {
      font-family: monospace;
      color: #0f172a;
    }
    .h-total-ttc {
      background: #0f172a;
      color: #ffffff;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
    }
    .h-total-ttc strong {
      color: #60a5fa;
      font-family: monospace;
      font-size: 11px;
    }

    .h-remarks {
      font-size: 8px;
      color: #64748b;
      margin-bottom: 3px;
      font-style: italic;
    }

    /* Signatures */
    .h-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 4px;
      text-align: center;
    }
    .h-sign-col {
      border-top: 1px solid #94a3b8;
      padding-top: 2px;
    }
    .h-sign-label {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }
    .h-sign-line {
      height: 18px;
    }

    @media print {
      body { margin: 0; padding: 0; }
      .sheet-landscape { width: 100%; height: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet-landscape">
    <!-- COPIE 1 : EXEMPLAIRE CLIENT -->
    <div class="half-copy">
      ${renderBLHalfCopy(data, 'EXEMPLAIRE CLIENT', '#1d4ed8')}
    </div>

    <!-- LIGNE DE DÉCOUPE CENTRALE -->
    <div class="cut-divider">
      <div class="cut-line"></div>
      <div class="cut-label">✂ DÉCOUPER ICI / FOLD & CUT ✂</div>
      <div class="cut-line"></div>
    </div>

    <!-- COPIE 2 : EXEMPLAIRE CARRIÈRE / SOUCHE -->
    <div class="half-copy">
      ${renderBLHalfCopy(data, 'EXEMPLAIRE CARRIÈRE / SOUCHE', '#0f172a')}
    </div>
  </div>
</body>
</html>
    `;
  }

  // 4. FORMAT A5 (Demi-Page 1 seule copie)
  if (isA5) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de Livraison A5 - ${data.number}</title>
  <style>
    @page {
      size: A5 landscape;
      margin: 6mm;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 11px; }
    .a5-container { height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="a5-container">
    ${renderBLHalfCopy(data, 'BON DE LIVRAISON', '#1d4ed8')}
  </div>
</body>
</html>
    `;
  }

  // 5. FORMAT A4 PORTRAIT CLASSIQUE (1 Copie pleine page)
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de Livraison - ${data.number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-logo {
      max-height: 75px;
      max-width: 150px;
      object-fit: contain;
      border-radius: 6px;
    }
    .company-name {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .company-desc {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .doc-badge {
      text-align: right;
    }
    .bl-tag {
      background: #eff6ff;
      border: 1.5px solid #3b82f6;
      color: #1d4ed8;
      font-family: monospace;
      font-weight: 900;
      font-size: 18px;
      padding: 4px 14px;
      border-radius: 6px;
      display: inline-block;
    }
    .date-label {
      font-size: 12px;
      color: #475569;
      margin-top: 4px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .card-title {
      font-size: 10px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      display: block;
    }
    .card-name {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    
    /* Hero Table: Marchandise (Central Focus) */
    .table-container {
      border: 2px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      border-bottom: 1px solid #0f172a;
    }
    td {
      padding: 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .product-designation {
      font-size: 17px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .product-qty-val {
      font-size: 16px;
      font-weight: 800;
      font-family: monospace;
      color: #1d4ed8;
      text-align: right;
    }

    /* Small Discreet Weights Bar (Petit caractère) */
    .weights-discreet-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 6px 14px;
      margin-bottom: 20px;
      font-size: 11px;
      color: #475569;
    }
    .weights-discreet-bar strong {
      color: #0f172a;
      font-family: monospace;
      font-size: 12px;
    }
    .weights-discreet-title {
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
      color: #64748b;
      letter-spacing: 0.5px;
    }

    .totals-area {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .totals-box {
      width: 300px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
      color: #475569;
    }
    .total-ttc {
      border-top: 2px solid #0f172a;
      margin-top: 6px;
      padding-top: 6px;
      font-size: 16px;
      font-weight: 900;
      color: #1d4ed8;
      display: flex;
      justify-content: space-between;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 36px;
      text-align: center;
    }
    .sign-box {
      border-top: 1.5px solid #94a3b8;
      padding-top: 8px;
      font-size: 11px;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
    }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Logo" class="header-logo" />` : ''}
      <div>
        <div class="company-name">${data.companyName || 'CARISOFT.next CARRIÈRE'}</div>
        <div class="company-desc">Extraction, Concassage & Commercialisation de Matériaux de Construction</div>
        <div style="font-size: 11px; color: #64748b;">${data.companyAddress || 'Zone d\'Activité Industrielle'} | Tél : ${data.companyPhone || '025 00 00 00'}</div>
      </div>
    </div>
    <div class="doc-badge">
      <div class="bl-tag">${data.number}</div>
      <div class="date-label">Date : <strong>${formatDate(data.date)}</strong> à ${new Date(data.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <span class="card-title">Client Facturé</span>
      <div class="card-name">${data.customerName}</div>
      <div style="color: #475569; font-size: 12px; margin-top: 2px;">Code : <strong>${data.customerCode || '-'}</strong></div>
      ${data.destination ? `<div style="color: #475569; font-size: 12px; margin-top: 2px;"><strong>Chantier / Dest :</strong> ${data.destination}</div>` : ''}
    </div>

    <div class="card">
      <span class="card-title">Véhicule & Transport</span>
      <div class="card-name">Camion : <span style="font-family: monospace; letter-spacing: 0.5px;">${data.truckMatricule}</span></div>
      <div style="color: #475569; font-size: 12px; margin-top: 2px;">Chauffeur : <strong>${data.driverName || 'Non spécifié'}</strong></div>
    </div>
  </div>

  <!-- TABLE MARCHANDISE (HERO / FOCUS PRINCIPAL) -->
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Désignation de la Marchandise</th>
          <th style="text-align: right; width: 160px;">Quantité / Poids</th>
          ${data.hidePrices ? '' : `
          <th style="text-align: right; width: 140px;">Prix Unitaire HT</th>
          <th style="text-align: right; width: 150px;">Montant Total HT</th>
          `}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div class="product-designation">${data.productName}</div>
            ${data.productCode ? `<div style="font-size: 11px; color: #64748b; font-mono;">Réf / Code : ${data.productCode}</div>` : ''}
          </td>
          <td class="product-qty-val">
            ${data.netWeight.toFixed(2)} ${data.productUnit}
          </td>
          ${data.hidePrices ? '' : `
          <td style="text-align: right; font-family: monospace; font-size: 14px; font-weight: 600;">${formatCurrency(data.priceHT)}</td>
          <td style="text-align: right; font-family: monospace; font-size: 15px; font-weight: 800; color: #0f172a;">${formatCurrency(data.totalHT)}</td>
          `}
        </tr>
      </tbody>
    </table>
  </div>

  <!-- DÉTAILS DE PESÉE PONT-BASCULE EN PETIT CARACTÈRE DISCRET -->
  <div class="weights-discreet-bar">
    <span class="weights-discreet-title">Pesée Pont-Bascule :</span>
    <span>Poids Brut (1ère pesée) : <strong>${data.grossWeight.toFixed(2)} T</strong></span>
    <span style="color: #cbd5e1;">|</span>
    <span>Tare (camion vide) : <strong>${data.tare.toFixed(2)} T</strong></span>
    <span style="color: #cbd5e1;">|</span>
    <span>Poids Net facturé : <strong>${data.netWeight.toFixed(2)} T</strong></span>
  </div>

  ${data.hidePrices ? '' : `
  <div class="totals-area">
    <div class="totals-box">
      <div class="total-row">
        <span>Montant Total HT :</span>
        <span style="font-family: monospace; font-weight: 700;">${formatCurrency(data.totalHT)}</span>
      </div>
      <div class="total-row">
        <span>TVA (${data.tvaRate}%) :</span>
        <span style="font-family: monospace;">${formatCurrency(data.totalTVA)}</span>
      </div>
      <div class="total-ttc">
        <span>TOTAL TTC :</span>
        <span style="font-family: monospace;">${formatCurrency(data.totalTTC)}</span>
      </div>
    </div>
  </div>
  `}

  ${data.remarks ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 18px; color: #475569;"><strong>Remarques :</strong> ${data.remarks}</div>` : ''}

  <div class="signatures">
    <div class="sign-box">
      Visa Responsable Pont Bascule<br><br><br>
    </div>
    <div class="sign-box">
      Visa & Signature du Chauffeur<br><br><br>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Robust print function:
 * 1. Creates a hidden iframe in the DOM with the complete HTML document.
 * 2. Triggers print on that iframe.
 * 3. Falls back to opening a dedicated print popup or page if iframe modal is blocked.
 */
export function executePrint(data: DeliveryPrintData, rawFormat: DeliveryPrintFormat | string = 'landscape2'): boolean {
  const htmlContent = generateBLHtml(data, rawFormat);

  // If inside iframe or sandbox, open popup window or dedicated tab
  if (isInsideIframe()) {
    return openPrintWindow(htmlContent);
  }

  try {
    let iframe = document.getElementById('print-virtual-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-virtual-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print blocked, falling back to popup window', e);
          openPrintWindow(htmlContent);
        }
      }, 200);
      return true;
    }
  } catch (err) {
    console.warn('Direct iframe write failed, falling back to popup', err);
  }

  return openPrintWindow(htmlContent);
}

function openPrintWindow(htmlContent: string): boolean {
  try {
    const printWin = window.open('', '_blank', 'width=900,height=950,menubar=no,toolbar=no,location=no,status=no');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        try {
          printWin.print();
        } catch (err) {
          console.error('Error invoking print() on popup window', err);
        }
      }, 350);
      return true;
    }
  } catch (err) {
    console.error('Popup window blocked', err);
  }
  return false;
}

/**
 * Generate A4 HTML for "Attachement Contradictoire / Enlèvements par camion"
 */
export function generateAttachmentReportHtml(data: AttachmentPrintData): string {
  const unitLabel = data.unit || 'T';

  const rowsHtml = data.items.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 9px 12px; font-family: monospace; font-weight: 700; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${item.matricule}</td>
      <td style="padding: 9px 12px; font-size: 13px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #1e293b; text-transform: uppercase;">${item.driverName || '-'}</td>
      <td style="padding: 9px 12px; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #047857;">${item.productName || '-'}</td>
      <td style="padding: 9px 12px; text-align: center; font-family: monospace; font-size: 14px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${item.deliveryCount}</td>
      <td style="padding: 9px 12px; text-align: right; font-family: monospace; font-size: 14px; font-weight: 800; border-bottom: 1px solid #e2e8f0; color: #1d4ed8;">${item.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unitLabel}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Enlèvements par camion - ${data.customerName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.4;
    }
    .header-table {
      width: 100%;
      margin-bottom: 24px;
      border-collapse: collapse;
    }
    .header-logo {
      max-height: 65px;
      max-width: 140px;
      object-fit: contain;
      margin-bottom: 8px;
      display: block;
    }
    .company-title {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.3px;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 4px;
      font-weight: 500;
    }
    .period-badge-box {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 10px 16px;
      background: #f8fafc;
      text-align: center;
      display: inline-block;
      min-width: 260px;
    }
    .period-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .period-dates {
      font-family: monospace;
      font-size: 14px;
      font-weight: 800;
      color: #1d4ed8;
    }
    .client-section {
      background: #f1f5f9;
      border-left: 4px solid #2563eb;
      padding: 10px 14px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .client-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .client-value {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .data-table th {
      background: #1e293b;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-bottom: 1.5px solid #0f172a;
    }
    .total-row {
      background: #e2e8f0 !important;
      border-top: 2px solid #0f172a;
      font-weight: 900;
    }
    .total-row td {
      padding: 12px;
      font-size: 15px;
      color: #0f172a;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .sig-box {
      border-top: 1.5px solid #94a3b8;
      padding-top: 8px;
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: top; width: 55%;">
        ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Logo" class="header-logo" />` : ''}
        <div class="company-title">${data.companyName || 'SARL MAHAJIR SIDAR'}</div>
        <div class="company-sub">${data.companyAddress || 'Extraction & Commercialisation de Matériaux de Construction'}</div>
        ${data.companyPhone ? `<div class="company-sub">Tél : ${data.companyPhone}</div>` : ''}
      </td>
      <td style="vertical-align: top; text-align: right; width: 45%;">
        <div class="period-badge-box">
          <div class="period-title">Enlèvements par client DU</div>
          <div class="period-dates">${data.startDate} AU ${data.endDate}</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- CLIENT SECTION -->
  <div class="client-section">
    <div>
      <div>
        <span class="client-label">Client : </span>
        <span class="client-value">${data.customerName}</span>
      </div>
      ${data.truckFilter ? `<div style="font-size: 11px; margin-top: 3px; color: #1e293b;"><strong>Filtre Camion :</strong> ${data.truckFilter}</div>` : ''}
      ${data.productFilter ? `<div style="font-size: 11px; margin-top: 2px; color: #1e293b;"><strong>Filtre Produit :</strong> ${data.productFilter}</div>` : ''}
    </div>
    ${data.customerCode ? `<div style="font-size: 12px; color: #475569; font-weight: bold;">Code : <span style="font-family: monospace;">${data.customerCode}</span></div>` : ''}
  </div>

  <!-- MAIN TABLE -->
  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: left; width: 22%;">Matricule</th>
        <th style="text-align: left; width: 25%;">Chauffeur</th>
        <th style="text-align: left; width: 25%;">Produit(s)</th>
        <th style="text-align: center; width: 13%;">Nbre Enlèv.</th>
        <th style="text-align: right; width: 15%;">Quantité (${unitLabel})</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">Aucun enlèvement enregistré pour ce client sur cette période</td></tr>`}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align: left; text-transform: uppercase;">Total Général</td>
        <td style="text-align: center; font-family: monospace; font-size: 16px;">${data.totalDeliveries}</td>
        <td style="text-align: right; font-family: monospace; font-size: 16px; color: #1d4ed8;">${data.totalQuantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unitLabel}</td>
      </tr>
    </tfoot>
  </table>

  <!-- SIGNATURES -->
  <div class="signatures-grid">
    <div class="sig-box">
      Visa Responsable Expédition / Pont Bascule<br><br><br><br>
    </div>
    <div class="sig-box">
      Visa & Cachet du Client / Transporteur<br><br><br><br>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Trigger print for attachment report
 */
export function executePrintAttachment(data: AttachmentPrintData): boolean {
  const htmlContent = generateAttachmentReportHtml(data);

  if (isInsideIframe()) {
    return openPrintWindow(htmlContent);
  }

  try {
    let iframe = document.getElementById('print-virtual-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-virtual-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print blocked, falling back to popup window', e);
          openPrintWindow(htmlContent);
        }
      }, 200);
      return true;
    }
  } catch (err) {
    console.warn('Direct iframe write failed, falling back to popup', err);
  }

  return openPrintWindow(htmlContent);
}

export function generateTruckReportHtml(data: TruckReportPrintData): string {
  const tableRows = data.items.map(item => `
    <tr>
      <td style="text-align: left;">${item.blNumber}</td>
      <td style="text-align: center;">${formatDate(item.date)}</td>
      <td style="text-align: left;">${item.customerName}</td>
      <td style="text-align: left;">${item.productName}</td>
      <td style="text-align: right;">${item.quantity.toFixed(3)}</td>
      <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
      <td style="text-align: right; font-weight: bold;">${formatCurrency(item.totalHT)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Enlèvements par camion - ${data.truckMatricule}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1e293b; line-height: 1.4; font-size: 11px; }
    * { box-sizing: border-box; }
    .header { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; display: table; }
    .company-info { display: table-cell; width: 60%; vertical-align: top; }
    .company-logo { max-height: 55px; max-width: 140px; object-fit: contain; margin-bottom: 6px; display: block; }
    .company-name { font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 4px; }
    .doc-meta { display: table-cell; width: 40%; text-align: right; vertical-align: top; }
    .doc-title { font-size: 16px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 8px; border: 2px solid #0f172a; padding: 6px 12px; display: inline-block; background-color: #f8fafc; }
    .filters-box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; margin-bottom: 15px; background: #f8fafc; }
    .filters-table { width: 100%; font-size: 11px; }
    .filters-table td { padding: 4px; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 10px; }
    .data-table th, .data-table td { border: 1px solid #94a3b8; padding: 6px 8px; }
    .data-table th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #475569; }
    .data-table tr:nth-child(even) { background-color: #f8fafc; }
    .summary-row td { background-color: #e2e8f0; font-weight: bold; border-top: 2px solid #0f172a; font-size: 11px; }
    .print-button { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background-color: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    @media print { .print-button { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Logo" class="company-logo" />` : ''}
      <div class="company-name">${data.companyName || 'CARRIÈRE'}</div>
      ${data.companyAddress ? `<div>${data.companyAddress}</div>` : ''}
      ${data.companyPhone ? `<div>Tél: ${data.companyPhone}</div>` : ''}
    </div>
    <div class="doc-meta">
      <div class="doc-title">Enlèvements par Camion</div>
      <div>Période: ${data.startDate} au ${data.endDate}</div>
    </div>
  </div>

  <div class="filters-box">
    <table class="filters-table">
      <tr>
        <td style="width: 15%"><strong>Camion:</strong></td>
        <td style="width: 35%; font-family: monospace; font-size: 13px;"><strong>${data.truckMatricule}</strong></td>
        <td style="width: 15%"><strong>Client:</strong></td>
        <td style="width: 35%">${data.customerName || 'Tous les clients'}</td>
      </tr>
      <tr>
        <td><strong>Chauffeur:</strong></td>
        <td>${data.driverName}</td>
        <td><strong>Produit:</strong></td>
        <td>${data.productName || 'Tous les produits'}</td>
      </tr>
      <tr>
        <td><strong>Tare:</strong></td>
        <td colspan="3">${data.tare} T</td>
      </tr>
    </table>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="text-align: left; width: 10%;">N° B.L</th>
        <th style="text-align: center; width: 12%;">Date</th>
        <th style="text-align: left; width: 28%;">Client</th>
        <th style="text-align: left; width: 20%;">Produit</th>
        <th style="text-align: right; width: 10%;">Qté (${data.unit || 'T'})</th>
        <th style="text-align: right; width: 10%;">Prix Unitaire</th>
        <th style="text-align: right; width: 10%;">Montant H.T</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="summary-row">
        <td colspan="4" style="text-align: right; text-transform: uppercase;">Total camion</td>
        <td style="text-align: right;">${data.totalQuantity.toFixed(3)}</td>
        <td style="text-align: right;"></td>
        <td style="text-align: right;">${formatCurrency(data.totalAmountHT)}</td>
      </tr>
    </tbody>
  </table>
  
  <div style="margin-top: 30px; display: table; width: 100%;">
    <div style="display: table-cell; width: 50%; text-align: center;"><strong>Signature Chauffeur</strong></div>
    <div style="display: table-cell; width: 50%; text-align: center;"><strong>Signature Administration</strong></div>
  </div>

  <button class="print-button" onclick="window.print()">Imprimer le Rapport</button>
</body>
</html>
  `;
}

export function executePrintTruckReport(data: TruckReportPrintData): boolean {
  if (isInsideIframe()) {
    console.warn('Printing is restricted inside the preview iframe. Please open the app in a new tab.');
    return false;
  }

  const html = generateTruckReportHtml(data);
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    console.error('Failed to open print window. Popup blocker might be active.');
    return false;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
  
  return true;
}

/**
 * Generate A4 HTML for Official Algerian Quarry Invoice (Facture)
 */
export function generateInvoiceHtml(data: InvoicePrintData): string {
  const rowsHtml = data.items.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 10px 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${item.designation}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #475569;">${item.unit}</td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${item.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #334155;">${formatCurrency(item.priceHT)}</td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${formatCurrency(item.totalHT)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture N° ${data.number}${data.isCancelled ? ' [ANNULÉE]' : ''}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
      position: relative;
    }
    ${data.isCancelled ? `
    .watermark-cancelled {
      position: fixed;
      top: 40%;
      left: 10%;
      right: 10%;
      transform: translateY(-50%) rotate(-25deg);
      font-size: 72px;
      font-weight: 900;
      color: rgba(220, 38, 38, 0.12);
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 6px;
      pointer-events: none;
      z-index: 999;
      border: 8px solid rgba(220, 38, 38, 0.15);
      padding: 20px;
      border-radius: 12px;
    }
    ` : ''}
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .header-logo {
      max-height: 75px;
      max-width: 160px;
      object-fit: contain;
      margin-bottom: 6px;
      display: block;
    }
    .company-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .company-sub {
      font-size: 11px;
      color: #475569;
      font-weight: 500;
      margin-top: 2px;
    }
    .tax-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3px 12px;
      font-size: 10px;
      color: #334155;
      margin-top: 6px;
    }
    .doc-badge {
      text-align: right;
    }
    .doc-tag {
      background: ${data.isCancelled ? '#fef2f2' : '#eff6ff'};
      border: 2px solid ${data.isCancelled ? '#dc2626' : '#1d4ed8'};
      color: ${data.isCancelled ? '#dc2626' : '#1d4ed8'};
      font-family: monospace;
      font-weight: 900;
      font-size: 20px;
      padding: 6px 16px;
      border-radius: 6px;
      display: inline-block;
    }
    .date-meta {
      font-size: 12px;
      color: #475569;
      margin-top: 6px;
    }
    .client-card {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }
    .client-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .client-details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px 12px;
      font-size: 11px;
      margin-top: 6px;
      color: #334155;
    }
    .table-container {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
    }
    table.data-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 9px 12px;
      border-bottom: 1.5px solid #0f172a;
    }
    .bottom-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-top: 10px;
    }
    .totals-box {
      width: 320px;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 12px;
      color: #334155;
    }
    .totals-ttc {
      border-top: 2px solid #0f172a;
      margin-top: 6px;
      padding-top: 6px;
      font-size: 16px;
      font-weight: 900;
      color: #1d4ed8;
      display: flex;
      justify-content: space-between;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 36px;
      text-align: center;
    }
    .sign-box {
      border-top: 1.5px solid #94a3b8;
      padding-top: 8px;
      font-size: 11px;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
    }
    .cancel-alert-box {
      background: #fff1f2;
      border: 2px solid #e11d48;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      color: #9f1239;
    }
    .cancel-alert-title {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cancel-alert-reason {
      font-size: 12px;
      margin-top: 4px;
      font-weight: 700;
      color: #be123c;
    }
    .cancel-alert-meta {
      font-size: 11px;
      margin-top: 2px;
      color: #881337;
    }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${data.isCancelled ? `<div class="watermark-cancelled">FACTURE ANNULÉE</div>` : ''}

  ${data.isCancelled ? `
  <div class="cancel-alert-box">
    <div class="cancel-alert-title">
      ⚠️ DOCUMENT COMPTABLE : FACTURE ANNULÉE / AVOIR
    </div>
    <div class="cancel-alert-reason">
      Motif obligatoire d'annulation : <strong>${data.cancelReason || 'Non spécifié'}</strong>
    </div>
    ${data.cancelledAt ? `
    <div class="cancel-alert-meta">
      Annulée le : <strong>${formatDate(data.cancelledAt)}</strong> ${data.cancelledBy ? `par le commercial : <strong>${data.cancelledBy}</strong>` : ''}
    </div>
    ` : ''}
  </div>
  ` : ''}

  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td style="vertical-align: top; width: 60%;">
        ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Logo" class="header-logo" />` : ''}
        <div class="company-title">${data.companyName || 'SARL MAHAJIR SIDAR'}</div>
        <div class="company-sub">${data.companyActivity || 'Production & Commercialisation d\'Agrégats'}</div>
        <div class="company-sub">${data.companyAddress || 'Zone Industrielle'} ${data.companyPhone ? `• Tél : ${data.companyPhone}` : ''}</div>
        
        <div class="tax-grid">
          ${data.companyRc ? `<div><strong>RC :</strong> ${data.companyRc}</div>` : ''}
          ${data.companyNif ? `<div><strong>NIF :</strong> ${data.companyNif}</div>` : ''}
          ${data.companyNis ? `<div><strong>NIS :</strong> ${data.companyNis}</div>` : ''}
          ${data.companyArticle ? `<div><strong>AI :</strong> ${data.companyArticle}</div>` : ''}
          ${data.companyBank ? `<div><strong>Banque :</strong> ${data.companyBank}</div>` : ''}
          ${data.companyCapital ? `<div><strong>Capital :</strong> ${data.companyCapital.toLocaleString('fr-FR')} DA</div>` : ''}
        </div>
      </td>
      <td style="vertical-align: top; text-align: right; width: 40%;">
        <div class="doc-badge">
          <div class="doc-tag">${data.number}</div>
          ${data.isCancelled ? `<div style="color: #e11d48; font-weight: 900; font-size: 13px; margin-top: 3px;">[ ANNULÉE ]</div>` : ''}
          <div class="date-meta">Date de Facture : <strong>${formatDate(data.date)}</strong></div>
          <div class="date-meta">Mode de paiement : <strong>${data.paymentMode || 'Terme'}</strong></div>
          ${data.orderNumber ? `<div class="date-meta" style="color: #1d4ed8; font-weight: bold;">Réf. Bon de Commande : ${data.orderNumber}</div>` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- CLIENT -->
  <div class="client-card">
    <div class="client-title">Facturé à l'attention de :</div>
    <div class="client-name">${data.customerName} ${data.customerCode ? `<span style="font-size: 13px; font-weight: normal; color: #64748b;">(Code: ${data.customerCode})</span>` : ''}</div>
    ${data.customerAddress ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${data.customerAddress}</div>` : ''}
    
    <div class="client-details-grid">
      ${data.customerNIF ? `<div><strong>NIF :</strong> ${data.customerNIF}</div>` : ''}
      ${data.customerRC ? `<div><strong>RC :</strong> ${data.customerRC}</div>` : ''}
      ${data.customerNIS ? `<div><strong>NIS :</strong> ${data.customerNIS}</div>` : ''}
      ${data.customerArticle ? `<div><strong>AI :</strong> ${data.customerArticle}</div>` : ''}
      ${data.customerPhone ? `<div><strong>Tél :</strong> ${data.customerPhone}</div>` : ''}
    </div>
  </div>

  <!-- TABLE DES PRESTATIONS -->
  <div class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align: left;">Désignation des Matériaux</th>
          <th style="text-align: center; width: 80px;">Unité</th>
          <th style="text-align: right; width: 120px;">Quantité</th>
          <th style="text-align: right; width: 130px;">P.U HT</th>
          <th style="text-align: right; width: 150px;">Montant Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <!-- TOTAUX & REGLEMENT -->
  <div class="bottom-section">
    <div style="flex: 1; font-size: 11px; color: #475569;">
      <p style="margin: 0 0 6px 0;">Arrêtée la présente facture à la somme TTC de :</p>
      <div style="font-weight: 800; color: #0f172a; font-size: 13px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;">
        ${data.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA
      </div>
      ${data.notes ? `
      <div style="background: #f1f5f9; border-left: 3px solid #64748b; padding: 6px 10px; font-size: 11px; color: #334155; margin-top: 6px;">
        <strong>Observations / Conditions :</strong> ${data.notes}
      </div>
      ` : ''}
    </div>

    <div class="totals-box">
      <div class="totals-row">
        <span>Montant Total HT :</span>
        <span style="font-family: monospace; font-weight: 700;">${formatCurrency(data.totalHT)}</span>
      </div>
      <div class="totals-row">
        <span>TVA (${data.tvaRate}%) :</span>
        <span style="font-family: monospace;">${formatCurrency(data.totalTVA)}</span>
      </div>
      ${data.timbre ? `
      <div class="totals-row">
        <span>Droit de Timbre :</span>
        <span style="font-family: monospace;">${formatCurrency(data.timbre)}</span>
      </div>
      ` : ''}
      <div class="totals-ttc">
        <span>TOTAL TTC :</span>
        <span style="font-family: monospace;">${formatCurrency(data.totalTTC)}</span>
      </div>
    </div>
  </div>

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sign-box">
      Visa & Signature du Client<br><br><br><br>
    </div>
    <div class="sign-box">
      Direction Générale / Cachet & Signature<br><br><br><br>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Trigger print for Invoice
 */
export function executePrintInvoice(data: InvoicePrintData): boolean {
  const htmlContent = generateInvoiceHtml(data);

  if (isInsideIframe()) {
    return openPrintWindow(htmlContent);
  }

  try {
    let iframe = document.getElementById('print-virtual-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-virtual-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print blocked, falling back to popup window', e);
          openPrintWindow(htmlContent);
        }
      }, 200);
      return true;
    }
  } catch (err) {
    console.warn('Direct iframe write failed, falling back to popup', err);
  }

  return openPrintWindow(htmlContent);
}

/**
 * Generate Bon de Commande HTML
 */
export function generateOrderHtml(data: OrderPrintData): string {
  const rowsHtml = data.items.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 10px 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${item.designation}</td>
      <td style="padding: 10px 12px; text-align: center; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #475569;">${item.unit || 'Tonne'}</td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${item.quantity.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #334155;">${formatCurrency(item.priceHT)}</td>
      <td style="padding: 10px 12px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 800; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${formatCurrency(item.totalHT)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de Commande N° ${data.number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .header-logo {
      max-height: 75px;
      max-width: 160px;
      object-fit: contain;
      margin-bottom: 6px;
      display: block;
    }
    .company-title {
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .company-sub {
      font-size: 11px;
      color: #475569;
      font-weight: 500;
      margin-top: 2px;
    }
    .doc-badge {
      display: inline-block;
      background: #2563eb;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      margin-bottom: 16px;
    }
    .items-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 9px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .totals-box {
      margin-left: auto;
      width: 320px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 14px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .totals-row.grand {
      background: #0f172a;
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
      border-bottom: none;
    }
    .footer-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }
    .sig-block {
      width: 45%;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      min-height: 90px;
      background: #fafafa;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="vertical-align: top; width: 55%;">
        ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Logo" class="header-logo" />` : ''}
        <div class="company-title">${data.companyName || 'SARL MAHAJIR SIDAR'}</div>
        <div class="company-sub">${data.companyActivity || 'Extraction & Concassage de Matériaux de Construction'}</div>
        <div class="company-sub">${data.companyAddress || ''}</div>
        ${data.companyPhone ? `<div class="company-sub"><strong>Tél:</strong> ${data.companyPhone}</div>` : ''}
      </td>
      <td style="vertical-align: top; text-align: right; width: 45%;">
        <div class="doc-badge">BON DE COMMANDE</div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; font-family: monospace;">N° ${data.number}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 4px;"><strong>Date:</strong> ${formatDate(data.date)}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;"><strong>Statut:</strong> ${
          data.status === 'confirmed' ? 'Confirmée' :
          data.status === 'delivered' ? 'Livrée' :
          data.status === 'cancelled' ? 'Annulée' : 'Brouillon'
        }</div>
      </td>
    </tr>
  </table>

  <!-- Client & Info section -->
  <table style="width: 100%; margin-bottom: 16px;">
    <tr>
      <td style="width: 50%; vertical-align: top; padding-right: 8px;">
        <div class="meta-box">
          <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Client / Destinataire</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${data.customerName}</div>
          ${data.customerCode ? `<div style="font-size: 11px; color: #475569;">Code: <strong>${data.customerCode}</strong></div>` : ''}
          ${data.customerAddress ? `<div style="font-size: 11px; color: #475569;">${data.customerAddress}</div>` : ''}
          ${data.customerPhone ? `<div style="font-size: 11px; color: #475569;">Tél: ${data.customerPhone}</div>` : ''}
        </div>
      </td>
      <td style="width: 50%; vertical-align: top; padding-left: 8px;">
        <div class="meta-box">
          <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Références & Logistique</div>
          <div style="font-size: 12px; color: #0f172a;"><strong>N° Commande:</strong> ${data.number}</div>
          <div style="font-size: 12px; color: #0f172a; margin-top: 3px;"><strong>Date de saisie:</strong> ${formatDate(data.date)}</div>
          ${data.truckMatricule ? `<div style="font-size: 12px; color: #0f172a; margin-top: 3px;"><strong>Camion assigné:</strong> ${data.truckMatricule}</div>` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="text-align: left;">Désignation des Produits</th>
        <th style="text-align: center; width: 80px;">Unité</th>
        <th style="text-align: right; width: 100px;">Quantité</th>
        <th style="text-align: right; width: 120px;">Prix Unit. HT</th>
        <th style="text-align: right; width: 130px;">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <!-- Totals Section -->
  <div class="totals-box">
    <div class="totals-row">
      <span style="color: #64748b;">Total Brut HT :</span>
      <span style="font-family: monospace; font-weight: 700;">${formatCurrency(data.totalHT)}</span>
    </div>
    <div class="totals-row">
      <span style="color: #64748b;">TVA (${data.tvaRate}%) :</span>
      <span style="font-family: monospace; font-weight: 700;">${formatCurrency(data.totalTVA)}</span>
    </div>
    <div class="totals-row grand">
      <span>NET À PAYER TTC :</span>
      <span style="font-family: monospace;">${formatCurrency(data.totalTTC)}</span>
    </div>
  </div>

  <!-- Signatures -->
  <div class="footer-signatures">
    <div class="sig-block">
      <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 30px;">Visa & Cachet Client :</div>
    </div>
    <div class="sig-block" style="text-align: right;">
      <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 30px;">Direction Commerciale / Carrière :</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Trigger print for Order
 */
export function executePrintOrder(data: OrderPrintData): boolean {
  const htmlContent = generateOrderHtml(data);

  if (isInsideIframe()) {
    return openPrintWindow(htmlContent);
  }

  try {
    let iframe = document.getElementById('print-virtual-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-virtual-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print blocked, falling back to popup window', e);
          openPrintWindow(htmlContent);
        }
      }, 200);
      return true;
    }
  } catch (err) {
    console.warn('Direct iframe write failed, falling back to popup', err);
  }

  return openPrintWindow(htmlContent);
}
