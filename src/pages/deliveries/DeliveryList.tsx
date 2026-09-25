import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, Printer, Edit, Trash2, X, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { executePrint, generateBLHtml, type DeliveryPrintData } from '../../lib/printReceipt';
import { useTranslation, formatLocalizedCurrency, formatLocalizedDate } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

export function DeliveryList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedBlForPrint, setSelectedBlForPrint] = useState<(DeliveryPrintData & { id: string }) | null>(null);
  const [printFormat, setPrintFormat] = useState<'A4' | 'ticket'>('A4');
  const [blToDelete, setBlToDelete] = useState<{ id: string; number: string } | null>(null);

  const deliveries = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const deliveryItems = useLiveQuery(() => db.deliveryNoteItems.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const companySettings = useLiveQuery(() => db.settings.get(1));

  const getCustomer = (id: string) => customers?.find(c => c.id === id);
  const getCustomerName = (id: string) => getCustomer(id)?.name || id;
  const getTruck = (id: string) => trucks?.find(t => t.id === id);
  const getTruckMatricule = (id: string) => getTruck(id)?.matricule || id;
  const getDriver = (id?: string) => drivers?.find(d => d.id === id);

  const filteredDeliveries = deliveries?.filter(d => 
    d.number.toLowerCase().includes(search.toLowerCase()) || 
    getCustomerName(d.customerId).toLowerCase().includes(search.toLowerCase()) ||
    getTruckMatricule(d.truckId).toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenPrint = (bl: any) => {

    const cust = getCustomer(bl.customerId);
    const truck = getTruck(bl.truckId);
    const driver = getDriver(bl.driverId);
    const item = deliveryItems?.find(i => i.deliveryNoteId === bl.id);
    const prod = item ? products?.find(p => p.id === item.productId) : null;

    setSelectedBlForPrint({
      id: bl.id,
      number: bl.number,
      date: bl.date,
      customerName: cust?.name || 'Client',
      customerCode: cust?.code || '',
      customerAddress: cust?.address || '',
      productName: prod?.name || 'Agrégats',
      productCode: prod?.code || '',
      productUnit: prod?.unit || 'Tonne',
      truckMatricule: truck?.matricule || '',
      driverName: driver?.name || 'Chauffeur',
      grossWeight: bl.grossWeight || 0,
      tare: bl.tare || 0,
      netWeight: bl.netWeight || 0,
      priceHT: item?.priceHT || (bl.netWeight > 0 ? bl.totalHT / bl.netWeight : 0),
      totalHT: bl.totalHT,
      totalTVA: bl.totalTVA,
      totalTTC: bl.totalTTC,
      tvaRate: cust?.tvaExempt ? 0 : 19,
      hidePrices: cust?.hidePricesOnDeliveryNote || false,
      destination: bl.destination,
      remarks: bl.remarks,
      companyName: companySettings?.name || 'CARISOFT.next CARRIÈRE',
      companyPhone: companySettings?.phone || '025 00 00 00',
      companyAddress: companySettings?.address,
      companyLogo: companySettings?.logoUrl
    });
  };

  const handleConfirmDelete = async () => {
    if (!blToDelete) return;
    try {
      await db.deliveryNotes.delete(blToDelete.id);
      await db.deliveryNoteItems.where('deliveryNoteId').equals(blToDelete.id).delete();
      setBlToDelete(null);
    } catch (err) {
      console.error('Error deleting delivery note', err);
    }
  };

  const handleDownloadFile = () => {
    if (!selectedBlForPrint) return;
    const html = generateBLHtml(selectedBlForPrint, printFormat);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedBlForPrint.number}_${printFormat}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.deliveries.title}</h1>
          <p className="text-slate-500">{t.deliveries.subtitle}</p>
        </div>
        <Button onClick={() => navigate('new')} className="bg-blue-600 hover:bg-blue-500 cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          {t.deliveries.newDelivery}
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
          <Input 
            placeholder={t.searchPlaceholder} 
            className="pl-9 rtl:pl-3 rtl:pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.deliveries.blNumber}</TableHead>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.client}</TableHead>
                <TableHead>{t.deliveries.truck}</TableHead>
                <TableHead className="text-right rtl:text-left">{t.deliveries.grossWeight}</TableHead>
                <TableHead className="text-right rtl:text-left">{t.deliveries.tareWeight}</TableHead>
                <TableHead className="text-right rtl:text-left">{t.deliveries.netWeight}</TableHead>
                <TableHead className="text-right rtl:text-left">{t.totalTTC}</TableHead>
                <TableHead className="text-right rtl:text-left">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {filteredDeliveries?.map(bl => (
                <TableRow key={bl.id}>
                  <TableCell className="font-bold font-mono text-blue-600">{bl.number}</TableCell>
                  <TableCell className="text-xs text-slate-600">{formatLocalizedDate(bl.date)}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{getCustomerName(bl.customerId)}</TableCell>
                  <TableCell className="font-mono text-xs">{getTruckMatricule(bl.truckId)}</TableCell>
                  <TableCell className="text-right rtl:text-left font-mono text-xs text-slate-500">{(bl.grossWeight || 0).toFixed(2)} T</TableCell>
                  <TableCell className="text-right rtl:text-left font-mono text-xs text-slate-500">{(bl.tare || 0).toFixed(2)} T</TableCell>
                  <TableCell className="text-right rtl:text-left font-mono font-bold text-blue-700">{bl.netWeight.toFixed(2)} T</TableCell>
                  <TableCell className="text-right rtl:text-left font-mono font-bold text-slate-900">{formatLocalizedCurrency(bl.totalTTC)}</TableCell>
                  <TableCell className="text-right rtl:text-left">
                    <div className="flex justify-end rtl:justify-start gap-1.5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleOpenPrint(bl)} 
                        title={t.print}
                        className="cursor-pointer text-blue-600 hover:bg-blue-50"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(bl.id)} 
                        title={t.edit}
                        className="cursor-pointer text-slate-600 hover:text-slate-900"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setBlToDelete({ id: bl.id, number: bl.number })} 
                        title={t.delete}
                        className="cursor-pointer text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDeliveries?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">{t.noData || t.na}</TableCell>
                </TableRow>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Delete BL Modal */}
      {blToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{t.delete}</h3>
                  <p className="text-xs text-slate-500 font-mono">B.L N° {blToDelete.number}</p>
                </div>
              </div>
              <button 
                onClick={() => setBlToDelete(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              {t.confirm} {blToDelete.number} ?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setBlToDelete(null)}
                className="cursor-pointer font-medium"
              >
                {t.cancel}
              </Button>
              <Button 
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer font-bold"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t.delete}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {selectedBlForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-blue-400" />
                <h3 className="font-bold">{t.print} - {selectedBlForPrint.number}</h3>
              </div>
              <button 
                onClick={() => setSelectedBlForPrint(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex gap-4 border-b border-slate-200 pb-4">
                <button
                  onClick={() => setPrintFormat('A4')}
                  className={`flex-1 p-3 rounded-xl border font-bold text-sm cursor-pointer transition-all ${
                    printFormat === 'A4' 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-xs' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.deliveries.printBL} (A4 / A5)
                </button>
                <button
                  onClick={() => setPrintFormat('ticket')}
                  className={`flex-1 p-3 rounded-xl border font-bold text-sm cursor-pointer transition-all ${
                    printFormat === 'ticket' 
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-xs' 
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t.deliveries.printTicket} (80mm)
                </button>
              </div>

              {/* Summary of BL */}
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.client} :</span>
                  <span className="font-bold text-slate-800">{selectedBlForPrint.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.products.title} :</span>
                  <span className="font-bold text-slate-800">{selectedBlForPrint.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.deliveries.truck} :</span>
                  <span className="font-mono font-bold text-slate-800">{selectedBlForPrint.truckMatricule}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">{t.deliveries.netWeight} :</span>
                  <span className="font-mono font-bold text-blue-600">{selectedBlForPrint.netWeight.toFixed(2)} T</span>
                </div>
                {!selectedBlForPrint.hidePrices && (
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-500">{t.totalTTC} :</span>
                    <span className="font-mono font-bold text-slate-900">{formatLocalizedCurrency(selectedBlForPrint.totalTTC)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadFile}
                  className="cursor-pointer text-slate-700"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  {t.export} HTML
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate(`/deliveries/print/${selectedBlForPrint.id}?format=${printFormat}`)}
                  className="cursor-pointer text-slate-700"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  {t.details}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedBlForPrint(null)}
                  className="cursor-pointer"
                >
                  {t.close}
                </Button>
                <Button 
                  onClick={() => executePrint(selectedBlForPrint, printFormat)}
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer font-bold"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  {t.print}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
