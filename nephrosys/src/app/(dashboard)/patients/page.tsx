'use client';

import { PatientTable } from '@/components/patients/patient-table';

export default function PatientsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Patients
      </h1>
      <PatientTable />
    </div>
  );
}
