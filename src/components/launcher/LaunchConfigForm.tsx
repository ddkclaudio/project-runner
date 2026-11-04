import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IconExternalLink, IconFolder, IconRefresh } from '@tabler/icons-react';
import { appId } from '@/components/launcher/LibraryCard';
import { AppProgressBar } from '@/components/launcher/AppProgressBar';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/ui/PageShell';
import { TabFilter } from '@/components/ui/TabFilter';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import {
  commit,
  isLaunchConfigDirty,
  launchFieldsDiffer,
  patchField,
  regenerateLaunchConfig,
  useLaunchConfig,
} from '@/lib/launch-config';
import {
  appOpenLaunchfileDir,
  appProjectEnv,
  launcherError,
  type AppView,
  type LaunchConfigView,
  type LaunchField,
} from '@/lib/launcher-api';
import { useAppProgressStore } from '@/stores/app-progress';

function isTruthyLaunchValue(value: string) {
  return ['true', 'yes', 'on', '1'].includes(value.trim().toLowerCase());
}

const LAUNCH_KINDS = ['site', 'api', 'desktop', 'cli'] as const;

function LaunchKindSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const current = value.trim().toLowerCase();
  const known = LAUNCH_KINDS.some((kind) => kind === current);
  const options = [
    ...(known ? [] : [{ value, label: 'Tipo desconhecido' }]),
    ...LAUNCH_KINDS.map((kind) => ({ value: kind, label: kind })),
  ];
  return (
    <Select
      aria-label="Tipo"
      value={known ? current : value}
      onChange={onChange}
      options={options}
    />
  );
}

function LaunchFieldControl({
  field,
  onChange,
  onError,
}: {
  field: LaunchField;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const type = (field.fieldType || 'text').toLowerCase();

  if (field.key === 'kind') {
    return <LaunchKindSelect value={field.value} onChange={onChange} />;
  }

  if (type === 'boolean') {
    return (
      <Checkbox checked={isTruthyLaunchValue(field.value)} onChange={(checked) => onChange(checked ? 'true' : 'false')} />
    );
  }

  if (type === 'multiline' || field.key === 'env') {
    return <Textarea value={field.value} onChange={(event) => onChange(event.target.value)} rows={4} />;
  }

  if (type === 'url') {
    return (
      <Input
        type="url"
        value={field.value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://"
        rightIcon={<IconExternalLink size={16} aria-hidden="true" />}
        rightIconLabel="Abrir URL"
        onRightIconClick={() => {
          const raw = field.value.trim();
          if (!raw) {
            onError('Indique uma URL para abrir.');
            return;
          }
          const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
          void openUrl(href).catch((err) => onError(launcherError(err)));
        }}
      />
    );
  }

  if (type === 'number') {
    return (
      <Input type="number" value={field.value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" />
    );
  }

  return <Input value={field.value} onChange={(event) => onChange(event.target.value)} />;
}

function envFieldName(key: string) {
  return key.toLowerCase().startsWith('env.') ? key.slice(4).toLowerCase() : '';
}

function isMovedEnvField(key: string) {
  const name = envFieldName(key);
  return name === 'port' || name === 'ci';
}

function launchPort(fields: LaunchField[]) {
  const value = fields.find((field) => envFieldName(field.key) === 'port')?.value.trim() ?? '';
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? value : '3000';
}

function launchCi(fields: LaunchField[]) {
  return fields.find((field) => envFieldName(field.key) === 'ci')?.value ?? 'false';
}

function withExpectedEnv(
  entries: { key: string; value: string }[],
  expected: { key: string; value: string }[],
) {
  const present = new Set(entries.map((entry) => entry.key));
  return [...expected.filter((entry) => !present.has(entry.key)), ...entries];
}

function parsedPrimitive(value: string): 'number' | 'boolean' | 'url' | 'text' {
  const trimmed = value.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed))) return 'number';
  if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) return 'boolean';
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  return 'text';
}

