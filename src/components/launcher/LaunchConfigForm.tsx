import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import {
  appGenerateLaunchfile,
  appLaunchConfigGet,
  appLaunchConfigSave,
  appOpenLaunchfileDir,
  launcherError,
  type AppView,
  type LaunchField,
} from '@/lib/launcher-api';
import { useAppProgressStore } from '@/stores/app-progress';

function httpPort(value: string): string | null {
  const match = value.trim().match(/^https?:\/\/[^/\s:]+:(\d+)(?=\/|$)/i);
  return match?.[1] ?? null;
}

function linkedPorts(previous: string, next: string): { oldPort: string; newPort: string } | null {
  const prev = previous.trim();
  const nextTrim = next.trim();
  if (!prev || prev === nextTrim) return null;
  if (/^\d+$/.test(prev) && /^\d+$/.test(nextTrim)) {
    return { oldPort: prev, newPort: nextTrim };
  }
  const oldUrlPort = httpPort(prev);
  const newUrlPort = httpPort(nextTrim);
  if (oldUrlPort && newUrlPort && oldUrlPort !== newUrlPort) {
    return { oldPort: oldUrlPort, newPort: newUrlPort };
  }
  return null;
}

function replacePortToken(value: string, oldPort: string, newPort: string): string {
  if (value.trim() === oldPort) return newPort;
  const colon = new RegExp(`:${oldPort}(?!\\d)`, 'g');
  const standalone = new RegExp(`(^|[\\s=])${oldPort}(?!\\d)`, 'g');
  return value.replace(colon, `:${newPort}`).replace(standalone, `$1${newPort}`);
}

function propagateLaunchValue(fields: LaunchField[], key: string, value: string): LaunchField[] {
  const previous = fields.find((item) => item.key === key)?.value ?? '';
  const ports = linkedPorts(previous, value);
  return fields.map((item) => {
    if (item.key === key) return { ...item, value };
    if (!ports) return item;
    return { ...item, value: replacePortToken(item.value, ports.oldPort, ports.newPort) };
  });
}

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

function LaunchConfigForm({
  loaded,
  fields,
  busy,
  onFieldsChange,
  onSaveFields,
  onGenerateDeepseek,
  onOpenFolder,
}: {
  loaded?: Awaited<ReturnType<typeof appLaunchConfigGet>>;
  fields: LaunchField[];
  busy: boolean;
  onFieldsChange: (fields: LaunchField[]) => void;
  onSaveFields: () => void;
  onGenerateDeepseek: () => void;
  onOpenFolder: () => void;
}) {
  const toast = useToast();
  if (!loaded) return null;

  const working = fields.length ? fields : loaded.fields;
  const visibleFields = working.filter((field) => field.key !== 'hint');
  const dirty = loaded.fields.some((field) => {
    const current = working.find((item) => item.key === field.key);
    return (current?.value ?? '') !== field.value;
  }) || working.some((field) => !loaded.fields.some((item) => item.key === field.key));

  function patchField(key: string, value: string) {
    onFieldsChange(propagateLaunchValue(working, key, value));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
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
              onChange={(value) => patchField(field.key, value)}
              onError={(message) => toast.error(message)}
            />
          </FormRow>
        ))}
        {working.some((field) => field.key === 'hint') ? (
          <FormCard.Hint>{working.find((field) => field.key === 'hint')?.value}</FormCard.Hint>
        ) : null}
        {dirty ? (
          <FormCard.Footer
            right={
              <Button type="button" variant="secondary" disabled={busy} onClick={onSaveFields}>
                Salvar
              </Button>
            }
          />
        ) : null}
      </FormCard>
    </div>
  );
}

export function LaunchConfigPanel({ app, showHeading = false }: { app: AppView; showHeading?: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<LaunchField[]>([]);
  const [configBusy, setConfigBusy] = useState(false);
  const config = useQuery({
    queryKey: ['launcher', 'launch-config', appId(app)],
    queryFn: () => appLaunchConfigGet(appId(app)),
  });

  useEffect(() => {
    if (!config.data) return;
    setFields(config.data.fields.map((item) => ({ ...item })));
  }, [config.data]);

  async function saveFields() {
    setConfigBusy(true);
    try {
      await appLaunchConfigSave(appId(app), { fields });
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'launch-config', appId(app)] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'exe', appId(app)] });
      toast.success('Configuração salva.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
    }
  }

  const progress = useAppProgressStore((s) => s.byId[appId(app)]);
  const setProgress = useAppProgressStore((s) => s.setProgress);
  const clearProgress = useAppProgressStore((s) => s.clearProgress);

  async function generateWithDeepseek() {
    const id = appId(app);
    if (useAppProgressStore.getState().isBusy(id) || configBusy) {
      toast.error('Já em curso…');
      return;
    }
    setConfigBusy(true);
    setProgress(id, { percent: 1, phase: 'DeepSeek a analisar…', kind: 'deepseek' });
    try {
      await appGenerateLaunchfile(id);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'launch-config', id] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'exe', id] });
      toast.success('Launchfile gerado com DeepSeek.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
      window.setTimeout(() => clearProgress(id), 700);
    }
  }

  async function openLaunchDir() {
    try {
      await appOpenLaunchfileDir(appId(app));
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  const body = (
    <>
      {config.error ? <InlineAlert>{launcherError(config.error)}</InlineAlert> : null}
      {progress ? <AppProgressBar progress={progress} /> : null}
      <LaunchConfigForm
        loaded={config.data}
        fields={fields}
        busy={configBusy || Boolean(progress)}
        onFieldsChange={setFields}
        onSaveFields={() => void saveFields()}
        onGenerateDeepseek={() => void generateWithDeepseek()}
        onOpenFolder={() => void openLaunchDir()}
      />
    </>
  );

  if (!showHeading) return body;
  return (
    <PageShell>
      <PageShell.Heading subtitle="Manifesto Launchfile — pre-start, start, porta e URL.">
        Executável {config.data ? <StatusBadge label={config.data.runnerLabel} tone="info" /> : null}
      </PageShell.Heading>
      {body}
    </PageShell>
  );
}
