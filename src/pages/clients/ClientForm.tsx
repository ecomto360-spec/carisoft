import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Accordion, AccordionItem } from '../../components/ui/Accordion';
import { 
  ArrowLeft, Save, Trash2, AlertCircle, AlertTriangle, EyeOff, 
  Youtube, FileSpreadsheet, User, CreditCard, MapPin, 
  Briefcase, Plus, Settings, Sparkles, Building2, Phone, ShieldCheck,
  DollarSign, Tag
} from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { ALGERIAN_WILAYAS } from '../../data/wilayas';
import { CustomerActivityModal } from '../../components/clients/CustomerActivityModal';
import { 
  validateAlgerianMobile, 
  validateAlgerianPhone, 
  getAlgerianPhoneValidationError,
  getAlgerianMobileValidationError,
  hasAlgerianIndicatif,
  formatAlgerianFixeInput,
  formatAlgerianMobileInput,
  validateAlgerianNIF, 
  validateAlgerianNIS, 
  validateAlgerianArticle, 
  validateAlgerianRC, 
  validateAlgerianBank,
  sanitizePhoneNumber
} from '../../utils/algerianValidation';

const clientSchema = z.object({
  code: z.string().min(1, 'Le code est requis'),
  name: z.string().min(1, 'Le nom ou raison sociale est requis'),
  familyId: z.string().optional(),
  activityId: z.string().optional(),
  wilaya: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional().superRefine((val, ctx) => {
    if (!val || val.trim() === '') return;
    const err = getAlgerianPhoneValidationError(val);
    if (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err,
      });
    }
  }),
  mobile: z.string().optional().superRefine((val, ctx) => {
    if (!val || val.trim() === '') return;
    const err = getAlgerianMobileValidationError(val);
    if (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err,
      });
    }
  }),
  email: z.string().email('Format email invalide').optional().or(z.literal('')),
  rc: z.string().optional().refine(val => validateAlgerianRC(val), {
    message: 'N° RC invalide (format attendu ex: 16/00-0123456B08 ou 16 B 0123456)'
  }),
  nif: z.string().optional().refine(val => validateAlgerianNIF(val), {
    message: 'Le NIF doit comporter exactement 15 chiffres numériques (ex: 001610159000652)'
  }),
  nis: z.string().optional().refine(val => validateAlgerianNIS(val), {
    message: 'Le NIS doit comporter 13 ou 15 chiffres numériques (ex: 001610028417284)'
  }),
  article: z.string().optional().refine(val => validateAlgerianArticle(val), {
    message: 'L\'article d\'imposition doit comporter exactement 11 chiffres numériques (ex: 10150539206)'
  }),
  bank: z.string().optional().refine(val => validateAlgerianBank(val), {
    message: 'Banque/RIB invalide (RIB à 20 chiffres ou nom de banque avec numéro)'
  }),
  tvaExempt: z.boolean(),
  hidePricesOnDeliveryNote: z.boolean(),
  initialDebt: z.number().min(0, 'Le montant doit être positif ou nul'),
  creditLimit: z.number().min(0, 'Le montant doit être positif ou nul'),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export function ClientForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentClientName, setCurrentClientName] = useState('');
  const [currentClientCode, setCurrentClientCode] = useState('');
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState('');
  const [initialBalanceMode, setInitialBalanceMode] = useState<'debt' | 'credit'>('debt');
  const [initialBalanceAmount, setInitialBalanceAmount] = useState<number>(0);

  const products = useLiveQuery(() => 
    db.products.where('companyId').equals(currentCompanyId).filter(p => p.active !== false).toArray()
  ) || [];

  const productPrices = useLiveQuery(() => 
    db.productPrices.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray()
  ) || [];

  const families = useLiveQuery(() => 
    db.customerFamilies.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()
  ) || [];

  const activities = useLiveQuery(() => 
    db.customerActivities.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()
  ) || [];

  // Helper to get standard price for a product
  const getStandardPrice = (productId: string) => {
    const pp = productPrices.find(p => p.productId === productId && p.conventionId === 'C_CONV1') ||
      productPrices.find(p => p.productId === productId);
    return pp ? pp.priceHT : 650;
  };

  const handleCustomPriceChange = (productId: string, valStr: string) => {
    const val = parseFloat(valStr);
    setCustomPrices(prev => {
      const next = { ...prev };
      if (isNaN(val) || val <= 0) {
        delete next[productId];
      } else {
        next[productId] = val;
      }
      return next;
    });
  };

  const resetProductPrice = (productId: string) => {
    setCustomPrices(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Check dependencies for selected client
  const clientDeliveriesCount = useLiveQuery(
    () => id ? db.deliveryNotes.where('companyId').equals(currentCompanyId).filter(d => d.customerId === id).count() : 0,
    [id]
  ) || 0;

  const clientOrdersCount = useLiveQuery(
    () => id ? db.orders.where('companyId').equals(currentCompanyId).filter(o => o.customerId === id).count() : 0,
    [id]
  ) || 0;

  const clientInvoicesCount = useLiveQuery(
    () => id ? db.invoices.where('companyId').equals(currentCompanyId).filter(i => i.customerId === id).count() : 0,
    [id]
  ) || 0;

  const clientPaymentsCount = useLiveQuery(
    () => id ? db.payments.where('companyId').equals(currentCompanyId).filter(p => p.customerId === id).count() : 0,
    [id]
  ) || 0;

  const totalLinkedDocs = clientDeliveriesCount + clientOrdersCount + clientInvoicesCount + clientPaymentsCount;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      code: '',
      name: '',
      familyId: '',
      activityId: '',
      wilaya: '',
      address: '',
      phone: '',
      mobile: '',
      email: '',
      rc: '',
      nif: '',
      nis: '',
      article: '',
      bank: '',
      tvaExempt: false,
      hidePricesOnDeliveryNote: false,
      initialDebt: 0,
      creditLimit: 0
    }
  });

  const watchPhone = watch('phone') || '';
  const watchMobile = watch('mobile') || '';

  useEffect(() => {
    if (isEditing && id) {
      db.customers.get(id).then(client => {
        if (client) {
          setCurrentClientName(client.name);
          setCurrentClientCode(client.code);
          if (client.customPrices) {
            setCustomPrices(client.customPrices);
          } else {
            setCustomPrices({});
          }

          // Initialize Solde Initial mode and amount
          if (client.initialBalance !== undefined) {
            if (client.initialBalance < 0) {
              setInitialBalanceMode('debt');
              setInitialBalanceAmount(Math.abs(client.initialBalance));
            } else if (client.initialBalance > 0) {
              setInitialBalanceMode('credit');
              setInitialBalanceAmount(client.initialBalance);
            } else {
              setInitialBalanceMode('debt');
              setInitialBalanceAmount(0);
            }
          } else if (client.initialDebt && client.initialDebt > 0) {
            setInitialBalanceMode('debt');
            setInitialBalanceAmount(client.initialDebt);
          } else if (client.balance !== undefined && client.balance !== 0) {
            if (client.balance < 0) {
              setInitialBalanceMode('debt');
              setInitialBalanceAmount(Math.abs(client.balance));
            } else {
              setInitialBalanceMode('credit');
              setInitialBalanceAmount(client.balance);
            }
          } else {
            setInitialBalanceMode('debt');
            setInitialBalanceAmount(0);
          }

          reset({
            code: client.code,
            name: client.name,
            familyId: client.familyId || 'CONV1',
            activityId: client.activityId || '',
            wilaya: client.wilaya || '',
            address: client.address || '',
            phone: client.phone || '',
            mobile: client.mobile || '',
            email: client.email || '',
            rc: client.rc || '',
            nif: client.nif || '',
            nis: client.nis || '',
            article: client.article || '',
            bank: client.bank || '',
            tvaExempt: client.tvaExempt,
            hidePricesOnDeliveryNote: client.hidePricesOnDeliveryNote || false,
            initialDebt: client.initialDebt || 0,
            creditLimit: client.creditLimit || 0,
          });
        }
      });
    } else {
      setCustomPrices({});
      setInitialBalanceMode('debt');
      setInitialBalanceAmount(0);
      // Auto-generate next client code
      db.customers.where('companyId').equals(currentCompanyId).filter(x => x.companyId === currentCompanyId).toArray().then(clients => {
        let maxCode = 0;
        for (const c of clients) {
          const num = parseInt(c.code, 10);
          if (!isNaN(num) && num > maxCode) {
            maxCode = num;
          }
        }
        const nextCode = (maxCode + 1).toString().padStart(2, '0');
        setValue('code', nextCode);
      });
    }
  }, [id, isEditing, reset, setValue, currentCompanyId]);

  const handleDeleteClient = async (hardDelete: boolean = true) => {
    if (!id) return;
    setIsDeleting(true);
    try {
      if (hardDelete) {
        await db.customers.delete(id);
      } else {
        await db.customers.update(id, { active: false });
      }
      setShowDeleteModal(false);
      navigate('/clients');
    } catch (err) {
      console.error('Failed to delete client:', err);
      alert('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: ClientFormValues) => {
    const selectedActivity = activities.find(a => a.id === data.activityId);
    const activityName = selectedActivity?.name || (data.activityId ? data.activityId : undefined);
    
    // Extract wilaya code if present
    const selectedWilayaObj = ALGERIAN_WILAYAS.find(w => w.name === data.wilaya || w.code === data.wilaya);
    const wilayaName = selectedWilayaObj?.name || data.wilaya || undefined;
    const wilayaCode = selectedWilayaObj?.code || undefined;

    // Calculate signed initial balance
    const finalInitialBalance = initialBalanceMode === 'credit' ? initialBalanceAmount : -initialBalanceAmount;
    const finalInitialDebt = initialBalanceMode === 'debt' ? initialBalanceAmount : 0;

    try {
      // Clean and sanitize phone and fiscal values
      const sanitizedPhone = data.phone ? sanitizePhoneNumber(data.phone) : undefined;
      const sanitizedMobile = data.mobile ? sanitizePhoneNumber(data.mobile) : undefined;
      const sanitizedRc = data.rc?.trim().toUpperCase() || undefined;
      const sanitizedNif = data.nif?.replace(/[\s\-\.]/g, '') || undefined;
      const sanitizedNis = data.nis?.replace(/[\s\-\.]/g, '') || undefined;
      const sanitizedArticle = data.article?.replace(/[\s\-\.\/]/g, '') || undefined;
      const sanitizedBank = data.bank?.trim() || undefined;

      const payload = {
        ...data,
        phone: sanitizedPhone,
        mobile: sanitizedMobile,
        rc: sanitizedRc,
        nif: sanitizedNif,
        nis: sanitizedNis,
        article: sanitizedArticle,
        bank: sanitizedBank,
        type: 'Tarif Standard',
        familyId: 'CONV1',
        customPrices,
        initialBalance: finalInitialBalance,
        initialDebt: finalInitialDebt,
        activityId: data.activityId || undefined,
        activityName: activityName || undefined,
        wilaya: wilayaName,
        wilayaCode: wilayaCode,
      };

      if (isEditing && id) {
        const existingClient = await db.customers.get(id);
        const oldInitialBalance = existingClient?.initialBalance !== undefined 
          ? existingClient.initialBalance 
          : (existingClient?.initialDebt ? -(existingClient.initialDebt) : (existingClient?.balance || 0));
        
        const balanceDiff = finalInitialBalance - oldInitialBalance;
        const updatedBalance = (existingClient?.balance || 0) + balanceDiff;

        await db.customers.update(id, {
          ...payload,
          balance: updatedBalance,
          companyId: currentCompanyId
        });
      } else {
        await db.customers.add({
          id: crypto.randomUUID(),
          ...payload,
          balance: finalInitialBalance,
          active: true,
          companyId: currentCompanyId
        });
      }
      navigate('/clients');
    } catch (error) {
      console.error('Failed to save client:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-6 animate-in fade-in duration-150">
      
      {/* Top Header with Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              {isEditing ? `Modifier le client : ${currentClientName || currentClientCode}` : 'Nouveau Client'}
            </h1>
            <p className="text-[11px] text-slate-500">
              Formulaire complet : informations générales, Wilaya, type d&apos;activité, facturation et convention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            id="btn-form-client-tutorial-youtube"
            href="https://youtu.be/Kzh6PKNWXig"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100/90 border border-red-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Tutoriel vidéo"
          >
            <Youtube className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <span>Tutoriel</span>
          </a>

          {isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 font-semibold cursor-pointer text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Supprimer
            </Button>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients')} className="cursor-pointer text-xs">
            Annuler
          </Button>

          <Button 
            type="button"
            size="sm"
            onClick={handleSubmit(onSubmit)} 
            isLoading={isSubmitting} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 shadow-xs flex items-center gap-1.5 cursor-pointer text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            Enregistrer
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        
        {/* Section 1: Informations Générales & Identification */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              1. Informations Générales & Activité
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              * Champs obligatoires
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5">
            
            {/* Code Client */}
            <div className="lg:col-span-3">
              <Input 
                label="Code Client (Auto) *" 
                error={errors.code?.message} 
                {...register('code')} 
                readOnly
                className="bg-slate-50 cursor-not-allowed text-slate-500 font-mono font-bold text-xs"
              />
            </div>

            {/* Nom ou Raison Sociale */}
            <div className="lg:col-span-9">
              <Input 
                label="Nom ou Raison sociale *" 
                error={errors.name?.message} 
                {...register('name')} 
                className="font-bold text-xs"
                placeholder="Ex: SARL BATIMENT SIDAR, ETPHB..."
              />
            </div>

            {/* Wilaya (69 Wilayas / Saisie libre ou vide) */}
            <div className="lg:col-span-6">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    Wilaya (69 Wilayas ou saisie libre)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Optionnel / Libre
                  </span>
                </div>
                
                <div className="relative flex items-center">
                  <input
                    type="text"
                    list="wilayas-datalist"
                    placeholder="Choisir ou saisir la wilaya (ex: 16 - Alger, 60 - Bou Saâda...)"
                    {...register('wilaya')}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs placeholder:font-normal pr-8"
                  />
                  <datalist id="wilayas-datalist">
                    {ALGERIAN_WILAYAS.map(w => (
                      <option key={w.code} value={w.name}>
                        {w.arName ? `${w.name} (${w.arName})` : w.name}
                      </option>
                    ))}
                  </datalist>

                  {watch('wilaya') && (
                    <button
                      type="button"
                      onClick={() => setValue('wilaya', '')}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title="Effacer la wilaya"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Type d'Activité (Nouvel ajout avec modal CRUD) */}
            <div className="lg:col-span-6">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                    Type d&apos;activité
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowActivityModal(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Ajouter, modifier ou supprimer des types d'activité"
                  >
                    <Settings className="h-3 w-3" />
                    Gérer les activités
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    {...register('activityId')}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Sélectionner le secteur d&apos;activité --</option>
                    {activities.map(act => (
                      <option key={act.id} value={act.id}>
                        {act.name} {act.code ? `[${act.code}]` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowActivityModal(true)}
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg cursor-pointer shrink-0 transition-colors"
                    title="Ajouter une nouvelle activité"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Coordonnées de contact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Téléphone Fixe</label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                  watchPhone && hasAlgerianIndicatif(watchPhone)
                    ? 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                    : 'text-slate-600 bg-slate-100 border border-slate-200'
                }`}>
                  {watchPhone && hasAlgerianIndicatif(watchPhone)
                    ? 'Indicatif (213) actif'
                    : `${(watchPhone.replace(/\D/g, '')).length}/9 chiffres max`}
                </span>
              </div>
              <Input 
                {...register('phone', {
                  onChange: (e) => {
                    const formatted = formatAlgerianFixeInput(e.target.value);
                    setValue('phone', formatted, { shouldValidate: true });
                  }
                })} 
                error={errors.phone?.message}
                placeholder="Ex: 026 12 34 56 ou (213) 26..." 
                className="text-xs font-mono font-semibold" 
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  Mobile / WhatsApp
                </label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                  watchMobile && hasAlgerianIndicatif(watchMobile)
                    ? 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                    : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                }`}>
                  {watchMobile && hasAlgerianIndicatif(watchMobile)
                    ? 'Indicatif (213) actif'
                    : `${(watchMobile.replace(/\D/g, '')).length}/10 chiffres max`}
                </span>
              </div>
              <Input 
                {...register('mobile', {
                  onChange: (e) => {
                    const formatted = formatAlgerianMobileInput(e.target.value);
                    setValue('mobile', formatted, { shouldValidate: true });
                  }
                })} 
                error={errors.mobile?.message}
                placeholder="Ex: 0550 12 34 56 ou (213) 55..." 
                className="text-xs font-mono font-semibold" 
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Email Professionnel</label>
                <span className="text-[10px] text-slate-400">Optionnel</span>
              </div>
              <Input 
                type="email" 
                error={errors.email?.message} 
                {...register('email')} 
                placeholder="contact@entreprise.com" 
                className="text-xs" 
              />
            </div>
          </div>

          <div>
            <Input label="Adresse / Chantier / Commune" {...register('address')} placeholder="Zone industrielle, Commune, Chantier principal..." className="text-xs" />
          </div>
        </div>

        {/* Section 2: Prix accordés / Modification des Tarifs par Produit */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Prix accordé / Modification des Tarifs par Produit
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Le <strong>Tarif Standard</strong> est appliqué par défaut. Vous pouvez spécifier ici un prix spécial négocié pour chaque agrégat (ex: 600 DA au lieu de 650 DA). Si le champ reste vide ou non modifié, le tarif standard est utilisé automatiquement.
              </p>
            </div>
            
            {Object.keys(customPrices).length > 0 ? (
              <span className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg shrink-0 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-emerald-600" />
                {Object.keys(customPrices).length} prix négocié(s)
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shrink-0">
                Tarif Standard général appliqué
              </span>
            )}
          </div>

          {/* Product pricing list */}
          {products.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-xs font-semibold">Aucun produit configuré dans le catalogue.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((prod) => {
                  const stdPrice = getStandardPrice(prod.id);
                  const hasCustom = customPrices[prod.id] !== undefined && customPrices[prod.id] > 0;
                  const currentCustomVal = customPrices[prod.id] !== undefined ? customPrices[prod.id] : '';

                  return (
                    <div 
                      key={prod.id} 
                      className={`p-3.5 rounded-xl border transition-all ${
                        hasCustom 
                          ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-300/60 shadow-2xs' 
                          : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[11px] bg-slate-200/80 text-slate-800 px-1.5 py-0.2 rounded shrink-0">
                              {prod.code}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate" title={prod.name}>
                              {prod.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            Unité: {prod.unit || 'Tonne'}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Standard</span>
                          <span className="text-xs font-mono font-bold text-slate-700">
                            {formatCurrency(stdPrice)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60">
                        <div className="flex items-center justify-between text-[11px]">
                          <label className="font-bold text-slate-700">Prix Accordé (HT) :</label>
                          {hasCustom && (
                            <button
                              type="button"
                              onClick={() => resetProductPrice(prod.id)}
                              className="text-[10px] font-semibold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                              title="Rétablir au tarif standard"
                            >
                              Rétablir standard
                            </button>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={`${stdPrice} (Standard)`}
                            value={currentCustomVal}
                            onChange={(e) => handleCustomPriceChange(prod.id, e.target.value)}
                            className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono font-black text-right focus:outline-none focus:ring-2 pr-9 transition-colors ${
                              hasCustom 
                                ? 'bg-white border-blue-400 text-blue-900 ring-1 ring-blue-400 focus:ring-blue-500' 
                                : 'bg-white border-slate-300 text-slate-800 focus:ring-blue-500'
                            }`}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                            DA
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-0.5">
                          {hasCustom ? (
                            <span className="font-bold text-blue-700 flex items-center gap-1">
                              ✓ Prix spécifique négocié
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Tarif standard appliqué
                            </span>
                          )}
                          {hasCustom && (
                            <span className={`font-mono font-bold ${customPrices[prod.id] < stdPrice ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {customPrices[prod.id] < stdPrice ? `-${formatCurrency(stdPrice - customPrices[prod.id])}` : `+${formatCurrency(customPrices[prod.id] - stdPrice)}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Accordéon pour les informations complémentaires (Fiscales, Bancaires, Dette, Plafond) */}
        <Accordion>
          
          {/* Accordion Item 1: Informations Fiscales & Bancaires */}
          <AccordionItem
            id="fiscale"
            title="Informations Fiscales & Facturation"
            subtitle="Registre de commerce, NIF (15 chiffres), NIS, Article (11 chiffres), Banque et TVA"
            icon={<FileSpreadsheet className="h-4 w-4 text-indigo-600" />}
            defaultOpen={false}
          >
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">N° Registre Commerce (RC)</label>
                    <span className="text-[10px] text-slate-400">Ex: 16/00-0123456B08</span>
                  </div>
                  <Input 
                    {...register('rc')} 
                    error={errors.rc?.message}
                    placeholder="16/00-0123456B08" 
                    className="text-xs font-mono font-semibold uppercase" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">NIF (Identifiant Fiscal)</label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded">15 chiffres</span>
                  </div>
                  <Input 
                    {...register('nif')} 
                    error={errors.nif?.message}
                    placeholder="Ex: 001610159000652" 
                    className="text-xs font-mono font-bold" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">NIS (Identifiant Statistique)</label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded">13 ou 15 chiffres</span>
                  </div>
                  <Input 
                    {...register('nis')} 
                    error={errors.nis?.message}
                    placeholder="Ex: 001610028417284" 
                    className="text-xs font-mono font-bold" 
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Article d&apos;Imposition (AI)</label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded">11 chiffres</span>
                  </div>
                  <Input 
                    {...register('article')} 
                    error={errors.article?.message}
                    placeholder="Ex: 10150539206" 
                    className="text-xs font-mono font-bold" 
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Banque & RIB</label>
                    <span className="text-[10px] text-slate-400">RIB 20 chiffres ou nom banque</span>
                  </div>
                  <Input 
                    {...register('bank')} 
                    error={errors.bank?.message}
                    placeholder="Ex: BNA - 00110058103000000000" 
                    className="text-xs font-mono" 
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-100 text-xs">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    id="tvaExempt" 
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    {...register('tvaExempt')}
                  />
                  <span className="font-semibold text-slate-800">Client exonéré / exempté de TVA</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    id="hidePricesOnDeliveryNote" 
                    className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    {...register('hidePricesOnDeliveryNote')}
                  />
                  <span className="font-semibold text-slate-800">Masquer le prix sur les bons de livraison</span>
                </label>
              </div>
            </div>
          </AccordionItem>

          {/* Accordion Item 2: Solde Initial & Plafond de Crédit */}
          <AccordionItem
            id="credit"
            title="Solde Initial & Plafond de Crédit"
            subtitle="Gestion du solde de départ (Dette antérieure ou Avance/Solde créditeur) et limite de crédit autorisée"
            icon={<CreditCard className="h-4 w-4 text-amber-600" />}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              
              {/* Solde Initial */}
              <div className={`border rounded-xl p-3.5 space-y-2.5 transition-all ${
                initialBalanceMode === 'debt' && initialBalanceAmount > 0
                  ? 'bg-red-50/60 border-red-300'
                  : initialBalanceMode === 'credit' && initialBalanceAmount > 0
                  ? 'bg-emerald-50/60 border-emerald-300'
                  : 'bg-amber-50/50 border-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 block">
                    Solde Initial Antérieur (DZD)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                    Avant logiciel
                  </span>
                </div>

                {/* Switch Dette (-) vs Avance (+) */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setInitialBalanceMode('debt')}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      initialBalanceMode === 'debt'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🔴 Dette Client (-)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInitialBalanceMode('credit')}
                    className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      initialBalanceMode === 'credit'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🟢 Avance / Avoir (+)</span>
                  </button>
                </div>

                {/* Amount Input */}
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={initialBalanceAmount === 0 ? '' : initialBalanceAmount}
                    onChange={(e) => setInitialBalanceAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-black text-right text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10 shadow-inner"
                  />
                  <span className="absolute right-3 font-extrabold text-slate-500 text-xs pointer-events-none">
                    DA
                  </span>
                </div>

                {/* Dynamic explanation badge */}
                <div className="text-[11px] pt-0.5">
                  {initialBalanceAmount === 0 ? (
                    <span className="text-slate-500 italic">
                      Solde de départ neutre : <strong>0,00 DA</strong>
                    </span>
                  ) : initialBalanceMode === 'debt' ? (
                    <div className="p-2 bg-red-100/70 text-red-900 rounded-lg border border-red-200 flex items-center justify-between font-medium">
                      <span>Dette antérieure due par le client :</span>
                      <strong className="font-mono text-xs font-black text-red-700">-{formatCurrency(initialBalanceAmount)}</strong>
                    </div>
                  ) : (
                    <div className="p-2 bg-emerald-100/70 text-emerald-900 rounded-lg border border-emerald-200 flex items-center justify-between font-medium">
                      <span>Avance / Solde créditeur en faveur du client :</span>
                      <strong className="font-mono text-xs font-black text-emerald-700">+{formatCurrency(initialBalanceAmount)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Plafond de Crédit */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-950 block">
                    Plafond de Crédit Autorisé (DZD)
                  </label>
                  <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-1.5 py-0.5 rounded">
                    Sécurité vente
                  </span>
                </div>
                <div className="relative flex items-center">
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...register('creditLimit', { valueAsNumber: true })}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10 shadow-inner"
                  />
                  <span className="absolute right-3 font-extrabold text-blue-700 text-xs pointer-events-none">
                    DA
                  </span>
                </div>
                <p className="text-[10px] text-blue-900/80 leading-tight">
                  Alerte si la dette dépasse ce plafond lors de la pesée. Laissez 0 pour désactiver.
                </p>
              </div>
            </div>
          </AccordionItem>
        </Accordion>

        {/* Bottom Bar: Action buttons */}
        <div className="flex items-center justify-between pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/clients')} className="cursor-pointer text-xs font-semibold">
            Annuler
          </Button>

          <Button 
            type="submit" 
            isLoading={isSubmitting} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer text-xs"
          >
            <Save className="h-4 w-4" />
            Enregistrer le Client
          </Button>
        </div>
      </form>

      {/* Customer Activity Management Modal */}
      <CustomerActivityModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        onSelectActivity={(actId) => setValue('activityId', actId)}
        companyId={currentCompanyId}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Supprimer le client</h3>
                <p className="text-xs text-slate-500 font-mono">Code: {currentClientCode || 'Client'}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Êtes-vous sûr de vouloir supprimer définitivement le client{' '}
                <strong className="text-slate-900 font-bold">{currentClientName || 'sélectionné'}</strong> ?
              </p>

              {totalLinkedDocs > 0 ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    Historique & Documents rattachés trouvés :
                  </div>
                  <ul className="text-xs text-amber-950 space-y-1 list-disc list-inside font-medium">
                    {clientDeliveriesCount > 0 && (
                      <li><strong>{clientDeliveriesCount}</strong> Bon(s) de Livraison (B.L)</li>
                    )}
                    {clientOrdersCount > 0 && (
                      <li><strong>{clientOrdersCount}</strong> Commande(s)</li>
                    )}
                    {clientInvoicesCount > 0 && (
                      <li><strong>{clientInvoicesCount}</strong> Facture(s)</li>
                    )}
                    {clientPaymentsCount > 0 && (
                      <li><strong>{clientPaymentsCount}</strong> Règlement(s) / Avance(s)</li>
                    )}
                  </ul>
                  <p className="text-[11px] text-amber-900/80 pt-1">
                    Pour conserver l&apos;intégrité comptable et les statistiques de la carrière, vous pouvez choisir de <strong>désactiver</strong> le client (il sera masqué des sélections tout en préservant son historique) ou de le <strong>supprimer définitivement</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                  Ce client n&apos;a aucun bon de livraison, commande ou facture rattaché. La suppression sera immédiate et définitive.
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="cursor-pointer font-medium"
              >
                Annuler
              </Button>

              {totalLinkedDocs > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => handleDeleteClient(false)}
                  className="text-amber-800 border-amber-300 hover:bg-amber-50 cursor-pointer font-bold flex items-center gap-1.5"
                >
                  <EyeOff className="h-4 w-4 text-amber-600" />
                  Désactiver seulement
                </Button>
              )}

              <Button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteClient(true)}
                className="bg-red-600 hover:bg-red-700 text-white cursor-pointer font-bold flex items-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
