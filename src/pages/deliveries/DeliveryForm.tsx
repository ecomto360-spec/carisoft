import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { 
  ArrowLeft, Save, Printer, Check, Plus, X, 
  Search, Star, Truck as TruckIcon, Layers, Calendar, Clock,
  CreditCard, Tag, AlertCircle, Download, ExternalLink, RefreshCw,
  CheckCircle2, AlertTriangle, FileText, UserCheck, ShieldAlert,
  ChevronDown, Phone, Lock, Scale, Calculator, PackageCheck, Unlink
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { executePrint, generateBLHtml, type DeliveryPrintData } from '../../lib/printReceipt';
import { ClientPickerModal } from './ClientPickerModal';
import { TruckPickerModal } from './TruckPickerModal';
import { FavoriteTrucksModal } from './FavoriteTrucksModal';
import { ProductPickerModal } from './ProductPickerModal';
import { CustomerProfileModal } from '../../components/clients/CustomerProfileModal';
import { Customer, Truck, Product, Order, OrderItem } from '../../types';
import { useAuthStore } from '../../store/authStore';

export function DeliveryForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const initialOrderId = searchParams.get('orderId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  // Live Query DB Data
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(p => p.active !== false).toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const conventions = useLiveQuery(() => db.conventions.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()) || [];
  const productPrices = useLiveQuery(() => db.productPrices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const deliveries = useLiveQuery(() => db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const orders = useLiveQuery(() => db.orders.where('companyId').equals(currentCompanyId).toArray()) || [];
  const orderItems = useLiveQuery(() => db.orderItems.where('companyId').equals(currentCompanyId).toArray()) || [];
  const companySettings = useLiveQuery(() => db.settings.toCollection().first());

  // Linked Order State
  const [linkedOrderId, setLinkedOrderId] = useState<string>(initialOrderId);
  const [linkedOrderItemId, setLinkedOrderItemId] = useState<string>('');
  const [orderSyncToast, setOrderSyncToast] = useState<{ number: string; message: string } | null>(null);

  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [isFavoriteTruckModalOpen, setIsFavoriteTruckModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCustomerProfileOpen, setIsCustomerProfileOpen] = useState(false);

  // Quick Client Search Dropdown
  const [quickClientSearch, setQuickClientSearch] = useState('');
  const [isQuickClientSearchOpen, setIsQuickClientSearchOpen] = useState(false);
  const quickSearchRef = useRef<HTMLDivElement>(null);

  // Credit limit alert modal state
  const [creditLimitAlert, setCreditLimitAlert] = useState<{
    customerName: string;
    creditLimit: number;
    currentDebt: number;
    saleAmount: number;
    projectedDebt: number;
    exceededBy: number;
    andPrint: boolean;
  } | null>(null);

  // Top Bar State
  const [blNumber, setBlNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));

  // Client Selection State
  const [clientCodeInput, setClientCodeInput] = useState('');
  const [customerId, setCustomerId] = useState('');

  // Tax Type: 'HT' or 'TTC'
  const [taxType, setTaxType] = useState<'HT' | 'TTC'>('TTC');

  // Product Line State
  const [productId, setProductId] = useState('');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [isAutoPrice, setIsAutoPrice] = useState(true);

  // Transport & Weighing State (SINGLE TRUCK SELECTION)
  const [truckId, setTruckId] = useState('');
  const [isFavoriteTruckSelected, setIsFavoriteTruckSelected] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [tare, setTare] = useState<number | ''>(''); // Tare (Camion Vide)
  const [ptc, setPtc] = useState<number | ''>('');   // PTC / Poids Brut (Total en Charge)

  // Payment & Discount State
  const [paymentMode, setPaymentMode] = useState<string>('Espèces');
  const [discount, setDiscount] = useState<number | ''>(''); // Remise
  const [destination, setDestination] = useState('');
  const [remarks, setRemarks] = useState('');

  // Feedback, Saving & Print States
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{ number: string; id: string } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFormat, setPrintFormat] = useState<'A4' | 'ticket'>('A4');
  const [savedDeliveryData, setSavedDeliveryData] = useState<(DeliveryPrintData & { id?: string }) | null>(null);

  // Resolved Entities
  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const selectedProduct = useMemo(() => products.find(p => p.id === productId), [products, productId]);
  const selectedTruck = useMemo(() => trucks.find(t => t.id === truckId), [trucks, truckId]);

  // Count unique favorite trucks (marked as favorite OR used for this customer)
  const clientFavoriteTrucksCount = useMemo(() => {
    const set = new Set<string>();
    trucks.forEach(t => {
      if (t.isFavorite && t.active !== false) {
        set.add(t.id);
      }
    });
    if (customerId && deliveries) {
      deliveries.forEach(d => {
        if (d.customerId === customerId && d.truckId) {
          set.add(d.truckId);
        }
      });
    }
    return set.size;
  }, [trucks, customerId, deliveries]);

  // Active Customer Orders
  const customerOrders = useMemo(() => {
    if (!customerId) return [];
    return orders.filter(o => o.customerId === customerId && o.status !== 'cancelled');
  }, [orders, customerId]);

  const currentLinkedOrder = useMemo(() => {
    if (!linkedOrderId) return null;
    return orders.find(o => o.id === linkedOrderId) || null;
  }, [orders, linkedOrderId]);

  const currentOrderItems = useMemo(() => {
    if (!linkedOrderId) return [];
    return orderItems.filter(item => item.orderId === linkedOrderId);
  }, [orderItems, linkedOrderId]);

  // Method to apply order data
  const applyOrderToDelivery = (order: Order, specificItemId?: string) => {

    setLinkedOrderId(order.id);

    // Synchronize Truck & Driver from Order
    if (order.truckId) {
      const trk = trucks.find(t => t.id === order.truckId);
      if (trk) {
        setTruckId(trk.id);
        setTare(trk.tare);
        setIsFavoriteTruckSelected(Boolean(trk.isFavorite));
        if (trk.driverName) {
          setDriverName(trk.driverName);
        } else if (trk.driverId) {
          const d = drivers.find(drv => drv.id === trk.driverId);
          if (d) setDriverName(d.name);
        }
      }
    }

    // Synchronize Product & Price from Order Items
    const items = orderItems.filter(it => it.orderId === order.id);
    if (items.length > 0) {
      const targetItem = specificItemId ? items.find(it => it.id === specificItemId) || items[0] : items[0];
      setProductId(targetItem.productId);
      setUnitPrice(targetItem.priceHT);
      setIsAutoPrice(false);
      setLinkedOrderItemId(targetItem.id);
    }

    setRemarks(prev => (prev ? prev : `Réf. Commande: ${order.number}`));
    setOrderSyncToast({
      number: order.number,
      message: `Commande ${order.number} chargée : Camion, Chauffeur et Tarifs synchronisés.`
    });
    setFormError(null);
  };

  // Sync initial customer if passed via searchParams
  useEffect(() => {
    if (!isEditing && initialCustomerId && customers.length > 0 && !customerId) {
      const matched = customers.find(c => c.id === initialCustomerId);
      if (matched) {
        setCustomerId(matched.id);
        setClientCodeInput(matched.code);
      }
    }
  }, [initialCustomerId, customers, isEditing, customerId]);

  // Auto-detect and link active order when customer changes (if not in edit mode)
  useEffect(() => {
    if (!isEditing && customerId && orders.length > 0) {
      const custOrders = orders.filter(o => o.customerId === customerId && o.status !== 'cancelled');
      if (custOrders.length > 0) {
        // If current linkedOrderId is not for this customer or not set
        if (!linkedOrderId || !custOrders.some(o => o.id === linkedOrderId)) {
          const target = (initialOrderId && custOrders.find(o => o.id === initialOrderId)) 
            || custOrders.find(o => o.status === 'confirmed') 
            || custOrders[0];
          if (target) {
            applyOrderToDelivery(target);
          }
        }
      } else {
        setLinkedOrderId('');
        setLinkedOrderItemId('');
      }
    }
  }, [customerId, orders, orderItems, trucks, drivers, isEditing, initialOrderId]);

  // Sync client code input when customerId changes
  useEffect(() => {
    if (selectedCustomer) {
      setClientCodeInput(selectedCustomer.code);
    }
  }, [selectedCustomer]);

  // Load existing BL if in edit mode
  useEffect(() => {
    if (isEditing && id) {
      db.deliveryNotes.get(id).then(async (dn) => {
        if (dn) {
          setBlNumber(dn.number);
          setCustomerId(dn.customerId);
          setTruckId(dn.truckId);
          setPtc(dn.grossWeight || 0);
          setTare(dn.tare || 0);
          if (dn.paymentMode) setPaymentMode(dn.paymentMode);
          if (dn.discount !== undefined) setDiscount(dn.discount);
          if (dn.taxType) setTaxType(dn.taxType);
          if (dn.date) {
            setDate(dn.date.split('T')[0]);
            setTime(new Date(dn.date).toTimeString().slice(0, 5));
          }
          if (dn.time) setTime(dn.time);
          if (dn.destination) setDestination(dn.destination);
          if (dn.remarks) setRemarks(dn.remarks);

          // Find driver name
          if (dn.driverId) {
            const drv = await db.drivers.get(dn.driverId);
            if (drv) setDriverName(drv.name);
          }

          // Get product item
          const item = await db.deliveryNoteItems.where('deliveryNoteId').equals(id).first();
          if (item) {
            setProductId(item.productId);
            setUnitPrice(item.priceHT);
            setIsAutoPrice(false);
          }
        }
      });
    } else {
      // Automatic BL Number generation
      db.deliveryNotes.count().then(count => {
        const nextNum = String(count + 1).padStart(4, '0');
        setBlNumber(`${nextNum}`);
      });
      // Default to first customer if available and none selected
      if (customers.length > 0 && !customerId) {
        const defaultCust = customers[0];
        setCustomerId(defaultCust.id);
        setClientCodeInput(defaultCust.code);
      }
      // Default to first product if available
      if (products.length > 0 && !productId) {
        setProductId(products[0].id);
      }
    }
  }, [id, isEditing, customers.length, products.length]);

  // Handle direct client code typing
  const handleClientCodeChange = (codeVal: string) => {
    setClientCodeInput(codeVal);
    const matched = customers.find(c => c.code.toLowerCase() === codeVal.trim().toLowerCase());
    if (matched) {
      setCustomerId(matched.id);
      setFormError(null);
    }
  };

  // Auto-calculate convention price when customer and product change
  useEffect(() => {
    if (isAutoPrice && customerId && productId) {
      let resolvedPrice = 0;

      // 1. Check customer family convention match
      if (selectedCustomer?.familyId) {
        const custConventions = conventions.filter(c => c.familyId === selectedCustomer.familyId);
        const matchingPrice = productPrices.find(pp => 
          pp.productId === productId && custConventions.some(c => c.id === pp.conventionId)
        );
        if (matchingPrice && matchingPrice.priceHT > 0) {
          resolvedPrice = matchingPrice.priceHT;
        }
      }

      // 2. Direct convention ID
      if (!resolvedPrice) {
        const directPrice = productPrices.find(pp => 
          pp.productId === productId && pp.conventionId === selectedCustomer?.familyId
        );
        if (directPrice && directPrice.priceHT > 0) {
          resolvedPrice = directPrice.priceHT;
        }
      }

      // 3. Fallback to any price for this product
      if (!resolvedPrice) {
        const fallback = productPrices.find(pp => pp.productId === productId);
        if (fallback) resolvedPrice = fallback.priceHT;
      }

      // 4. Default standard quarry price
      if (!resolvedPrice) {
        resolvedPrice = 650;
      }

      setUnitPrice(resolvedPrice);
    }
  }, [customerId, productId, isAutoPrice, selectedCustomer, conventions, productPrices]);

  // Weights calculation
  const grossVal = typeof ptc === 'number' ? ptc : 0;
  const tareVal = typeof tare === 'number' ? tare : 0;
  const netWeight = useMemo(() => {
    const net = grossVal - tareVal;
    return net > 0 ? Number(net.toFixed(2)) : 0;
  }, [grossVal, tareVal]);

  const unitPriceVal = typeof unitPrice === 'number' ? unitPrice : 0;
  const tvaRate = selectedCustomer?.tvaExempt ? 0 : 19;

  // Amounts calculation based on Type B.L. (HT vs TTC)
  const totalHT = useMemo(() => {
    if (taxType === 'HT') {
      return Number((netWeight * unitPriceVal).toFixed(2));
    } else {
      // If price was entered TTC, calculate base HT
      const ttcBase = netWeight * unitPriceVal;
      return tvaRate > 0 ? Number((ttcBase / (1 + tvaRate / 100)).toFixed(2)) : ttcBase;
    }
  }, [netWeight, unitPriceVal, taxType, tvaRate]);

  const totalTVA = useMemo(() => {
    if (selectedCustomer?.tvaExempt) return 0;
    return Number((totalHT * (tvaRate / 100)).toFixed(2));
  }, [totalHT, tvaRate, selectedCustomer]);

  const totalTTC = useMemo(() => {
    if (taxType === 'TTC') {
      return Number((netWeight * unitPriceVal).toFixed(2));
    }
    return Number((totalHT + totalTVA).toFixed(2));
  }, [netWeight, unitPriceVal, taxType, totalHT, totalTVA]);

  const discountVal = typeof discount === 'number' ? discount : 0;
  const netToPay = useMemo(() => {
    const finalVal = totalTTC - discountVal;
    return finalVal > 0 ? Number(finalVal.toFixed(2)) : 0;
  }, [totalTTC, discountVal]);

  // Selection handlers from Modals
  const handleSelectCustomer = (cust: Customer) => {
    setCustomerId(cust.id);
    setClientCodeInput(cust.code);
    setFormError(null);
  };

  // Single truck selection handler (mutually exclusive)
  const handleSelectTruck = (truck: Truck, drvName?: string, isFav = false) => {
    setTruckId(truck.id);
    setTare(truck.tare);
    setIsFavoriteTruckSelected(isFav || Boolean(truck.isFavorite));
    setFormError(null);

    if (truck.driverName) {
      setDriverName(truck.driverName);
    } else if (drvName && drvName !== '-') {
      setDriverName(drvName);
    } else if (truck.driverId) {
      const d = drivers.find(drv => drv.id === truck.driverId);
      if (d) setDriverName(d.name);
    }
  };

  const handleSelectProduct = (prod: Product, priceHT: number) => {
    setProductId(prod.id);
    setUnitPrice(priceHT);
    setIsAutoPrice(false);
    setFormError(null);
  };

  // Reset form to chain multiple deliveries easily
  const handleResetForNewBL = async () => {
    const count = await db.deliveryNotes.count();
    const nextNum = String(count + 1).padStart(4, '0');
    setBlNumber(`${nextNum}`);
    setPtc('');
    setTare('');
    setTruckId('');
    setDriverName('');
    setIsFavoriteTruckSelected(false);
    setDiscount('');
    setDestination('');
    setRemarks('');
    setFormError(null);
    setSaveSuccess(null);
    setShowPrintModal(false);
  };

  // Save & Validate Delivery Note
  const handleSave = async (andPrint = false, bypassCreditLimit = false) => {
    setFormError(null);

    if (!customerId) {
      setFormError('Veuillez sélectionner un client.');
      return false;
    }
    if (!productId) {
      setFormError('Veuillez sélectionner un produit agrégat.');
      return false;
    }
    if (!truckId) {
      setFormError('Veuillez sélectionner un camion de transport (1 seul camion possible).');
      return false;
    }
    if (grossVal <= 0) {
      setFormError('Veuillez renseigner le Poids Total en Charge (PTC / Brut).');
      return false;
    }
    if (tareVal < 0) {
      setFormError('La Tare doit être positive ou égale à 0.');
      return false;
    }
    if (netWeight <= 0) {
      setFormError('Le Poids Net doit être supérieur à 0 (Le PTC doit être supérieur à la Tare).');
      return false;
    }

    // Check Credit Limit for "Terme" payments
    if (paymentMode === 'Terme' && selectedCustomer && !bypassCreditLimit) {
      const creditLimit = selectedCustomer.creditLimit || 0;
      if (creditLimit > 0) {
        const currentBalance = selectedCustomer.balance || 0;
        const currentDebt = currentBalance < 0 ? Math.abs(currentBalance) : 0;
        const projectedDebt = currentDebt + netToPay;

        if (projectedDebt > creditLimit) {
          setCreditLimitAlert({
            customerName: selectedCustomer.name,
            creditLimit,
            currentDebt,
            saleAmount: netToPay,
            projectedDebt,
            exceededBy: projectedDebt - creditLimit,
            andPrint
          });
          return false;
        }
      }
    }

    setIsSaving(true);
    try {
      const deliveryId = isEditing && id ? id : crypto.randomUUID();
      const combinedDateTime = new Date(`${date}T${time || '12:00'}:00`).toISOString();

      // Find or create driver
      let driverIdToSave = selectedTruck?.driverId;
      if (driverName.trim()) {
        const existingDrv = drivers.find(d => d.name.toLowerCase() === driverName.trim().toLowerCase());
        if (existingDrv) {
          driverIdToSave = existingDrv.id;
        } else {
          const newDrvId = crypto.randomUUID();
          await db.drivers.add({
            id: newDrvId,
            name: driverName.trim(),
            phone: '',
            active: true
          });
          driverIdToSave = newDrvId;
        }
      }

      const deliveryPayload = {
        number: blNumber.startsWith('BL-') ? blNumber : `BL-${blNumber}`,
        date: combinedDateTime,
        time,
        customerId,
        truckId,
        driverId: driverIdToSave || undefined,
        grossWeight: grossVal,
        tare: tareVal,
        netWeight,
        totalHT,
        totalTVA,
        totalTTC: netToPay,
        paymentMode,
        discount: discountVal > 0 ? discountVal : undefined,
        taxType,
        destination: destination.trim() || undefined,
        remarks: remarks.trim() || undefined,
        orderId: linkedOrderId || undefined,
        status: 'validated' as const
      };

      if (isEditing && id) {
        await db.deliveryNotes.update(id, deliveryPayload);
        await db.deliveryNoteItems.where('deliveryNoteId').equals(id).delete();
      } else {
        await db.deliveryNotes.add({
          id: deliveryId,
          ...deliveryPayload
        });

        // If this delivery was linked to an order, mark the order as delivered
        if (linkedOrderId) {
          await db.orders.update(linkedOrderId, { status: 'delivered' });
        }
      }

      // Add product item line
      await db.deliveryNoteItems.add({
        id: crypto.randomUUID(),
        deliveryNoteId: deliveryId,
        productId,
        quantity: netWeight,
        priceHT: taxType === 'HT' ? unitPriceVal : totalHT / (netWeight || 1),
        totalHT
      });

      // Update customer balance if payment is on credit / Terme
      if (paymentMode === 'Terme' && selectedCustomer) {
        await db.customers.update(customerId, {
          balance: (selectedCustomer.balance || 0) - netToPay
        });
      }

      const printPayload: DeliveryPrintData & { id: string } = {
        id: deliveryId,
        number: deliveryPayload.number,
        date: combinedDateTime,
        customerName: selectedCustomer?.name || 'Client',
        customerCode: selectedCustomer?.code || '',
        customerAddress: selectedCustomer?.address || '',
        customerRC: selectedCustomer?.rc || '',
        customerNIF: selectedCustomer?.nif || '',
        hidePrices: selectedCustomer?.hidePricesOnDeliveryNote || false,
        productName: selectedProduct?.name || 'Agrégats',
        productCode: selectedProduct?.code || '',
        productUnit: selectedProduct?.unit || 'Tonne',
        truckMatricule: selectedTruck?.matricule || '',
        driverName: driverName || (selectedTruck?.driverId ? (drivers.find(d => d.id === selectedTruck?.driverId)?.name || 'Chauffeur') : 'Chauffeur'),
        grossWeight: grossVal,
        tare: tareVal,
        netWeight,
        priceHT: unitPriceVal,
        totalHT,
        totalTVA,
        totalTTC: netToPay,
        tvaRate,
        destination: destination.trim() || undefined,
        remarks: remarks.trim() || undefined,
        companyName: companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS',
        companyPhone: companySettings?.phone || '026 00 00 00',
        companyAddress: companySettings?.address || 'CITE 150 BT E CAGE 01 N8 EL HACHIMIA .W BOURA',
        companyLogo: companySettings?.logoUrl
      };

      setSavedDeliveryData(printPayload);

      if (andPrint) {
        setShowPrintModal(true);
        executePrint(printPayload, printFormat);
      } else {
        setSaveSuccess({ number: deliveryPayload.number, id: deliveryId });
      }
      return true;
    } catch (err) {
      console.error('Error saving delivery note', err);
      setFormError('Erreur lors de l\'enregistrement du bon de livraison');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCreditLimitSale = async () => {
    if (!creditLimitAlert) return;
    const andPrint = creditLimitAlert.andPrint;
    setCreditLimitAlert(null);
    await handleSave(andPrint, true);
  };

  const handleDownloadFile = () => {
    if (!savedDeliveryData) return;
    const html = generateBLHtml(savedDeliveryData, printFormat);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${savedDeliveryData.number}_${printFormat}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12 font-sans">
      
      {/* Return & Breadcrumb Bar */}
      <div className="flex items-center justify-between pb-1">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/deliveries')} 
          className="cursor-pointer text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour aux Bons de Livraison
        </Button>
        <span className="text-xs text-slate-500 font-mono">
          Système de Pesée & Expédition Carrière
        </span>
      </div>

      {/* Validation Error Banner */}
      {formError && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{formError}</span>
          </div>
          <button 
            type="button"
            onClick={() => setFormError(null)}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Container Window */}
      <div className="bg-slate-50 rounded-xl border border-slate-300 shadow-xl overflow-hidden">
        
        {/* TOP TITLE BAR: "Nouveau Bon de Livraison *" / "SARL MAHAJIR SIDAR..." */}
        <div className="bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-4 py-2.5 flex items-center justify-between shadow-xs select-none">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base tracking-wide">
              {isEditing ? 'Modifier Bon de Livraison' : 'Nouveau Bon de Livraison *'}
            </span>
            <span className="text-xs text-blue-200 hidden sm:inline">
              — {companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'}
            </span>
          </div>
          <div className="text-xs bg-blue-950/70 border border-blue-400/30 px-2.5 py-0.5 rounded font-mono font-bold text-blue-100">
            PESÉE PONT BASCULE
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 bg-slate-100/70">
          
          {/* SECTION 1: BL Number, Date, Heure, Client & Type B.L. */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            
            {/* Top Row: Bon de Livraison, Date B.L., Heure */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
              
              {/* Bon de Livraison Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                  Bon de Livraison
                </span>
                <div className="bg-slate-900 text-white px-3.5 py-1 rounded text-base font-mono font-extrabold tracking-wider border border-slate-800 shadow-xs">
                  {blNumber || '----'}
                </div>
              </div>

              {/* Date & Heure */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1 rounded-lg">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">Date B.L. :</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1 rounded-lg">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">Heure :</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

            </div>

            {/* Middle Row: Client Selection (Code + Name + Picker + Profil + Solde/Dette/Plafond) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              
              {/* Client Code + Name + Button */}
              <div className="lg:col-span-8 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1.5">
                    Client <span className="text-red-500 font-bold">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    {selectedCustomer?.hidePricesOnDeliveryNote && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                        Prix masqués sur B.L. (Exempt / Bon de retrait)
                      </span>
                    )}
                    {selectedCustomer && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        {selectedCustomer.city ? `${selectedCustomer.city}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Direct Code Input */}
                  <input
                    type="text"
                    placeholder="Code"
                    value={clientCodeInput}
                    onChange={(e) => handleClientCodeChange(e.target.value)}
                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    title="Saisir directement le code client (ex: C001, 1...)"
                  />

                  {/* Customer Display Box */}
                  <div 
                    onClick={() => setIsClientModalOpen(true)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 rounded text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
                  >
                    <span className="truncate">
                      {selectedCustomer ? `${selectedCustomer.name}` : 'Cliquez pour choisir un client...'}
                    </span>
                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  </div>

                  {/* Open Client Modal Button */}
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(true)}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded shadow-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Choix Client
                  </button>

                  {/* Open Profile Modal Button */}
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => setIsCustomerProfileOpen(true)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded shadow-2xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                      title="Consulter l'historique, dettes antérieures et règlements de ce client"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-600" />
                      Fiche & Règl.
                    </button>
                  )}
                </div>
              </div>

              {/* Reste à payer / Solde & Plafond Display Card */}
              <div 
                onClick={() => {
                  if (selectedCustomer) setIsCustomerProfileOpen(true);
                }}
                className={`lg:col-span-4 p-2.5 rounded-xl border transition-all ${
                  selectedCustomer ? 'cursor-pointer hover:shadow-md' : ''
                } ${
                  (selectedCustomer?.balance || 0) < 0 
                    ? 'bg-red-50/70 border-red-200' 
                    : (selectedCustomer?.balance || 0) > 0 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : 'bg-slate-50 border-slate-200'
                }`}
                title={selectedCustomer ? 'Cliquer pour ouvrir la fiche client et enregistrer un versement' : ''}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-tight">
                      Solde Client :
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {(selectedCustomer?.balance || 0) < 0 ? 'Dette globale en cours' : (selectedCustomer?.balance || 0) > 0 ? 'Avance client' : 'Solde nul (À jour)'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-mono font-black ${
                      (selectedCustomer?.balance || 0) < 0 ? 'text-red-600' : (selectedCustomer?.balance || 0) > 0 ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {formatCurrency(selectedCustomer?.balance || 0)}
                    </span>
                  </div>
                </div>

                {/* Sub-row: Dette Initiale + Plafond de crédit */}
                {selectedCustomer && ((selectedCustomer.initialDebt && selectedCustomer.initialDebt > 0) || (selectedCustomer.creditLimit && selectedCustomer.creditLimit > 0)) && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                    {selectedCustomer.initialDebt && selectedCustomer.initialDebt > 0 ? (
                      <span className="text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-bold">
                        Dette Init.: {formatCurrency(selectedCustomer.initialDebt)}
                      </span>
                    ) : <span />}
                    {selectedCustomer.creditLimit && selectedCustomer.creditLimit > 0 && (
                      <span className={`px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${
                        Math.abs(Math.min(0, selectedCustomer.balance || 0)) > selectedCustomer.creditLimit
                          ? 'bg-red-200 text-red-900'
                          : 'bg-blue-100 text-blue-900'
                      }`}>
                        {Math.abs(Math.min(0, selectedCustomer.balance || 0)) > selectedCustomer.creditLimit && (
                          <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                        )}
                        Plafond: {formatCurrency(selectedCustomer.creditLimit)}
                      </span>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Row: Type B.L. (H.Taxes vs TTC) */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">
                  Type B.L. :
                </span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="taxType"
                      value="HT"
                      checked={taxType === 'HT'}
                      onChange={() => setTaxType('HT')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>H.Taxes</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="taxType"
                      value="TTC"
                      checked={taxType === 'TTC'}
                      onChange={() => setTaxType('TTC')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>TTC</span>
                  </label>
                </div>
              </div>

            </div>

          </div>

          {/* ORDER LINKING BANNER / CARD */}
          {currentLinkedOrder ? (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 border-2 border-blue-300 rounded-xl p-3.5 shadow-xs space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
                    <PackageCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Commande Client Rattachée :
                      </span>
                      <span className="font-mono font-extrabold text-sm text-blue-900 bg-white px-2.5 py-0.5 rounded-md border border-blue-400 shadow-2xs">
                        {currentLinkedOrder.number}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        currentLinkedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        currentLinkedOrder.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {currentLinkedOrder.status === 'confirmed' ? '✓ Confirmée' : currentLinkedOrder.status === 'delivered' ? '✓ Livrée' : 'Brouillon'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                        Date: {formatDate(currentLinkedOrder.date)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Camion, Chauffeur et Tarifs négociés automatiquement synchronisés. 
                      Renseignez le <strong>PTC (Poids Brut)</strong> sur le pont bascule pour calculer le montant final. Vous pouvez modifier n&apos;importe quelle information.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {customerOrders.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Changer :</span>
                      <select
                        value={linkedOrderId}
                        onChange={(e) => {
                          const ord = customerOrders.find(o => o.id === e.target.value);
                          if (ord) applyOrderToDelivery(ord);
                        }}
                        className="text-xs bg-white border border-blue-400 text-blue-950 font-bold px-2.5 py-1 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer shadow-2xs"
                      >
                        {customerOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.number} ({formatDate(o.date)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedOrderId('');
                      setLinkedOrderItemId('');
                      setIsAutoPrice(true);
                    }}
                    className="text-xs text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    title="Dissocier la commande pour créer un BL libre"
                  >
                    <Unlink className="h-3.5 w-3.5 text-slate-400 group-hover:text-red-500" />
                    Dissocier
                  </button>
                </div>
              </div>

              {/* Multi-item selector pills if order has items */}
              {currentOrderItems.length > 0 && (
                <div className="pt-2 border-t border-blue-200/80 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">
                    Articles de la commande :
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {currentOrderItems.map(item => {
                      const prod = products.find(p => p.id === item.productId);
                      const isSelected = item.productId === productId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setLinkedOrderItemId(item.id);
                            setProductId(item.productId);
                            setUnitPrice(item.priceHT);
                            setIsAutoPrice(false);
                            setFormError(null);
                          }}
                          className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-700 text-white border-blue-800 shadow-sm ring-2 ring-blue-400'
                              : 'bg-white hover:bg-blue-50 text-slate-800 border-slate-300 hover:border-blue-400'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                          <span>{prod?.name || 'Produit'}</span>
                          <span className={`font-mono text-[11px] ${isSelected ? 'text-blue-100 font-extrabold' : 'text-slate-500'}`}>
                            ({item.quantity} T @ {formatCurrency(item.priceHT)} HT)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            customerOrders.length > 0 && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-amber-900 font-medium">
                    Ce client a <strong>{customerOrders.length} commande(s)</strong> enregistrée(s).
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {customerOrders.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => applyOrderToDelivery(o)}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <PackageCheck className="h-3.5 w-3.5 text-amber-600" />
                      Lier {o.number}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Toast / Alert banner on order sync */}
          {orderSyncToast && (
            <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{orderSyncToast.message}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setOrderSyncToast(null)}
                className="text-emerald-100 hover:text-white cursor-pointer ml-4"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* SECTION 2: Détail B.Livraison (Product Lines Table & Right Action Buttons) */}
          <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
            
            {/* Table Header Banner */}
            <div className="bg-blue-600 text-white px-4 py-1.5 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
              <span>Détail B.Livraison</span>
              <span className="text-[11px] font-normal text-blue-100">
                1 Ligne d&apos;agrégat par bon
              </span>
            </div>

            {/* Table + Action Buttons Layout */}
            <div className="flex flex-col lg:flex-row">
              
              {/* Product Table */}
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-800 text-white font-semibold select-none">
                    <tr>
                      <th className="py-2 px-3 border-r border-slate-700 w-28">Code</th>
                      <th className="py-2 px-3 border-r border-slate-700">Désignation</th>
                      <th className="py-2 px-3 border-r border-slate-700 w-28 text-right">Prix Unitaire</th>
                      <th className="py-2 px-3 border-r border-slate-700 w-24 text-right bg-blue-900/70">Qté (T)</th>
                      <th className="py-2 px-3 border-r border-slate-700 w-32 text-right">Mnt H.T.</th>
                      <th className="py-2 px-3 w-32 text-right">Mnt TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Active Product Row */}
                    <tr className="bg-[#ecfccb] text-slate-950 font-medium">
                      
                      {/* Code */}
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold">
                        {selectedProduct ? selectedProduct.code : '-'}
                      </td>

                      {/* Designation */}
                      <td className="py-2 px-3 border-r border-slate-200 font-bold">
                        <div className="flex items-center justify-between gap-2">
                          <span>{selectedProduct ? selectedProduct.name : 'Sélectionnez un produit avec le bouton Ajouter +'}</span>
                          <button
                            type="button"
                            onClick={() => setIsProductModalOpen(true)}
                            className="text-[10px] bg-white hover:bg-slate-100 text-blue-700 border border-blue-300 px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            Changer
                          </button>
                        </div>
                      </td>

                      {/* Unit Price (Editable) */}
                      <td className="py-1 px-2 border-r border-slate-200 text-right">
                        <div className="relative flex items-center justify-end">
                          <input
                            type="number"
                            step="0.01"
                            value={unitPrice}
                            onChange={(e) => {
                              setIsAutoPrice(false);
                              setUnitPrice(e.target.value === '' ? '' : Number(e.target.value));
                            }}
                            className="w-24 px-1.5 py-1 text-right font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Quantity (Net Weight in Tonnes) */}
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-extrabold text-blue-900 text-sm bg-lime-100">
                        {netWeight.toFixed(2).replace('.', ',')}
                      </td>

                      {/* Mnt H.T. */}
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(totalHT)}
                      </td>

                      {/* Mnt TTC */}
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                        {formatCurrency(totalTTC)}
                      </td>

                    </tr>
                  </tbody>

                  {/* Table Footer: Total B.L. */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800">
                      <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider text-xs">
                        Total B.L. :
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-800">
                        {netWeight.toFixed(2).replace('.', ',')} T
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-900">
                        {formatCurrency(totalHT)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-700 text-sm">
                        {formatCurrency(totalTTC)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Side Action Buttons: Valider / Ajouter / Annuler */}
              <div className="bg-slate-100 p-2.5 border-t lg:border-t-0 lg:border-l border-slate-300 flex flex-row lg:flex-col gap-2 justify-center lg:w-36 shrink-0">
                
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex-1 lg:flex-none px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Valider
                </button>

                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(true)}
                  className="flex-1 lg:flex-none px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4 text-emerald-600" />
                  Ajouter +
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setProductId('');
                    setUnitPrice('');
                  }}
                  className="flex-1 lg:flex-none px-3 py-2 bg-white hover:bg-slate-50 text-red-700 border border-slate-300 font-bold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4 text-red-500" />
                  Annuler
                </button>

              </div>

            </div>

          </div>

          {/* SECTION 3: Bottom Payment, Transport & Weights Area */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left Column: Mode de règlement, Remise, Net à payer (4 cols) */}
              <div className="lg:col-span-4 space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                
                {/* Mode règlement */}
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    Mode règlement :
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="flex-1 max-w-[160px] px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Terme">Terme (Crédit)</option>
                    <option value="Avances">Avances</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>

                {paymentMode === 'Terme' && (
                  <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg text-[11px] text-amber-900 leading-tight space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <CreditCard className="h-3.5 w-3.5 text-amber-700" />
                      Paiement à terme (Vente à crédit)
                    </div>
                    <p className="text-[10px] text-amber-800">
                      Le montant de {formatCurrency(netToPay)} sera automatiquement ajouté à la dette du client.
                    </p>
                  </div>
                )}

                {/* Remise */}
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    Remise :
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-32 px-2.5 py-1 text-xs font-mono font-bold text-right bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 font-semibold">DA</span>
                  </div>
                </div>

                {/* Net à payer Display */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                    Net à payer :
                  </span>
                  <div className="text-base font-mono font-extrabold text-blue-800 bg-blue-50 px-3 py-1 rounded border border-blue-200">
                    {formatCurrency(netToPay)}
                  </div>
                </div>

              </div>

              {/* Middle & Right Column: Transport, Camion (1 SEUL CHOIX), Chauffeur, Tare, PTC (8 cols) */}
              <div className="lg:col-span-8 space-y-3">
                
                {/* UNIFIED TRUCK SELECTION CARD (ENFORCE SINGLE CHOICE) */}
                <div className="space-y-2.5 bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TruckIcon className="h-4 w-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                        Camion de Transport <span className="text-red-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        (Liaison Pont-Bascule)
                      </span>
                      {(isFavoriteTruckSelected || selectedTruck?.isFavorite) && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                          <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                          Camion Favori
                        </span>
                      )}
                    </div>

                    {/* Two Modal Selection Buttons (Mutually Exclusive) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTruckModalOpen(true)}
                        className="text-xs bg-white hover:bg-slate-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Search className="h-3.5 w-3.5 text-blue-600" />
                        Tous les camions
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsFavoriteTruckModalOpen(true)}
                        className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        title="Ouvrir les camions favoris et habituels"
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        Camions favoris {clientFavoriteTrucksCount > 0 ? `(${clientFavoriteTrucksCount})` : ''}
                      </button>
                    </div>
                  </div>

                  {/* Single Active Truck Box */}
                  <div 
                    onClick={() => setIsTruckModalOpen(true)}
                    className={`w-full p-3 bg-white border rounded-xl cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      selectedTruck 
                        ? isFavoriteTruckSelected 
                          ? 'border-amber-400 bg-amber-50/20 shadow-xs' 
                          : 'border-blue-400 bg-blue-50/20 shadow-xs'
                        : 'border-slate-300 hover:border-slate-400 border-dashed'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Truck Thumbnail Photo or Icon */}
                      <div className={`w-14 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border ${
                        selectedTruck 
                          ? 'border-blue-300 bg-slate-900' 
                          : 'border-slate-200 bg-slate-100 text-slate-400'
                      }`}>
                        {selectedTruck?.imageUrl ? (
                          <img 
                            src={selectedTruck.imageUrl} 
                            alt={selectedTruck.matricule} 
                            className="w-full h-full object-cover" 
                          />
                        ) : selectedTruck ? (
                          <TruckIcon className="h-7 w-7 text-amber-400" />
                        ) : (
                          <TruckIcon className="h-6 w-6 text-slate-400" />
                        )}
                      </div>

                      <div className="space-y-1">
                        {selectedTruck ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-sm text-slate-950 tracking-wider">
                                {selectedTruck.matricule}
                              </span>
                              {selectedTruck.brand && (
                                <span className="text-xs text-slate-500 font-medium">
                                  • {selectedTruck.brand}
                                </span>
                              )}
                              {selectedTruck.allowDiscount && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                                  Remise accordée
                                </span>
                              )}
                            </div>

                            {/* Detailed Specs Row: Tare, Mn Tonne, Volume, Phone */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className="font-mono font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded border border-blue-200">
                                Tare fixe: {selectedTruck.tare.toFixed(2).replace('.', ',')} T
                              </span>
                              {selectedTruck.mnTonne !== undefined && (
                                <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  Mn T: {Number(selectedTruck.mnTonne).toFixed(2).replace('.', ',')} T
                                </span>
                              )}
                              {selectedTruck.volumeM3 ? (
                                <span className="font-mono font-semibold text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded border border-amber-200">
                                  Vol: {selectedTruck.volumeM3} m³
                                </span>
                              ) : null}
                              {selectedTruck.driverPhone && (
                                <span className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  {selectedTruck.driverPhone}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 font-medium italic">
                            Aucun camion sélectionné — Cliquez ici ou utilisez l&apos;un des boutons ci-dessus
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {selectedTruck && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTruckId('');
                            setTare('');
                            setIsFavoriteTruckSelected(false);
                          }}
                          className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded font-semibold transition-colors cursor-pointer"
                          title="Désélectionner le camion"
                        >
                          Effacer
                        </button>
                      )}
                      <div className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300 font-bold hover:bg-slate-200">
                        Changer
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chauffeur Row */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Nom du Chauffeur</span>
                    {selectedTruck?.driverPhone && (
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        Tél : <strong className="text-slate-700">{selectedTruck.driverPhone}</strong>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Nom du chauffeur (ex: MAHDI HICHEME, GESSABI HAMID...)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Tare, PTC & Net Weights Row (PONT BASCULE WORKFLOW) */}
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    
                    {/* Tare (Auto-filled & Fixed from selected truck) */}
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Lock className="h-3 w-3 text-slate-400" />
                          Tare Fixe (T)
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Enregistrée)
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          readOnly
                          placeholder="0.00"
                          value={tare !== '' ? Number(tare).toFixed(2) : ''}
                          className="w-full px-2.5 py-1.5 text-base font-mono font-black text-right bg-slate-100 border border-slate-300 rounded text-slate-800 cursor-not-allowed select-all"
                          title="La tare est fixe et chargée automatiquement depuis la fiche du camion"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                          T
                        </span>
                      </div>
                    </div>

                    {/* PTC (Poids Total en Charge / Brut) - Only input field required */}
                    <div className="space-y-1 bg-blue-50/80 p-2.5 rounded-lg border-2 border-blue-400 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                          <Scale className="h-3 w-3 text-blue-600" />
                          PTC / Brut (T) *
                        </span>
                        <span className="text-[10px] text-blue-700 font-bold animate-pulse">
                          À saisir
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          autoFocus={Boolean(selectedTruck)}
                          placeholder="0.00"
                          value={ptc}
                          onChange={(e) => {
                            setPtc(e.target.value === '' ? '' : Number(e.target.value));
                            setFormError(null);
                          }}
                          className="w-full px-2.5 py-1.5 text-base font-mono font-black text-right bg-white border border-blue-400 rounded text-blue-950 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-inner"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-black text-blue-700">
                          T
                        </span>
                      </div>
                    </div>

                    {/* Poids Net (Computed automatically: PTC - Tare) */}
                    <div className="space-y-1 bg-emerald-50 p-2.5 rounded-lg border-2 border-emerald-400 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-900 flex items-center gap-1">
                          <Calculator className="h-3 w-3 text-emerald-600" />
                          Poids Net Facturé
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          PTC - Tare
                        </span>
                      </div>
                      <div className="text-base font-mono font-black text-emerald-950 py-1.5 text-right px-2 bg-emerald-100/70 border border-emerald-300 rounded">
                        {netWeight.toFixed(2).replace('.', ',')} T
                      </div>
                    </div>

                  </div>

                  {/* Formula Helper Bar */}
                  {selectedTruck && (
                    <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs flex flex-wrap items-center justify-between font-medium border border-slate-200">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <Scale className="h-3.5 w-3.5 text-blue-600" />
                        Calcul automatique du pont :
                      </span>
                      <div className="font-mono text-xs font-bold text-slate-900">
                        <span className="text-blue-700">{typeof ptc === 'number' ? ptc.toFixed(2) : '0.00'} T</span> (PTC)
                        {' - '}
                        <span className="text-slate-700">{typeof tare === 'number' ? tare.toFixed(2) : '0.00'} T</span> (Tare)
                        {' = '}
                        <span className="text-emerald-700 font-black">{netWeight.toFixed(2)} T</span> (Net)
                      </div>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Optional Destination & Remarks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                  Chantier / Destination (Optionnel)
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex: Chantier Autoroute Est-Ouest, Lot 4..."
                  className="w-full px-3 py-1 text-xs bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                  Observations / Remarques (Optionnel)
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Ex: N° Bon de Commande, Chauffeur suppléant..."
                  className="w-full px-3 py-1 text-xs bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

          </div>

          {/* SECTION 4: Final Bottom Validation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            
            <div className="text-xs text-slate-500">
              * Assurez-vous que le Poids Brut (PTC) est supérieur à la Tare pour générer le bon.
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/deliveries')}
                className="cursor-pointer"
              >
                Annuler
              </Button>

              <Button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Valider
              </Button>

              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-6 shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="h-4 w-4" />
                Valider & Imprimer
              </Button>
            </div>

          </div>

        </div>

      </div>

      {/* ALL MODALS */}

      {/* 1. Modal Choix des Clients */}
      <ClientPickerModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSelect={handleSelectCustomer}
        customers={customers}
        selectedCustomerId={customerId}
        companyName={companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'}
      />

      {/* 2. Modal Liste des Camions (Choix 1) */}
      <TruckPickerModal
        isOpen={isTruckModalOpen}
        onClose={() => setIsTruckModalOpen(false)}
        onSelect={(truck, drv) => handleSelectTruck(truck, drv, false)}
        trucks={trucks}
        drivers={drivers}
        selectedTruckId={truckId}
        companyName={companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'}
      />

      {/* 3. Modal Camions Favoris (Choix 2) */}
      <FavoriteTrucksModal
        isOpen={isFavoriteTruckModalOpen}
        onClose={() => setIsFavoriteTruckModalOpen(false)}
        onSelect={(truck, drv) => handleSelectTruck(truck, drv, true)}
        customerName={selectedCustomer?.name || 'DEVERS'}
        customerId={customerId}
        trucks={trucks}
        drivers={drivers}
        deliveries={deliveries}
        selectedTruckId={truckId}
      />

      {/* 4. Modal Choix du Produit */}
      <ProductPickerModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSelect={handleSelectProduct}
        products={products}
        productPrices={productPrices}
        conventionId={selectedCustomer?.familyId}
      />

      {/* 5. Success Validation Modal (Quick action when clicking 'Valider') */}
      {saveSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 space-y-5 text-center">
            
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                Bon de Livraison Enregistré !
              </h3>
              <p className="text-sm text-slate-600">
                Le bon <span className="font-mono font-bold text-blue-700">{saveSuccess.number}</span> a été validé avec succès.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 flex justify-between">
              <span>Client : <strong>{selectedCustomer?.name}</strong></span>
              <span>Net : <strong>{netWeight.toFixed(2)} T</strong></span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => {
                  setSaveSuccess(null);
                  setShowPrintModal(true);
                  if (savedDeliveryData) executePrint(savedDeliveryData, printFormat);
                }}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer className="h-4 w-4" />
                Imprimer le Bon
              </Button>

              <Button
                variant="outline"
                onClick={handleResetForNewBL}
                className="w-full border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold py-2.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-emerald-600" />
                Nouveau Bon de Livraison (Suivant)
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setSaveSuccess(null);
                  navigate('/deliveries');
                }}
                className="w-full text-slate-500 hover:text-slate-800 text-xs py-2 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Retourner à la liste des bons
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* 6. Print Modal (When clicking 'Valider & Imprimer' or 'Imprimer le Bon') */}
      {showPrintModal && savedDeliveryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
              <div className="flex items-center gap-2 text-slate-900">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Impression du Bon de Livraison</h3>
                  <p className="text-xs text-slate-500 font-mono">N° {savedDeliveryData.number}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPrintFormat('A4')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      printFormat === 'A4' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Format A4 Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat('ticket')}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      printFormat === 'ticket' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ticket 80mm
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setShowPrintModal(false);
                    navigate('/deliveries');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Document Preview */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50 flex justify-center">
              <div 
                className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 ${
                  printFormat === 'ticket' ? 'w-[320px]' : 'w-full max-w-2xl'
                }`}
                dangerouslySetInnerHTML={{ __html: generateBLHtml(savedDeliveryData, printFormat) }}
              />
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadFile}
                  title="Télécharger le fichier pour impression hors-ligne ou archivage"
                  className="text-xs"
                >
                  <Download className="h-4 w-4 mr-1.5 text-slate-600" />
                  Exporter HTML / PDF
                </Button>

                {savedDeliveryData.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/print/bl/${savedDeliveryData.id}?format=${printFormat}`, '_blank')}
                    title="Ouvrir dans un nouvel onglet sans restrictions"
                    className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Ouvrir Plein Écran
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPrintModal(false);
                    navigate('/deliveries');
                  }}
                >
                  Fermer
                </Button>
                
                <Button 
                  onClick={() => executePrint(savedDeliveryData, printFormat)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Lancer l&apos;Impression
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 7. Credit Limit Alert & Authorization Modal */}
      {creditLimitAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-red-200 w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-xl text-red-600 shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-red-950">
                  Dépassement du Plafond de Crédit
                </h3>
                <p className="text-xs text-red-700 font-medium">
                  Autorisation de vente à terme requise
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Le client <strong className="text-slate-900 font-bold">{creditLimitAlert.customerName}</strong> dépasse le plafond de crédit autorisé pour cette vente à terme :
              </p>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Plafond autorisé :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(creditLimitAlert.creditLimit)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Dette actuelle :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(creditLimitAlert.currentDebt)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-blue-800 font-medium">
                  <span>Montant de ce bon :</span>
                  <span className="font-mono font-bold">
                    +{formatCurrency(creditLimitAlert.saleAmount)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold">
                  <span className="text-red-900">Nouvelle dette projetée :</span>
                  <span className="font-mono text-red-600 text-sm">
                    {formatCurrency(creditLimitAlert.projectedDebt)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-red-700 bg-red-100/70 px-2 py-1 rounded font-medium">
                  <span>Dépassement :</span>
                  <span className="font-mono font-black">
                    +{formatCurrency(creditLimitAlert.exceededBy)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Vous pouvez autoriser exceptionnellement cette vente à terme ou modifier le mode de règlement.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setCreditLimitAlert(null)}
                className="text-xs"
              >
                Modifier / Annuler
              </Button>
              <Button
                onClick={handleConfirmCreditLimitSale}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md"
              >
                Autoriser la vente à terme
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* 8. Customer Profile & Payment Management Modal */}
      {isCustomerProfileOpen && selectedCustomer && (
        <CustomerProfileModal
          customer={selectedCustomer}
          onClose={() => setIsCustomerProfileOpen(false)}
        />
      )}

    </div>
  );
}
