'use client';

import { Input } from '@/components/ui/input';
import type { UseFormRegister, FieldValues, Path } from 'react-hook-form';

type FieldDef = {
  name: string;
  label: string;
  type?: 'number' | 'text' | 'select';
  step?: string;
  options?: { value: string; label: string }[];
};

type Props<T extends FieldValues> = {
  fields: FieldDef[];
  register: UseFormRegister<T>;
  disabled: boolean;
};

export function BilanSection<T extends FieldValues>({ fields, register, disabled }: Props<T>) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {field.label}
          </label>
          {field.type === 'select' ? (
            <select
              {...register(field.name as Path<T>)}
              disabled={disabled}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">—</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={field.type ?? 'number'}
              step={field.step ?? '0.01'}
              {...register(
                field.name as Path<T>,
                field.type === 'number' || !field.type ? { valueAsNumber: true } : undefined,
              )}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
