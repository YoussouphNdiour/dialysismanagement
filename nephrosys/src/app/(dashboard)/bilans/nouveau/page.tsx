'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createBilanSchema, type CreateBilanInput } from '@/lib/validators/bilans';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NouveauBilanPage() {
  const router = useRouter();
  const { data: patientsData } = api.patients.list.useQuery({ page: 1, perPage: 100 });
  const { data: usersData } = api.users.list.useQuery();

  const createMutation = api.bilans.create.useMutation({
    onSuccess: (bilan) => {
      if (bilan) {
        router.push(`/bilans/${bilan.id}`);
      }
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBilanInput>({
    resolver: zodResolver(createBilanSchema),
    defaultValues: {
      dateBilan: new Date().toISOString().slice(0, 16),
      typeBilan: 'mensuel',
    },
  });

  const onSubmit = (data: CreateBilanInput) => {
    // Ensure ISO format for datetime
    const dateBilan = data.dateBilan.includes('T') && !data.dateBilan.includes('Z')
      ? `${data.dateBilan}:00.000Z`
      : data.dateBilan;
    createMutation.mutate({ ...data, dateBilan });
  };

  const medecins = usersData?.filter((u) => u.role === 'medecin') ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Nouveau bilan biologique
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Patient *
          </label>
          <select
            {...register('patientId')}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Selectionner un patient</option>
            {patientsData?.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom} {p.prenom}
              </option>
            ))}
          </select>
          {errors.patientId && (
            <p className="text-sm text-red-500">{errors.patientId.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Medecin *
          </label>
          <select
            {...register('physicianId')}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Selectionner un medecin</option>
            {medecins.map((u) => (
              <option key={u.id} value={u.id}>
                Dr {u.nom} {u.prenom}
              </option>
            ))}
          </select>
          {errors.physicianId && (
            <p className="text-sm text-red-500">{errors.physicianId.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date *
          </label>
          <Input type="datetime-local" {...register('dateBilan')} />
          {errors.dateBilan && (
            <p className="text-sm text-red-500">{errors.dateBilan.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Type de bilan *
          </label>
          <select
            {...register('typeBilan')}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="mensuel">Mensuel</option>
            <option value="trimestriel">Trimestriel</option>
            <option value="semestriel">Semestriel</option>
            <option value="annuel">Annuel</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Notes
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            placeholder="Notes optionnelles..."
          />
        </div>

        {createMutation.isError && (
          <p className="text-sm text-red-500">
            Erreur: {createMutation.error.message}
          </p>
        )}

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creation...' : 'Creer le bilan'}
        </Button>
      </form>
    </div>
  );
}
