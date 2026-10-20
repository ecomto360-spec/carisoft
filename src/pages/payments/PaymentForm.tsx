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
    <div className="space-y-4 max-w-3xl mx-auto pb-6">
      {/* Header with Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/payments')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">
              {id ? 'Modifier le Règlement' : 'Nouveau Règlement / Avance'}
            </h1>
            <p className="text-[10px] text-slate-500">
              Enregistrement des encaissements clients et affectation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/payments')} className="text-xs cursor-pointer">
            Annuler
          </Button>
          <Button onClick={handleSave} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer">
            <Save className="h-3.5 w-3.5 mr-1" />
            Enregistrer
          </Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select 
              label="Client *"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setInvoiceId('');
              }}
              options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
              className="text-xs"
            />
          </div>
          
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-600">Solde Actuel :</span>
            <span className={`text-base font-mono font-black ${customerBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCurrency(customerBalance)}
            </span>
          </div>

          <div>
            <Select 
              label="Affecter à la facture (Optionnel)"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              options={[
                { value: '', label: 'Avance libre (Non affecté)' },
                ...customerInvoices.map(i => ({ value: i.id, label: `${i.number} - Reste: ${formatCurrency(i.totalTTC)}` }))
              ]}
              className="text-xs"
            />
          </div>

          <div>
            <Input 
              label="Montant du versement (DZD) *" 
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0.00"
              className="text-xs font-mono font-bold"
            />
          </div>

          <div>
            <Select 
              label="Mode de paiement *"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              options={[
                { value: 'especes', label: 'Espèces' },
                { value: 'cheque', label: 'Chèque' },
                { value: 'virement', label: 'Virement' },
              ]}
              className="text-xs"
            />
          </div>

          {(mode === 'cheque' || mode === 'virement') && (
            <div>
              <Input 
                label="Référence (N° Chèque / Virement) *" 
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex: CHQ-1234567..."
                className="text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={() => navigate('/payments')} className="text-xs cursor-pointer">
            Annuler
          </Button>
          <Button onClick={handleSave} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 shadow-xs cursor-pointer">
            <Save className="h-3.5 w-3.5 mr-1" />
            Enregistrer le versement
          </Button>
        </div>
      </div>
    </div>
  );
}
