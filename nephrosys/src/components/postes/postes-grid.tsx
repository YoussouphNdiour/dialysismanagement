'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPosteSchema } from '@/lib/validators/postes';
import { Plus, X } from 'lucide-react';
import type { z } from 'zod';

type FormInput = z.input<typeof createPosteSchema>;

export function PostesGrid() {
  const [showForm, setShowForm] = useState(false);
  const utils = api.useUtils();

  const { data: postes, isLoading } = api.postes.list.useQuery();
  const createMutation = api.postes.create.useMutation({
    onSuccess: () => {
      utils.postes.list.invalidate();
      setShowForm(false);
      reset();
    },
  });
  const toggleMutation = api.postes.toggleActive.useMutation({
    onSuccess: () => utils.postes.list.invalidate(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput>({
    resolver: zodResolver(createPosteSchema),
    defaultValues: { isVip: false },
  });

  const onSubmit = (data: FormInput) => {
    createMutation.mutate(data as z.output<typeof createPosteSchema>);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {showForm ? 'Annuler' : 'Nouveau poste'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6 p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap gap-4">
            <div>
              <Input placeholder="Nom du poste" {...register('nom')} />
              {errors.nom && <p className="text-sm text-red-500">{errors.nom.message}</p>}
            </div>
            <div>
              <Input
                type="number"
                placeholder="Numero"
                {...register('numero', { valueAsNumber: true })}
              />
              {errors.numero && <p className="text-sm text-red-500">{errors.numero.message}</p>}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isVip" {...register('isVip')} />
              <label htmlFor="isVip">VIP</label>
            </div>
            <div>
              <Input placeholder="Equipement (optionnel)" {...register('equipement')} />
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {postes?.map((poste) => (
          <Card
            key={poste.id}
            className={`p-4 ${poste.isVip ? 'border-2 border-amber-400' : ''} ${
              !poste.isActive ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{poste.nom}</p>
                <p className="text-sm text-gray-500">N° {poste.numero}</p>
              </div>
              <div className="flex gap-1">
                {poste.isVip && (
                  <Badge className="bg-amber-100 text-amber-800">VIP</Badge>
                )}
                <Badge variant={poste.isActive ? 'success' : 'danger'}>
                  {poste.isActive ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>
            {poste.equipement && (
              <p className="mt-2 text-xs text-gray-500">{poste.equipement}</p>
            )}
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleMutation.mutate({ id: poste.id })}
                disabled={toggleMutation.isPending}
              >
                {poste.isActive ? 'Desactiver' : 'Activer'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
