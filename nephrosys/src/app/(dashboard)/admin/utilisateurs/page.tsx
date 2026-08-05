'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, type CreateUserInput } from '@/lib/validators/users';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'medecin', label: 'Medecin' },
  { value: 'infirmiere', label: 'Infirmiere' },
  { value: 'secretaire', label: 'Secretaire' },
  { value: 'facturation', label: 'Facturation' },
  { value: 'patient', label: 'Patient' },
];

export default function UtilisateursPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: usersList, isLoading } = api.users.list.useQuery();
  const utils = api.useUtils();

  const createMutation = api.users.create.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setShowForm(false);
      reset();
    },
  });

  const toggleMutation = api.users.toggleActive.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Utilisateurs
        </h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Annuler' : 'Nouvel utilisateur'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            {createMutation.error && (
              <p className="text-sm text-red-500">{createMutation.error.message}</p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input label="Prenom" id="prenom" {...register('prenom')} error={errors.prenom?.message} />
              <Input label="Nom" id="nom" {...register('nom')} error={errors.nom?.message} />
              <Select label="Role" id="role" {...register('role')} error={errors.role?.message} options={ROLE_OPTIONS} placeholder="Selectionner" />
              <Input label="Email" id="email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Mot de passe" id="password" type="password" {...register('password')} error={errors.password?.message} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creation...' : 'Creer'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Nom</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Email</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Role</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Statut</th>
              <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-8 w-24" /></td>
                </tr>
              ))}

            {usersList?.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                  {user.prenom} {user.nom}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">
                    {ROLE_OPTIONS.find((r) => r.value === user.role)?.label || user.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={user.isActive ? 'success' : 'danger'}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: user.id })}
                    disabled={toggleMutation.isPending}
                  >
                    {user.isActive ? 'Desactiver' : 'Activer'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
