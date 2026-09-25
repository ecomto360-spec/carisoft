import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { db } from '../../db/db';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ArrowLeft, Save } from 'lucide-react';

export function DriverForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      phone: '',
      active: true
    }
  });

  useEffect(() => {
    if (isEditing && id) {
      db.drivers.get(id).then(driver => {
        if (driver) {
          reset({
            name: driver.name,
            phone: driver.phone || '',
            active: driver.active
          });
        }
      });
    }
  }, [id, isEditing, reset]);

  const onSubmit = async (data: any) => {
    try {
      if (isEditing && id) {
        await db.drivers.update(id, data);
      } else {
        await db.drivers.add({
          id: crypto.randomUUID(),
          ...data
        });
      }
      // Assuming we pass state to tell list which tab to open, or handle it via URL query params.
      navigate('/logistics?tab=drivers');
    } catch (error) {
      console.error('Failed to save driver:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/logistics?tab=drivers')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEditing ? 'Modifier le Chauffeur' : 'Nouveau Chauffeur'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nom et Prénom *" required {...register('name')} />
            <Input label="Téléphone" {...register('phone')} />
          </div>
          <div className="flex items-center mt-4">
            <input 
              type="checkbox" 
              id="active" 
              className="h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              {...register('active')}
            />
            <label htmlFor="active" className="ml-2 text-sm text-slate-700">Chauffeur actif</label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/logistics?tab=drivers')}>Annuler</Button>
          <Button type="submit" isLoading={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
