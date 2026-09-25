import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';

export function PaymentList() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const payments = useLiveQuery(() => db.payments.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray());

  const getCustomerName = (id: string) => customers?.find(c => c.id === id)?.name || id;

  const filteredPayments = payments?.filter(p => 
    getCustomerName(p.customerId).toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (paymentId: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce règlement ? (Le solde du client sera mis à jour)')) {
      try {
        await db.transaction('rw', db.payments, db.customers, async () => {
          const payment = await db.payments.get(paymentId);
          if (payment) {
            const customer = await db.customers.get(payment.customerId);
            if (customer) {
              await db.customers.update(customer.id, { balance: customer.balance - payment.amount });
            }
            await db.payments.delete(paymentId);
          }
        });
      } catch (error) {
        console.error(error);
        alert('Erreur lors de la suppression.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Règlements & Avances</h1>
          <p className="text-slate-500">Gestion des encaissements et soldes clients</p>
        </div>
        <Button onClick={() => navigate('new')}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Règlement
        </Button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Rechercher par client..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Référence / N° Chèque</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {filteredPayments?.map(payment => (
              <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.date)}</TableCell>
                <TableCell className="font-medium">{getCustomerName(payment.customerId)}</TableCell>
                <TableCell className="font-bold text-green-600">+{formatCurrency(payment.amount)}</TableCell>
                <TableCell className="capitalize">{payment.mode}</TableCell>
                <TableCell>{payment.reference || '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(payment.id)} title="Modifier">
                      <Edit className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(payment.id)} title="Supprimer">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredPayments?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">Aucun règlement trouvé</TableCell>
              </TableRow>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
