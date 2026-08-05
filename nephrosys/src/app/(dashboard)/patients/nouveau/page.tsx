import { PatientForm } from '@/components/patients/patient-form';

export default function NouveauPatientPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Nouveau patient
      </h1>
      <PatientForm mode="create" />
    </div>
  );
}
