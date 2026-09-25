import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, Edit, Trash2, Printer, AlertCircle, Truck as TruckIcon } from 'lucide-react';
import { executePrintOrder } from '../../lib/printReceipt';
import { Order } from '../../types';
import { useTranslation, formatLocalizedCurrency, formatLocalizedDate } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

export function OrderList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const orders = useLiveQuery(() => db.orders.reverse().toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const units = useLiveQuery(() => db.productUnits.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const getCustomerName = (id: string) => customers?.find(c => c.id === id)?.name || id;

  const filteredOrders = orders?.filter(o => {
    const matchesSearch = 
      o.number.toLowerCase().includes(search.toLowerCase()) || 
      getCustomerName(o.customerId).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    try {
      await db.orderItems.where('orderId').equals(orderToDelete.id).delete();
      await db.orders.delete(orderToDelete.id);
      setOrderToDelete(null);
    } catch (err) {
      console.error('Erreur lors de la suppression de la commande', err);
      alert(t.error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintOrder = async (order: Order) => {
    const customer = customers.find(c => c.id === order.customerId);
    const truck = trucks.find(t => t.id === order.truckId);
    const orderItems = await db.orderItems.where('orderId').equals(order.id).toArray();

    const printItems = (orderItems || []).map(it => {
      const prod = products.find(p => p.id === it.productId);
      const unit = units.find(u => u.id === (prod as any)?.unitId);
      return {
        designation: prod?.name || 'Produit',
        unit: unit?.name || (prod as any)?.unit || 'Tonne',
        quantity: it.quantity,
        priceHT: it.priceHT,
        totalHT: it.totalHT
      };
    });

    executePrintOrder({
      number: order.number,
      date: order.date,
      status: order.status,
      customerName: customer?.name || 'Client',
      customerCode: customer?.code,
      customerAddress: customer?.address,
      customerPhone: customer?.phone,
      customerNIF: customer?.nif,
      customerRC: customer?.rc,
      truckMatricule: truck?.matricule,
      items: printItems,
      totalHT: order.totalHT,
      tvaRate: 19,
      totalTVA: order.totalTVA,
      totalTTC: order.totalTTC,
      companyName: settings?.name || 'SARL MAHAJIR SIDAR',
      companyActivity: settings?.activity || 'Extraction & Concassage',
      companyAddress: settings?.address || '',
      companyPhone: settings?.phone || '',
      companyNif: settings?.nif || '',
      companyRc: settings?.rc || '',
      companyLogo: settings?.logoUrl || settings?.logo || ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.orders.title}</h1>
          <p className="text-slate-500">{t.orders.subtitle}</p>
        </div>
        <Button onClick={() => navigate('new')} className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
          <Plus className="h-4 w-4 mr-2" />
          {t.orders.newOrder}
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rtl:left-auto rtl:right-3" />
            <Input 
              placeholder={t.searchPlaceholder} 
              className="pl-9 rtl:pl-3 rtl:pr-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 text-xs">
            {[
              { id: 'all', label: t.all },
              { id: 'confirmed', label: t.orders.statusConfirmed },
              { id: 'delivered', label: t.orders.statusDelivered },
              { id: 'draft', label: t.orders.statusDraft },
              { id: 'cancelled', label: t.orders.statusCancelled }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.orders.orderNumber}</TableHead>
              <TableHead>{t.orders.orderDate}</TableHead>
              <TableHead>{t.orders.customer}</TableHead>
              <TableHead>{t.totalTTC}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead className="text-right rtl:text-left">{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {filteredOrders?.map(order => (
              <TableRow key={order.id} className="hover:bg-slate-50/80 transition-colors">
                <TableCell className="font-bold text-slate-900 font-mono">{order.number}</TableCell>
                <TableCell className="text-slate-600">{formatLocalizedDate(order.date)}</TableCell>
                <TableCell className="font-semibold text-slate-800">{getCustomerName(order.customerId)}</TableCell>
                <TableCell className="font-bold text-slate-900 font-mono">{formatLocalizedCurrency(order.totalTTC)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {order.status === 'confirmed' ? t.orders.statusConfirmed :
                     order.status === 'delivered' ? t.orders.statusDelivered :
                     order.status === 'cancelled' ? t.orders.statusCancelled : t.orders.statusDraft}
                  </span>
                </TableCell>
                <TableCell className="text-right rtl:text-left">
                  <div className="flex items-center justify-end rtl:justify-start gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate(`/deliveries/new?orderId=${order.id}&customerId=${order.customerId}`)}
                      title={t.orders.generateBL}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 cursor-pointer"
                    >
                      <TruckIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handlePrintOrder(order)}
                      title={t.orders.printOrder}
                      className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => navigate(order.id)} 
                      title={t.edit}
                      className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setOrderToDelete(order)} 
                      title={t.delete}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredOrders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                  {t.noData || t.na}
                </TableCell>
              </TableRow>
            )}
          </tbody>
        </Table>
      </div>

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t.delete}</h3>
            </div>

            <p className="text-sm text-slate-600">
              {t.confirm}{' '}
              <strong className="text-slate-900">{orderToDelete.number}</strong> (Client :{' '}
              <strong>{getCustomerName(orderToDelete.customerId)}</strong>) ?
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <Button
                variant="outline"
                disabled={isDeleting}
                onClick={() => setOrderToDelete(null)}
                className="cursor-pointer"
              >
                {t.cancel}
              </Button>
              <Button
                disabled={isDeleting}
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? t.deleting : t.delete}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
