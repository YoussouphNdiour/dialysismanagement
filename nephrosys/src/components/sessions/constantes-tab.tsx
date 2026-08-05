'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

type Props = {
  sessionId: string;
  sessionStatut: string;
  isLocked: boolean;
};

export function ConstantesTab({ sessionId, sessionStatut, isLocked }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [ta, setTa] = useState('');
  const [fc, setFc] = useState('');
  const [fr, setFr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [glycemie, setGlycemie] = useState('');
  const [hypotension, setHypotension] = useState(false);
  const [notes, setNotes] = useState('');

  const utils = api.useUtils();
  const { data: constantes } = api.vitalSigns.listBySession.useQuery({ sessionId });
  const createMutation = api.vitalSigns.create.useMutation({
    onSuccess: () => {
      utils.vitalSigns.listBySession.invalidate({ sessionId });
      resetForm();
    },
  });
  const deleteMutation = api.vitalSigns.delete.useMutation({
    onSuccess: () => utils.vitalSigns.listBySession.invalidate({ sessionId }),
  });

  const resetForm = () => {
    setShowForm(false);
    setTa('');
    setFc('');
    setFr('');
    setSpo2('');
    setTemp('');
    setGlycemie('');
    setHypotension(false);
    setNotes('');
  };

  const handleCreate = () => {
    createMutation.mutate({
      sessionId,
      heureMesure: new Date().toISOString(),
      tensionArterielle: ta,
      frequenceCardiaque: fc ? parseInt(fc) : undefined,
      frequenceRespiratoire: fr ? parseInt(fr) : undefined,
      spo2: spo2 ? parseFloat(spo2) : undefined,
      temperature: temp ? parseFloat(temp) : undefined,
      glycemie: glycemie ? parseFloat(glycemie) : undefined,
      isHypotension: hypotension,
      notes: notes || undefined,
    });
  };

  const canAdd = sessionStatut === 'en_cours' && !isLocked;

  return (
    <div>
      {canAdd && (
        <div className="mb-4">
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" /> Nouveau releve
          </Button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs font-medium">TA *</label>
              <Input placeholder="130/80" value={ta} onChange={(e) => setTa(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">FC (bpm)</label>
              <Input type="number" value={fc} onChange={(e) => setFc(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">FR (c/min)</label>
              <Input type="number" value={fr} onChange={(e) => setFr(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">SpO2 (%)</label>
              <Input type="number" step="0.1" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Temperature (°C)</label>
              <Input type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Glycemie (g/L)</label>
              <Input type="number" step="0.01" value={glycemie} onChange={(e) => setGlycemie(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <input
                type="checkbox"
                id="hypotension"
                checked={hypotension}
                onChange={(e) => setHypotension(e.target.checked)}
              />
              <label htmlFor="hypotension" className="text-xs font-medium">Hypotension</label>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!ta || createMutation.isPending}>
              {createMutation.isPending ? 'Ajout...' : 'Ajouter'}
            </Button>
            <Button variant="outline" onClick={resetForm}>Annuler</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-2 text-left">Heure</th>
              <th className="px-2 py-2">TA</th>
              <th className="px-2 py-2">FC</th>
              <th className="px-2 py-2">FR</th>
              <th className="px-2 py-2">SpO2</th>
              <th className="px-2 py-2">T°</th>
              <th className="px-2 py-2">Glyc.</th>
              <th className="px-2 py-2">Hypo.</th>
              <th className="px-2 py-2 text-left">Notes</th>
              {canAdd && <th className="px-2 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {constantes?.map((c) => (
              <tr key={c.id} className={`border-b ${c.isHypotension ? 'bg-red-50 dark:bg-red-950' : ''}`}>
                <td className="px-2 py-2 text-xs">
                  {new Date(c.heureMesure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-2 py-2 text-center">{c.tensionArterielle}</td>
                <td className="px-2 py-2 text-center">{c.frequenceCardiaque ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.frequenceRespiratoire ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.spo2 ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.temperature ?? '—'}</td>
                <td className="px-2 py-2 text-center">{c.glycemie ?? '—'}</td>
                <td className="px-2 py-2 text-center">
                  {c.isHypotension && <Badge className="bg-red-100 text-red-800">Oui</Badge>}
                </td>
                <td className="px-2 py-2 text-xs">{c.notes ?? ''}</td>
                {canAdd && (
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate({ id: c.id })}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {(!constantes || constantes.length === 0) && (
              <tr>
                <td colSpan={canAdd ? 10 : 9} className="px-2 py-6 text-center text-gray-500">
                  Aucune constante enregistree
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
