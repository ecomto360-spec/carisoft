import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { db } from '../../db/db';
import { DeliveryNote, Customer, Truck, Driver } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { 
  Plus, Search, Printer, Edit, Trash2, X, AlertCircle, 
  ChevronLeft, ChevronRight, Sparkles 
} from 'lucide-react';
import { 
  executePrint, 
  generateBLHtml, 
  getStoredPrintFormat, 
  setStoredPrintFormat, 
  type DeliveryPrintData, 
  type DeliveryPrintFormat 
} from '../../lib/printReceipt';
import { useTranslation, formatLocalizedCurrency, formatLocalizedDate } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { useDebounce } from '../../hooks/useDebounce';

const PAGE_SIZE = 50;

// Memoized Delivery Note Row
interface DeliveryRowProps {
  bl: DeliveryNote;
  customerName: string;
  truckMatricule: string;
  onOpenPrint: (bl: DeliveryNote) => void;
  onEdit: (id: string) => void;
  onDelete: (bl: { id: string; number: string }) => void;
  printText: string;
  editText: string;
  deleteText: string;
}

const DeliveryRow = React.memo(function DeliveryRow({
  bl,
  customerName,
  truckMatricule,
  onOpenPrint,
  onEdit,
  onDelete,
  printText,
  editText,
  deleteText,
}: DeliveryRowProps) {
  return (
    <TableRow className="h-[52px]">
      <TableCell className="font-bold font-mono text-blue-600">{bl.number}</TableCell>
      <TableCell className="text-xs text-slate-600">{formatLocalizedDate(bl.date)}</TableCell>
      <TableCell className="font-semibold text-slate-900">{customerName}</TableCell>
      <TableCell className="font-mono text-xs">{truckMatricule}</TableCell>
      <TableCell className="text-right rtl:text-left font-mono text-xs text-slate-500">
        {(bl.grossWeight || 0).toFixed(2)} T
      </TableCell>
      <TableCell className="text-right rtl:text-left font-mono text-xs text-slate-500">
        {(bl.tare || 0).toFixed(2)} T
      </TableCell>
      <TableCell className="text-right rtl:text-left font-mono font-bold text-blue-700">
        {bl.netWeight.toFixed(2)} T
      </TableCell>
      <TableCell className="text-right rtl:text-left font-mono font-bold text-slate-900">
        {formatLocalizedCurrency(bl.totalTTC)}
      </TableCell>
      <TableCell className="text-right rtl:text-left">
        <div className="flex justify-end rtl:justify-start gap-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onOpenPrint(bl)} 
            title={printText}
            className="cursor-pointer text-blue-600 hover:bg-blue-50"
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onEdit(bl.id)} 
            title={editText}
            className="cursor-pointer text-slate-600 hover:text-slate-900"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete({ id: bl.id, number: bl.number })} 
            title={deleteText}
            className="cursor-pointer text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function DeliveryList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);

  const [selectedBlForPrint, setSelectedBlForPrint] = useState<(DeliveryPrintData & { id: string }) | null>(null);
  const [printFormat, setPrintFormatState] = useState<DeliveryPrintFormat>(getStoredPrintFormat());
  const setPrintFormat = (fmt: DeliveryPrintFormat) => {
    setPrintFormatState(fmt);
    setStoredPrintFormat(fmt);
  };
  const [blToDelete, setBlToDelete] = useState<{ id: string; number: string } | null>(null);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Total count via Dexie index count
  const totalDeliveriesCount = useLiveQuery(
    () => currentCompanyId ? db.deliveryNotes.where('companyId').equals(currentCompanyId).count() : 0,
    [currentCompanyId]
  ) || 0;

  // Reset page when searching
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  // Targeted query for Delivery Notes (pagination or search limit)
  const deliveries = useLiveQuery(async () => {
    if (!currentCompanyId) return [];
    const q = debouncedSearch.trim().toLowerCase();

    if (q) {
      return await db.deliveryNotes
        .where('companyId')
        .equals(currentCompanyId)
        .filter((d) => d.number.toLowerCase().includes(q))
        .limit(100)
        .toArray();
    }

    return await db.deliveryNotes
      .where('companyId')
      .equals(currentCompanyId)
      .reverse()
      .offset(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();
  }, [currentCompanyId, debouncedSearch, page]);

  const deliveryItems = useMemo(() => deliveries || [], [deliveries]);

  // Targeted resolution of customers & trucks ONLY for the current page
  const pageLookup = useLiveQuery(async () => {
    if (!deliveryItems.length) return { customers: new Map<string, string>(), trucks: new Map<string, string>() };

    const cIds = Array.from(new Set(deliveryItems.map(d => d.customerId).filter(Boolean))) as string[];
    const tIds = Array.from(new Set(deliveryItems.map(d => d.truckId).filter(Boolean))) as string[];

    const custRecords = await db.customers.where('id').anyOf(cIds).toArray();
    const truckRecords = await db.trucks.where('id').anyOf(tIds).toArray();

    const cMap = new Map<string, string>();
    custRecords.forEach(c => cMap.set(c.id, c.name));

    const tMap = new Map<string, string>();
    truckRecords.forEach(t => tMap.set(t.id, t.matricule));

    return { customers: cMap, trucks: tMap };
  }, [deliveryItems]);

  const getCustomerName = (id: string) => pageLookup?.customers.get(id) || id;
  const getTruckMatricule = (id: string) => pageLookup?.trucks.get(id) || id;

  // Virtualizer for fixed row height
  const virtualizer = useVirtualizer({
    count: deliveryItems.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const handleOpenPrint = useCallback(async (bl: DeliveryNote) => {
    const cust = await db.customers.get(bl.customerId);
    const truck = await db.trucks.get(bl.truckId);
    const driver = bl.driverId ? await db.drivers.get(bl.driverId) : null;
    const item = await db.deliveryNoteItems.where('deliveryNoteId').equals(bl.id).first();
    const prod = item ? await db.products.get(item.productId) : null;
    const companySettings = await db.settings.get(1);

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
  }, []);

  const handleEdit = useCallback((id: string) => {
    navigate(id);
  }, [navigate]);

  const handleDelete = useCallback((bl: { id: string; number: string }) => {
    setBlToDelete(bl);
  }, []);

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

  const isSearchActive = Boolean(debouncedSearch.trim());
  const totalPages = Math.ceil(totalDeliveriesCount / PAGE_SIZE) || 1;

  // Virtual rows and spacers
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0 
    ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800">{t.deliveries.title}</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="h-3 w-3" />
              Mode Haute Performance (50 000+ BL)
            </span>
          </div>
          <p className="text-slate-500">{t.deliveries.subtitle}</p>
        </div>
        <Button onClick={() => navigate('new')} className="bg-blue-600 hover:bg-blue-500 cursor-pointer text-white font-bold">
          <Plus className="h-4 w-4 mr-2" />
          {t.deliveries.newDelivery}
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
            <Input 
              placeholder="Rechercher par N° de BL..." 
              className="pl-9 rtl:pl-3 rtl:pr-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Pagination Controls */}
          {!isSearchActive && totalDeliveriesCount > PAGE_SIZE && (
            <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold self-end sm:self-auto">
              <span>Page {page + 1} sur {totalPages} ({totalDeliveriesCount} BL)</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {isSearchActive && (
            <div className="text-xs text-slate-500 font-medium">
              {deliveryItems.length} bon(s) de livraison trouvé(s) pour « {debouncedSearch} »
            </div>
          )}
        </div>

        {/* Virtualized Deliveries Table */}
        <div 
          ref={tableScrollRef}
          className="overflow-x-auto overflow-y-auto max-h-[620px] border border-slate-200 rounded-lg"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-2xs">
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
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={9} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const bl = deliveryItems[virtualRow.index];
                if (!bl) return null;
                return (
                  <DeliveryRow
                    key={bl.id}
                    bl={bl}
                    customerName={getCustomerName(bl.customerId)}
                    truckMatricule={getTruckMatricule(bl.truckId)}
                    onOpenPrint={handleOpenPrint}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    printText={t.print}
                    editText={t.edit}
                    deleteText={t.delete}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={9} />
                </tr>
              )}
              {deliveryItems.length === 0 && (
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
              >
                {t.cancel}
              </Button>
              <Button 
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                {t.delete}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {selectedBlForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                Aperçu du Bon de Livraison #{selectedBlForPrint.number}
              </h3>
              <button 
                onClick={() => setSelectedBlForPrint(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Print format selector */}
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Format d'impression :</span>
              {(['standard', 'a5', 'ticket'] as DeliveryPrintFormat[]).map((fmt) => (
                <label key={fmt} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="printFormat"
                    value={fmt}
                    checked={printFormat === fmt}
                    onChange={() => setPrintFormat(fmt)}
                    className="text-blue-600"
                  />
                  <span className="capitalize">{fmt}</span>
                </label>
              ))}
            </div>

            {/* Document preview iframe */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-inner">
              <iframe
                title="Preview BL"
                srcDoc={generateBLHtml(selectedBlForPrint, printFormat)}
                className="w-full h-[400px] border-none"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={handleDownloadFile}>
                Télécharger HTML
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedBlForPrint(null)}>
                  Fermer
                </Button>
                <Button 
                  onClick={() => executePrint(selectedBlForPrint, printFormat)} 
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Imprimer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
