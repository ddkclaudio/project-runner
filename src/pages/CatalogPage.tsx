import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useToast } from '@/components/ui/Toast';
import {
  catalogAdd,
  catalogLoad,
  launcherError,
  libraryExport,
  libraryImport,
  libraryValidate,
  type AppEntry,
} from '@/lib/launcher-api';
import styles from './library.module.css';

export function CatalogPage({ mode }: { mode: 'remote' | 'files' }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ['launcher', 'catalog'],
    queryFn: catalogLoad,
    enabled: mode === 'remote',
    retry: false,
  });
  const [raw, setRaw] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(entry: AppEntry) {
    try {
      await catalogAdd(entry);
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'library'] });
      toast.success(`${entry.name} entrou na biblioteca.`);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function onImport(file: File) {
    try {
      const count = await libraryImport(await file.text());
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'library'] });
      toast.success(`${count} apps importadas.`);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function onExport() {
    try {
      const json = await libraryExport();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'apps.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function onValidate() {
    try {
      const count = await libraryValidate();
      toast.success(`Biblioteca regravada com ${count} apps.`);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  if (mode === 'files') {
    return (
      <PageShell>
        <PageShell.Heading subtitle="O ficheiro aceita apps, um array, ou as secções standard, experimental e custom.">
          Importar e exportar
        </PageShell.Heading>
        <div className={styles.stack}>
          <Input label="JSON" value={raw} onChange={(event) => setRaw(event.target.value)} placeholder='{"apps":[]}' />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => void libraryImport(raw).then(async (count) => {
              await queryClient.invalidateQueries({ queryKey: ['launcher', 'library'] });
              toast.success(`${count} apps importadas.`);
            }).catch((err) => toast.error(launcherError(err)))}>
              Importar texto
            </Button>
            <Button type="button" onClick={() => fileRef.current?.click()}>Escolher ficheiro</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onImport(file);
              }}
            />
            <Button onClick={() => void onExport()}>Exportar</Button>
            <Button onClick={() => void onValidate()}>Validar</Button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle={catalog.data ? `${catalog.data.repository} · ${catalog.data.version}${catalog.data.fromCache ? ' · cache' : ''}` : 'A última release do repositório configurado.'}>
        Catálogo
      </PageShell.Heading>
      {catalog.isLoading ? <p className={styles.meta}>A carregar o catálogo…</p> : null}
      {catalog.error ? <InlineAlert>{launcherError(catalog.error)}</InlineAlert> : null}
      <div className={styles.stack}>
        {(catalog.data?.groups ?? []).map((group) => (
          <section key={group.name}>
            <h2 className={styles.title}>{group.name}</h2>
            {group.apps.map((app) => (
              <div key={app.repository} className={styles.row} style={{ marginTop: 8 }}>
                <div>
                  <p className={styles.title}>{app.name}</p>
                  <p className={styles.meta}>{app.repository}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void add(app)}>Adicionar</Button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
