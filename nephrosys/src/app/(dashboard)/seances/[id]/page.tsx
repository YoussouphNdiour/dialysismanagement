'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PreDialyseTab } from '@/components/sessions/pre-dialyse-tab';
import { MachineTab } from '@/components/sessions/machine-tab';
import { ConstantesTab } from '@/components/sessions/constantes-tab';
import { FinSeanceTab } from '@/components/sessions/fin-seance-tab';
import { PrescriptionsTab } from '@/components/sessions/prescriptions-tab';

const TABS = ['Pre-dialyse', 'Machine', 'Constantes', 'Fin de seance', 'Prescriptions'] as const;

const STATUT_BADGES: Record<string, { className: string; label: string }> = {
  planifiee: { className: 'bg-blue-100 text-blue-800', label: 'Planifiee' },
  en_cours: { className: 'bg-orange-100 text-orange-800', label: 'En cours' },
  terminee: { className: 'bg-green-100 text-green-800', label: 'Terminee' },
  annulee: { className: 'bg-red-100 text-red-800', label: 'Annulee' },
};

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState(0);

  const utils = api.useUtils();
  const { data: session, isLoading } = api.sessions.getById.useQuery({ id });
  const demarrerMutation = api.sessions.demarrer.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id }),
  });
  const terminerMutation = api.sessions.terminer.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id }),
  });
  const annulerMutation = api.sessions.annuler.useMutation({
    onSuccess: () => utils.sessions.getById.invalidate({ id }),
  });

  const { data: factureData } = api.factures.getBySessionId.useQuery(
    { sessionId: id },
    { enabled: !!session && session.statut === 'terminee' },
  );

  const generateFactureMutation = api.factures.generate.useMutation({
    onSuccess: (data) => {
      if (data) {
        window.location.href = `/facturation/${data.id}`;
      }
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!session) return <p>Seance non trouvee</p>;

  const badge = STATUT_BADGES[session.statut] ?? STATUT_BADGES['planifiee']!;
  const isLocked = session.isLocked;

  let modificationRemaining = '';
  if (session.statut === 'terminee' && !isLocked) {
    const hoursAgo = (Date.now() - new Date(session.updatedAt).getTime()) / (1000 * 60 * 60);
    const remaining = Math.max(0, Math.round(24 - hoursAgo));
    modificationRemaining = `Modifiable encore ${remaining}h`;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Seance — {session.patient?.nom} {session.patient?.prenom}
          </h1>
          <p className="text-sm text-gray-500">
            {session.dateSeance} | {session.poste?.nom} | Dr {session.physician?.nom}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={badge.className}>{badge.label}</Badge>
          {isLocked && <Badge className="bg-gray-200 text-gray-700">Verrouillee</Badge>}
          {modificationRemaining && (
            <Badge className="bg-yellow-100 text-yellow-800">{modificationRemaining}</Badge>
          )}

          {session.statut === 'planifiee' && (
            <Button
              onClick={() => demarrerMutation.mutate({ id })}
              disabled={demarrerMutation.isPending}
            >
              Demarrer la seance
            </Button>
          )}
          {session.statut === 'en_cours' && (
            <Button
              onClick={() => terminerMutation.mutate({ id })}
              disabled={terminerMutation.isPending}
            >
              Terminer la seance
            </Button>
          )}
          {(session.statut === 'planifiee' || session.statut === 'en_cours') && (
            <Button
              variant="outline"
              onClick={() => annulerMutation.mutate({ id })}
              disabled={annulerMutation.isPending}
              className="text-red-600"
            >
              Annuler
            </Button>
          )}
          {session.statut === 'terminee' && !factureData && (
            <Button
              variant="secondary"
              onClick={() => generateFactureMutation.mutate({ sessionId: id })}
              disabled={generateFactureMutation.isPending}
            >
              Generer la facture
            </Button>
          )}
          {session.statut === 'terminee' && factureData && (
            <Link href={`/facturation/${factureData.id}`}>
              <Button variant="outline">
                Voir la facture ({factureData.reference})
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-4 flex border-b">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === i
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <PreDialyseTab
          sessionId={id}
          defaultValues={{
            arrivalStatus: session.arrivalStatus ?? undefined,
            arrivalWeight: session.arrivalWeight ? parseFloat(session.arrivalWeight) : undefined,
            dryWeight: session.dryWeight ? parseFloat(session.dryWeight) : undefined,
            taPreDialyse: session.taPreDialyse ?? undefined,
            taDebout: session.taDebout ?? undefined,
            taCoucher: session.taCoucher ?? undefined,
            temperaturePre: session.temperaturePre ? parseFloat(session.temperaturePre) : undefined,
          }}
          isLocked={isLocked}
        />
      )}
      {activeTab === 1 && (
        <MachineTab
          sessionId={id}
          defaultValues={{
            typeDialyse: session.typeDialyse ?? undefined,
            dialyzerType: session.dialyzerType ?? undefined,
            typeAbordVasculaire: session.typeAbordVasculaire ?? undefined,
            debitSang: session.debitSang ? parseFloat(session.debitSang) : undefined,
            debitDialysat: session.debitDialysat ? parseFloat(session.debitDialysat) : undefined,
            ufPrescrite: session.ufPrescrite ? parseFloat(session.ufPrescrite) : undefined,
            ufMax: session.ufMax ? parseFloat(session.ufMax) : undefined,
            dureePrescrite: session.dureePrescrite ?? undefined,
            conductivite: session.conductivite ? parseFloat(session.conductivite) : undefined,
            bainCalcium: session.bainCalcium ? parseFloat(session.bainCalcium) : undefined,
            bainPotassium: session.bainPotassium ? parseFloat(session.bainPotassium) : undefined,
            bainGlucose: session.bainGlucose ? parseFloat(session.bainGlucose) : undefined,
            bainSodium: session.bainSodium ?? undefined,
            temperatureBain: session.temperatureBain ? parseFloat(session.temperatureBain) : undefined,
            bicarbonate: session.bicarbonate ?? undefined,
            anticoagulation: session.anticoagulation ?? undefined,
            aiguilleArterielle: session.aiguilleArterielle ?? undefined,
            aiguilleVeineuse: session.aiguilleVeineuse ?? undefined,
            ponction: session.ponction ?? undefined,
            pressionArterielle: session.pressionArterielle ?? undefined,
            pressionVeineuse: session.pressionVeineuse ?? undefined,
            ptm: session.ptm ?? undefined,
          }}
          isLocked={isLocked}
        />
      )}
      {activeTab === 2 && (
        <ConstantesTab
          sessionId={id}
          sessionStatut={session.statut}
          isLocked={isLocked}
        />
      )}
      {activeTab === 3 && (
        <FinSeanceTab
          sessionId={id}
          defaultValues={{
            departureWeight: session.departureWeight ? parseFloat(session.departureWeight) : undefined,
            ufReelle: session.ufReelle ? parseFloat(session.ufReelle) : undefined,
            dureeReelle: session.dureeReelle ?? undefined,
            toleranceGlobale: session.toleranceGlobale ?? undefined,
            aspectRein: session.aspectRein ?? undefined,
            notesFin: session.notesFin ?? undefined,
            ureePre: session.ureePre ? parseFloat(session.ureePre) : undefined,
            ureePost: session.ureePost ? parseFloat(session.ureePost) : undefined,
            traitementEnCours: session.traitementEnCours ?? undefined,
            hemoculture: session.hemoculture ?? undefined,
            vaccination: session.vaccination ?? undefined,
            transfusion: session.transfusion ?? undefined,
            erythropoietine: session.erythropoietine ?? undefined,
            observations: session.observations ?? undefined,
          }}
          ktvCalculated={session.ktvCalculated}
          ktvStatus={session.ktvStatus}
          urrCalculated={session.urrCalculated}
          isLocked={isLocked}
        />
      )}
      {activeTab === 4 && (
        <PrescriptionsTab
          sessionId={id}
          sessionStatut={session.statut}
          isLocked={isLocked}
        />
      )}
    </div>
  );
}
