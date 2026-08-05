'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateBilanSchema, type UpdateBilanInput } from '@/lib/validators/bilans';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BilanSection } from '@/components/bilans/bilan-tabs/bilan-section';

const TABS = [
  'Hematologie',
  'Biochimie renale',
  'Electrolytes',
  'Mineraux / Os',
  'Lipides',
  'Nutrition / Inflammation',
  'Hepatique',
  'Martial',
  'Glycemie / Urines',
  'Serologies / PBR',
] as const;

const SEROLOGIE_OPTIONS = [
  { value: 'positif', label: 'Positif' },
  { value: 'negatif', label: 'Negatif' },
  { value: 'non_fait', label: 'Non fait' },
];

type FieldDef = {
  name: string;
  label: string;
  type?: 'number' | 'text' | 'select';
  step?: string;
  options?: { value: string; label: string }[];
};

const TAB_FIELDS: Record<number, FieldDef[]> = {
  0: [
    // Hematologie
    { name: 'hemoglobine', label: 'Hemoglobine (g/dL)' },
    { name: 'hematocrite', label: 'Hematocrite (%)' },
    { name: 'globulesBlancs', label: 'Globules blancs (10^3/uL)' },
    { name: 'plaquettes', label: 'Plaquettes (/uL)', step: '1' },
    { name: 'neutrophiles', label: 'Neutrophiles (%)' },
    { name: 'eosinophiles', label: 'Eosinophiles (%)' },
    { name: 'basophiles', label: 'Basophiles (%)' },
    { name: 'lymphocytes', label: 'Lymphocytes (%)' },
    { name: 'monocytes', label: 'Monocytes (%)' },
    { name: 'ferritine', label: 'Ferritine (ng/mL)' },
    { name: 'saturationTransferrine', label: 'Saturation transferrine (%)' },
    { name: 'vgm', label: 'VGM (fL)' },
    { name: 'ccmh', label: 'CCMH (g/dL)' },
  ],
  1: [
    // Biochimie renale
    { name: 'creatinine', label: 'Creatinine (umol/L)' },
    { name: 'ureePre', label: 'Uree pre-dialyse (mmol/L)' },
    { name: 'ureePost', label: 'Uree post-dialyse (mmol/L)' },
    { name: 'acideUrique', label: 'Acide urique (umol/L)' },
    { name: 'uricemie', label: 'Uricemie (mg/L)' },
    { name: 'dfgMdrd', label: 'DFG MDRD (mL/min)' },
  ],
  2: [
    // Electrolytes
    { name: 'sodium', label: 'Sodium (mmol/L)' },
    { name: 'potassium', label: 'Potassium (mmol/L)' },
    { name: 'chlore', label: 'Chlore (mmol/L)' },
    { name: 'calcium', label: 'Calcium (mmol/L)' },
    { name: 'phosphore', label: 'Phosphore (mmol/L)' },
    { name: 'bicarbonateBilan', label: 'Bicarbonate (mmol/L)' },
    { name: 'reserveAlcaline', label: 'Reserve alcaline (mmol/L)' },
  ],
  3: [
    // Mineraux / Os
    { name: 'pth', label: 'PTH (pg/mL)' },
    { name: 'vitamineD', label: 'Vitamine D (ng/mL)' },
    { name: 'phosphataseAlcaline', label: 'Phosphatase alcaline (UI/L)' },
  ],
  4: [
    // Lipides
    { name: 'hdl', label: 'HDL (g/L)' },
    { name: 'ldl', label: 'LDL (g/L)' },
    { name: 'cholesterolTotal', label: 'Cholesterol total (g/L)' },
    { name: 'triglycerides', label: 'Triglycerides (g/L)' },
  ],
  5: [
    // Nutrition / Inflammation
    { name: 'albumine', label: 'Albumine (g/L)' },
    { name: 'prealbumine', label: 'Prealbumine (mg/L)' },
    { name: 'proteinesTotales', label: 'Proteines totales (g/L)' },
    { name: 'proteidemie', label: 'Proteidemie (g/L)' },
    { name: 'crp', label: 'CRP (mg/L)' },
  ],
  6: [
    // Hepatique
    { name: 'alat', label: 'ALAT (UI/L)' },
    { name: 'asat', label: 'ASAT (UI/L)' },
    { name: 'gammaGt', label: 'Gamma GT (UI/L)' },
    { name: 'ldhBilan', label: 'LDH (UI/L)' },
    { name: 'cpk', label: 'CPK (UI/L)' },
    { name: 'haptoglobine', label: 'Haptoglobine (g/L)' },
    { name: 'bilirubineTotale', label: 'Bilirubine totale (umol/L)' },
    { name: 'bilirubineIndirecte', label: 'Bilirubine indirecte (umol/L)' },
    { name: 'schizocytes', label: 'Schizocytes', type: 'text' as const },
    { name: 'rac', label: 'RAC', type: 'text' as const },
  ],
  7: [
    // Martial
    { name: 'cst', label: 'CST (%)' },
    { name: 'ferSerique', label: 'Fer serique (umol/L)' },
  ],
  8: [
    // Glycemie / Urines
    { name: 'gaj', label: 'GAJ (g/L)' },
    { name: 'hba1c', label: 'HbA1c (%)', step: '0.1' },
    { name: 'pu24h', label: 'PU 24h', type: 'text' as const },
    { name: 'eppu', label: 'EPPU', type: 'text' as const },
    { name: 'ecbu', label: 'ECBU', type: 'text' as const },
    { name: 'nau', label: 'NaU (mmol/L)' },
    { name: 'ku', label: 'KU (mmol/L)' },
    { name: 'rapportNaK', label: 'Rapport Na/K' },
    { name: 'ureeUrinaire', label: 'Uree urinaire (mmol/L)' },
    { name: 'creatUrinaire', label: 'Creatinine urinaire (umol/L)' },
  ],
  9: [
    // Serologies / PBR
    {
      name: 'hbsAg',
      label: 'HBs Ag',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    {
      name: 'antiHbs',
      label: 'Anti-HBs',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    {
      name: 'antiHbc',
      label: 'Anti-HBc',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    {
      name: 'antiHcv',
      label: 'Anti-HCV',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    {
      name: 'antiHiv',
      label: 'Anti-HIV',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    {
      name: 'tpha',
      label: 'TPHA',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    {
      name: 'vdrl',
      label: 'VDRL',
      type: 'select' as const,
      options: SEROLOGIE_OPTIONS,
    },
    { name: 'pbrResultat', label: 'Resultat PBR', type: 'text' as const },
  ],
};

const DECIMAL_KEYS = [
  'hemoglobine', 'hematocrite', 'globulesBlancs', 'plaquettes',
  'neutrophiles', 'eosinophiles', 'basophiles', 'lymphocytes', 'monocytes',
  'ferritine', 'saturationTransferrine', 'vgm', 'ccmh',
  'creatinine', 'ureePre', 'ureePost', 'acideUrique', 'uricemie', 'dfgMdrd',
  'sodium', 'potassium', 'chlore', 'calcium', 'phosphore',
  'bicarbonateBilan', 'reserveAlcaline',
  'pth', 'vitamineD', 'phosphataseAlcaline',
  'hdl', 'ldl', 'cholesterolTotal', 'triglycerides',
  'albumine', 'prealbumine', 'proteinesTotales', 'proteidemie', 'crp',
  'alat', 'asat', 'gammaGt', 'ldhBilan', 'cpk',
  'haptoglobine', 'bilirubineTotale', 'bilirubineIndirecte',
  'cst', 'ferSerique', 'gaj', 'hba1c',
  'nau', 'ku', 'rapportNaK', 'ureeUrinaire', 'creatUrinaire',
] as const;

const STRING_KEYS = ['notes', 'schizocytes', 'rac', 'pu24h', 'eppu', 'ecbu', 'pbrResultat'] as const;
const ENUM_KEYS = ['hbsAg', 'antiHbs', 'antiHbc', 'antiHcv', 'antiHiv', 'tpha', 'vdrl'] as const;

type StatusBadgeProps = { label: string; status: string | null | undefined };

function StatusBadge({ label, status }: StatusBadgeProps) {
  if (!status) return null;
  const cls = status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  return (
    <Badge className={`${cls} text-xs`}>
      {label}: {status}
    </Badge>
  );
}

export default function BilanDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState(0);

  const utils = api.useUtils();
  const { data: bilan, isLoading } = api.bilans.getById.useQuery({ id });
  const updateMutation = api.bilans.update.useMutation({
    onSuccess: () => utils.bilans.getById.invalidate({ id }),
  });

  // Build default values from bilan data
  const buildDefaults = (): Partial<UpdateBilanInput> => {
    if (!bilan) return { id };
    const defaults: Record<string, unknown> = { id };

    for (const key of DECIMAL_KEYS) {
      const val = bilan[key as keyof typeof bilan];
      if (val != null && typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) defaults[key] = parsed;
      }
    }
    for (const key of STRING_KEYS) {
      const val = bilan[key as keyof typeof bilan];
      if (val != null) defaults[key] = val;
    }
    for (const key of ENUM_KEYS) {
      const val = bilan[key as keyof typeof bilan];
      if (val != null) defaults[key] = val;
    }

    return defaults as Partial<UpdateBilanInput>;
  };

  const defaults = buildDefaults();

  const { register, handleSubmit } = useForm<UpdateBilanInput>({
    resolver: zodResolver(updateBilanSchema),
    defaultValues: { id, ...defaults },
    values: { id, ...defaults } as UpdateBilanInput,
  });

  const onSubmit = (data: UpdateBilanInput) => {
    updateMutation.mutate(data);
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!bilan) return <p className="text-gray-500">Bilan non trouve</p>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bilan {bilan.reference}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {bilan.patient?.nom} {bilan.patient?.prenom} |{' '}
          {new Date(bilan.dateBilan).toLocaleDateString('fr-FR')} |{' '}
          <span className="capitalize">{bilan.typeBilan}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <StatusBadge label="Hb" status={bilan.hbStatut} />
          <StatusBadge label="K+" status={bilan.potassiumStatut} />
          <StatusBadge label="PO4" status={bilan.phosphoreStatut} />
          <StatusBadge label="Alb" status={bilan.albumineStatut} />
          <StatusBadge label="PTH" status={bilan.pthStatut} />
          <StatusBadge label="CaP" status={bilan.caPStatut} />
          {bilan.urrCalculated && (
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              URR: {bilan.urrCalculated}%
            </Badge>
          )}
          {bilan.produitCaP && (
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              Ca x P: {bilan.produitCaP}
            </Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input type="hidden" {...register('id')} />

        {/* Tab navigation */}
        <div className="mb-4 flex flex-wrap border-b dark:border-gray-700">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === i
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-48">
          <BilanSection<UpdateBilanInput>
            fields={TAB_FIELDS[activeTab] ?? []}
            register={register}
            disabled={false}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          {updateMutation.isSuccess && (
            <span className="text-sm text-green-600">Enregistre avec succes</span>
          )}
          {updateMutation.isError && (
            <span className="text-sm text-red-500">
              Erreur: {updateMutation.error.message}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
