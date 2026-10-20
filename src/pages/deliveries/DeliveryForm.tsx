import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { 
  ArrowLeft, Save, Printer, Check, Plus, X, 
  Search, Star, Truck as TruckIcon, Layers, Calendar, Clock,
  CreditCard, Tag, Copy, AlertCircle, Download, ExternalLink, RefreshCw,
  CheckCircle2, AlertTriangle, FileText, UserCheck, ShieldAlert,
  ChevronDown, Phone, Lock, Scale, Calculator, PackageCheck, Unlink
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { 
  executePrint, 
  generateBLHtml, 
  getStoredPrintFormat, 
  setStoredPrintFormat, 
  type DeliveryPrintData, 
  type DeliveryPrintFormat 
} from '../../lib/printReceipt';
import { ClientPickerModal } from './ClientPickerModal';
import { TruckPickerModal } from './TruckPickerModal';
import { FavoriteTrucksModal } from './FavoriteTrucksModal';
import { ProductPickerModal } from './ProductPickerModal';
import { CustomerProfileModal } from '../../components/clients/CustomerProfileModal';
import { Accordion, AccordionItem } from '../../components/ui/Accordion';
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

  // Linked Order & Customer Selection State
  const [linkedOrderId, setLinkedOrderId] = useState<string>(initialOrderId);
  const [customerId, setCustomerId] = useState<string>(initialCustomerId);

  // Live Query DB Data (Optimized with targeted indexes)
  const customers = useLiveQuery(() => db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const products = useLiveQuery(() => db.products.where('companyId').equals(currentCompanyId).filter(p => p.active !== false).toArray()) || [];
  const trucks = useLiveQuery(() => db.trucks.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const drivers = useLiveQuery(() => db.drivers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const conventions = useLiveQuery(() => db.conventions.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()) || [];
  const productPrices = useLiveQuery(() => db.productPrices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()) || [];
  const deliveries = useLiveQuery(
    () => customerId 
      ? db.deliveryNotes.where('customerId').equals(customerId).limit(50).toArray() 
      : [],
    [customerId]
  ) || [];
  const orders = useLiveQuery(() => currentCompanyId ? db.orders.where('companyId').equals(currentCompanyId).limit(50).toArray() : [], [currentCompanyId]) || [];
  const orderItems = useLiveQuery(
    () => linkedOrderId 
      ? db.orderItems.where('orderId').equals(linkedOrderId).toArray() 
      : [],
    [linkedOrderId]
  ) || [];
  const companySettings = useLiveQuery(() => db.settings.toCollection().first());

  // Linked Order Items & State
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
  const [printFormat, setPrintFormatState] = useState<DeliveryPrintFormat>(getStoredPrintFormat());
  const setPrintFormat = (fmt: DeliveryPrintFormat) => {
    setPrintFormatState(fmt);
    setStoredPrintFormat(fmt);
  };
  const [savedDeliveryData, setSavedDeliveryData] = useState<(DeliveryPrintData & { id?: string }) | null>(null);

  // Resolved Entities
  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);
  const selectedProduct = useMemo(() => products.find(p => p.id === productId), [products, productId]);
  const selectedTruck = useMemo(() => trucks.find(t => t.id === truckId), [trucks, truckId]);

  // Client Habitual / Favorite Trucks (auto-assigned and historically frequent)
  const clientFavoriteTrucks = useMemo(() => {
    if (!customerId) return [];
    const custFavIds = new Set<string>(selectedCustomer?.favoriteTruckIds || []);
    
    // Count deliveries per truck for this customer
    const deliveryCountMap = new Map<string, number>();
    if (deliveries) {
      deliveries.forEach(del => {
        if (del.customerId === customerId && del.truckId) {
          deliveryCountMap.set(del.truckId, (deliveryCountMap.get(del.truckId) || 0) + 1);
        }
      });
    }

    const activeTrucks = trucks.filter(t => t.active !== false);
    const matched = activeTrucks.filter(t => 
      custFavIds.has(t.id) || 
      (deliveryCountMap.get(t.id) || 0) > 0 ||
      t.isFavorite
    );

    return matched.sort((a, b) => {
      // 1. Trucks in customer's explicit favorite/assigned list
      const aInCust = custFavIds.has(a.id) ? 1 : 0;
      const bInCust = custFavIds.has(b.id) ? 1 : 0;
      if (aInCust !== bInCust) return bInCust - aInCust;

      // 2. Number of previous deliveries with this customer
      const aCount = deliveryCountMap.get(a.id) || 0;
      const bCount = deliveryCountMap.get(b.id) || 0;
      if (aCount !== bCount) return bCount - aCount;

      // 3. Global isFavorite
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      return a.matricule.localeCompare(b.matricule);
    });
  }, [customerId, selectedCustomer, deliveries, trucks]);

  // Count unique favorite trucks (marked as favorite OR used for this customer)
  const clientFavoriteTrucksCount = useMemo(() => {
    return clientFavoriteTrucks.length;
  }, [clientFavoriteTrucks]);

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

      // 0. Check custom negotiated price for this customer first!
      if (selectedCustomer?.customPrices && selectedCustomer.customPrices[productId] !== undefined && selectedCustomer.customPrices[productId] > 0) {
        resolvedPrice = selectedCustomer.customPrices[productId];
      }

      // 1. Check customer family convention match
      if (!resolvedPrice && selectedCustomer?.familyId) {
        const custConventions = conventions.filter(c => c.familyId === selectedCustomer.familyId);
        const matchingPrice = productPrices.find(pp => 
          pp.productId === productId && custConventions.some(c => c.id === pp.conventionId)
        );
        if (matchingPrice && matchingPrice.priceHT > 0) {
          resolvedPrice = matchingPrice.priceHT;
        }
      }

      // 2. Direct convention ID / Tarif Standard
      if (!resolvedPrice) {
        const directPrice = productPrices.find(pp => 
          pp.productId === productId && (pp.conventionId === 'C_CONV1' || pp.conventionId === selectedCustomer?.familyId)
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
  const handleSelectTruck = async (truck: Truck, drvName?: string, isFav = false) => {
    setTruckId(truck.id);
    setTare(truck.tare);
    setIsFavoriteTruckSelected(isFav || Boolean(truck.isFavorite) || (selectedCustomer?.favoriteTruckIds || []).includes(truck.id));
    setFormError(null);

    if (truck.driverName) {
      setDriverName(truck.driverName);
    } else if (drvName && drvName !== '-') {
      setDriverName(drvName);
    } else if (truck.driverId) {
      const d = drivers.find(drv => drv.id === truck.driverId);
      if (d) setDriverName(d.name);
    }

    // Auto-assign this truck as favorite/habitual for this customer
    if (customerId) {
      try {
        const cust = await db.customers.get(customerId);
        if (cust) {
          const currentFavs = cust.favoriteTruckIds || [];
          if (!currentFavs.includes(truck.id)) {
            await db.customers.update(customerId, {
              favoriteTruckIds: [...currentFavs, truck.id],
              lastTruckId: truck.id
            });
          } else {
            await db.customers.update(customerId, {
              lastTruckId: truck.id
            });
          }
        }
      } catch (e) {
        console.error('Failed to auto-assign favorite truck for customer:', e);
      }
    }
  };

  // Toggle favorite truck for current customer
  const handleToggleCustomerFavoriteTruck = async (targetTruckId: string) => {
    if (!customerId) return;
    try {
      const cust = await db.customers.get(customerId);
      if (cust) {
        const currentFavs = new Set(cust.favoriteTruckIds || []);
        if (currentFavs.has(targetTruckId)) {
          currentFavs.delete(targetTruckId);
        } else {
          currentFavs.add(targetTruckId);
        }
        await db.customers.update(customerId, {
          favoriteTruckIds: Array.from(currentFavs)
        });
      }
    } catch (e) {
      console.error('Failed to toggle customer favorite truck:', e);
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

      // Ensure truck is remembered in customer's favorite/habitual trucks
      if (selectedCustomer && truckId) {
        const currentFavs = selectedCustomer.favoriteTruckIds || [];
        if (!currentFavs.includes(truckId)) {
          await db.customers.update(customerId, {
            favoriteTruckIds: [...currentFavs, truckId],
            lastTruckId: truckId
          });
        } else {
          await db.customers.update(customerId, {
            lastTruckId: truckId
          });
        }
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
      
      {/* Top Header & Immediate Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/deliveries')} 
            className="cursor-pointer text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Bons de Livraison</span>
          </Button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm sm:text-base text-slate-900">
              {isEditing ? 'Modifier Bon de Livraison' : 'Nouveau Bon de Livraison'}
            </span>
            <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-200 font-mono">
              PONT BASCULE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/deliveries')}
            className="cursor-pointer text-xs"
          >
            Annuler
          </Button>

          <Button
            size="sm"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            Valider
          </Button>

          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Valider & Imprimer
          </Button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {formError && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{formError}</span>
          </div>
          <button 
            type="button"
            onClick={() => setFormError(null)}
            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Container Window */}
      <div className="bg-slate-50 rounded-xl border border-slate-300 shadow-md overflow-hidden space-y-3 p-3 sm:p-4">
        
        {/* Strip 1: N° Bon de Livraison, Date B.L., Heure, Type B.L. (HT vs TTC) */}
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
              B.L. N° :
            </span>
            <div className="bg-slate-900 text-white px-3 py-0.5 rounded text-sm font-mono font-extrabold tracking-wider border border-slate-800 shadow-2xs">
              {blNumber || '----'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-700">Date :</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-700">Heure :</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-700">Type :</span>
              <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
                <input
                  type="radio"
                  name="taxType"
                  value="HT"
                  checked={taxType === 'HT'}
                  onChange={() => setTaxType('HT')}
                  className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>HT</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer font-medium text-slate-700">
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

        {/* Strip 2: Two Main Columns (Left: Client & Product, Right: Truck & Weighing Scale) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          
          {/* LEFT COLUMN: Client + Produit + Règlement & Total (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            
            {/* 1. Client Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1">
                  Client <span className="text-red-500 font-bold">*</span>
                </label>
                {selectedCustomer && (
                  <div className="flex items-center gap-2">
                    {selectedCustomer.city && (
                      <span className="text-slate-500 font-semibold text-xs hidden sm:inline">{selectedCustomer.city}</span>
                    )}
                    <div className={`px-3 py-1 rounded-lg font-mono font-black text-xs sm:text-sm shadow-xs border flex items-center gap-1.5 transition-all ${
                      (selectedCustomer.balance || 0) < 0 
                        ? 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-400/40' 
                        : (selectedCustomer.balance || 0) > 0 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-1 ring-emerald-400/40' 
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <span className="text-[10px] font-sans uppercase font-bold text-slate-500">Solde :</span>
                      <span className="tracking-tight">{formatCurrency(selectedCustomer.balance || 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Code"
                  value={clientCodeInput}
                  onChange={(e) => handleClientCodeChange(e.target.value)}
                  className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 text-center focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  title="Code client"
                />

                <div 
                  onClick={() => setIsClientModalOpen(true)}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 hover:border-blue-400 rounded text-xs font-bold text-slate-900 flex items-center justify-between cursor-pointer transition-colors shadow-2xs min-w-0"
                >
                  <span className="truncate">
                    {selectedCustomer ? selectedCustomer.name : 'Choisir un client...'}
                  </span>
                  <Search className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-1" />
                </div>

                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(true)}
                  className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded shadow-2xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                >
                  <Search className="h-3 w-3" />
                  <span>Choix</span>
                </button>

                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setIsCustomerProfileOpen(true)}
                    className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded shadow-2xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="Fiche & Règlements du client"
                  >
                    <FileText className="h-3 w-3" />
                    <span>Fiche</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Produit (Agrégat) Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-1">
                  Produit / Agrégat <span className="text-red-500 font-bold">*</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(true)}
                  className="text-[11px] text-blue-700 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3 text-blue-600" />
                  <span>{selectedProduct ? 'Changer de produit' : 'Sélectionner un produit'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                      {selectedProduct ? selectedProduct.code : '-'}
                    </span>
                    <span className="font-bold text-xs text-slate-900 truncate">
                      {selectedProduct ? selectedProduct.name : 'Aucun produit sélectionné'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold block">P.U. HT</span>
                    <input
                      type="number"
                      step="0.01"
                      value={unitPrice}
                      onChange={(e) => {
                        setIsAutoPrice(false);
                        setUnitPrice(e.target.value === '' ? '' : Number(e.target.value));
                      }}
                      className="w-20 px-1.5 py-0.5 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Product Pricing Summary Bar */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-100">
                <div className="bg-lime-50 border border-lime-200 p-1.5 rounded-lg">
                  <span className="text-[10px] text-lime-900 font-bold block uppercase">Quantité (Net)</span>
                  <span className="font-mono font-extrabold text-xs text-lime-950">
                    {netWeight.toFixed(2).replace('.', ',')} T
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg">
                  <span className="text-[10px] text-slate-600 font-bold block uppercase">Montant HT</span>
                  <span className="font-mono font-bold text-xs text-slate-900">
                    {formatCurrency(totalHT)}
                  </span>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-1.5 rounded-lg">
                  <span className="text-[10px] text-blue-800 font-bold block uppercase">Montant TTC</span>
                  <span className="font-mono font-extrabold text-xs text-blue-950">
                    {formatCurrency(totalTTC)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Mode de Règlement & Net à Payer */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Règlement :</span>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Terme">Terme (Crédit)</option>
                  <option value="Avances">Avances</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Virement">Virement</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                  Net à Payer :
                </span>
                <span className="text-base font-mono font-black text-blue-900 bg-blue-50 px-3 py-0.5 rounded-lg border border-blue-300">
                  {formatCurrency(netToPay)}
                </span>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Camion + Chauffeur + Pont Bascule Weigher (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            
            {/* 1. Camion Selection Card */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <TruckIcon className="h-4 w-4 text-blue-700" />
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                    Camion <span className="text-red-500 font-bold">*</span>
                  </span>
                  {(isFavoriteTruckSelected || selectedTruck?.isFavorite || (selectedCustomer?.favoriteTruckIds || []).includes(truckId)) && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                      Habituel Client
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsTruckModalOpen(true)}
                    className="text-xs bg-slate-50 hover:bg-slate-100 text-blue-800 border border-slate-300 px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Search className="h-3 w-3 text-blue-600" />
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFavoriteTruckModalOpen(true)}
                    className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    Favoris {clientFavoriteTrucksCount > 0 ? `(${clientFavoriteTrucksCount})` : ''}
                  </button>
                </div>
              </div>

              {/* Truck Display Strip */}
              <div 
                onClick={() => setIsTruckModalOpen(true)}
                className={`w-full p-2.5 bg-slate-50 hover:bg-slate-100/80 border rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all ${
                  selectedTruck ? 'border-blue-300' : 'border-slate-300 border-dashed'
                }`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
                    <TruckIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    {selectedTruck ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-xs text-slate-950">
                          {selectedTruck.matricule}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-blue-900 bg-blue-100/70 px-1.5 py-0.2 rounded border border-blue-200">
                          Tare: {selectedTruck.tare.toFixed(2).replace('.', ',')} T
                        </span>
                        {selectedTruck.driverPhone && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {selectedTruck.driverPhone}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Cliquez pour sélectionner un camion...
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {selectedTruck && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCustomerFavoriteTruck(selectedTruck.id);
                        }}
                        className={`p-1 rounded cursor-pointer transition-transform hover:scale-110 ${
                          (selectedCustomer?.favoriteTruckIds || []).includes(selectedTruck.id) || selectedTruck.isFavorite
                            ? 'text-amber-500'
                            : 'text-slate-400 hover:text-amber-400'
                        }`}
                        title="Ajouter ou retirer ce camion des favoris de ce client"
                      >
                        <Star className={`h-4 w-4 ${
                          (selectedCustomer?.favoriteTruckIds || []).includes(selectedTruck.id) || selectedTruck.isFavorite
                            ? 'fill-amber-500 text-amber-500'
                            : ''
                        }`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTruckId('');
                          setTare('');
                          setIsFavoriteTruckSelected(false);
                        }}
                        className="text-[10px] text-red-600 hover:text-red-800 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-semibold cursor-pointer"
                      >
                        Effacer
                      </button>
                    </>
                  )}
                  <span className="text-[11px] text-blue-700 font-bold">Changer</span>
                </div>
              </div>

              {/* Chauffeur input */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Chauffeur :</span>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Nom du chauffeur (ex: MAHDI HICHEME...)"
                  className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium text-slate-900 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Quick Habitual Trucks Bar for Selected Customer */}
              {selectedCustomer && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span>Camions habituels de <strong>{selectedCustomer.name}</strong></span>
                      {clientFavoriteTrucks.length > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.2 rounded-full font-mono">
                          {clientFavoriteTrucks.length}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFavoriteTruckModalOpen(true)}
                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                    >
                      Voir liste complète
                    </button>
                  </div>

                  {clientFavoriteTrucks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      {clientFavoriteTrucks.slice(0, 8).map(trk => {
                        const isCurrentSelected = trk.id === truckId;
                        const isExplicitFav = (selectedCustomer.favoriteTruckIds || []).includes(trk.id) || trk.isFavorite;

                        return (
                          <button
                            key={trk.id}
                            type="button"
                            onClick={() => handleSelectTruck(trk)}
                            className={`text-left px-2 py-1 rounded-lg border text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                              isCurrentSelected
                                ? 'bg-blue-700 text-white border-blue-800 font-bold shadow-xs'
                                : 'bg-slate-50 hover:bg-amber-50/80 border-slate-200 text-slate-800 hover:border-amber-300'
                            }`}
                            title={`Sélectionner ${trk.matricule} (Tare: ${trk.tare.toFixed(2)} T)`}
                          >
                            <Star className={`h-3 w-3 shrink-0 ${
                              isCurrentSelected
                                ? 'fill-amber-300 text-amber-300'
                                : isExplicitFav
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-slate-400'
                            }`} />
                            <span className="font-mono font-bold tracking-tight">{trk.matricule}</span>
                            <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                              isCurrentSelected 
                                ? 'bg-blue-800 text-blue-100' 
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}>
                              {trk.tare.toFixed(2)}T
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic bg-slate-50 p-1.5 rounded border border-dashed border-slate-200">
                      💡 Tout camion sélectionné pour ce client sera automatiquement retenu dans ses favoris habituels.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 2. PONT BASCULE CORE (The 3 scale boxes) */}
            <div className="bg-white p-3 rounded-xl border-2 border-blue-400 shadow-sm space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-blue-600" />
                  Saisie Pesée Pont-Bascule
                </span>
                <span className="text-[10px] text-blue-600 font-bold">
                  PTC - Tare = Net Facturé
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {/* 1. Tare Fixe */}
                <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600 flex items-center gap-0.5">
                      <Lock className="h-2.5 w-2.5 text-slate-400" />
                      Tare (T)
                    </span>
                    <span className="text-[9px] text-slate-400">Fixe</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      readOnly
                      placeholder="0.00"
                      value={tare !== '' ? Number(tare).toFixed(2) : ''}
                      className="w-full px-2 py-1 text-sm font-mono font-black text-right bg-slate-100 border border-slate-300 rounded text-slate-800 cursor-not-allowed select-all"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      T
                    </span>
                  </div>
                </div>

                {/* 2. PTC / Brut (HIGHLIGHTED) */}
                <div className="space-y-1 bg-blue-50 p-2 rounded-lg border-2 border-blue-500 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-blue-900 flex items-center gap-0.5">
                      <Scale className="h-2.5 w-2.5 text-blue-600" />
                      PTC Brut *
                    </span>
                    <span className="text-[9px] text-blue-700 font-bold animate-pulse">Saisie</span>
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
                      className="w-full px-2 py-1 text-base font-mono font-black text-right bg-white border border-blue-400 rounded text-blue-950 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-inner"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-700">
                      T
                    </span>
                  </div>
                </div>

                {/* 3. Poids Net Facturé */}
                <div className="space-y-1 bg-emerald-50 p-2 rounded-lg border-2 border-emerald-400 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-900 flex items-center gap-0.5">
                      <Calculator className="h-2.5 w-2.5 text-emerald-600" />
                      Poids Net
                    </span>
                    <span className="text-[9px] text-emerald-700 font-bold">Facturé</span>
                  </div>
                  <div className="text-base font-mono font-black text-emerald-950 py-1 text-right px-2 bg-emerald-100/70 border border-emerald-300 rounded">
                    {netWeight.toFixed(2).replace('.', ',')} T
                  </div>
                </div>
              </div>

              {/* Quick helper calculation strip */}
              {selectedTruck && (
                <div className="text-[11px] font-mono text-center font-bold text-slate-700 bg-slate-50 py-1 rounded border border-slate-200">
                  <span className="text-blue-700">{typeof ptc === 'number' ? ptc.toFixed(2) : '0.00'} T</span> (PTC)
                  {' - '}
                  <span className="text-slate-700">{typeof tare === 'number' ? tare.toFixed(2) : '0.00'} T</span> (Tare)
                  {' = '}
                  <span className="text-emerald-700 font-black">{netWeight.toFixed(2)} T Net</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ACCORDION for Optional / Secondary Details */}
        <Accordion>
          {/* Accordion Item 1: Chantier, Destination & Observations */}
          <AccordionItem
            id="destination"
            title="Chantier, Destination & Observations"
            subtitle="Informations optionnelles de transport et remarques du bon"
            icon={<Tag className="h-4 w-4 text-blue-600" />}
            defaultOpen={Boolean(destination || remarks)}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Chantier / Destination (Optionnel)
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex: Chantier Autoroute Est-Ouest, Lot 4..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Observations / Remarques (Optionnel)
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Ex: N° Bon de Commande, Chauffeur suppléant..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </AccordionItem>

          {/* Accordion Item 2: Remise & Détails Financiers */}
          <AccordionItem
            id="remise"
            title="Remise Commerciale & Détails Financiers"
            subtitle="Déduction financière exceptionnelle ou remise globale"
            icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
            defaultOpen={Boolean(discount && Number(discount) > 0)}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Remise sur le bon :
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-28 px-2.5 py-1 text-xs font-mono font-bold text-right bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">DA</span>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                TVA applicable : <strong>{tvaRate}%</strong> | Total TVA : <strong>{formatCurrency(totalTVA)}</strong>
              </div>
            </div>
          </AccordionItem>

          {/* Accordion Item 3: Commande Client Rattachée (if any) */}
          {(currentLinkedOrder || customerOrders.length > 0) && (
            <AccordionItem
              id="commande"
              title={`Commande Client Rattachée ${currentLinkedOrder ? `(${currentLinkedOrder.number})` : `(${customerOrders.length} disponible(s))`}`}
              subtitle="Liaison avec une commande client préalable"
              icon={<PackageCheck className="h-4 w-4 text-indigo-600" />}
              defaultOpen={Boolean(currentLinkedOrder)}
            >
              <div className="space-y-2.5 pt-1">
                {currentLinkedOrder ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-800">Commande :</span>
                      <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {currentLinkedOrder.number} ({formatDate(currentLinkedOrder.date)})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setLinkedOrderId('');
                        setLinkedOrderItemId('');
                        setIsAutoPrice(true);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Unlink className="h-3 w-3" />
                      Dissocier la commande
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-600">Commandes disponibles pour ce client :</span>
                    {customerOrders.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => applyOrderToDelivery(o)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                      >
                        Lier {o.number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </AccordionItem>
          )}
        </Accordion>

        {/* Bottom Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            * Poids Brut (PTC) &gt; Tare pour valider le ticket.
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/deliveries')}
              className="cursor-pointer text-xs"
            >
              Annuler
            </Button>

            <Button
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Valider
            </Button>

            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Valider & Imprimer
            </Button>
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
        customerName={selectedCustomer?.name}
        customerFavoriteTruckIds={selectedCustomer?.favoriteTruckIds || []}
        onToggleCustomerFavorite={handleToggleCustomerFavoriteTruck}
        companyName={companySettings?.name || 'SARL MAHAJIR SIDAR - CARRIERE D\'AGREGATS'}
      />

      {/* 3. Modal Camions Favoris (Choix 2) */}
      <FavoriteTrucksModal
        isOpen={isFavoriteTruckModalOpen}
        onClose={() => setIsFavoriteTruckModalOpen(false)}
        onSelect={(truck, drv) => handleSelectTruck(truck, drv, true)}
        customerName={selectedCustomer?.name || 'DEVERS'}
        customerId={customerId}
        customerFavoriteTruckIds={selectedCustomer?.favoriteTruckIds || []}
        onToggleCustomerFavorite={handleToggleCustomerFavoriteTruck}
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
        customPrices={selectedCustomer?.customPrices}
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

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold gap-1">
                  <button
                    type="button"
                    onClick={() => setPrintFormat('landscape2')}
                    title="A4 Paysage - 2 Copies sur 1 page (Économise 50% de papier)"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printFormat === 'landscape2' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Paysage (2 Copies Éco)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat('label')}
                    title="Format Étiquette / Sticker autocollant petite taille (58mm)"
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printFormat === 'label' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>Étiquette</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat('ticket')}
                    title="Ticket thermique 80mm de caisse"
                    className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printFormat === 'ticket' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    Ticket 80mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintFormat('A4')}
                    title="Format A4 Portrait standard (1 copie pleine page)"
                    className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      printFormat === 'A4' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    A4 1-Page
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
                className={`bg-white border border-slate-200 shadow-sm rounded-xl p-4 transition-all ${
                  printFormat === 'label' 
                    ? 'w-[280px]' 
                    : printFormat === 'ticket' 
                    ? 'w-[340px]' 
                    : printFormat === 'landscape2' 
                    ? 'w-full max-w-4xl' 
                    : 'w-full max-w-2xl'
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
