'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updatePreDialyseSchema, type UpdatePreDialyseInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  sessionId: string;
  defaultValues: Partial<UpdatePreDialyseInput>;
  isLocked: boolean;
};

export function PreDialyseTab({ sessionId, defaultValues, isLocked }: Props) {
  const utils = api.useUtils();
  const mutation = api.sessions.updatePreDialyse.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePreDialyseInput>({
    resolver: zodResolver(updatePreDialyseSchema),
    defaultValues: { id: sessionId, ...defaultValues },
  });

  const onSubmit = (data: UpdatePreDialyseInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('id')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Statut arrivee</label>
          <select {...register('arrivalStatus')} disabled={isLocked} className="w-full rounded border px-2 py-1">
            <option value="">—</option>
            <option value="stable">Stable</option>
            <option value="malade">Malade</option>
            <option value="urgence">Urgence</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Poids arrivee (kg)</label>
          <Input type="number" step="0.01" {...register('arrivalWeight', { valueAsNumber: true })} disabled={isLocked} />
          {errors.arrivalWeight && <p className="text-sm text-red-500">{errors.arrivalWeight.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Poids sec (kg)</label>
          <Input type="number" step="0.01" {...register('dryWeight', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">TA pre-dialyse</label>
          <Input placeholder="140/90" {...register('taPreDialyse')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">TA debout</label>
          <Input placeholder="135/85" {...register('taDebout')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">TA couche</label>
          <Input placeholder="130/80" {...register('taCoucher')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Temperature (°C)</label>
          <Input type="number" step="0.1" {...register('temperaturePre', { valueAsNumber: true })} disabled={isLocked} />
        </div>
      </div>

      {!isLocked && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer pre-dialyse'}
        </Button>
      )}
      {mutation.isSuccess && <p className="text-sm text-green-600">Enregistre</p>}
    </form>
  );
}
