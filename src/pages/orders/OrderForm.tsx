import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ArrowLeft, Save, Printer, Trash2, Plus, AlertCircle, X } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { executePrintOrder } from '../../lib/printReceipt';
import { useAuthStore } from '../../store/authStore';

interface OrderItemRow {
  id: string;
  productId: string;
  quantity: number;
  priceHT: number;
  totalHT: number;
}

export function OrderForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id && id !== 'new');
  const navigate = useNavigate();

  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(c => c.active).toArray()) || [];
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(p => p.active).toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(t => t.active).toArray()) || [];
  const units = useLiveQuery(() => db.productUnits.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const [number, setNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [status, setStatus] = useState<'draft' | 'confirmed' | 'delivered' | 'cancelled'>('confirmed');
  const [items, setItems] = useState<OrderItemRow[]>([
    { id: crypto.randomUUID(), productId: '', quantity: 1, priceHT: 0, totalHT: 0 }
  ]);
  const [loading, setLoading] = useState(isEditMode);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Load existing order for editing
  useEffect(() => {
    if (!isEditMode || !id) {
      setNumber(`CMD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`);
      return;
    }

    const loadOrder = async () => {
      try {
        const order = await db.orders.get(id);
        if (order) {
          setNumber(order.number);
          setDate(order.date ? order.date.split('T')[0] : new Date().toISOString().split('T')[0]);
          setCustomerId(order.customerId);
          setTruckId(order.truckId || '');
          setStatus(order.status || 'confirmed');

          const orderItems = await db.orderItems.where('orderId').equals(id).toArray();
          if (orderItems && orderItems.length > 0) {
            setItems(orderItems.map(item => ({
              id: item.id || crypto.randomUUID(),
              productId: item.productId,
              quantity: item.quantity,
              priceHT: item.priceHT,
              totalHT: item.totalHT || (item.quantity * item.priceHT)
            })));
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement de la commande', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id, isEditMode]);

  // Helper to fetch price for product + customer
  const fetchPrice = async (prodId: string, custId: string) => {
    if (!prodId) return 0;
    if (custId) {
      const customer = await db.customers.get(custId);
      if (customer && customer.familyId) {
        const pp = await db.productPrices
          .where('[productId+conventionId]')
          .equals([prodId, customer.familyId])
          .first();
        if (pp && pp.priceHT > 0) {
          return pp.priceHT;
        }
      }
    }
    const prod = await db.products.get(prodId);
    return prod ? (prod as any).priceHT || 0 : 0;
  };

  const handleCustomerChange = async (newCustomerId: string) => {
    setCustomerId(newCustomerId);
    if (!newCustomerId) return;

    // Update prices for all existing product rows
    const updatedItems = await Promise.all(
      items.map(async (item) => {
        if (item.productId) {
          const newPrice = await fetchPrice(item.productId, newCustomerId);
          const price = newPrice > 0 ? newPrice : item.priceHT;
          return {
            ...item,
            priceHT: price,
            totalHT: item.quantity * price
          };
        }
        return item;
      })
    );
    setItems(updatedItems);
  };

  const handleProductChange = async (index: number, newProductId: string) => {
    const price = await fetchPrice(newProductId, customerId);
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId: newProductId,
      priceHT: price,
      totalHT: newItems[index].quantity * price
    };
    setItems(newItems);
  };

  const handleQuantityChange = (index: number, qty: number) => {

    const newItems = [...items];
    const validQty = Math.max(0, qty);
    newItems[index] = {
      ...newItems[index],
      quantity: validQty,
      totalHT: validQty * newItems[index].priceHT
    };
    setItems(newItems);
  };

  const handlePriceChange = (index: number, price: number) => {
    const newItems = [...items];
    const validPrice = Math.max(0, price);
    newItems[index] = {
      ...newItems[index],
      priceHT: validPrice,
      totalHT: newItems[index].quantity * validPrice
    };
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), productId: '', quantity: 1, priceHT: 0, totalHT: 0 }
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const totalHT = items.reduce((acc, curr) => acc + (curr.totalHT || 0), 0);
  const tvaRate = 19;
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  const handleSave = async () => {
    if (!customerId) {
      alert('Veuillez sélectionner un client.');
      return;
    }

    const validItems = items.filter(it => it.productId && it.quantity > 0);
    if (validItems.length === 0) {
      alert('Veuillez ajouter au moins une ligne de produit valide avec une quantité supérieure à 0.');
      return;
    }

    try {
      const orderId = isEditMode && id ? id : crypto.randomUUID();
      const orderData = {
        id: orderId,
        number: number || `CMD-2026-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        date: new Date(date).toISOString(),
        customerId,
        truckId: truckId || undefined,
        totalHT,
        totalTVA,
        totalTTC,
        status
      };

      if (isEditMode && id) {
        await db.orders.update(id, orderData);
        // Replace order items
        await db.orderItems.where('orderId').equals(id).delete();
        await db.orderItems.bulkAdd(
          validItems.map(item => ({
            id: item.id || crypto.randomUUID(),
            orderId: id,
            productId: item.productId,
            quantity: item.quantity,
            priceHT: item.priceHT,
            totalHT: item.totalHT
          }))
        );
      } else {
        await db.orders.add(orderData);
        await db.orderItems.bulkAdd(
          validItems.map(item => ({
            id: item.id || crypto.randomUUID(),
            orderId,
            productId: item.productId,
            quantity: item.quantity,
            priceHT: item.priceHT,
            totalHT: item.totalHT
          }))
        );
      }

      navigate('/orders');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la commande', err);
      alert('Une erreur est survenue lors de l\'enregistrement.');
    }
  };

  const handleDelete = async () => {
    if (!isEditMode || !id) return;
    try {
      await db.orderItems.where('orderId').equals(id).delete();
      await db.orders.delete(id);
      navigate('/orders');
    } catch (err) {
      console.error('Erreur lors de la suppression de la commande', err);
      alert('Erreur lors de la suppression.');
    }
  };

  const handlePrint = async () => {
    const customer = customers.find(c => c.id === customerId);
    const truck = trucks.find(t => t.id === truckId);

    const validItems = items.filter(it => it.productId);
    const printItems = validItems.map(it => {
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
      number: number || 'CMD-0000',
      date: date || new Date().toISOString(),
      status,
      customerName: customer?.name || 'Client',
      customerCode: customer?.code,
      customerAddress: customer?.address,
      customerPhone: customer?.phone,
      customerNIF: customer?.nif,
      customerRC: customer?.rc,
      truckMatricule: truck?.matricule,
      items: printItems,
      totalHT,
      tvaRate,
      totalTVA,
      totalTTC,
      companyName: settings?.name || 'SARL MAHAJIR SIDAR',
      companyActivity: settings?.activity || 'Extraction & Concassage',
      companyAddress: settings?.address || '',
      companyPhone: settings?.phone || '',
      companyNif: settings?.nif || '',
      companyRc: settings?.rc || '',
      companyLogo: settings?.logoUrl || settings?.logo || ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-slate-500 font-medium">Chargement de la commande...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/orders')} className="p-2 cursor-pointer">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isEditMode ? `Modifier la Commande N° ${number}` : 'Nouvelle Commande'}
            </h1>
            <p className="text-slate-500 text-sm">
              {isEditMode ? 'Mettez à jour les informations et articles de la commande' : 'Créer une nouvelle commande client'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isEditMode && (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={handlePrint}
                className="text-slate-700 hover:text-blue-600 border-slate-300"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimer
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => navigate('/orders')}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? 'Enregistrer les modifications' : 'Valider la commande'}
          </Button>
        </div>
      </div>

      {/* General Information Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 flex items-center justify-between">
          <span>Informations Générales</span>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-bold">
            {number}
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Input
            label="N° Commande *"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="CMD-2026-0000"
          />

          <Input
            label="Date de commande *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <Select
            label="Statut *"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            options={[
              { value: 'confirmed', label: 'Confirmée' },
              { value: 'draft', label: 'Brouillon' },
              { value: 'delivered', label: 'Livrée' },
              { value: 'cancelled', label: 'Annulée' }
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <Select
            label="Client *"
            value={customerId}
            onChange={(e) => handleCustomerChange(e.target.value)}
            options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
          />

          <Select
            label="Camion assigné (Optionnel)"
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
            options={[
              { value: '', label: 'Aucun camion assigné' },
              ...trucks.map(t => ({ value: t.id, label: t.matricule }))
            ]}
          />
        </div>
      </div>

      {/* Order Items Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Articles & Produits commandés</h2>
            <p className="text-xs text-slate-500">Ajoutez les produits, quantités et vérifiez le prix unitaire HT</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItemRow}
            className="text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une ligne
          </Button>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 rounded-lg border border-slate-200 bg-slate-50/50"
            >
              <div className="md:col-span-5">
                <Select
                  label={index === 0 ? "Produit *" : undefined}
                  value={item.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  options={products.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  label={index === 0 ? "Quantité (T/U)" : undefined}
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantity === 0 ? '' : item.quantity}
                  onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  label={index === 0 ? "Prix Unit. HT" : undefined}
                  type="number"
                  min="0"
                  step="any"
                  value={item.priceHT === 0 ? '' : item.priceHT}
                  onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="md:col-span-2 flex flex-col justify-end">
                {index === 0 && <span className="text-sm font-medium text-slate-700 mb-1.5">Montant HT</span>}
                <div className="h-10 flex items-center px-3 bg-white rounded-md border border-slate-200 text-sm font-bold text-slate-800">
                  {formatCurrency(item.totalHT)}
                </div>
              </div>

              <div className="md:col-span-1 flex justify-center pb-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItemRow(index)}
                  disabled={items.length <= 1}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-2 cursor-pointer"
                  title="Supprimer cette ligne"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col items-end pt-4 border-t border-slate-100 space-y-2 text-sm">
          <div className="flex w-72 justify-between">
            <span className="text-slate-500">Total Brut HT :</span>
            <span className="font-medium font-mono">{formatCurrency(totalHT)}</span>
          </div>
          <div className="flex w-72 justify-between">
            <span className="text-slate-500">TVA ({tvaRate}%) :</span>
            <span className="font-medium font-mono">{formatCurrency(totalTVA)}</span>
          </div>
          <div className="flex w-72 justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2">
            <span>Net à Payer TTC :</span>
            <span className="text-blue-600 font-mono text-lg">{formatCurrency(totalTTC)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Action bar */}
      <div className="flex justify-between items-center pt-2">
        {isEditMode ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeleteModal(true)}
            className="text-red-600 hover:bg-red-50 border-red-200 cursor-pointer"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer cette commande
          </Button>
        ) : <div />}

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate('/orders')}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? 'Enregistrer les modifications' : 'Valider la commande'}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Supprimer la commande</h3>
            </div>

            <p className="text-sm text-slate-600">
              Êtes-vous sûr de vouloir supprimer définitivement la commande{' '}
              <strong className="text-slate-900">{number}</strong> ? Cette action est irréversible.
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Confirmer la suppression
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

