import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ArrowLeft, Save, Printer, Trash2, Plus, AlertCircle, X, Search, Truck as TruckIcon, User, ChevronDown, Check, Star } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { executePrintOrder } from '../../lib/printReceipt';
import { useAuthStore } from '../../store/authStore';
import { TruckPickerModal } from '../deliveries/TruckPickerModal';
import { ClientPickerModal } from '../deliveries/ClientPickerModal';

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
  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(d => d.active).toArray()) || [];
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

  // Searchable Client Combobox States
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Searchable Truck Combobox States
  const [isTruckSearchOpen, setIsTruckSearchOpen] = useState(false);
  const [truckSearchQuery, setTruckSearchQuery] = useState('');
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const truckDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setIsClientSearchOpen(false);
      }
      if (truckDropdownRef.current && !truckDropdownRef.current.contains(e.target as Node)) {
        setIsTruckSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const driverMap = useMemo(() => {
    const map = new Map<string, { name: string; phone?: string }>();
    drivers.forEach(d => map.set(d.id, { name: d.name, phone: d.phone }));
    return map;
  }, [drivers]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const custFavIds = useMemo(() => new Set<string>(selectedCustomer?.favoriteTruckIds || []), [selectedCustomer]);

  // Filter customers by name, code, city, or phone
  const filteredCustomers = useMemo(() => {
    const q = clientSearchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.wilaya && c.wilaya.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.mobile && c.mobile.includes(q))
      );
    });
  }, [customers, clientSearchQuery]);

  const selectedTruck = useMemo(() => trucks.find(t => t.id === truckId), [trucks, truckId]);
  const selectedDriverInfo = useMemo(() => {
    if (!selectedTruck) return null;
    const name = selectedTruck.driverName || (selectedTruck.driverId ? driverMap.get(selectedTruck.driverId)?.name : '') || '';
    const phone = selectedTruck.driverPhone || (selectedTruck.driverId ? driverMap.get(selectedTruck.driverId)?.phone : '') || '';
    return { name, phone };
  }, [selectedTruck, driverMap]);

  // Filter trucks by matricule, driver name, brand, or phone
  const filteredTrucks = useMemo(() => {
    const q = truckSearchQuery.toLowerCase().trim();
    const list = trucks.filter(t => {
      if (!q) return true;
      const drvName = t.driverName || (t.driverId ? driverMap.get(t.driverId)?.name : '') || '';
      const drvPhone = t.driverPhone || (t.driverId ? driverMap.get(t.driverId)?.phone : '') || '';
      const brand = t.brand || '';
      return (
        t.matricule.toLowerCase().includes(q) ||
        drvName.toLowerCase().includes(q) ||
        drvPhone.includes(q) ||
        brand.toLowerCase().includes(q)
      );
    });

    // Prioritize customer's favorite trucks, then global favorites, then by matricule
    return list.sort((a, b) => {
      const aFav = custFavIds.has(a.id) ? 1 : 0;
      const bFav = custFavIds.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.matricule.localeCompare(b.matricule);
    });
  }, [trucks, truckSearchQuery, driverMap, custFavIds]);

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
      if (customer) {
        // 0. Check custom negotiated price
        if (customer.customPrices && customer.customPrices[prodId] !== undefined && customer.customPrices[prodId] > 0) {
          return customer.customPrices[prodId];
        }
        if (customer.familyId) {
          const pp = await db.productPrices
            .where('productId')
            .equals(prodId)
            .filter(p => p.conventionId === customer.familyId || p.conventionId === 'C_CONV1')
            .first();
          if (pp && pp.priceHT > 0) {
            return pp.priceHT;
          }
        }
      }
    }
    const standardPP = await db.productPrices.where('productId').equals(prodId).first();
    if (standardPP && standardPP.priceHT > 0) return standardPP.priceHT;
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
    <div className="space-y-3 max-w-5xl mx-auto pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/orders')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800">
              {isEditMode ? `Modifier la Commande : ${number}` : 'Nouvelle Commande Client'}
            </h1>
            <p className="text-[10px] text-slate-500">
              {isEditMode ? 'Mise à jour des informations et articles de la commande' : 'Création rapide de commande avec réservation de tarifs'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={handlePrint}
                className="text-slate-700 hover:text-blue-600 border-slate-300 text-xs"
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                Imprimer
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 hover:bg-red-50 border-red-200 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Supprimer
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')} className="text-xs">
            Annuler
          </Button>
          <Button onClick={handleSave} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs">
            <Save className="h-3.5 w-3.5 mr-1" />
            {isEditMode ? 'Enregistrer' : 'Valider la commande'}
          </Button>
        </div>
      </div>

      {/* General Information Card */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight border-b border-slate-100 pb-1.5 flex items-center justify-between">
          <span>Informations Générales</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
            {number}
          </span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <Input
              label="N° Commande *"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="CMD-2026-0000"
              className="text-xs font-mono font-bold"
            />
          </div>

          <div>
            <Input
              label="Date de commande *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div>
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
              className="text-xs"
            />
          </div>

          <div className="relative" ref={clientDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                Client <span className="text-red-500 font-bold">*</span>
              </label>
              {selectedCustomer && (
                <div className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs sm:text-sm shadow-xs border flex items-center gap-1.5 transition-all ${
                  (selectedCustomer.balance || 0) < 0
                    ? 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-400/40'
                    : (selectedCustomer.balance || 0) > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-400/40'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  <span className="text-[10px] font-sans uppercase font-bold text-slate-500">Solde :</span>
                  <span className="tracking-tight">{formatCurrency(selectedCustomer.balance || 0)}</span>
                </div>
              )}
            </div>

            <div
              onClick={() => setIsClientSearchOpen(!isClientSearchOpen)}
              className={`w-full min-h-[34px] px-2.5 py-1.5 bg-white border rounded-lg flex items-center justify-between gap-1.5 cursor-pointer text-xs transition-colors shadow-2xs ${
                isClientSearchOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {selectedCustomer ? (
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 shrink-0 text-[11px]">
                      {selectedCustomer.code}
                    </span>
                    <span className="font-bold text-slate-900 truncate">
                      {selectedCustomer.name}
                    </span>
                    {selectedCustomer.city && (
                      <span className="text-slate-500 text-[11px] truncate">({selectedCustomer.city})</span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 italic truncate">Sélectionner (code / nom)...</span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCustomerChange('');
                    }}
                    className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                    title="Désélectionner le client"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Floating Searchable Client Dropdown */}
            {isClientSearchOpen && (
              <div className="absolute left-0 right-0 sm:right-auto sm:w-80 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 max-h-80 flex flex-col">
                {/* Search Input Bar */}
                <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Taper le nom du client ou code..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  {clientSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setClientSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Customer Items List */}
                <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-slate-100 text-xs">
                  {filteredCustomers.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 italic">
                      Aucun client trouvé pour &quot;{clientSearchQuery}&quot;
                    </div>
                  ) : (
                    filteredCustomers.map(c => {
                      const isSelected = c.id === customerId;

                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            handleCustomerChange(c.id);
                            setIsClientSearchOpen(false);
                            setClientSearchQuery('');
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-blue-50/70 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1 py-0.2 rounded text-[11px] border border-blue-200">
                                {c.code}
                              </span>
                              <span className="font-bold text-slate-900 truncate">{c.name}</span>
                            </div>
                            {(c.city || c.phone || c.mobile) && (
                              <div className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-2">
                                {c.city && <span>{c.city}</span>}
                                {(c.phone || c.mobile) && <span className="font-mono text-[10px] text-slate-400">{c.mobile || c.phone}</span>}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              (c.balance || 0) < 0 ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100'
                            }`}>
                              {formatCurrency(c.balance || 0)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer to open full client picker modal */}
                <div className="p-1.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsClientSearchOpen(false);
                      setIsClientModalOpen(true);
                    }}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center justify-center gap-1 w-full py-1 cursor-pointer"
                  >
                    <Search className="h-3 w-3" />
                    <span>Parcourir la liste complète des clients</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={truckDropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Camion assigné</label>
              {selectedCustomer && custFavIds.size > 0 && (
                <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                  {custFavIds.size} favori{custFavIds.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div
              onClick={() => setIsTruckSearchOpen(!isTruckSearchOpen)}
              className={`w-full min-h-[34px] px-2.5 py-1.5 bg-white border rounded-lg flex items-center justify-between gap-1.5 cursor-pointer text-xs transition-colors shadow-2xs ${
                isTruckSearchOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <TruckIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {selectedTruck ? (
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-mono font-bold text-slate-900">{selectedTruck.matricule}</span>
                    {selectedDriverInfo?.name && (
                      <span className="text-slate-500 truncate text-[11px]">({selectedDriverInfo.name})</span>
                    )}
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded font-mono text-slate-600 shrink-0">
                      {selectedTruck.tare.toFixed(2)}T
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic truncate">Sélectionner (matricule / nom)...</span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {selectedTruck && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTruckId('');
                    }}
                    className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                    title="Désassigner le camion"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {/* Floating Searchable Dropdown */}
            {isTruckSearchOpen && (
              <div className="absolute left-0 right-0 sm:right-auto sm:w-80 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 max-h-80 flex flex-col">
                {/* Search Input Bar */}
                <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Rechercher par matricule ou nom..."
                    value={truckSearchQuery}
                    onChange={(e) => setTruckSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  {truckSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTruckSearchQuery('')}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Truck Items List */}
                <div className="flex-1 overflow-y-auto max-h-56 divide-y divide-slate-100 text-xs">
                  {/* Option 'Aucun (Libre)' */}
                  <button
                    type="button"
                    onClick={() => {
                      setTruckId('');
                      setIsTruckSearchOpen(false);
                      setTruckSearchQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors ${
                      !truckId ? 'bg-blue-50/70 text-blue-900 font-bold' : 'text-slate-600'
                    }`}
                  >
                    <span className="italic">Aucun (Libre)</span>
                    {!truckId && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>

                  {filteredTrucks.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 italic">
                      Aucun camion trouvé pour &quot;{truckSearchQuery}&quot;
                    </div>
                  ) : (
                    filteredTrucks.map(truck => {
                      const isSelected = truck.id === truckId;
                      const isFav = custFavIds.has(truck.id) || truck.isFavorite;
                      const drvName = truck.driverName || (truck.driverId ? driverMap.get(truck.driverId)?.name : '') || '';
                      const drvPhone = truck.driverPhone || (truck.driverId ? driverMap.get(truck.driverId)?.phone : '') || '';

                      return (
                        <button
                          key={truck.id}
                          type="button"
                          onClick={() => {
                            setTruckId(truck.id);
                            setIsTruckSearchOpen(false);
                            setTruckSearchQuery('');
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-blue-50/70 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">{truck.matricule}</span>
                              {isFav && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-sans font-bold">
                                  <Star className="h-2 w-2 fill-amber-500 text-amber-500" />
                                  Habituel
                                </span>
                              )}
                              {truck.brand && (
                                <span className="text-[10px] text-slate-400">({truck.brand})</span>
                              )}
                            </div>

                            {(drvName || drvPhone) && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                <User className="h-3 w-3 text-slate-400 shrink-0" />
                                <span className="truncate">{drvName || '-'}</span>
                                {drvPhone && <span className="font-mono text-[10px] text-slate-400">({drvPhone})</span>}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono text-[11px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {truck.tare.toFixed(2)} T
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Footer to open full picker modal */}
                <div className="p-1.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTruckSearchOpen(false);
                      setIsTruckModalOpen(true);
                    }}
                    className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center justify-center gap-1 w-full py-1 cursor-pointer"
                  >
                    <Search className="h-3 w-3" />
                    <span>Parcourir la liste complète des camions</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items Card */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Articles & Produits commandés</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItemRow}
            className="text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer text-xs py-1"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter une ligne
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg border border-slate-200 bg-slate-50/70"
            >
              <div className="sm:col-span-5">
                <Select
                  label={index === 0 ? "Produit *" : undefined}
                  value={item.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  options={products.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
                  className="text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label={index === 0 ? "Qté (T)" : undefined}
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantity === 0 ? '' : item.quantity}
                  onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                  className="text-xs font-mono font-bold text-right"
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label={index === 0 ? "Prix U. HT" : undefined}
                  type="number"
                  min="0"
                  step="any"
                  value={item.priceHT === 0 ? '' : item.priceHT}
                  onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                  className="text-xs font-mono font-bold text-right"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col justify-end">
                {index === 0 && <span className="text-[10px] font-bold text-slate-600 mb-1">Mnt HT</span>}
                <div className="h-8 flex items-center justify-end px-2.5 bg-white rounded border border-slate-200 text-xs font-mono font-bold text-slate-800">
                  {formatCurrency(item.totalHT)}
                </div>
              </div>

              <div className="sm:col-span-1 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItemRow(index)}
                  disabled={items.length <= 1}
                  className="text-slate-400 hover:text-red-600 disabled:opacity-30 p-1.5 cursor-pointer"
                  title="Supprimer cette ligne"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Summary */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <div className="text-slate-500 font-medium">
            TVA applicable: <strong>{tvaRate}%</strong>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500 mr-1.5">Total HT :</span>
              <span className="font-mono font-bold text-slate-800">{formatCurrency(totalHT)}</span>
            </div>
            <div>
              <span className="text-slate-500 mr-1.5">TVA :</span>
              <span className="font-mono font-bold text-slate-800">{formatCurrency(totalTVA)}</span>
            </div>
            <div className="bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
              <span className="text-blue-900 font-bold mr-1.5 uppercase tracking-tight">Net à Payer :</span>
              <span className="text-blue-950 font-mono font-black text-sm">{formatCurrency(totalTTC)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action bar */}
      <div className="flex justify-between items-center pt-1">
        {isEditMode ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="text-red-600 hover:bg-red-50 border-red-200 cursor-pointer text-xs"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Supprimer cette commande
          </Button>
        ) : <div />}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')} className="text-xs">
            Annuler
          </Button>
          <Button onClick={handleSave} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs">
            <Save className="h-3.5 w-3.5 mr-1" />
            {isEditMode ? 'Enregistrer' : 'Valider la commande'}
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
      {/* Client Picker Full Modal */}
      <ClientPickerModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSelect={(cust) => {
          handleCustomerChange(cust.id);
          setIsClientModalOpen(false);
        }}
        customers={customers}
        selectedCustomerId={customerId}
        companyName={settings?.name || 'SARL MAHAJIR SIDAR'}
      />

      {/* Truck Picker Full Modal */}
      <TruckPickerModal
        isOpen={isTruckModalOpen}
        onClose={() => setIsTruckModalOpen(false)}
        onSelect={(truck) => {
          setTruckId(truck.id);
          setIsTruckModalOpen(false);
        }}
        trucks={trucks}
        drivers={drivers}
        selectedTruckId={truckId}
        customerName={selectedCustomer?.name}
        customerFavoriteTruckIds={selectedCustomer?.favoriteTruckIds || []}
        companyName={settings?.name || 'SARL MAHAJIR SIDAR'}
      />
    </div>
  );
}

