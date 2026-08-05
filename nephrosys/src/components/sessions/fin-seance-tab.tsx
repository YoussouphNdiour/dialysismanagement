'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateFinSeanceSchema, type UpdateFinSeanceInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Props = {
  sessionId: string;
  defaultValues: Partial<UpdateFinSeanceInput>;
  ktvCalculated?: string | null;
  ktvStatus?: string | null;
  urrCalculated?: string | null;
  isLocked: boolean;
};

export function FinSeanceTab({ sessionId, defaultValues, ktvCalculated, ktvStatus, urrCalculated, isLocked }: Props) {
  const utils = api.useUtils();
  const mutation = api.sessions.updateFinSeance.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const {
    register,
    handleSubmit,
  } = useForm<UpdateFinSeanceInput>({
    resolver: zodResolver(updateFinSeanceSchema),
    defaultValues: { id: sessionId, ...defaultValues },
  });

  const onSubmit = (data: UpdateFinSeanceInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...register('id')} />

      <div>
        <h3 className="mb-3 text-lg font-semibold">Fin de seance</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Poids depart (kg)</label>
            <Input type="number" step="0.01" {...register('departureWeight', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">UF reelle (L)</label>
            <Input type="number" step="0.01" {...register('ufReelle', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Duree reelle (min)</label>
            <Input type="number" {...register('dureeReelle', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tolerance globale</label>
            <select {...register('toleranceGlobale')} disabled={isLocked} className="w-full rounded border px-2 py-1">
              <option value="">—</option>
              <option value="bonne">Bonne</option>
              <option value="moyenne">Moyenne</option>
              <option value="mauvaise">Mauvaise</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Aspect du rein</label>
            <Input {...register('aspectRein')} disabled={isLocked} />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Notes fin de seance</label>
            <textarea {...register('notesFin')} disabled={isLocked} className="w-full rounded border px-2 py-1" rows={2} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Adequation dialyse</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Uree pre-dialyse</label>
            <Input type="number" step="0.01" {...register('ureePre', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Uree post-dialyse</label>
            <Input type="number" step="0.01" {...register('ureePost', { valueAsNumber: true })} disabled={isLocked} />
          </div>
          <div className="flex items-end gap-4">
            {ktvCalculated && (
              <div>
                <span className="text-sm text-gray-500">Kt/V: </span>
                <span className="font-semibold">{ktvCalculated}</span>
                {ktvStatus && (
                  <Badge className={`ml-1 ${ktvStatus === 'adequate' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {ktvStatus === 'adequate' ? 'Adequat' : 'Inadequat'}
                  </Badge>
                )}
              </div>
            )}
            {urrCalculated && (
              <div>
                <span className="text-sm text-gray-500">URR: </span>
                <span className="font-semibold">{urrCalculated}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Clinique divers</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Traitement en cours</label>
            <textarea {...register('traitementEnCours')} disabled={isLocked} className="w-full rounded border px-2 py-1" rows={2} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Hemoculture</label>
            <Input {...register('hemoculture')} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Vaccination</label>
            <Input {...register('vaccination')} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Transfusion</label>
            <Input {...register('transfusion')} disabled={isLocked} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Erythropoietine</label>
            <Input {...register('erythropoietine')} disabled={isLocked} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Observations</label>
            <textarea {...register('observations')} disabled={isLocked} className="w-full rounded border px-2 py-1" rows={3} />
          </div>
        </div>
      </div>

      {!isLocked && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer fin de seance'}
        </Button>
      )}
      {mutation.isSuccess && <p className="text-sm text-green-600">Enregistre</p>}
    </form>
  );
}