function parsedTruthy(value: string) {
  return ['true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function EnvValueControl({ value }: { value: string }) {
  const kind = parsedPrimitive(value);
  if (kind === 'boolean') {
    return <Checkbox checked={parsedTruthy(value)} onChange={() => undefined} disabled />;
  }
  if (kind === 'number') {
    return <Input type="number" value={value} readOnly aria-label={value} inputMode="decimal" />;
  }
  if (kind === 'url') {
    return <Input type="url" value={value} readOnly aria-label={value} />;
  }
  return <Input value={value} readOnly aria-label={value} />;
}

function ProjectEnvTab({
  appId: launchId,
  port,
  ci,
}: {
  appId: string;
  port: string;
  ci: string;
}) {
  const envFile = useQuery({
    queryKey: ['launcher', 'project-env', launchId],
    queryFn: () => appProjectEnv(launchId),
    enabled: Boolean(launchId),
  });
  const source = envFile.data?.source;
  const entries = withExpectedEnv(envFile.data?.entries ?? [], [
    { key: 'PORT', value: port },
    { key: 'CI', value: ci },
  ]);
  const subtitle = envFile.isLoading
    ? 'A ler…'
    : source === 'example'
      ? 'O projeto não tem .env. Estes são os valores esperados em .env.example.'
      : 'Definidas no .env do projeto.';

  return (
    <FormCard aria-label="Variáveis de ambiente">
      <FormCard.Header title="Variáveis" subtitle={envFile.isError ? launcherError(envFile.error) : subtitle} />
      {envFile.isLoading
        ? null
        : entries.map((entry) => (
            <FormRow key={entry.key} label={entry.key}>
              <EnvValueControl value={entry.value} />
            </FormRow>
          ))}
    </FormCard>
  );
}

function LaunchConfigForm({
  appId: launchId,
  loaded,
  fields,
  busy,
  showSave = true,
  onSaveFields,
  onGenerateDeepseek,
  onOpenFolder,
}: {
  appId: string;
  loaded?: LaunchConfigView;
  fields: LaunchField[];
  busy: boolean;
  showSave?: boolean;
  onSaveFields: () => void;
  onGenerateDeepseek: () => void;
  onOpenFolder: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'app' | 'env'>('app');
  if (!loaded) return null;

  const working = fields.length ? fields : loaded.fields;
  const visibleFields = working.filter((field) => field.key !== 'hint' && !isMovedEnvField(field.key));
  const dirty = launchFieldsDiffer(loaded.fields, working);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
      <TabFilter
        aria-label="Executável"
        value={tab}
        onChange={(value) => setTab(value === 'env' ? 'env' : 'app')}
        tabs={[
          { value: 'app', label: 'App' },
          { value: 'env', label: 'Variáveis' },
        ]}
      />
      {tab === 'env' ? (
        <ProjectEnvTab appId={launchId} port={launchPort(working)} ci={launchCi(working)} />
      ) : null}
      {tab === 'app' ? (
      <FormCard aria-label="Configuração de execução">
        <FormCard.Header
          title="Launchfile"
          subtitle={
            loaded.configPath
              ? 'O DeepSeek só corre ao trocar de branch se este ficheiro ainda não existir. Para o reescrever, usa o ícone de regenerar.'
              : 'O DeepSeek cria o Launchfile se ainda não existir (token em Perfil).'
          }
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                aria-label="Abrir pasta do Launchfile"
                title="Abrir pasta do Launchfile"
                onClick={onOpenFolder}
                style={{ width: 28, padding: 0 }}
                leftIcon={<IconFolder size={15} aria-hidden="true" />}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                aria-label="Regenerar com DeepSeek"
                title="Regenerar com DeepSeek"
                onClick={onGenerateDeepseek}
                style={{ width: 28, padding: 0 }}
                leftIcon={<IconRefresh size={15} aria-hidden="true" />}
              />
            </>
          }
        />
        {visibleFields.map((field) => (
          <FormRow key={field.key} label={field.label}>
            <LaunchFieldControl
              field={field}
              onChange={(value) => patchField(launchId, field.key, value)}
              onError={(message) => toast.error(message)}
            />
          </FormRow>
        ))}
        {working.some((field) => field.key === 'hint') ? (
          <FormCard.Hint>{working.find((field) => field.key === 'hint')?.value}</FormCard.Hint>
        ) : null}
        {showSave && dirty ? (
          <FormCard.Footer
            right={
              <Button type="button" variant="secondary" disabled={busy} onClick={onSaveFields}>
                Salvar
              </Button>
            }
          />
        ) : null}
      </FormCard>
      ) : null}
    </div>
  );
}

export function LaunchConfigPanel({
  app,
  showHeading = false,
  showSave = true,
}: {
  app: AppView;
  showHeading?: boolean;
  showSave?: boolean;
}) {
  const launchId = appId(app);
  const toast = useToast();
  const config = useLaunchConfig(launchId);
  const [configBusy, setConfigBusy] = useState(false);
  const progress = useAppProgressStore((s) => s.byId[launchId]);
  const setProgress = useAppProgressStore((s) => s.setProgress);
  const clearProgress = useAppProgressStore((s) => s.clearProgress);

  async function saveFields() {
    if (!isLaunchConfigDirty(launchId)) return;
    setConfigBusy(true);
    try {
      await commit(launchId);
      toast.success('Configuração salva.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
    }
  }

  async function generateWithDeepseek() {
    if (useAppProgressStore.getState().isBusy(launchId) || configBusy) {
      toast.error('Já em curso…');
      return;
    }
    setConfigBusy(true);
    setProgress(launchId, { percent: 1, phase: 'DeepSeek a analisar…', kind: 'deepseek' });
    try {
      await regenerateLaunchConfig(launchId);
      toast.success('Launchfile gerado com DeepSeek.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
      window.setTimeout(() => clearProgress(launchId), 700);
    }
  }

  async function openLaunchDir() {
    try {
      await appOpenLaunchfileDir(launchId);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  const body = (
    <>
      {config.error ? <InlineAlert>{launcherError(config.error)}</InlineAlert> : null}
      {progress ? <AppProgressBar progress={progress} /> : null}
      <LaunchConfigForm
        appId={launchId}
        loaded={config.data}
        fields={config.fields}
        busy={configBusy || Boolean(progress)}
        showSave={showSave}
        onSaveFields={() => void saveFields()}
        onGenerateDeepseek={() => void generateWithDeepseek()}
        onOpenFolder={() => void openLaunchDir()}
      />
    </>
  );

  if (!showHeading) return body;
  return (
    <PageShell>
      <PageShell.Heading subtitle="Configuração de arranque e variáveis do projeto.">
        Executável {config.data ? <StatusBadge label={config.data.runnerLabel} tone="info" /> : null}
      </PageShell.Heading>
      {body}
    </PageShell>
  );
}
