import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ArrowLeft, Save, Plus, Settings2, FolderTree, Scale } from 'lucide-react';
import { ProductFamilyModal } from '../../components/products/ProductFamilyModal';
import { ProductUnitModal } from '../../components/products/ProductUnitModal';
import { useAuthStore } from '../../store/authStore';

export function ProductForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const conventions = useLiveQuery(() => db.conventions.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()) || [];
  const families = useLiveQuery(() => db.productFamilies.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];
  const units = useLiveQuery(() => db.productUnits.filter(x  => (!x .companyId || x .companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      code: '',
      name: '',
      familyId: '',
      unit: 'Tonne',
      tva: 19,
      prices: [] as { conventionId: string; priceHT: number }[]
    }
  });

  const selectedFamilyId = watch('familyId');
  const selectedUnit = watch('unit');

  useEffect(() => {
    if (isEditing && id && conventions.length > 0) {
      Promise.all([
        db.products.get(id),
        db.productPrices.where('productId').equals(id).filter(x => x.companyId === currentCompanyId).toArray()
      ]).then(([product, productPrices]) => {
        if (product) {
          // Map prices to conventions
          const prices = conventions.map(conv => {
            const pp = productPrices.find(p => p.conventionId === conv.id);
            return {
              conventionId: conv.id,
              priceHT: pp ? pp.priceHT : 0
            };
          });

          reset({
            code: product.code,
            name: product.name,
            familyId: product.familyId,
            unit: product.unit,
            tva: product.tva,
            prices
          });
        }
      });
    } else if (!isEditing && conventions.length > 0) {
      reset({
        code: '', name: '', familyId: '', unit: 'Tonne', tva: 19,
        prices: conventions.map(conv => ({ conventionId: conv.id, priceHT: 0 }))
      });
    }
  }, [id, isEditing, conventions, reset]);

  const onSubmit = async (data: any) => {
    try {
      const productId = id || crypto.randomUUID();
      
      // Save product
      const productData = {
        id: productId,
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        familyId: data.familyId,
        unit: data.unit,
        tva: Number(data.tva),
        stock: 0,
        minStock: 0,
        active: true
      };

      if (isEditing) {
        await db.products.update(productId, productData);
        // Delete old prices
        await db.productPrices.where('productId').equals(productId).delete();
      } else {
        await db.products.add(productData);
      }

      // Save new prices
      const pricesToSave = data.prices
        .filter((p: any) => Number(p.priceHT) > 0)
        .map((p: any) => ({
          id: crypto.randomUUID(),
          productId: productId,
          conventionId: p.conventionId,
          priceHT: Number(p.priceHT)
        }));
      
      if (pricesToSave.length > 0) {
        await db.productPrices.bulkAdd(pricesToSave);
      }

      navigate('/products');
    } catch (error) {
      console.error('Error saving product', error);
      alert('Erreur lors de la sauvegarde du produit');
    }
  };

  // Unit options from database with fallback
  const unitOptions = units.length > 0 
    ? units.map(u => ({ value: u.name, label: `${u.name} (${u.symbol || u.code})` }))
    : [
        { value: 'Tonne', label: 'Tonne (T)' },
        { value: 'Mètre cube', label: 'Mètre cube (m³)' },
        { value: 'Voyage', label: 'Voyage (Voy)' },
        { value: 'Pièce / Unité', label: 'Pièce / Unité (U)' }
      ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/products')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEditing ? 'Modifier Produit & Tarifs' : 'Nouveau Produit & Tarifs'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Informations Générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Code Produit *" required {...register('code')} />
            <Input label="Désignation *" required {...register('name')} />
            
            {/* Famille with quick manager modal button */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Famille *</label>
                <button
                  type="button"
                  onClick={() => setShowFamilyModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  title="Ajouter, modifier ou supprimer des familles"
                >
                  <Plus className="h-3 w-3" />
                  <span>Gérer les Familles</span>
                </button>
              </div>
              <Select 
                options={[
                  { value: '', label: 'Sélectionnez une option' },
                  ...families.map(f => ({ value: f.id, label: f.name }))
                ]}
                required
                {...register('familyId')}
              />
            </div>

            {/* Unité with quick manager modal button */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Unité</label>
                <button
                  type="button"
                  onClick={() => setShowUnitModal(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  title="Ajouter, modifier ou supprimer des unités"
                >
                  <Plus className="h-3 w-3" />
                  <span>Gérer les Unités</span>
                </button>
              </div>
              <Select 
                options={unitOptions}
                {...register('unit')}
              />
            </div>

            <Input label="TVA (%)" type="number" step="1" required {...register('tva')} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Grille Tarifaire (Prix unitaire HT)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conventions.map((conv, index) => (
              <div key={conv.id} className="space-y-1">
                <input type="hidden" {...register(`prices.${index}.conventionId`)} value={conv.id} />
                <Input 
                  label={`Prix ${conv.name}`} 
                  type="number" step="0.01" 
                  {...register(`prices.${index}.priceHT`)} 
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/products')}>Annuler</Button>
          <Button type="submit" isLoading={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      </form>

      {/* Interactive Family Manager Modal */}
      <ProductFamilyModal 
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
        onSelectFamily={(famId) => setValue('familyId', famId, { shouldValidate: true })}
      />

      {/* Interactive Unit Manager Modal */}
      <ProductUnitModal 
        isOpen={showUnitModal}
        onClose={() => setShowUnitModal(false)}
        onSelectUnit={(unitName) => setValue('unit', unitName, { shouldValidate: true })}
      />
    </div>
  );
}
