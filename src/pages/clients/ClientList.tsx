import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, Edit, FileText, AlertTriangle, FileSpreadsheet, Trash2, AlertCircle, EyeOff, Youtube } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { CustomerProfileModal } from '../../components/clients/CustomerProfileModal';
import { ClientExcelModal } from '../../components/clients/ClientExcelModal';
import { Customer } from '../../types';
import { useTranslation, formatLocalizedCurrency } from '../../i18n';

export function ClientList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCustomerIdForProfile, setSelectedCustomerIdForProfile] = useState<string | null>(null);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const currentUser = useAuthStore(state => state.user);

  const clients = useLiveQuery(
    () => db.customers.where('companyId').equals(currentCompanyId).filter(c => 
      c.active !== false &&
      (c.companyId === currentUser?.companyId) && (
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.type && c.type.toLowerCase().includes(search.toLowerCase()))
    )).toArray(),
    [search, currentUser?.companyId]
  );

  const allClientsForExport = useLiveQuery(
    () => db.customers.where('companyId').equals(currentCompanyId).filter(c => 
      (c.companyId === currentUser?.companyId)
    ).toArray(),
    [currentUser?.companyId]
  );

  // Check dependencies for selected client
  const clientDeliveriesCount = useLiveQuery(
    () => clientToDelete ? db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(d => d.customerId === clientToDelete.id).count() : 0,
    [clientToDelete]
  ) || 0;

  const clientOrdersCount = useLiveQuery(
    () => clientToDelete ? db.orders.where('companyId').equals(currentCompanyId).filter(o => o.customerId === clientToDelete.id).count() : 0,
    [clientToDelete]
  ) || 0;

  const clientInvoicesCount = useLiveQuery(
    () => clientToDelete ? db.invoices.where('companyId').equals(currentCompanyId).filter(i => i.customerId === clientToDelete.id).count() : 0,
    [clientToDelete]
  ) || 0;

  const clientPaymentsCount = useLiveQuery(
    () => clientToDelete ? db.payments.where('companyId').equals(currentCompanyId).filter(p => p.customerId === clientToDelete.id).count() : 0,
    [clientToDelete]
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.clients.title}</h1>
          <p className="text-slate-500">{t.clients.subtitle}</p>
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

          <Button id="btn-new-client" onClick={() => navigate('new')} className="bg-blue-600 hover:bg-blue-500 cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            {t.clients.newClient}
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
            <Input 
              placeholder={t.clients.searchPlaceholder} 
              className="pl-9 rtl:pl-3 rtl:pr-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.clients.code}</TableHead>
              <TableHead>{t.clients.nameSocial}</TableHead>
              <TableHead>{t.clients.typeConvention}</TableHead>
              <TableHead>{t.clients.initialDebt}</TableHead>
              <TableHead>{t.clients.creditLimit}</TableHead>
              <TableHead>{t.clients.balanceDebt}</TableHead>
              <TableHead className="text-right rtl:text-left">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {clients?.map((client) => {
              const balance = client.balance || 0;
              const debt = balance < 0 ? Math.abs(balance) : 0;
              const creditLimit = client.creditLimit || 0;
              const isLimitExceeded = creditLimit > 0 && debt > creditLimit;

              return (
                <TableRow 
                  key={client.id}
                  className="hover:bg-blue-50/50 cursor-pointer"
                  onClick={() => setSelectedCustomerIdForProfile(client.id)}
                >
                  <TableCell className="font-mono font-bold text-slate-900">{client.code}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{client.name}</div>
                    {client.phone && <div className="text-xs text-slate-400">{client.phone}</div>}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {client.type || t.na}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-slate-700">
                    {(client.initialDebt || 0) > 0 ? (
                      <span className="text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {formatLocalizedCurrency(client.initialDebt || 0)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-slate-700">
                    {creditLimit > 0 ? (
                      <span className="text-blue-800 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {formatLocalizedCurrency(creditLimit)}
                      </span>
                    ) : (
                      <span className="text-slate-400">{t.clients.unlimited}</span>
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
                        <span className="text-slate-600">0 {t.currency}</span>
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
                        onClick={() => setSelectedCustomerIdForProfile(client.id)} 
                        title={t.clients.profileSheet}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(client.id)} 
                        title={t.edit}
                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setClientToDelete(client)} 
                        title={t.delete}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {clients?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  {t.noData || t.na}
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </Table>
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
        clients={allClientsForExport || clients || []}
        companyId={currentUser?.companyId}
      />
    </div>
  );
}
