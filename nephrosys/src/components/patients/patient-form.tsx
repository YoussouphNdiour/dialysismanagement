'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { api } from '@/lib/trpc/client';
import { createPatientSchema } from '@/lib/validators/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

// Schema du formulaire: les champs editables (sans id)
const patientFormSchema = createPatientSchema.extend({
  userId: z.string().uuid().nullable().optional(),
});
type PatientFormValues = z.infer<typeof patientFormSchema>;

type PatientFormProps = {
  defaultValues?: Partial<PatientFormValues>;
  mode: 'create' | 'edit';
  isAdmin?: boolean;
  patientId?: string;
};

export function PatientForm({ defaultValues, mode, isAdmin, patientId }: PatientFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: defaultValues ?? {},
  });

  const { data: usersPatient } = api.users.listPatientsDisponibles.useQuery(
    { currentPatientId: patientId },
    { enabled: isAdmin === true && mode === 'edit' },
  );

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
      utils.patients.getById.invalidate({ id: patientId });
      router.push(`/patients/${patientId}`);
    },
  });

  const onSubmit = (data: PatientFormValues) => {
    if (mode === 'edit' && patientId) {
      updateMutation.mutate({
        ...data,
        id: patientId,
        userId: data.userId ?? null,
      });
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

      {isAdmin === true && mode === 'edit' && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Acces portail patient
          </h2>
          <div>
            <label
              htmlFor="userId"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Compte portail patient (optionnel)
            </label>
            <select
              id="userId"
              {...register('userId')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="">-- Aucun compte associe --</option>
              {usersPatient?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom} ({u.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Seuls les comptes avec role &quot;patient&quot; non encore associes sont listes.
            </p>
          </div>
        </Card>
      )}

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
