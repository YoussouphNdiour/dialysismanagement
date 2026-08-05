'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateMachineSchema, type UpdateMachineInput } from '@/lib/validators/sessions';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  sessionId: string;
  defaultValues: Partial<UpdateMachineInput>;
  isLocked: boolean;
};

export function MachineTab({ sessionId, defaultValues, isLocked }: Props) {
  const utils = api.useUtils();
  const mutation = api.sessions.updateMachine.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id: sessionId }),
  });

  const {
    register,
    handleSubmit,
  } = useForm<UpdateMachineInput>({
    resolver: zodResolver(updateMachineSchema),
    defaultValues: { id: sessionId, ...defaultValues },
  });

  const onSubmit = (data: UpdateMachineInput) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register('id')} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Type de dialyse</label>
          <select {...register('typeDialyse')} disabled={isLocked} className="w-full rounded border px-2 py-1">
            <option value="">—</option>
            <option value="hemodialyse">Hemodialyse</option>
            <option value="hemodiafiltration">Hemodiafiltration</option>
            <option value="dialyse_peritoneale">Dialyse peritoneale</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Dialyseur (rein artificiel)</label>
          <Input {...register('dialyzerType')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Abord vasculaire</label>
          <Input {...register('typeAbordVasculaire')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Debit sang (ml/min)</label>
          <Input type="number" step="0.1" {...register('debitSang', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Debit dialysat (ml/min)</label>
          <Input type="number" step="0.1" {...register('debitDialysat', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">UF prescrite (L)</label>
          <Input type="number" step="0.01" {...register('ufPrescrite', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">UF max (L)</label>
          <Input type="number" step="0.01" {...register('ufMax', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Duree prescrite (min)</label>
          <Input type="number" {...register('dureePrescrite', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Conductivite (mS/cm)</label>
          <Input type="number" step="0.01" {...register('conductivite', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain calcium</label>
          <Input type="number" step="0.01" {...register('bainCalcium', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain potassium</label>
          <Input type="number" step="0.01" {...register('bainPotassium', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain glucose</label>
          <Input type="number" step="0.01" {...register('bainGlucose', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bain sodium</label>
          <Input {...register('bainSodium')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Temperature bain (°C)</label>
          <Input type="number" step="0.1" {...register('temperatureBain', { valueAsNumber: true })} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bicarbonate</label>
          <Input {...register('bicarbonate')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Anticoagulation</label>
          <Input {...register('anticoagulation')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Aiguille arterielle</label>
          <Input {...register('aiguilleArterielle')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Aiguille veineuse</label>
          <Input {...register('aiguilleVeineuse')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Ponction</label>
          <Input {...register('ponction')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Pression arterielle</label>
          <Input {...register('pressionArterielle')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Pression veineuse</label>
          <Input {...register('pressionVeineuse')} disabled={isLocked} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">PTM</label>
          <Input {...register('ptm')} disabled={isLocked} />
        </div>
      </div>

      {!isLocked && (
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement...' : 'Enregistrer parametres machine'}
        </Button>
      )}
      {mutation.isSuccess && <p className="text-sm text-green-600">Enregistre</p>}
    </form>
  );
}
