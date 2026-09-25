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
import { ArrowLeft, Save, Trash2, AlertCircle, AlertTriangle, EyeOff, Youtube } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const clientSchema = z.object({
  code: z.string().min(1, 'Le code est requis'),
  name: z.string().min(1, 'Le nom est requis'),
  familyId: z.string().min(1, 'Le type (convention) est requis'),
  address: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  rc: z.string().optional(),
  nif: z.string().optional(),
  nis: z.string().optional(),
  article: z.string().optional(),
  bank: z.string().optional(),
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

  const families = useLiveQuery(() => db.customerFamilies.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()) || [];

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

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      code: '',
      name: '',
      familyId: '',
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

  useEffect(() => {
    if (isEditing && id) {
      db.customers.get(id).then(client => {
        if (client) {
          setCurrentClientName(client.name);
          setCurrentClientCode(client.code);
          reset({
            code: client.code,
            name: client.name,
            familyId: client.familyId,
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
  }, [id, isEditing, reset, setValue]);

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
    const type = families.find(f => f.id === data.familyId)?.name || 'DIVERS';
    
    try {
      if (isEditing && id) {
        const existingClient = await db.customers.get(id);
        const oldInitialDebt = existingClient?.initialDebt || 0;
        const initialDebtDiff = (data.initialDebt || 0) - oldInitialDebt;
        const updatedBalance = (existingClient?.balance || 0) - initialDebtDiff;

        await db.customers.update(id, {
          ...data,
          type,
          balance: updatedBalance
        });
      } else {
        const initDebt = data.initialDebt || 0;
        await db.customers.add({
          id: crypto.randomUUID(),
          ...data,
          type,
          balance: -initDebt, // Negative balance indicates customer debt
          active: true
        });
      }
      navigate('/clients');
    } catch (error) {
      console.error('Failed to save client:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEditing ? 'Modifier le client' : 'Nouveau client'}
          </h1>
        </div>

        <a
          id="btn-form-client-tutorial-youtube"
          href="https://youtu.be/Kzh6PKNWXig"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100/90 border border-red-200 rounded-lg transition-colors cursor-pointer shadow-xs"
          title="Tutoriel vidéo : Comment ajouter un client"
        >
          <Youtube className="h-4 w-4 text-red-600 shrink-0" />
          <span>Tutoriel vidéo : Comment ajouter un client</span>
        </a>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Informations Générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label="Code Client (Auto) *" 
              error={errors.code?.message} 
              {...register('code')} 
              readOnly
              className="bg-slate-50 cursor-not-allowed text-slate-500 font-medium"
            />
            <Input label="Nom ou Raison sociale *" error={errors.name?.message} {...register('name')} />
            <Select 
              label="Type / Convention *" 
              error={errors.familyId?.message} 
              {...register('familyId')}
              options={families.map(f => ({ value: f.id, label: f.name }))}
            />
            <Input label="Adresse" {...register('address')} />
            <Input label="Téléphone Fixe" {...register('phone')} />
            <Input label="Mobile" {...register('mobile')} />
            <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Informations Fiscales & Bancaires</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="N° Registre Commerce" {...register('rc')} />
            <Input label="NIF (Mat. Fiscal)" {...register('nif')} />
            <Input label="NIS" {...register('nis')} />
            <Input label="Article Imposition" {...register('article')} />
            <Input label="Banque / RIB" {...register('bank')} />
            <div className="flex flex-col gap-3 mt-6">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="tvaExempt" 
                  className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  {...register('tvaExempt')}
                />
                <label htmlFor="tvaExempt" className="ml-2 text-sm text-slate-700 cursor-pointer select-none">Client exempt de la TVA</label>
              </div>
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="hidePricesOnDeliveryNote" 
                  className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  {...register('hidePricesOnDeliveryNote')}
                />
                <label htmlFor="hidePricesOnDeliveryNote" className="ml-2 text-sm text-slate-700 cursor-pointer select-none">Ne pas afficher le prix dans le bon de livraison</label>
              </div>
            </div>
          </div>
        </div>

        {/* Section Dette Initiale & Plafond de crédit */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          {/* Dette Initiale (Yellow/Amber Card) */}
          <div className="bg-amber-50/40 border-2 border-amber-300 rounded-xl p-5 space-y-2.5 shadow-2xs">
            <label className="text-sm font-bold text-amber-950 block">
              Dette Initiale (dettes antérieures avant l&apos;utilisation du logiciel)
            </label>
            <div className="relative flex items-center">
              <input 
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                {...register('initialDebt', { valueAsNumber: true })}
                className="w-full px-4 py-3 bg-white border-2 border-amber-300 rounded-xl text-base sm:text-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none pr-12 shadow-inner"
              />
              <span className="absolute right-4 font-extrabold text-amber-700 text-sm pointer-events-none">
                DA
              </span>
            </div>
            <p className="text-xs text-amber-900/80 font-medium leading-relaxed">
              Ce montant sera ajouté à la dette totale du client. Laissez 0 s&apos;il n&apos;y a pas de dette antérieure.
            </p>
          </div>

          {/* Plafond de crédit (Blue Card) */}
          <div className="bg-blue-50/40 border-2 border-blue-200 rounded-xl p-5 space-y-2.5 shadow-2xs">
            <label className="text-sm font-bold text-blue-950 block">
              Plafond de crédit (dette maximale autorisée)
            </label>
            <div className="relative flex items-center">
              <input 
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                {...register('creditLimit', { valueAsNumber: true })}
                className="w-full px-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-base sm:text-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none pr-12 shadow-inner"
              />
              <span className="absolute right-4 font-extrabold text-blue-700 text-sm pointer-events-none">
                DA
              </span>
            </div>
            <p className="text-xs text-blue-900/80 font-medium leading-relaxed">
              Si la dette totale dépasse ce plafond lors d&apos;une vente, une confirmation est demandée. Laissez 0 pour désactiver.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
                Supprimer ce client
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => navigate('/clients')} className="cursor-pointer">
              Annuler
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-3 rounded-xl shadow-md flex items-center gap-2 cursor-pointer">
              <Save className="h-4 w-4" />
              Enregistrer les Données
            </Button>
          </div>
        </div>
      </form>

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
