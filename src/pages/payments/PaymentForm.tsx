import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ArrowLeft, Save } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';

export function PaymentForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.where('companyId').equals(currentCompanyId).filter(i => i.status === 'validated').toArray()) || [];
  
  const payment = useLiveQuery(() => id ? db.payments.get(id) : undefined, [id]);

  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [mode, setMode] = useState('especes');
  const [reference, setReference] = useState('');
  
  // Keep track of original values for edit mode
  const [originalAmount, setOriginalAmount] = useState(0);
  const [originalCustomerId, setOriginalCustomerId] = useState('');

  useEffect(() => {
    if (payment) {
      setCustomerId(payment.customerId);
      setOriginalCustomerId(payment.customerId);
      setInvoiceId(payment.invoiceId || '');
      setAmount(payment.amount);
      setOriginalAmount(payment.amount);
      setMode(payment.mode);
      setReference(payment.reference || '');
    }
  }, [payment]);

  const customerInvoices = invoices.filter(i => i.customerId === customerId);
  const customerBalance = customers.find(c => c.id === customerId)?.balance || 0;

  const handleSave = async () => {
    if (!customerId || !amount) {
      alert('Veuillez sélectionner un client et saisir un montant.');
      return;
    }

    try {
      await db.transaction('rw', db.payments, db.customers, db.invoices, async () => {
        const paymentData = {
          date: payment?.date || new Date().toISOString(),
          customerId,
          invoiceId: invoiceId || undefined,
          amount: Number(amount),
          mode: mode as any,
          reference
        };

        if (id) {
          await db.payments.update(id, paymentData);
          
          // Revert old balance impact, apply new balance impact
          if (originalCustomerId === customerId) {
             const customer = await db.customers.get(customerId);
             if (customer) {
               await db.customers.update(customerId, { 
                 balance: customer.balance - originalAmount + Number(amount) 
               });
             }
          } else {
             // If customer changed (rare but possible)
             const oldCustomer = await db.customers.get(originalCustomerId);
             if (oldCustomer) await db.customers.update(originalCustomerId, { balance: oldCustomer.balance - originalAmount });
             
             const newCustomer = await db.customers.get(customerId);
             if (newCustomer) await db.customers.update(customerId, { balance: newCustomer.balance + Number(amount) });
          }

        } else {
          await db.payments.add({
            ...paymentData,
            id: crypto.randomUUID(),
          });
          
          // Update Customer Balance
          const customer = await db.customers.get(customerId);
          if (customer) {
            await db.customers.update(customerId, { balance: customer.balance + Number(amount) });
          }
        }

        // If paying a specific invoice, update its status
        if (invoiceId) {
          await db.invoices.update(invoiceId, { status: 'paid' });
        }
      });
      navigate('/payments');
    } catch (error) {
      console.error(error);
      alert('Erreur lors de l\'enregistrement');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/payments')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">Nouveau Règlement / Avance</h1>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select 
            label="Client *"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setInvoiceId('');
            }}
            options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
          />
          
          <div className="flex items-end pb-2">
            <span className="text-sm text-slate-500 mr-2">Solde Actuel :</span>
            <span className={`text-lg font-bold ${customerBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(customerBalance)}
            </span>
          </div>

          <Select 
            label="Affecter à la facture (Optionnel)"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            options={[
              { value: '', label: 'Avance (Non affecté)' },
              ...customerInvoices.map(i => ({ value: i.id, label: `${i.number} - Reste: ${formatCurrency(i.totalTTC)}` }))
            ]}
          />

          <Input 
            label="Montant (DZD) *" 
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />

          <Select 
            label="Mode de paiement *"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            options={[
              { value: 'especes', label: 'Espèces' },
              { value: 'cheque', label: 'Chèque' },
              { value: 'virement', label: 'Virement' },
            ]}
          />

          {(mode === 'cheque' || mode === 'virement') && (
            <Input 
              label="Référence (N° Chèque / Virement) *" 
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={() => navigate('/payments')}>Annuler</Button>
          <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Enregistrer le versement</Button>
        </div>
      </div>
    </div>
  );
}
