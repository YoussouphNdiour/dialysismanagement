'use client';

import { Button } from '@/components/ui/button';

type Props = {
  href: string;
  label?: string;
};

export function ExportPdfButton({ href, label = 'Exporter PDF' }: Props) {
  function handleClick() {
    window.open(href, '_blank');
  }

  return (
    <Button variant="outline" onClick={handleClick}>
      {label}
    </Button>
  );
}
