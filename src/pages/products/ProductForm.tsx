import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Accordion, AccordionItem } from '../../components/ui/Accordion';
import { ArrowLeft, Save, Plus, Package, DollarSign } from 'lucide-react';
import { ProductFamilyModal } from '../../components/products/ProductFamilyModal';
import { ProductUnitModal } from '../../components/products/ProductUnitModal';
import { useAuthStore } from '../../store/authStore';

export function ProductForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const families = useLiveQuery(() => db.productFamilies.filter(x => (!x.companyId || x.companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];
  const units = useLiveQuery(() => db.productUnits.filter(x => (!x.companyId || x.companyId === currentCompanyId) && x.companyId === currentCompanyId).toArray()) || [];

  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      code: '',
      name: '',
      familyId: '',
      unit: 'Tonne',
      tva: 19,
      priceHT: 0
    }
  });

  const selectedFamilyId = watch('familyId');
  const selectedUnit = watch('unit');

  // Purge old conventions on mount and ensure only C_CONV1 Tarif Standard exists
  useEffect(() => {
    const purgeOldConventions = async () => {
      try {
        const allConvs = await db.conventions.toArray();
        const oldIds = allConvs.filter(c => c.id !== 'C_CONV1').map(c => c.id);
        if (oldIds.length > 0) {
          await db.conventions.bulkDelete(oldIds);
        }
        await db.conventions.put({
          id: 'C_CONV1',
          name: 'Tarif Standard',
          description: 'Tarif standard de vente',
          familyId: 'CONV1'
        });
      } catch (e) {
        console.error('Error purging old conventions', e);
      }
    };
    purgeOldConventions();
  }, []);

  useEffect(() => {
    if (isEditing && id) {
      Promise.all([
        db.products.get(id),
        db.productPrices.where('productId').equals(id).filter(x => x.companyId === currentCompanyId).toArray()
      ]).then(([product, productPrices]) => {
        if (product) {
          const standardPriceObj = productPrices.find(p => p.conventionId === 'C_CONV1') || productPrices[0];
          const standardPrice = standardPriceObj ? standardPriceObj.priceHT : 0;

          reset({
            code: product.code,
            name: product.name,
            familyId: product.familyId,
            unit: product.unit,
            tva: product.tva,
            priceHT: standardPrice
          });
        }
      });
    } else if (!isEditing) {
      reset({
        code: '', name: '', familyId: '', unit: 'Tonne', tva: 19,
        priceHT: 0
      });
    }
  }, [id, isEditing, reset, currentCompanyId]);

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
        active: true,
        companyId: currentCompanyId
      };

      if (isEditing) {
        await db.products.update(productId, productData);
        // Delete old prices
        await db.productPrices.where('productId').equals(productId).delete();
      } else {
        await db.products.add(productData);
      }

      // Save single Tarif Standard price
      const priceVal = Number(data.priceHT) || 0;
      await db.productPrices.put({
        id: crypto.randomUUID(),
        productId: productId,
        conventionId: 'C_CONV1',
        priceHT: priceVal,
        companyId: currentCompanyId
      });

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
    <div className="space-y-4 max-w-4xl mx-auto pb-6">
      {/* Top Header with Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/products')} className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              {isEditing ? 'Modifier Produit & Tarifs' : 'Nouveau Produit & Tarifs'}
            </h1>
            <p className="text-[11px] text-slate-500">
              Paramétrage de l&apos;agrégat, unité, famille et conventions tarifaires
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/products')} className="cursor-pointer text-xs">
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Section 1: Informations Générales Produit */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Informations du Produit
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              * Obligatoire
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Input label="Code Produit *" required {...register('code')} className="text-xs font-mono font-bold uppercase" placeholder="Ex: 0/4, GRAV..." />
            </div>

            <div className="lg:col-span-3">
              <Input label="Désignation de l'agrégat *" required {...register('name')} className="text-xs font-semibold" placeholder="Ex: SABLE CONCASSÉ 0/4, GRAVIER 15/25..." />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Famille with quick manager modal button */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">Famille *</label>
                <button
                  type="button"
                  onClick={() => setShowFamilyModal(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="h-2.5 w-2.5" />
                  <span>Gérer</span>
                </button>
              </div>
              <Select 
                options={[
                  { value: '', label: 'Choisir la famille...' },
                  ...families.map(f => ({ value: f.id, label: f.name }))
                ]}
                required
                {...register('familyId')}
                className="text-xs"
              />
            </div>

            {/* Unité with quick manager modal button */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">Unité de mesure</label>
                <button
                  type="button"
                  onClick={() => setShowUnitModal(true)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="h-2.5 w-2.5" />
                  <span>Gérer</span>
                </button>
              </div>
              <Select 
                options={unitOptions}
                {...register('unit')}
                className="text-xs font-mono"
              />
            </div>

            <div>
              <Input label="TVA applicable (%) *" type="number" step="1" required {...register('tva')} className="text-xs font-mono" />
            </div>
          </div>
        </div>

        {/* Section 2: Tarif Standard Unique */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Tarif Standard de Vente (Prix unitaire HT)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Définissez le prix unitaire standard HT de cet agrégat pour la vente et pesée
              </p>
            </div>
            <span className="px-2.5 py-1 text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg">
              Tarif Standard
            </span>
          </div>

          <div className="max-w-md pt-1">
            <div className="space-y-1.5 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Tarif Standard</span>
                <span className="text-xs text-slate-600 font-mono font-bold bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                  DZD / {selectedUnit || 'Tonne'}
                </span>
              </div>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="0.00"
                  {...register('priceHT')} 
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-base font-mono font-black text-right text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none pr-10 shadow-2xs"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  DA
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between items-center pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/products')} className="text-xs cursor-pointer">
            Annuler
          </Button>
          <Button type="submit" size="sm" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-xs cursor-pointer">
            <Save className="h-4 w-4 mr-1.5" />
            Enregistrer le Produit
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
