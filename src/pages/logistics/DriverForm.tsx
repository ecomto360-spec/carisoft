import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ArrowLeft, Save, User, Phone } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { 
  validateAlgerianMobile, 
  validateAlgerianPhone, 
  sanitizePhoneNumber,
  formatAlgerianMobileInput,
  hasAlgerianIndicatif
} from '../../utils/algerianValidation';

const driverSchema = z.object({
  name: z.string().min(1, 'Le nom et prénom du chauffeur est requis'),
  phone: z.string().optional().refine(val => validateAlgerianMobile(val) || validateAlgerianPhone(val), {
    message: 'Numéro invalide (10 chiffres max commençant par 05, 06, 07 ou indicatif (213))'
  }),
  active: z.boolean()
});

type DriverFormValues = z.infer<typeof driverSchema>;

export function DriverForm() {
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      phone: '',
      active: true
    }
  });

  const watchPhone = watch('phone') || '';

  useEffect(() => {
    if (isEditing && id) {
      db.drivers.get(id).then(driver => {
        if (driver) {
          reset({
            name: driver.name,
            phone: driver.phone || '',
            active: driver.active !== undefined ? driver.active : true
          });
        }
      });
    }
  }, [id, isEditing, reset]);

  const onSubmit = async (data: DriverFormValues) => {
    try {
      const sanitizedPhone = data.phone ? sanitizePhoneNumber(data.phone) : undefined;
      const payload = {
        name: data.name.trim(),
        phone: sanitizedPhone,
        active: data.active,
        companyId: currentCompanyId
      };

      if (isEditing && id) {
        await db.drivers.update(id, payload);
      } else {
        await db.drivers.add({
          id: `DRV_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...payload
        });
      }
      navigate('/logistics?tab=drivers');
    } catch (error) {
      console.error('Failed to save driver:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <Button variant="ghost" size="sm" onClick={() => navigate('/logistics?tab=drivers')} className="cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Modifier le Chauffeur' : 'Nouveau Chauffeur'}
          </h1>
          <p className="text-xs text-slate-500">
            Enregistrement d&apos;un conducteur pour les pesées de la carrière
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input 
                label="Nom et Prénom *" 
                error={errors.name?.message}
                {...register('name')} 
                placeholder="Ex: MAHDI Hichem"
                className="font-bold text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  N° Téléphone / Mobile
                </label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                  watchPhone && hasAlgerianIndicatif(watchPhone)
                    ? 'text-indigo-700 bg-indigo-50 border border-indigo-200'
                    : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                }`}>
                  {watchPhone && hasAlgerianIndicatif(watchPhone)
                    ? 'Indicatif (213)'
                    : `${(watchPhone.replace(/\D/g, '')).length}/10 chiffres max`}
                </span>
              </div>
              <Input 
                error={errors.phone?.message}
                {...register('phone', {
                  onChange: (e) => {
                    const formatted = formatAlgerianMobileInput(e.target.value);
                    setValue('phone', formatted, { shouldValidate: true });
                  }
                })} 
                placeholder="Ex: 0550 12 34 56 ou (213) 55..."
                className="font-mono font-semibold text-xs"
              />
            </div>
          </div>

          <div className="flex items-center pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox" 
                id="active" 
                className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                {...register('active')}
              />
              <span>Chauffeur actif (proposé au pont-bascule)</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/logistics?tab=drivers')} className="cursor-pointer text-xs">
            Annuler
          </Button>
          <Button type="submit" size="sm" isLoading={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer text-xs">
            <Save className="h-4 w-4 mr-1.5" />
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}

