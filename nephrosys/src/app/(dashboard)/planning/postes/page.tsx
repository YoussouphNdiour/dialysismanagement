'use client';

import { PostesGrid } from '@/components/postes/postes-grid';

export default function PostesPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Postes de dialyse
      </h1>
      <PostesGrid />
    </div>
  );
}
