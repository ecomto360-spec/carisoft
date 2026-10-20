import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { 
  Search, Printer, FileText, CheckCircle2, X, Download, Plus, 
  Edit, Ban, AlertTriangle, Info, HelpCircle 
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getNextInvoiceNumber } from '../../lib/invoiceNumber';
import { executePrintInvoice, generateInvoiceHtml, type InvoicePrintData, type InvoiceItemPrintData } from '../../lib/printReceipt';
import type { Invoice } from '../../types';
import { useAuthStore } from '../../store/authStore';

export function InvoiceList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<InvoicePrintData | null>(null);

  // Modale de visualisation du motif d'annulation
  const [invoiceToViewReason, setInvoiceToViewReason] = useState<Invoice | null>(null);

  // Modale d'annulation rapide avec motif obligatoire
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const invoices = useLiveQuery(() => 
    db.invoices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray(),
    [currentCompanyId]
  );
  const customers = useLiveQuery(() => 
    db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray(),
    [currentCompanyId]
  );
  const products = useLiveQuery(() => 
    db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray(),
    [currentCompanyId]
  );
  const companySettings = useLiveQuery(() => db.settings.toCollection().first());
  const unbilledDeliveries = useLiveQuery(() => 
    db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(d => d.status === 'validated').toArray(),
    [currentCompanyId]
  );

  const getCustomer = (id: string) => customers?.find(c => c.id === id);
  const getCustomerName = (id: string) => getCustomer(id)?.name || id;

  const filteredInvoices = invoices?.filter(i => 
    i.number.toLowerCase().includes(search.toLowerCase()) || 
    getCustomerName(i.customerId).toLowerCase().includes(search.toLowerCase()) ||
    (i.cancelReason && i.cancelReason.toLowerCase().includes(search.toLowerCase()))
  );

  const handlePrintInvoice = async (invoice: Invoice) => {
    const cust = getCustomer(invoice.customerId);
    const rawItems = await db.invoiceItems.where('invoiceId').equals(invoice.id).toArray();
    
    // Group or format items
    const printItems: InvoiceItemPrintData[] = rawItems.map(item => {
      const prod = products?.find(p => p.id === item.productId);
      return {
        designation: item.customDesignation || prod?.name || 'Matériaux / Agrégats',
        unit: item.unit || prod?.unit || 'Tonne',
        quantity: item.quantity,
        priceHT: item.priceHT,
        totalHT: item.totalHT
      };
    });

    // If no explicit items found, create a fallback item
    if (printItems.length === 0) {
      printItems.push({
        designation: 'Enlèvement Agrégats & Matériaux de Construction',
        unit: 'Prestation',
        quantity: 1,
        priceHT: invoice.totalHT,
        totalHT: invoice.totalHT
      });
    }

    const payload: InvoicePrintData = {
      number: invoice.number,
      date: invoice.date,
      customerName: cust?.name || 'Client',
      customerCode: cust?.code || '',
      customerAddress: cust?.address || '',
      customerRC: cust?.rc || '',
      customerNIF: cust?.nif || '',
      customerNIS: cust?.nis || '',
      customerArticle: cust?.article || '',
      customerPhone: cust?.phone || '',
      paymentMode: invoice.paymentMode || 'Terme',
      items: printItems,
      totalHT: invoice.totalHT,
      tvaRate: cust?.tvaExempt ? 0 : 19,
      totalTVA: invoice.totalTVA,
      timbre: invoice.timbre || 0,
      totalTTC: invoice.totalTTC,
      status: invoice.status,
      isCancelled: invoice.status === 'cancelled' || Boolean(invoice.cancelReason),
      cancelReason: invoice.cancelReason,
      cancelledAt: invoice.cancelledAt,
      cancelledBy: invoice.cancelledBy,
      notes: invoice.notes,
      orderNumber: invoice.customerRef || invoice.orderNumber,
      companyName: companySettings?.name || 'SARL MAHAJIR SIDAR',
      companyActivity: companySettings?.activity || 'Extraction & Concassage de Matériaux de Construction',
      companyAddress: companySettings?.address || 'Zone Industrielle',
      companyPhone: companySettings?.phone || '025 00 00 00',
      companyEmail: companySettings?.email || '',
      companyNif: companySettings?.nif || '',
      companyNis: companySettings?.nis || '',
      companyRc: companySettings?.rc || '',
      companyArticle: companySettings?.article || '',
      companyBank: companySettings?.bank || '',
      companyCapital: companySettings?.capital || undefined,
      companyLogo: companySettings?.logoUrl || companySettings?.logo
    };

    setSelectedInvoiceForPrint(payload);
  };

  const handleDownloadInvoiceHtml = () => {
    if (!selectedInvoiceForPrint) return;
    const html = generateInvoiceHtml(selectedInvoiceForPrint);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedInvoiceForPrint.number}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Annulation avec justification obligatoire
  const handleConfirmCancel = async () => {
    if (!invoiceToCancel) return;
    if (!cancelReasonInput.trim() || cancelReasonInput.trim().length < 5) {
      setNotification({ type: 'error', message: "La justification de l'annulation est obligatoire (au moins 5 caractères)." });
      return;
    }

    setIsCancelling(true);
    try {
      const nowIso = new Date().toISOString();
      const author = user?.name || user?.username || 'Commercial';

      await db.invoices.update(invoiceToCancel.id, {
        status: 'cancelled',
        cancelReason: cancelReasonInput.trim(),
        cancelledAt: nowIso,
        cancelledBy: author,
        updatedAt: nowIso
      });

      setNotification({ type: 'success', message: `Facture N° ${invoiceToCancel.number} annulée avec succès (Avoir).` });
      setInvoiceToCancel(null);
      setCancelReasonInput('');
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: "Erreur lors de l'annulation de la facture." });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleGenerateInvoices = async () => {
    if (!unbilledDeliveries || unbilledDeliveries.length === 0) {
      setNotification({ type: 'error', message: "Il n'y a aucun Bon de Livraison non facturé." });
      return;
    }

    setIsGenerating(true);
    try {
      // Group by customer
      const deliveriesByCustomer = unbilledDeliveries.reduce((acc, bl) => {
        if (!acc[bl.customerId]) acc[bl.customerId] = [];
        acc[bl.customerId].push(bl);
        return acc;
      }, {} as Record<string, typeof unbilledDeliveries>);

      for (const [customerId, customerBLs] of Object.entries(deliveriesByCustomer)) {
        const invoiceId = crypto.randomUUID();
        // Utilise la séquence stricte annuelle AAAA/001
        const invoiceNumber = await getNextInvoiceNumber(currentCompanyId, new Date().toISOString());
        
        let totalHT = 0;
        let totalTVA = 0;
        let totalTTC = 0;
        const timbre = 1;

        // Create invoice items and calculate totals
        for (const bl of customerBLs) {
          totalHT += bl.totalHT;
          totalTVA += bl.totalTVA;
          totalTTC += bl.totalTTC;

          const items = await db.deliveryNoteItems.where('deliveryNoteId').equals(bl.id).filter(x => x.companyId === currentCompanyId).toArray();
          for (const item of items) {
            await db.invoiceItems.add({
              id: crypto.randomUUID(),
              invoiceId,
              productId: item.productId,
              quantity: item.quantity,
              priceHT: item.priceHT,
              totalHT: item.totalHT,
              companyId: currentCompanyId
            });
          }

          // Mark BL as invoiced
          await db.deliveryNotes.update(bl.id, { 
            status: 'invoiced',
            invoiceId
          });
        }

        // Add the Timbre to total TTC
        totalTTC += timbre;

        // Save Invoice
        await db.invoices.add({
          id: invoiceId,
          number: invoiceNumber,
          date: new Date().toISOString(),
          customerId,
          totalHT,
          totalTVA,
          timbre,
          totalTTC,
          status: 'validated',
          paymentMode: 'Terme',
          companyId: currentCompanyId,
          createdAt: new Date().toISOString()
        });
      }

      setNotification({ type: 'success', message: `Facturation générée avec succès pour ${unbilledDeliveries.length} Bon(s) de Livraison.` });
    } catch (error) {
      console.error(error);
      setNotification({ type: 'error', message: "Une erreur est survenue lors de la facturation." });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-2 animate-in fade-in ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span className="text-sm font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Facturation Client</h1>
          <p className="text-slate-500 text-sm">
            Facturation manuelle sur mesure • Numérotation séquentielle annuelle (ex: 2026/001) • Gestion des Avoirs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* BOUTON CRÉATION MANUELLE SUR MESURE */}
          <Button 
            onClick={() => navigate('/invoices/new')} 
            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle Facture Sur Mesure
          </Button>

          {/* BOUTON FACTURATION AUTOMATIQUE DES BL */}
          <Button 
            variant="outline"
            onClick={handleGenerateInvoices} 
            isLoading={isGenerating}
            disabled={!unbilledDeliveries || unbilledDeliveries.length === 0}
            className="cursor-pointer text-slate-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
            Facturer B.L ({unbilledDeliveries?.length || 0})
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Rechercher par N° Facture, client, motif d'annulation..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total TTC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {filteredInvoices?.map(inv => {
                const isCancelled = inv.status === 'cancelled' || Boolean(inv.cancelReason);

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
                    <TableCell className="font-mono font-black text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className={isCancelled ? 'line-through text-slate-400' : 'text-blue-700'}>
                          {inv.number}
                        </span>
                        {isCancelled && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                            AVOIR
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{formatDate(inv.date)}</TableCell>
                    <TableCell className="font-semibold text-slate-800">
                      {getCustomerName(inv.customerId)}
                      {inv.customerRef && (
                        <div className="text-[11px] text-slate-400 font-normal">
                          Réf: {inv.customerRef}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold font-mono text-slate-900">
                      {formatCurrency(inv.totalTTC)}
                    </TableCell>
                    <TableCell>
                      {isCancelled ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInvoiceToViewReason(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors cursor-pointer"
                            title="Cliquer pour voir le motif d'annulation"
                          >
                            <Ban className="h-3 w-3 text-red-600" />
                            <span>Annulée</span>
                            <Info className="h-3 w-3 text-red-500 ml-0.5" />
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full border ${
                          inv.status === 'validated' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {inv.status === 'validated' ? 'Validée (À régler)' :
                           inv.status === 'paid' ? 'Payée' : 'Brouillon'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {/* MODIFIER */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Modifier la facture" 
                          onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                          className="text-slate-700 hover:bg-slate-100 cursor-pointer text-xs font-bold"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1 text-slate-500" />
                          Modifier
                        </Button>

                        {/* IMPRIMER */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          title="Visualiser et Imprimer Facture" 
                          onClick={() => handlePrintInvoice(inv)}
                          className="text-blue-600 hover:bg-blue-50 cursor-pointer text-xs font-bold"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" />
                          Imprimer
                        </Button>

                        {/* ANNULER / AVOIR (si pas encore annulée) */}
                        {!isCancelled && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Annuler cette facture et émettre un avoir" 
                            onClick={() => {
                              setInvoiceToCancel(inv);
                              setCancelReasonInput('');
                            }}
                            className="text-red-600 hover:bg-red-50 cursor-pointer text-xs font-bold"
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" />
                            Annuler
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </tr>
                );
              })}
              {filteredInvoices?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                    Aucune facture trouvée.
                  </TableCell>
                </TableRow>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* MODALE 1 : CONSULTATION DU MOTIF D'ANNULATION */}
      {invoiceToViewReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-red-200 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-extrabold text-base">Justification de l'Annulation (Avoir)</h3>
              </div>
              <button 
                onClick={() => setInvoiceToViewReason(null)}
                className="text-red-100 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide font-bold">Facture Concernée</div>
                <div className="text-lg font-black font-mono text-slate-900 mt-0.5">
                  N° {invoiceToViewReason.number}
                </div>
                <div className="text-xs text-slate-600">
                  Client : <strong>{getCustomerName(invoiceToViewReason.customerId)}</strong> • Montant : <strong>{formatCurrency(invoiceToViewReason.totalTTC)}</strong>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <span className="text-xs font-extrabold text-red-800 uppercase tracking-wide block mb-1">
                  Motif d'annulation justifié par le commercial :
                </span>
                <p className="text-sm font-semibold text-red-950 italic">
                  « {invoiceToViewReason.cancelReason || 'Aucun motif renseigné.'} »
                </p>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                {invoiceToViewReason.cancelledAt && (
                  <div>
                    Date de l'annulation : <strong>{formatDate(invoiceToViewReason.cancelledAt)}</strong>
                  </div>
                )}
                {invoiceToViewReason.cancelledBy && (
                  <div>
                    Annulée par : <strong>{invoiceToViewReason.cancelledBy}</strong>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button 
                  size="sm" 
                  onClick={() => setInvoiceToViewReason(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white"
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 2 : CONFIRMATION D'ANNULATION OBLIGATOIRE */}
      {invoiceToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-red-200 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                <h3 className="font-extrabold text-base">Annuler la Facture N° {invoiceToCancel.number}</h3>
              </div>
              <button 
                onClick={() => setInvoiceToCancel(null)}
                className="text-red-100 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900">
                <p className="font-bold text-red-950 mb-1">
                  ⚠️ Annulation comptable définitive (Facture d'Avoir)
                </p>
                Vous devez <strong>obligatoirement justifier la raison</strong> de cette annulation. Cette note sera conservée et affichée dans le dossier de la facture.
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide block mb-1">
                  Motif / Justification obligatoire de l'annulation <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex : Erreur sur le tonnage négocié, retour de marchandise défectueuse, ou réémission d'une facture corrigée..."
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Suggestions rapides */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Motifs fréquents :</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Erreur de facturation sur le prix",
                    "Erreur de client / Réédition requise",
                    "Retour marchandise ou refus",
                    "Avoir commercial négocié"
                  ].map(motif => (
                    <button
                      key={motif}
                      type="button"
                      onClick={() => setCancelReasonInput(motif)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      {motif}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setInvoiceToCancel(null)}
                  disabled={isCancelling}
                >
                  Abandonner
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleConfirmCancel}
                  disabled={!cancelReasonInput.trim() || cancelReasonInput.trim().length < 5 || isCancelling}
                  isLoading={isCancelling}
                  className="bg-red-600 hover:bg-red-500 text-white font-extrabold"
                >
                  <Ban className="h-4 w-4 mr-1.5" />
                  Confirmer l'Annulation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 3 : APERÇU ET IMPRESSION FACTURE */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedInvoiceForPrint.isCancelled ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>Impression Facture N° {selectedInvoiceForPrint.number}</span>
                    {selectedInvoiceForPrint.isCancelled && (
                      <span className="text-xs font-black bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        ANNULÉE / AVOIR
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">{selectedInvoiceForPrint.customerName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadInvoiceHtml} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-1.5" />
                  Exporter HTML
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => executePrintInvoice(selectedInvoiceForPrint)} 
                  className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer font-bold"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Imprimer
                </Button>
                <button 
                  onClick={() => setSelectedInvoiceForPrint(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Preview Box */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
              <div 
                className="bg-white shadow-lg rounded-xl overflow-hidden max-w-3xl w-full p-8"
                dangerouslySetInnerHTML={{ __html: generateInvoiceHtml(selectedInvoiceForPrint) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
