import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { 
  ArrowLeft, Save, Printer, Plus, Trash2, Lock, AlertCircle, 
  CheckCircle2, FileText, ShoppingCart, Ban, AlertTriangle, 
  HelpCircle, RefreshCw, X, Check, Building2, UserCheck
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import { getNextInvoiceNumber } from '../../lib/invoiceNumber';
import { executePrintInvoice, type InvoicePrintData, type InvoiceItemPrintData } from '../../lib/printReceipt';
import type { Invoice, InvoiceItem } from '../../types';
import { useAuthStore } from '../../store/authStore';

interface FormLineItem {
  id: string;
  productId: string;
  customDesignation: string;
  unit: string;
  quantity: number;
  priceHT: number;
  discountPercent: number;
  tvaRate: number;
}

export function InvoiceForm() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id && id !== 'new');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  // Données Dexie
  const customers = useLiveQuery(() => 
    db.customers.where('companyId').equals(currentCompanyId).filter(x => x.active).toArray(),
    [currentCompanyId]
  );
  const products = useLiveQuery(() => 
    db.products.where('companyId').equals(currentCompanyId).filter(x => x.active).toArray(),
    [currentCompanyId]
  );
  const productPrices = useLiveQuery(() => 
    db.productPrices.where('companyId').equals(currentCompanyId).toArray(),
    [currentCompanyId]
  );
  const orders = useLiveQuery(() => 
    db.orders.where('companyId').equals(currentCompanyId).toArray(),
    [currentCompanyId]
  );
  const companySettings = useLiveQuery(() => db.settings.toCollection().first());

  const getProductPrice = (prodId?: string) => {
    if (!prodId) return 0;
    const pp = productPrices?.find(p => p.productId === prodId);
    return pp?.priceHT || 0;
  };

  // Champs de la facture
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [paymentMode, setPaymentMode] = useState('Terme');
  const [invoiceStatus, setInvoiceStatus] = useState<'draft' | 'validated' | 'paid' | 'cancelled'>('validated');
  const [notes, setNotes] = useState('');
  const [customerRef, setCustomerRef] = useState('');

  // Lignes de facture sur mesure
  const [lines, setLines] = useState<FormLineItem[]>([
    {
      id: crypto.randomUUID(),
      productId: '',
      customDesignation: '',
      unit: 'Tonne',
      quantity: 1,
      priceHT: 0,
      discountPercent: 0,
      tvaRate: 19
    }
  ]);

  // Options fiscales
  const [applyTimbre, setApplyTimbre] = useState(true);
  const [timbreAmount, setTimbreAmount] = useState(1.0); // 1.00 DZD timbre standard

  // États d'annulation / Avoir
  const [existingInvoice, setExistingInvoice] = useState<Invoice | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Sauvegarde & feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Initialisation du numéro séquentiel strict AAAA/001
  useEffect(() => {
    if (!isEditMode) {
      // Génération automatique du numéro selon l'année choisie (ex: 2026/001, 2027/001...)
      let isMounted = true;
      getNextInvoiceNumber(currentCompanyId, invoiceDate).then(num => {
        if (isMounted) {
          setInvoiceNumber(num);
        }
      });
      return () => { isMounted = false; };
    }
  }, [isEditMode, currentCompanyId, invoiceDate]);

  // Chargement en mode modification
  useEffect(() => {
    if (isEditMode && id) {
      let isMounted = true;
      (async () => {
        const inv = await db.invoices.get(id);
        if (inv && isMounted) {
          setExistingInvoice(inv);
          setInvoiceNumber(inv.number);
          setInvoiceDate(inv.date ? inv.date.split('T')[0] : new Date().toISOString().split('T')[0]);
          setCustomerId(inv.customerId || '');
          setSelectedOrderId(inv.orderId || '');
          setPaymentMode(inv.paymentMode || 'Terme');
          setInvoiceStatus(inv.status || 'validated');
          setNotes(inv.notes || '');
          setCustomerRef(inv.customerRef || '');
          setApplyTimbre(Boolean(inv.timbre && inv.timbre > 0));
          if (inv.timbre) setTimbreAmount(inv.timbre);

          // Charger les lignes
          const items = await db.invoiceItems.where('invoiceId').equals(id).toArray();
          if (items.length > 0 && isMounted) {
            setLines(items.map(it => ({
              id: it.id,
              productId: it.productId || '',
              customDesignation: it.customDesignation || '',
              unit: it.unit || 'Tonne',
              quantity: it.quantity || 1,
              priceHT: it.priceHT || 0,
              discountPercent: it.discountPercent || 0,
              tvaRate: it.tvaRate !== undefined ? it.tvaRate : 19
            })));
          }
        }
      })();
      return () => { isMounted = false; };
    }
  }, [isEditMode, id]);

  // Client sélectionné
  const selectedCustomer = useMemo(() => 
    customers?.find(c => c.id === customerId),
    [customers, customerId]
  );

  // Commandes disponibles pour le client ou toutes
  const availableOrders = useMemo(() => {
    if (!orders) return [];
    if (!customerId) return orders;
    return orders.filter(o => o.customerId === customerId);
  }, [orders, customerId]);

  // Gestion de la sélection d'un Bon de Commande
  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId) return;

    const order = orders?.find(o => o.id === orderId);
    if (order) {
      // Préremplir le client si pas encore fait
      if (order.customerId && order.customerId !== customerId) {
        setCustomerId(order.customerId);
      }

      // Importer les articles du bon de commande
      const orderItems = await db.orderItems.where('orderId').equals(order.id).toArray();
      if (orderItems.length > 0) {
        const importedLines: FormLineItem[] = orderItems.map(oi => {
          const prod = products?.find(p => p.id === oi.productId);
          return {
            id: crypto.randomUUID(),
            productId: oi.productId,
            customDesignation: prod?.name || 'Matériaux / Agrégats',
            unit: prod?.unit || 'Tonne',
            quantity: oi.quantity,
            priceHT: oi.priceHT,
            discountPercent: 0,
            tvaRate: selectedCustomer?.tvaExempt ? 0 : 19
          };
        });
        setLines(importedLines);
        setCustomerRef(order.number);
      }
    }
  };

  // Manipulation des lignes de produits
  const handleAddLine = (presetProductId?: string) => {
    const prod = presetProductId ? products?.find(p => p.id === presetProductId) : undefined;
    const defaultTva = selectedCustomer?.tvaExempt ? 0 : 19;
    const initialPrice = presetProductId ? getProductPrice(presetProductId) : 0;

    setLines(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: prod?.id || '',
        customDesignation: prod?.name || '',
        unit: prod?.unit || 'Tonne',
        quantity: 1,
        priceHT: initialPrice,
        discountPercent: 0,
        tvaRate: defaultTva
      }
    ]);
  };

  const handleRemoveLine = (lineId: string) => {
    if (lines.length <= 1) {
      setFormError("La facture doit comporter au moins une ligne de produit.");
      return;
    }
    setFormError(null);
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const handleUpdateLine = (lineId: string, updates: Partial<FormLineItem>) => {
    setLines(prev => prev.map(line => {
      if (line.id !== lineId) return line;

      // Si le produit change, initialiser désignation, unité et prix unitaire
      if (updates.productId !== undefined && updates.productId !== line.productId) {
        const prod = products?.find(p => p.id === updates.productId);
        const resolvedPrice = updates.productId ? getProductPrice(updates.productId) : line.priceHT;
        return {
          ...line,
          ...updates,
          customDesignation: prod?.name || line.customDesignation,
          unit: prod?.unit || line.unit,
          priceHT: resolvedPrice,
          tvaRate: selectedCustomer?.tvaExempt ? 0 : 19
        };
      }

      return { ...line, ...updates };
    }));
  };

  // Calculs totaux financiers en temps réel
  const calculations = useMemo(() => {
    let totalBrutHT = 0;
    let totalRemises = 0;
    let totalNetHT = 0;
    let totalTVA = 0;

    lines.forEach(line => {
      const q = Number(line.quantity) || 0;
      const pu = Number(line.priceHT) || 0;
      const disc = Number(line.discountPercent) || 0;
      const tvaR = Number(line.tvaRate) || 0;

      const brut = q * pu;
      const remise = brut * (disc / 100);
      const net = brut - remise;
      const tva = net * (tvaR / 100);

      totalBrutHT += brut;
      totalRemises += remise;
      totalNetHT += net;
      totalTVA += tva;
    });

    const timbre = applyTimbre ? Number(timbreAmount) || 0 : 0;
    const totalTTC = totalNetHT + totalTVA + timbre;

    return {
      totalBrutHT,
      totalRemises,
      totalNetHT,
      totalTVA,
      timbre,
      totalTTC
    };
  }, [lines, applyTimbre, timbreAmount]);

  // Validation et enregistrement de la facture
  const handleSaveInvoice = async (targetStatus?: 'draft' | 'validated') => {
    setFormError(null);
    if (!customerId) {
      setFormError("Veuillez sélectionner un Client pour cette facture.");
      return;
    }

    if (lines.length === 0) {
      setFormError("Veuillez ajouter au moins une ligne de produit à la facture.");
      return;
    }

    // Vérifier les lignes
    for (const [idx, line] of lines.entries()) {
      if (!line.productId && !line.customDesignation.trim()) {
        setFormError(`La ligne N° ${idx + 1} n'a aucune désignation de produit.`);
        return;
      }
      if (line.quantity <= 0) {
        setFormError(`La quantité de la ligne N° ${idx + 1} doit être supérieure à zéro.`);
        return;
      }
      if (line.priceHT < 0) {
        setFormError(`Le prix unitaire de la ligne N° ${idx + 1} ne peut pas être négatif.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const invoiceId = isEditMode && id ? id : crypto.randomUUID();
      const statusToSave = targetStatus || invoiceStatus;

      // Pour une nouvelle facture, s'assurer du numéro annuel strict AAAA/001
      let finalNumber = invoiceNumber;
      if (!isEditMode) {
        finalNumber = await getNextInvoiceNumber(currentCompanyId, invoiceDate);
      }

      const invoicePayload: Invoice = {
        id: invoiceId,
        number: finalNumber,
        date: new Date(invoiceDate).toISOString(),
        customerId,
        orderId: selectedOrderId || undefined,
        totalHT: calculations.totalNetHT,
        totalTVA: calculations.totalTVA,
        timbre: calculations.timbre,
        totalTTC: calculations.totalTTC,
        status: statusToSave,
        paymentMode,
        companyId: currentCompanyId,
        notes: notes.trim() || undefined,
        customerRef: customerRef.trim() || undefined,
        updatedAt: new Date().toISOString(),
        createdAt: isEditMode && existingInvoice?.createdAt ? existingInvoice.createdAt : new Date().toISOString()
      };

      // Si la facture était annulée, préserver les motifs
      if (existingInvoice?.cancelReason) {
        invoicePayload.cancelReason = existingInvoice.cancelReason;
        invoicePayload.cancelledAt = existingInvoice.cancelledAt;
        invoicePayload.cancelledBy = existingInvoice.cancelledBy;
        invoicePayload.status = 'cancelled';
      }

      // Sauvegarder la facture dans Dexie
      if (isEditMode) {
        await db.invoices.put(invoicePayload);
        // Supprimer les anciennes lignes
        await db.invoiceItems.where('invoiceId').equals(invoiceId).delete();
      } else {
        await db.invoices.add(invoicePayload);
      }

      // Sauvegarder les lignes
      for (const line of lines) {
        const prod = products?.find(p => p.id === line.productId);
        const q = Number(line.quantity) || 0;
        const pu = Number(line.priceHT) || 0;
        const disc = Number(line.discountPercent) || 0;
        const brut = q * pu;
        const totalHT = brut - (brut * (disc / 100));

        await db.invoiceItems.add({
          id: crypto.randomUUID(),
          invoiceId,
          productId: line.productId || 'custom',
          customDesignation: line.customDesignation || prod?.name || 'Matériaux / Agrégats',
          unit: line.unit || prod?.unit || 'Tonne',
          quantity: q,
          priceHT: pu,
          discountPercent: disc,
          tvaRate: line.tvaRate,
          totalHT,
          companyId: currentCompanyId
        });
      }

      setSaveSuccessMsg(`Facture N° ${finalNumber} enregistrée avec succès !`);
      setTimeout(() => {
        navigate('/invoices');
      }, 700);

    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la facture:", error);
      setFormError("Une erreur est survenue lors de l'enregistrement de la facture.");
    } finally {
      setIsSaving(false);
    }
  };

  // Annulation obligatoire avec motif
  const handleConfirmCancelInvoice = async () => {
    if (!id || !isEditMode) return;
    if (!cancelReasonInput.trim() || cancelReasonInput.trim().length < 5) {
      setFormError("La justification de l'annulation est obligatoire (minimum 5 caractères).");
      return;
    }

    setIsCancelling(true);
    try {
      const nowIso = new Date().toISOString();
      const author = user?.name || user?.username || 'Commercial';

      await db.invoices.update(id, {
        status: 'cancelled',
        cancelReason: cancelReasonInput.trim(),
        cancelledAt: nowIso,
        cancelledBy: author,
        updatedAt: nowIso
      });

      // Mettre à jour l'état local
      setInvoiceStatus('cancelled');
      setExistingInvoice(prev => prev ? {
        ...prev,
        status: 'cancelled',
        cancelReason: cancelReasonInput.trim(),
        cancelledAt: nowIso,
        cancelledBy: author
      } : null);

      setShowCancelModal(false);
      setSaveSuccessMsg(`La facture ${invoiceNumber} a été annulée avec succès (Facture d'Avoir).`);
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
      setFormError("Impossible d'annuler la facture.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Préparation de l'impression
  const handlePrintCurrentInvoice = () => {
    const cust = selectedCustomer;
    const printItems: InvoiceItemPrintData[] = lines.map(item => {
      const prod = products?.find(p => p.id === item.productId);
      const q = Number(item.quantity) || 0;
      const pu = Number(item.priceHT) || 0;
      const disc = Number(item.discountPercent) || 0;
      const brut = q * pu;
      const net = brut - (brut * (disc / 100));

      return {
        designation: item.customDesignation || prod?.name || 'Matériaux / Agrégats',
        unit: item.unit || prod?.unit || 'Tonne',
        quantity: q,
        priceHT: pu,
        totalHT: net
      };
    });

    const payload: InvoicePrintData = {
      number: invoiceNumber,
      date: new Date(invoiceDate).toISOString(),
      customerName: cust?.name || 'Client',
      customerCode: cust?.code || '',
      customerAddress: cust?.address || '',
      customerRC: cust?.rc || '',
      customerNIF: cust?.nif || '',
      customerNIS: cust?.nis || '',
      customerArticle: cust?.article || '',
      customerPhone: cust?.phone || '',
      paymentMode,
      items: printItems,
      totalHT: calculations.totalNetHT,
      tvaRate: selectedCustomer?.tvaExempt ? 0 : 19,
      totalTVA: calculations.totalTVA,
      timbre: calculations.timbre,
      totalTTC: calculations.totalTTC,
      status: invoiceStatus,
      isCancelled: invoiceStatus === 'cancelled' || Boolean(existingInvoice?.cancelReason),
      cancelReason: existingInvoice?.cancelReason,
      cancelledAt: existingInvoice?.cancelledAt,
      cancelledBy: existingInvoice?.cancelledBy,
      orderNumber: customerRef || (selectedOrderId ? orders?.find(o => o.id === selectedOrderId)?.number : undefined),
      notes: notes.trim() || undefined,
      companyName: companySettings?.name || 'CARISOFT.next CARRIÈRE',
      companyActivity: companySettings?.activity || 'Extraction & Concassage d\'Agrégats',
      companyAddress: companySettings?.address || 'Zone Industrielle',
      companyPhone: companySettings?.phone || '025 00 00 00',
      companyEmail: companySettings?.email || '',
      companyNif: companySettings?.nif || '',
      companyNis: companySettings?.nis || '',
      companyRc: companySettings?.rc || '',
      companyArticle: companySettings?.article || '',
      companyBank: companySettings?.bank || '',
      companyCapital: companySettings?.capital || undefined,
      companyLogo: companySettings?.logoUrl || companySettings?.logo
    };

    executePrintInvoice(payload);
  };

  const isCancelled = invoiceStatus === 'cancelled' || Boolean(existingInvoice?.cancelReason);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* BANDEAU ROUGE SI FACTURE ANNULÉE */}
      {isCancelled && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-600 text-white rounded-xl">
              <Ban className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold text-red-900 text-lg uppercase tracking-tight">
                  Facture Annulée (Facture d'Avoir)
                </h3>
                {existingInvoice?.cancelledAt && (
                  <span className="text-xs bg-red-200 text-red-900 font-bold px-2.5 py-1 rounded-full">
                    Annulée le {formatDate(existingInvoice.cancelledAt)} {existingInvoice.cancelledBy ? `par ${existingInvoice.cancelledBy}` : ''}
                  </span>
                )}
              </div>
              <div className="mt-2 bg-white/80 border border-red-200 rounded-lg p-3">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Motif d'annulation justifié par le commercial :</span>
                <p className="text-sm font-semibold text-red-950 mt-0.5">
                  « {existingInvoice?.cancelReason || 'Annulation enregistrée.'} »
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER BAR : ACTIONS SANS DÉFILEMENT */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/invoices')}
            className="text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Factures
          </Button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-slate-900">
                {isEditMode ? `Modifier Facture N° ${invoiceNumber}` : 'Nouvelle Facture Sur Mesure'}
              </h1>
              {isCancelled ? (
                <span className="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-red-300">
                  Annulée
                </span>
              ) : (
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                  invoiceStatus === 'validated' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  invoiceStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {invoiceStatus === 'validated' ? 'Validée' : invoiceStatus === 'paid' ? 'Payée' : 'Brouillon'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Numérotation séquentielle automatique par an • Sélection et ajustement libre des produits
            </p>
          </div>
        </div>

        {/* Boutons d'action principaux en haut */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bouton d'annulation (si existante et non annulée) */}
          {isEditMode && !isCancelled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold cursor-pointer"
            >
              <Ban className="h-4 w-4 mr-1.5" />
              Annuler / Avoir
            </Button>
          )}

          {/* Bouton Imprimer */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintCurrentInvoice}
            className="cursor-pointer font-bold text-slate-700"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Imprimer
          </Button>

          {/* Bouton Enregistrer Brouillon */}
          {!isCancelled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSaveInvoice('draft')}
              isLoading={isSaving}
              className="cursor-pointer text-slate-700"
            >
              <Save className="h-4 w-4 mr-1.5 text-slate-500" />
              Brouillon
            </Button>
          )}

          {/* Bouton Valider Facture */}
          {!isCancelled && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleSaveInvoice('validated')}
              isLoading={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-sm cursor-pointer"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Valider la Facture
            </Button>
          )}
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {formError && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span>{formError}</span>
          </div>
          <button onClick={() => setFormError(null)} className="text-red-700 hover:text-red-900 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* STRIP 1 : PARAMÈTRES CLÉS & NUMÉROTATION STRICTEMENT AUTOMATIQUE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* N° FACTURE STRICTEMENT AUTOMATIQUE */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                N° de Facture Officiel
              </label>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                Verrouillé
              </span>
            </div>
            <input 
              type="text" 
              value={invoiceNumber}
              disabled
              readOnly
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-base font-black text-blue-700 cursor-not-allowed shadow-2xs"
            />
            <p className="text-[10.5px] text-slate-500 mt-1 font-medium">
              Attribué automatiquement par an (ex: 2026/001). Non modifiable.
            </p>
          </div>

          {/* DATE FACTURE */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
              Date d'émission
            </label>
            <Input 
              type="date" 
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              disabled={isCancelled}
              className="bg-white font-bold text-slate-800"
            />
            <p className="text-[10.5px] text-slate-500 mt-1">
              L'année de la date pilote le compteur séquentiel (ex: 2026).
            </p>
          </div>

          {/* MODE DE PAIEMENT */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
              Mode de Règlement
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              disabled={isCancelled}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="Terme">À Terme (30 jours)</option>
              <option value="Espèces">Espèces (Caisse)</option>
              <option value="Chèque">Chèque Bancaire</option>
              <option value="Virement">Virement Bancaire</option>
              <option value="Traite">Traite / Effet</option>
              <option value="Chèque CCP">Chèque CCP</option>
            </select>
            <p className="text-[10.5px] text-slate-500 mt-1">
              Mention officielle sur la facture.
            </p>
          </div>

          {/* STATUT */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
              Statut de la Facture
            </label>
            <select
              value={invoiceStatus}
              onChange={(e) => setInvoiceStatus(e.target.value as any)}
              disabled={isCancelled}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="validated">Validée (À régler)</option>
              <option value="draft">Brouillon</option>
              <option value="paid">Payée / Réglée</option>
              {isCancelled && <option value="cancelled">Annulée (Avoir)</option>}
            </select>
            <p className="text-[10.5px] text-slate-500 mt-1">
              État comptable de la créance.
            </p>
          </div>
        </div>
      </div>

      {/* STRIP 2 : SÉLECTION DU CLIENT & IMPORT BON DE COMMANDE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* CLIENT */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                1. Sélectionner le Client Facturé <span className="text-red-500">*</span>
              </label>
              {selectedCustomer && (
                <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  Code: {selectedCustomer.code}
                </span>
              )}
            </div>

            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={isCancelled}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choisir un client dans la liste --</option>
              {customers?.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.code ? `(${c.code})` : ''} {c.tvaExempt ? '• [Exonéré TVA]' : ''}
                </option>
              ))}
            </select>

            {/* Infos fiscales du client sélectionné */}
            {selectedCustomer && (
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div><strong>NIF :</strong> {selectedCustomer.nif || '-'}</div>
                <div><strong>RC :</strong> {selectedCustomer.rc || '-'}</div>
                <div><strong>NIS :</strong> {selectedCustomer.nis || '-'}</div>
                <div><strong>Art. Imposition :</strong> {selectedCustomer.article || '-'}</div>
                <div className="col-span-2"><strong>Adresse :</strong> {selectedCustomer.address || 'Non renseignée'}</div>
              </div>
            )}
          </div>

          {/* OU LIER À UN BON DE COMMANDE (B.C) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                2. Ou Importer depuis un Bon de Commande (B.C)
              </label>
              {selectedOrderId && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Produits Importés
                </span>
              )}
            </div>

            <select
              value={selectedOrderId}
              onChange={(e) => handleSelectOrder(e.target.value)}
              disabled={isCancelled}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Sélectionner un Bon de Commande client (Optionnel) --</option>
              {availableOrders.map(ord => {
                const c = customers?.find(cust => cust.id === ord.customerId);
                return (
                  <option key={ord.id} value={ord.id}>
                    N° {ord.number} • {c?.name || 'Client'} ({formatCurrency(ord.totalTTC)})
                  </option>
                );
              })}
            </select>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Réf. commande client :</span>
              <Input
                placeholder="Ex: BC-2026-CLIENT-08"
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                disabled={isCancelled}
                className="max-w-xs h-8 text-xs bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* STRIP 3 : TABLEAU SUR MESURE DES PRODUITS & PRESTATIONS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Lignes de Produits & Prestations Sur Mesure
            </h2>
            <p className="text-xs text-slate-500">
              Modifiez librement la désignation, les unités, quantités, prix négociés, remises et TVA.
            </p>
          </div>

          {!isCancelled && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleAddLine()}
                className="cursor-pointer font-bold text-blue-700 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Ajouter une Ligne Libre
              </Button>
            </div>
          )}
        </div>

        {/* Tableau interactif */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 text-xs font-extrabold uppercase tracking-wide border-b border-slate-200">
                <th className="py-2.5 px-3 min-w-[240px]">Désignation Produit / Prestation</th>
                <th className="py-2.5 px-2 w-28">Unité</th>
                <th className="py-2.5 px-2 w-28 text-right">Quantité</th>
                <th className="py-2.5 px-2 w-36 text-right">P.U HT (DZD)</th>
                <th className="py-2.5 px-2 w-24 text-right">Remise %</th>
                <th className="py-2.5 px-2 w-28 text-center">TVA %</th>
                <th className="py-2.5 px-3 w-36 text-right">Total HT (DZD)</th>
                {!isCancelled && <th className="py-2.5 px-2 w-12 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, index) => {
                const q = Number(line.quantity) || 0;
                const pu = Number(line.priceHT) || 0;
                const disc = Number(line.discountPercent) || 0;
                const brut = q * pu;
                const netHT = brut - (brut * (disc / 100));

                return (
                  <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* DÉSIGNATION */}
                    <td className="py-2 px-3">
                      <div className="space-y-1.5">
                        <select
                          value={line.productId}
                          onChange={(e) => handleUpdateLine(line.id, { productId: e.target.value })}
                          disabled={isCancelled}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="">-- Sélectionner Produit Carrière --</option>
                          {products?.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.code}) • {formatCurrency(getProductPrice(p.id))}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Ou saisie libre désignation / prestation sur mesure..."
                          value={line.customDesignation}
                          onChange={(e) => handleUpdateLine(line.id, { customDesignation: e.target.value })}
                          disabled={isCancelled}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:border-blue-500"
                        />
                      </div>
                    </td>

                    {/* UNITÉ */}
                    <td className="py-2 px-2">
                      <select
                        value={line.unit}
                        onChange={(e) => handleUpdateLine(line.id, { unit: e.target.value })}
                        disabled={isCancelled}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700"
                      >
                        <option value="Tonne">Tonne</option>
                        <option value="M³">M³</option>
                        <option value="Voyage">Voyage</option>
                        <option value="Unité">Unité</option>
                        <option value="Heure">Heure</option>
                        <option value="Forfait">Forfait</option>
                      </select>
                    </td>

                    {/* QUANTITÉ */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.quantity}
                        onChange={(e) => handleUpdateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
                        disabled={isCancelled}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-sm text-slate-900"
                      />
                    </td>

                    {/* PRIX UNITAIRE HT */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.priceHT}
                        onChange={(e) => handleUpdateLine(line.id, { priceHT: parseFloat(e.target.value) || 0 })}
                        disabled={isCancelled}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-right font-mono font-bold text-sm text-slate-900"
                      />
                    </td>

                    {/* REMISE % */}
                    <td className="py-2 px-2 text-right">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={line.discountPercent}
                        onChange={(e) => handleUpdateLine(line.id, { discountPercent: parseFloat(e.target.value) || 0 })}
                        disabled={isCancelled}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-right font-mono text-xs text-slate-800"
                      />
                    </td>

                    {/* TVA % */}
                    <td className="py-2 px-2 text-center">
                      <select
                        value={line.tvaRate}
                        onChange={(e) => handleUpdateLine(line.id, { tvaRate: parseFloat(e.target.value) || 0 })}
                        disabled={isCancelled}
                        className="w-full bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 text-center text-xs font-bold text-slate-800"
                      >
                        <option value="19">19 %</option>
                        <option value="9">9 %</option>
                        <option value="0">0 % (Exonéré)</option>
                      </select>
                    </td>

                    {/* TOTAL HT */}
                    <td className="py-2 px-3 text-right">
                      <div className="font-mono font-extrabold text-sm text-slate-900">
                        {formatCurrency(netHT)}
                      </div>
                      {disc > 0 && (
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          (-{disc}%)
                        </div>
                      )}
                    </td>

                    {/* ACTION SUPPRIMER */}
                    {!isCancelled && (
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* STRIP 4 : TOTAUX FINANCIERS & OBSERVATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Colonne Gauche : Notes & Mentions */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide block">
            Observations, Conditions particulières ou Références
          </label>
          <textarea
            rows={4}
            placeholder="Ex : Règlement par virement bancaire sur compte CPA N°..., Bon de commande client N° ..., Livraison assurée sur chantier d'El Eulma..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isCancelled}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={applyTimbre}
                onChange={(e) => setApplyTimbre(e.target.checked)}
                disabled={isCancelled}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              Appliquer Droit de Timbre Fiscal
            </label>
            {applyTimbre && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  step="0.5"
                  value={timbreAmount}
                  onChange={(e) => setTimbreAmount(parseFloat(e.target.value) || 0)}
                  disabled={isCancelled}
                  className="w-24 h-7 text-xs font-mono font-bold"
                />
                <span className="text-xs text-slate-500 font-semibold">DZD</span>
              </div>
            )}
          </div>
        </div>

        {/* Colonne Droite : Card Totaux */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
            Récapitulatif Financier
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Total Brut HT :</span>
              <span className="font-mono font-semibold">{formatCurrency(calculations.totalBrutHT)}</span>
            </div>

            {calculations.totalRemises > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Remises Déduites :</span>
                <span className="font-mono">-{formatCurrency(calculations.totalRemises)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-900 font-bold border-t border-slate-100 pt-2">
              <span>Total Net HT :</span>
              <span className="font-mono text-base">{formatCurrency(calculations.totalNetHT)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>Montant TVA :</span>
              <span className="font-mono font-semibold">{formatCurrency(calculations.totalTVA)}</span>
            </div>

            {calculations.timbre > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Droit de Timbre :</span>
                <span className="font-mono">{formatCurrency(calculations.timbre)}</span>
              </div>
            )}

            <div className="bg-slate-900 text-white rounded-xl p-3.5 mt-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Total TTC à Payer</span>
                <span className="text-xs text-blue-300 font-medium">Toutes taxes comprises</span>
              </div>
              <div className="text-xl font-black font-mono text-emerald-400">
                {formatCurrency(calculations.totalTTC)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODALE D'ANNULATION OBLIGATOIRE (AVOIR) */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-red-200 w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="font-extrabold text-base">Annulation Obligatoire de la Facture</h3>
              </div>
              <button 
                onClick={() => setShowCancelModal(false)}
                className="text-red-100 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 font-medium">
                <p className="font-bold text-red-950 mb-1">
                  ⚠️ Attention : Vous êtes sur le point d'annuler la facture N° {invoiceNumber}.
                </p>
                L'annulation d'une facture est un acte comptable officiel qui crée une mention d'avoir. Conformément aux règles de l'entreprise, <strong>le commercial est dans l'obligation de justifier le motif</strong> de cette annulation.
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide block mb-1.5">
                  Motif / Justification obligatoire de l'annulation <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex : Erreur sur le tonnage négocié avec le client, retour de marchandise défectueuse, ou réémission d'une facture corrigée..."
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>

              {/* Suggestions rapides */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Motifs fréquents :</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Erreur de facturation sur le prix unitaire",
                    "Erreur de client / Réédition requise",
                    "Retour marchandise ou refus de livraison",
                    "Avoir commercial négocié avec le client",
                    "Changement de condition de paiement"
                  ].map(motif => (
                    <button
                      key={motif}
                      type="button"
                      onClick={() => setCancelReasonInput(motif)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
                    >
                      {motif}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowCancelModal(false)}
                  disabled={isCancelling}
                >
                  Fermer
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleConfirmCancelInvoice}
                  disabled={!cancelReasonInput.trim() || cancelReasonInput.trim().length < 5 || isCancelling}
                  isLoading={isCancelling}
                  className="bg-red-600 hover:bg-red-500 text-white font-extrabold"
                >
                  <Ban className="h-4 w-4 mr-1.5" />
                  Confirmer l'Annulation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
