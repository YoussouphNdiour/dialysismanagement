'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSessionSchema, type CreateSessionInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NouvelleSeancePage() {
  const router = useRouter();

  const { data: postesData } = api.postes.list.useQuery();
  const { data: patientsData } = api.patients.list.useQuery({ page: 1, perPage: 100 });
  const { data: usersData } = api.users.list.useQuery();

  const createMutation = api.sessions.create.useMutation({
    onSuccess: (session) => {
      router.push(`/seances/${session.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSessionInput>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      dateSeance: new Date().toISOString().split('T')[0]!,
    },
  });

  const onSubmit = (data: CreateSessionInput) => {
    createMutation.mutate(data);
  };

  const medecins = usersData?.filter((u) => u.role === 'medecin') ?? [];
  const infirmieres = usersData?.filter((u) => u.role === 'infirmiere') ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Nouvelle seance
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Patient *</label>
          <select {...register('patientId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un patient</option>
            {patientsData?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
            ))}
          </select>
          {errors.patientId && <p className="text-sm text-red-500">{errors.patientId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Date *</label>
          <Input type="date" {...register('dateSeance')} />
          {errors.dateSeance && <p className="text-sm text-red-500">{errors.dateSeance.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Poste *</label>
          <select {...register('posteId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un poste</option>
            {postesData?.filter((p) => p.isActive).map((p) => (
              <option key={p.id} value={p.id}>{p.nom}{p.isVip ? ' (VIP)' : ''}</option>
            ))}
          </select>
          {errors.posteId && <p className="text-sm text-red-500">{errors.posteId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Medecin *</label>
          <select {...register('physicianId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un medecin</option>
            {medecins.map((u) => (
              <option key={u.id} value={u.id}>Dr {u.nom} {u.prenom}</option>
            ))}
          </select>
          {errors.physicianId && <p className="text-sm text-red-500">{errors.physicianId.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Infirmier(e) *</label>
          <select {...register('nurseId')} className="w-full rounded border px-2 py-1">
            <option value="">Selectionner un(e) infirmier(e)</option>
            {infirmieres.map((u) => (
              <option key={u.id} value={u.id}>{u.nom} {u.prenom}</option>
            ))}
          </select>
          {errors.nurseId && <p className="text-sm text-red-500">{errors.nurseId.message}</p>}
        </div>

        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creation...' : 'Creer la seance'}
        </Button>
        {createMutation.isError && (
          <p className="text-sm text-red-500">{createMutation.error.message}</p>
        )}
      </form>
    </div>
  );
}
