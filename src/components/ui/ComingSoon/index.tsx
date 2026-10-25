import React from 'react';
import Link from 'next/link';
import { IconRocket } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import styles from './ComingSoon.module.css';

interface ComingSoonProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function ComingSoon({
  title = 'Em Breve',
  description = 'Esta funcionalidade está em desenvolvimento. Volte em breve.',
  backHref = '/projects',
  backLabel = 'Voltar aos projetos',
}: ComingSoonProps) {
  return (
    <PageShell>
      <div className={styles.page}>
        <div className={styles.iconWrap}>
          <IconRocket size={32} className={styles.icon} />
        </div>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <Link href={backHref} className={styles.link}>
          {backLabel}
        </Link>
      </div>
    </PageShell>
  );
}
