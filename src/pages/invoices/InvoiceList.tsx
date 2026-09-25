import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Search, Printer, FileText, CheckCircle2, X, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
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

  const invoices = useLiveQuery(() => db.invoices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const companySettings = useLiveQuery(() => db.settings.toCollection().first());
  const unbilledDeliveries = useLiveQuery(() => 
    db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(d => d.status === 'validated').toArray()
  );

  const getCustomer = (id: string) => customers?.find(c => c.id === id);
  const getCustomerName = (id: string) => getCustomer(id)?.name || id;

  const filteredInvoices = invoices?.filter(i => 
    i.number.toLowerCase().includes(search.toLowerCase()) || 
    getCustomerName(i.customerId).toLowerCase().includes(search.toLowerCase())
  );

  const handlePrintInvoice = async (invoice: Invoice) => {
    const cust = getCustomer(invoice.customerId);
    const rawItems = await db.invoiceItems.where('invoiceId').equals(invoice.id).toArray();
    
    // Group or format items
    const printItems: InvoiceItemPrintData[] = rawItems.map(item => {
      const prod = products?.find(p => p.id === item.productId);
      return {
        designation: prod?.name || 'Matériaux / Agrégats',
        unit: prod?.unit || 'Tonne',
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

  const handleGenerateInvoices = async () => {
    if (!unbilledDeliveries || unbilledDeliveries.length === 0) {
      alert("Il n'y a aucun Bon de Livraison non facturé.");
      return;
    }

    if (!window.confirm(`Générer les factures pour ${unbilledDeliveries.length} Bon(s) de Livraison ?`)) return;

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
        const invoiceNumber = `FAC-2026-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`;
        
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
              totalHT: item.totalHT
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
          paymentMode: 'Terme'
        });
      }

      alert("Facturation générée avec succès.");
    } catch (error) {
      console.error(error);
      alert("Une erreur est survenue lors de la facturation.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Facturation</h1>
          <p className="text-slate-500">Gestion des factures et facturation automatique des B.L</p>
        </div>
        <Button 
          onClick={handleGenerateInvoices} 
          isLoading={isGenerating}
          disabled={!unbilledDeliveries || unbilledDeliveries.length === 0}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Facturer les B.L en attente ({unbilledDeliveries?.length || 0})
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Rechercher Facture ou client..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
            {filteredInvoices?.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-bold text-slate-700">{inv.number}</TableCell>
                <TableCell>{formatDate(inv.date)}</TableCell>
                <TableCell className="font-medium">{getCustomerName(inv.customerId)}</TableCell>
                <TableCell className="font-bold text-slate-900">{formatCurrency(inv.totalTTC)}</TableCell>
                <TableCell>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    inv.status === 'validated' ? 'bg-blue-100 text-blue-800' :
                    inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                    inv.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {inv.status === 'validated' ? 'À régler' :
                     inv.status === 'paid' ? 'Payée' : inv.status}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      title="Visualiser et Imprimer Facture" 
                      onClick={() => handlePrintInvoice(inv)}
                      className="text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      <Printer className="h-4 w-4 mr-1.5" />
                      Imprimer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredInvoices?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">Aucune facture</TableCell>
              </TableRow>
            )}
          </tbody>
        </Table>
      </div>

      {/* Invoice Print & Preview Modal */}
      {selectedInvoiceForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Impression de la Facture</h3>
                  <p className="text-xs text-slate-500 font-mono">N° {selectedInvoiceForPrint.number}</p>
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

