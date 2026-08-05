'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { createPatientSchema, type CreatePatientInput } from '@/lib/validators/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

type PatientFormProps = {
  defaultValues?: Partial<CreatePatientInput> & { id?: string };
  mode: 'create' | 'edit';
};

export function PatientForm({ defaultValues, mode }: PatientFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: defaultValues || {},
  });

  const utils = api.useUtils();
  const createMutation = api.patients.create.useMutation({
    onSuccess: () => {
      utils.patients.list.invalidate();
      router.push('/patients');
    },
  });
  const updateMutation = api.patients.update.useMutation({
    onSuccess: () => {
      utils.patients.list.invalidate();
      utils.patients.getById.invalidate({ id: defaultValues?.id });
      router.push(`/patients/${defaultValues?.id}`);
    },
  });

  const onSubmit = (data: CreatePatientInput) => {
    if (mode === 'edit' && defaultValues?.id) {
      updateMutation.mutate({ ...data, id: defaultValues.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const error = createMutation.error || updateMutation.error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error.message}
        </div>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Identite
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Nom *"
            id="nom"
            {...register('nom')}
            error={errors.nom?.message}
          />
          <Input
            label="Prenom *"
            id="prenom"
            {...register('prenom')}
            error={errors.prenom?.message}
          />
          <Input
            label="Date de naissance"
            id="dateNaissance"
            type="date"
            {...register('dateNaissance')}
            error={errors.dateNaissance?.message}
          />
          <Select
            label="Sexe"
            id="sexe"
            {...register('sexe')}
            error={errors.sexe?.message}
            placeholder="Selectionner"
            options={[
              { value: 'M', label: 'Masculin' },
              { value: 'F', label: 'Feminin' },
            ]}
          />
          <Input
            label="Telephone"
            id="telephone"
            {...register('telephone')}
            error={errors.telephone?.message}
          />
          <Select
            label="Groupe sanguin"
            id="groupeSanguin"
            {...register('groupeSanguin')}
            placeholder="Selectionner"
            options={[
              { value: 'A+', label: 'A+' },
              { value: 'A-', label: 'A-' },
              { value: 'B+', label: 'B+' },
              { value: 'B-', label: 'B-' },
              { value: 'AB+', label: 'AB+' },
              { value: 'AB-', label: 'AB-' },
              { value: 'O+', label: 'O+' },
              { value: 'O-', label: 'O-' },
            ]}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Donnees cliniques
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Taille (cm)"
            id="tailleCm"
            type="number"
            step="0.1"
            {...register('tailleCm', { valueAsNumber: true })}
            error={errors.tailleCm?.message}
          />
          <Input
            label="Poids sec (kg)"
            id="poidsSecKg"
            type="number"
            step="0.1"
            {...register('poidsSecKg', { valueAsNumber: true })}
            error={errors.poidsSecKg?.message}
          />
          <Input
            label="Date 1ere dialyse"
            id="datePremiereDialyse"
            type="date"
            {...register('datePremiereDialyse')}
          />
          <Select
            label="Statut"
            id="statut"
            {...register('statut')}
            placeholder="Selectionner"
            options={[
              { value: 'actif', label: 'Actif' },
              { value: 'inactif', label: 'Inactif' },
              { value: 'transfere', label: 'Transfere' },
              { value: 'decede', label: 'Decede' },
            ]}
          />
        </div>
        <div className="mt-4">
          <label htmlFor="nephropathie" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Nephropathie
          </label>
          <textarea
            id="nephropathie"
            rows={3}
            {...register('nephropathie')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Enregistrement...'
            : mode === 'create'
              ? 'Creer le patient'
              : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
