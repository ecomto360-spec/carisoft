import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Customer } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { 
  X, Printer, FileText, CheckCircle2, 
  CreditCard, Calendar, Tag, AlertTriangle, 
  DollarSign, Receipt, QrCode, ArrowDownRight,
  PlusCircle, Check
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

export interface CustomerProfileModalProps {
  isOpen?: boolean;
  onClose: () => void;
  customerId?: string;
  customer?: Customer;
}

export function CustomerProfileModal({
  isOpen = true,
  onClose,
  customerId: passedCustomerId,
  customer: passedCustomer
}: CustomerProfileModalProps) {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const activeCustomerId = passedCustomerId || passedCustomer?.id || '';
  const liveCustomer = useLiveQuery(() => activeCustomerId ? db.customers.get(activeCustomerId) : undefined, [activeCustomerId]);
  const customer = liveCustomer || passedCustomer;
  const customerId = activeCustomerId;

  const deliveries = useLiveQuery(() => customerId ? db.deliveryNotes.where('customerId').equals(customerId).filter(x => x.companyId === currentCompanyId).toArray() : [], [customerId]) || [];
  const payments = useLiveQuery(() => customerId ? db.payments.where('customerId').equals(customerId).filter(x => x.companyId === currentCompanyId).toArray() : [], [customerId]) || [];
  const companySettings = useLiveQuery(() => db.settings.get(1));

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Espèces (Cash)');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // Calculations
  const totalPurchases = useMemo(() => {
    return deliveries.reduce((sum, d) => sum + (d.totalTTC || 0), 0);
  }, [deliveries]);

  const totalPaymentsMade = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  // Balance logic:
  // If balance < 0, total debt = Math.abs(balance)
  // If balance >= 0, total debt = 0 (and customer has positive credit/advance)
  const currentBalance = customer?.balance ?? 0;
  const totalDebt = currentBalance < 0 ? Math.abs(currentBalance) : 0;
  const initialDebt = customer?.initialDebt || 0;
  const creditLimit = customer?.creditLimit || 0;
  const isCreditLimitExceeded = creditLimit > 0 && totalDebt > creditLimit;

  // Remaining initial debt
  const remainingInitialDebt = useMemo(() => {
    if (initialDebt <= 0) return 0;
    // Estimate remaining initial debt proportional to payments if needed or display initial debt
    return Math.min(initialDebt, totalDebt);
  }, [initialDebt, totalDebt]);

  if (!isOpen || !customer) return null;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = typeof paymentAmount === 'number' ? paymentAmount : 0;
    if (amountVal <= 0) {
      alert('Veuillez saisir un montant de paiement valide supérieur à 0.');
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const newPaymentId = crypto.randomUUID();
      let modeKey: string = 'especes';
      if (paymentMode.includes('Chèque bancaire')) modeKey = 'cheque';
      else if (paymentMode.includes('Chèque postal')) modeKey = 'cheque_ccp';
      else if (paymentMode.includes('Virement')) modeKey = 'virement';
      else if (paymentMode.includes('Carte')) modeKey = 'carte';
      else if (paymentMode.includes('Autre')) modeKey = 'autre';

      await db.payments.add({
        id: newPaymentId,
        date: new Date(`${paymentDate}T12:00:00`).toISOString(),
        customerId: customer.id,
        amount: amountVal,
        mode: modeKey,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        companyId: customer.companyId
      });

      // Update customer balance (reducing debt, i.e., adding to balance)
      await db.customers.update(customer.id, {
        balance: (customer.balance || 0) + amountVal
      });

      setPaymentSuccess(`Paiement de ${formatCurrency(amountVal)} enregistré avec succès.`);
      setPaymentAmount('');
      setReference('');
      setNotes('');

      if (autoPrintReceipt) {
        // Trigger quick receipt printing
        printPaymentReceipt({
          customerName: customer.name,
          customerCode: customer.code,
          amount: amountVal,
          date: paymentDate,
          mode: paymentMode,
          reference,
          newDebt: Math.max(0, totalDebt - amountVal),
          companyName: companySettings?.name || 'CARISOFT CARRIÈRE',
          logoUrl: companySettings?.logoUrl
        });
      }

      setTimeout(() => setPaymentSuccess(null), 4000);
    } catch (err) {
      console.error('Failed to record payment', err);
      alert('Erreur lors de l\'enregistrement du paiement');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const printPaymentReceipt = (data: {
    customerName: string;
    customerCode: string;
    amount: number;
    date: string;
    mode: string;
    reference?: string;
    newDebt: number;
    companyName: string;
    logoUrl?: string;
  }) => {

    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reçu de Paiement - ${data.customerName}</title>
        <style>
          body { font-family: monospace; padding: 20px; font-size: 13px; color: #111; }
          .center { text-align: center; }
          .logo-img { max-height: 50px; max-width: 140px; object-fit: contain; margin-bottom: 6px; }
          .header { border-bottom: 2px dashed #333; padding-bottom: 10px; margin-bottom: 15px; }
          .row { display: flex; justify-content: space-between; margin: 6px 0; }
          .bold { font-weight: bold; }
          .big { font-size: 16px; font-weight: bold; }
          .footer { border-top: 2px dashed #333; padding-top: 10px; margin-top: 15px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header center">
          ${data.logoUrl ? `<div><img src="${data.logoUrl}" alt="Logo" class="logo-img" /></div>` : ''}
          <div class="bold" style="font-size: 15px;">${data.companyName}</div>
          <div>REÇU D'ENCAISSEMENT CLIENT</div>
          <div>Date: ${data.date}</div>
        </div>
        <div class="row"><span>Client:</span><span class="bold">${data.customerName} (${data.customerCode})</span></div>
        <div class="row"><span>Mode de règlement:</span><span>${data.mode}</span></div>
        ${data.reference ? `<div class="row"><span>Réf/Chèque:</span><span>${data.reference}</span></div>` : ''}
        <div class="row big" style="margin: 15px 0; padding: 8px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
          <span>MONTANT ENCAISSÉ:</span><span>${data.amount.toFixed(2)} DA</span>
        </div>
        <div class="row"><span>Solde restant / Dette:</span><span class="bold">${data.newDebt.toFixed(2)} DA</span></div>
        <div class="footer">
          <div>Merci pour votre confiance</div>
          <div style="font-size: 10px; margin-top: 5px;">Carisoft Vente & Pesée</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 350);
  };

  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Extrait de Compte Client - ${customer.name}</title>
        <style>
          body { font-family: sans-serif; padding: 30px; color: #1e293b; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
          .logo-img { max-height: 60px; max-width: 140px; object-fit: contain; margin-bottom: 6px; }
          .title { font-size: 20px; font-weight: bold; color: #1e3a8a; }
          .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px; }
          .card { padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; }
          .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .card-val { font-size: 18px; font-weight: bold; margin-top: 4px; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 12px; }
          td { padding: 8px; border: 1px solid #e2e8f0; font-size: 12px; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${companySettings?.logoUrl ? `<img src="${companySettings.logoUrl}" alt="Logo" class="logo-img" />` : ''}
            <div>
              <div class="title">RELEVÉ DE COMPTE CLIENT</div>
              <div style="font-weight: bold; margin-top: 5px;">${customer.name} (Code: ${customer.code})</div>
              <div>${customer.address || ''} ${customer.phone ? '• Tél: ' + customer.phone : ''}</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold;">${companySettings?.name || 'CARISOFT CARRIÈRE'}</div>
            <div>Date d'édition: ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-title">Total des Achats</div>
            <div class="card-val">${totalPurchases.toFixed(2)} DA</div>
          </div>
          <div class="card" style="border-color: #fcd34d; background: #fffbeb;">
            <div class="card-title" style="color: #b45309;">Dette Initiale</div>
            <div class="card-val" style="color: #b45309;">${initialDebt.toFixed(2)} DA</div>
          </div>
          <div class="card" style="border-color: #fca5a5; background: #fef2f2;">
            <div class="card-title" style="color: #dc2626;">Dette Totale</div>
            <div class="card-val" style="color: #dc2626;">${totalDebt.toFixed(2)} DA</div>
          </div>
        </div>

        <h3>Historique des Bons de Livraison</h3>
        <table>
          <thead>
            <tr>
              <th>N° Bon</th>
              <th>Date</th>
              <th>Camion</th>
              <th>Mode</th>
              <th class="text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            ${deliveries.map(d => `
              <tr>
                <td class="bold">${d.number}</td>
                <td>${formatDate(d.date)}</td>
                <td>${d.truckId || '-'}</td>
                <td>${d.paymentMode || 'Terme'}</td>
                <td class="text-right bold">${d.totalTTC.toFixed(2)} DA</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3 style="margin-top: 25px;">Historique des Règlements</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th>Référence</th>
              <th class="text-right">Montant Payé</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${formatDate(p.date)}</td>
                <td>${p.mode}</td>
                <td>${p.reference || '-'}</td>
                <td class="text-right bold" style="color: #15803d;">${p.amount.toFixed(2)} DA</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto flex flex-col max-h-[95vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            {/* Barcode representation box */}
            <div className="bg-slate-50 border border-slate-300 p-1.5 rounded-lg flex flex-col items-center justify-center shadow-2xs">
              <div className="flex gap-0.5 h-7 items-center px-1">
                {[3, 1, 4, 2, 5, 2, 4, 1, 3, 2, 4, 1, 5, 2].map((w, i) => (
                  <div 
                    key={i} 
                    className="bg-slate-900 h-full rounded-[0.5px]" 
                    style={{ width: `${w}px` }} 
                  />
                ))}
              </div>
              <span className="text-[9px] font-mono font-bold text-slate-600 tracking-wider">
                {customer.code}
              </span>
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                Profil du Client: <span className="text-blue-700">{customer.name}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                <span>Téléphone: {customer.phone || customer.mobile || 'Non renseigné'}</span>
                <span>•</span>
                <span className="font-mono">ID: {customer.code}</span>
                <span>•</span>
                <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-semibold text-[11px] border border-blue-200">
                  {customer.type}
                </span>
                {customer.wilaya && (
                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold text-[11px] border border-slate-300">
                    📍 {customer.wilaya}
                  </span>
                )}
                {customer.activityName && (
                  <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded font-semibold text-[11px] border border-indigo-200">
                    💼 {customer.activityName}
                  </span>
                )}
                {customer.hidePricesOnDeliveryNote && (
                  <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold text-[10px] border border-amber-300">
                    Sans prix B.L.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintSummary}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Facture récapitulative
            </button>

            <button
              type="button"
              onClick={handlePrintSummary}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimer le résumé
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 bg-slate-50/50 flex-1">
          
          {/* Top 3 Metric Cards (Exact match to screenshots 4 & 5) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Card 1: Total des Achats */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                Total des Achats
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-blue-600">
                {formatCurrency(totalPurchases)}
              </div>
              <span className="text-[11px] text-slate-400">
                {deliveries.length} bon(s) de livraison
              </span>
            </div>

            {/* Card 2: Dette Initiale (Restant) - Amber */}
            <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-2xs flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-tight">
                Dette Initiale (Restant)
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-amber-500">
                {formatCurrency(remainingInitialDebt)}
              </div>
              <span className="text-[11px] text-slate-400 font-mono font-medium">
                Original: {initialDebt.toFixed(2)}
              </span>
            </div>

            {/* Card 3: Dette Totale - Red Accent */}
            <div className="bg-white p-5 rounded-2xl border-2 border-red-200 shadow-2xs flex flex-col items-center justify-center text-center space-y-1 relative overflow-hidden">
              <div className="absolute bottom-0 inset-x-0 h-1 bg-red-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                Dette Totale
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-red-600">
                {formatCurrency(totalDebt)}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                {creditLimit > 0 ? (
                  isCreditLimitExceeded ? (
                    <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Plafond ({creditLimit} DA) dépassé
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                      Plafond: {creditLimit} DA
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Plafond non configuré</span>
                )}
              </div>
            </div>

          </div>

          {/* Section: Enregistrer un paiement (Screenshots 4 & 5) */}
          <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-xs space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                Enregistrer un paiement
              </h3>
              {paymentSuccess && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {paymentSuccess}
                </div>
              )}
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                
                {/* Montant Payé */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Enregistrer un paiement (Montant DA) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Entrez le montant payé par le client..."
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm font-mono font-bold text-slate-900 bg-white border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal"
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      DA
                    </span>
                  </div>
                </div>

                {/* Date de paiement */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Date de paiement
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Mode de paiement */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Mode de paiement
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Espèces (Cash)">Espèces (Cash)</option>
                    <option value="Chèque bancaire">Chèque bancaire</option>
                    <option value="Chèque postal (CCP)">Chèque postal (CCP)</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                {/* Référence (optionnel) */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Référence (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="N° chèque / virement..."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>

              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Notes supplémentaires..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>

              {/* Bottom Submit Bar with Checkbox */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Imprimer le reçu automatiquement</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  Confirmer le paiement
                </button>
              </div>

            </form>

          </div>

          {/* Bottom Dual Tables: Factures de vente & Historique des paiements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Table 1: Factures / Bons de vente */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <FileText className="h-4 w-4 text-blue-600" />
                Factures de vente / Bons de livraison
              </h4>

              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5">N° / Date</th>
                      <th className="py-2 px-2.5 text-right">Total</th>
                      <th className="py-2 px-2.5 text-center">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveries.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400 italic">
                          Aucun historique de vente.
                        </td>
                      </tr>
                    ) : (
                      deliveries.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5">
                            <div className="font-mono font-bold text-slate-900">{d.number}</div>
                            <div className="text-[10px] text-slate-400">{formatDate(d.date)}</div>
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(d.totalTTC)}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.paymentMode === 'Terme' 
                                ? 'bg-amber-100 text-amber-900' 
                                : 'bg-emerald-100 text-emerald-900'
                            }`}>
                              {d.paymentMode || 'Terme'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Historique des paiements */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Historique des paiements reçus
              </h4>

              <div className="overflow-x-auto max-h-56">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-emerald-50/60 text-emerald-950 sticky top-0 font-semibold border-b border-emerald-200">
                    <tr>
                      <th className="py-2 px-2.5">Date</th>
                      <th className="py-2 px-2.5 text-right">Montant Payé</th>
                      <th className="py-2 px-2.5">Mode / Réf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400 italic">
                          Aucun historique de paiement.
                        </td>
                      </tr>
                    ) : (
                      payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-mono text-slate-700">
                            {formatDate(p.date)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="py-2 px-2.5">
                            <div className="font-medium text-slate-800">{p.mode}</div>
                            {p.reference && <div className="text-[10px] text-slate-400 font-mono">Réf: {p.reference}</div>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Fermer
          </Button>
        </div>

      </div>
    </div>
  );
}
