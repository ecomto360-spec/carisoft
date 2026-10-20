import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { 
  Plus, Search, Edit, FileText, AlertTriangle, FileSpreadsheet, 
  Trash2, AlertCircle, EyeOff, Youtube, MapPin, Briefcase, Sparkles,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { CustomerProfileModal } from '../../components/clients/CustomerProfileModal';
import { ClientExcelModal } from '../../components/clients/ClientExcelModal';
import { Customer } from '../../types';
import { useTranslation, formatLocalizedCurrency } from '../../i18n';
import { useDebounce } from '../../hooks/useDebounce';

const PAGE_SIZE = 50;

// Memoized Client Row Component
interface ClientRowProps {
  client: Customer;
  currency: string;
  na: string;
  unlimitedText: string;
  profileSheetText: string;
  editText: string;
  deleteText: string;
  onSelectProfile: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (client: Customer) => void;
}

const ClientRow = React.memo(function ClientRow({
  client,
  currency,
  na,
  unlimitedText,
  profileSheetText,
  editText,
  deleteText,
  onSelectProfile,
  onEdit,
  onDelete,
}: ClientRowProps) {
  const balance = client.balance || 0;
  const debt = balance < 0 ? Math.abs(balance) : 0;
  const creditLimit = client.creditLimit || 0;
  const isLimitExceeded = creditLimit > 0 && debt > creditLimit;

  return (
    <TableRow 
      className="hover:bg-blue-50/50 cursor-pointer h-[58px]"
      onClick={() => onSelectProfile(client.id)}
    >
      <TableCell className="font-mono font-bold text-slate-900">{client.code}</TableCell>
      <TableCell>
        <div className="font-bold text-slate-900">{client.name}</div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          {client.phone && <span>{client.phone}</span>}
          {client.mobile && <span>• {client.mobile}</span>}
        </div>
      </TableCell>

      {/* Wilaya & Activity */}
      <TableCell>
        <div className="space-y-1">
          {client.wilaya ? (
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
              <MapPin className="h-3 w-3 text-blue-600 shrink-0" />
              <span>{client.wilaya}</span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">Wilaya non spécifiée</span>
          )}

          {client.activityName ? (
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                <Briefcase className="h-2.5 w-2.5 text-indigo-600" />
                {client.activityName}
              </span>
            </div>
          ) : null}
        </div>
      </TableCell>

      <TableCell>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          {client.type || na}
        </span>
      </TableCell>
      
      <TableCell className="font-mono">
        {(() => {
          const initBal = client.initialBalance !== undefined 
            ? client.initialBalance 
            : (client.initialDebt ? -(client.initialDebt) : 0);
          if (initBal < 0) {
            return (
              <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200 text-xs">
                {formatLocalizedCurrency(initBal)}
              </span>
            );
          } else if (initBal > 0) {
            return (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                +{formatLocalizedCurrency(initBal)}
              </span>
            );
          }
          return <span className="text-slate-400 text-xs">-</span>;
        })()}
      </TableCell>
      <TableCell className="font-mono text-slate-700">
        {creditLimit > 0 ? (
          <span className="text-blue-800 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            {formatLocalizedCurrency(creditLimit)}
          </span>
        ) : (
          <span className="text-slate-400">{unlimitedText}</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 font-mono font-bold">
          {balance < 0 ? (
            <span className="text-red-600">
              {formatLocalizedCurrency(balance)} ({formatLocalizedCurrency(debt)})
            </span>
          ) : balance > 0 ? (
            <span className="text-emerald-700">
              +{formatLocalizedCurrency(balance)}
            </span>
          ) : (
            <span className="text-slate-600">0 {currency}</span>
          )}
          {isLimitExceeded && (
            <span title="Credit limit exceeded" className="text-red-500 animate-pulse">
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right rtl:text-left" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end rtl:justify-start gap-1.5">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onSelectProfile(client.id)} 
            title={profileSheetText}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onEdit(client.id)} 
            title={editText}
            className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(client)} 
            title={deleteText}
            className="text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function ClientList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);

  const [selectedCustomerIdForProfile, setSelectedCustomerIdForProfile] = useState<string | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Total count via Dexie index count (instantaneous, zero heap usage)
  const totalClientsCount = useLiveQuery(
    () => currentCompanyId 
      ? db.customers.where('companyId').equals(currentCompanyId).filter(c => c.active !== false).count() 
      : 0,
    [currentCompanyId]
  ) || 0;

  // Reset pagination on search
  React.useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  // Targeted Dexie query: paginated or capped search
  const clients = useLiveQuery(async () => {
    if (!currentCompanyId) return [];
    const q = debouncedSearch.trim().toLowerCase();

    if (q) {
      return await db.customers
        .where('companyId')
        .equals(currentCompanyId)
        .filter((c) => {
          if (c.active === false) return false;
          const name = c.name?.toLowerCase() || '';
          const code = c.code?.toLowerCase() || '';
          const type = c.type?.toLowerCase() || '';
          const wilaya = c.wilaya?.toLowerCase() || '';
          const act = c.activityName?.toLowerCase() || '';
          return name.includes(q) || code.includes(q) || type.includes(q) || wilaya.includes(q) || act.includes(q);
        })
        .limit(100)
        .toArray();
    }

    // Paginated load: only loads 50 records at a time
    return await db.customers
      .where('companyId')
      .equals(currentCompanyId)
      .filter(c => c.active !== false)
      .offset(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();
  }, [currentCompanyId, debouncedSearch, page]);

  const clientItems = useMemo(() => clients || [], [clients]);

  // Virtualizer for fixed row heights
  const virtualizer = useVirtualizer({
    count: clientItems.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 58,
    overscan: 10,
  });

  const onSelectProfile = useCallback((id: string) => {
    setSelectedCustomerIdForProfile(id);
  }, []);

  const onEdit = useCallback((id: string) => {
    navigate(id);
  }, [navigate]);

  const onDelete = useCallback((client: Customer) => {
    setClientToDelete(client);
  }, []);

  // Check dependencies for selected client
  const clientDeliveriesCount = useLiveQuery(
    () => clientToDelete && currentCompanyId ? db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(d => d.customerId === clientToDelete.id).count() : 0,
    [clientToDelete, currentCompanyId]
  ) || 0;

  const clientOrdersCount = useLiveQuery(
    () => clientToDelete && currentCompanyId ? db.orders.where('companyId').equals(currentCompanyId).filter(o => o.customerId === clientToDelete.id).count() : 0,
    [clientToDelete, currentCompanyId]
  ) || 0;

  const clientInvoicesCount = useLiveQuery(
    () => clientToDelete && currentCompanyId ? db.invoices.where('companyId').equals(currentCompanyId).filter(i => i.customerId === clientToDelete.id).count() : 0,
    [clientToDelete, currentCompanyId]
  ) || 0;

  const clientPaymentsCount = useLiveQuery(
    () => clientToDelete && currentCompanyId ? db.payments.where('companyId').equals(currentCompanyId).filter(p => p.customerId === clientToDelete.id).count() : 0,
    [clientToDelete, currentCompanyId]
  ) || 0;

  const totalLinkedDocs = clientDeliveriesCount + clientOrdersCount + clientInvoicesCount + clientPaymentsCount;

  // Handle Deletion
  const handleDeleteCustomer = async (hardDelete: boolean = true) => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      if (hardDelete) {
        await db.customers.delete(clientToDelete.id);
      } else {
        await db.customers.update(clientToDelete.id, { active: false });
      }
      setClientToDelete(null);
    } catch (err) {
      console.error('Failed to delete client:', err);
      alert(t.error);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSearchActive = Boolean(debouncedSearch.trim());
  const totalPages = Math.ceil(totalClientsCount / PAGE_SIZE) || 1;

  // Virtual items & spacers
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
            <h1 className="text-2xl font-bold text-slate-800">{t.clients.title}</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="h-3 w-3" />
              Mode Haute Performance (50 000+)
            </span>
          </div>
          <p className="text-slate-500 text-sm">{t.clients.subtitle}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            id="btn-client-tutorial-youtube"
            href="https://youtu.be/Kzh6PKNWXig"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100/90 border border-red-200 rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Tutoriel vidéo : Comment ajouter un client"
          >
            <Youtube className="h-4 w-4 text-red-600 shrink-0" />
            <span>{t.clients.videoTutorial || 'Comment ajouter un client'}</span>
          </a>

          <Button 
            id="btn-clients-excel-management"
            variant="outline" 
            onClick={() => setShowExcelModal(true)}
            className="text-emerald-700 hover:text-emerald-800 border-emerald-300 hover:bg-emerald-50 cursor-pointer"
            title="Excel Manager"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            {t.clients.excelManagement}
          </Button>

          <Button id="btn-new-client" onClick={() => navigate('new')} className="bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer shadow-sm">
            <Plus className="h-4 w-4 mr-1.5" />
            {t.clients.newClient}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        {/* Search & Pagination Bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
            <Input 
              placeholder="Rechercher code, nom, wilaya, activité (ETB, Béton...)..." 
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
          {!isSearchActive && totalClientsCount > PAGE_SIZE && (
            <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold self-end sm:self-auto">
              <span>Page {page + 1} sur {totalPages} ({totalClientsCount} clients)</span>
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
              {clientItems.length} client(s) trouvé(s) pour « {debouncedSearch} »
            </div>
          )}
        </div>

        {/* Virtualized Clients Table */}
        <div 
          ref={tableScrollRef}
          className="overflow-x-auto overflow-y-auto max-h-[620px] border border-slate-200 rounded-lg"
        >
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10 shadow-2xs">
              <TableRow>
                <TableHead>{t.clients.code}</TableHead>
                <TableHead>{t.clients.nameSocial}</TableHead>
                <TableHead>Wilaya & Activité</TableHead>
                <TableHead>{t.clients.typeConvention}</TableHead>
                <TableHead>{t.clients.initialDebt}</TableHead>
                <TableHead>{t.clients.creditLimit}</TableHead>
                <TableHead>{t.clients.balanceDebt}</TableHead>
                <TableHead className="text-right rtl:text-left">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={8} />
                </tr>
              )}
              {virtualRows.map((virtualRow) => {
                const client = clientItems[virtualRow.index];
                if (!client) return null;
                return (
                  <ClientRow
                    key={client.id}
                    client={client}
                    currency={t.currency}
                    na={t.na}
                    unlimitedText={t.clients.unlimited}
                    profileSheetText={t.clients.profileSheet}
                    editText={t.edit}
                    deleteText={t.delete}
                    onSelectProfile={onSelectProfile}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={8} />
                </tr>
              )}
              {clientItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {t.noData || t.na}
                  </TableCell>
                </TableRow>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Customer Profile Modal */}
      {selectedCustomerIdForProfile && (
        <CustomerProfileModal
          isOpen={Boolean(selectedCustomerIdForProfile)}
          onClose={() => setSelectedCustomerIdForProfile(null)}
          customerId={selectedCustomerIdForProfile}
        />
      )}

      {/* Delete Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t.clients.deleteModalTitle}</h3>
                <p className="text-xs text-slate-500 font-mono">{t.clients.code}: {clientToDelete.code}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                {t.clients.deleteConfirmText}{' '}
                <strong className="text-slate-900 font-bold">{clientToDelete.name}</strong> ?
              </p>

              {totalLinkedDocs > 0 ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    {t.clients.linkedHistoryWarning}
                  </div>
                  <ul className="text-xs text-amber-950 space-y-1 list-disc list-inside font-medium">
                    {clientDeliveriesCount > 0 && (
                      <li><strong>{clientDeliveriesCount}</strong> {t.clients.blCount}</li>
                    )}
                    {clientOrdersCount > 0 && (
                      <li><strong>{clientOrdersCount}</strong> {t.clients.ordersCount}</li>
                    )}
                    {clientInvoicesCount > 0 && (
                      <li><strong>{clientInvoicesCount}</strong> {t.clients.invoicesCount}</li>
                    )}
                    {clientPaymentsCount > 0 && (
                      <li><strong>{clientPaymentsCount}</strong> {t.clients.paymentsCount}</li>
                    )}
                  </ul>
                  <p className="text-[11px] text-amber-900/80 pt-1">
                    {t.clients.accountingPreserveNotice}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                  {t.clients.noLinkedDocsNotice}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => setClientToDelete(null)}
                className="cursor-pointer font-medium"
              >
                {t.cancel}
              </Button>

              {totalLinkedDocs > 0 && (
                <Button
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => handleDeleteCustomer(false)}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 cursor-pointer font-bold flex items-center gap-1.5"
                >
                  <EyeOff className="h-4 w-4 text-amber-600" />
                  {t.clients.deactivateOnly}
                </Button>
              )}

              <Button
                disabled={isDeleting}
                onClick={() => handleDeleteCustomer(true)}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer font-bold flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? t.deleting : t.clients.deletePermanently}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import/Export Modal */}
      <ClientExcelModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        clients={clientItems}
        companyId={currentCompanyId}
      />
    </div>
  );
}
