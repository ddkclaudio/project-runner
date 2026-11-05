import { useRef, useState, type KeyboardEvent } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IconExternalLink, IconFolder, IconRefresh } from '@tabler/icons-react';
import { appId } from '@/components/launcher/LibraryCard';
import { AppProgressBar } from '@/components/launcher/AppProgressBar';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import formStyles from '@/components/ui/FormCard/FormCard.module.css';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { PageShell } from '@/components/ui/PageShell';
import { TabFilter } from '@/components/ui/TabFilter';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { cx } from '@/utils';
import {
  commit,
  importLaunchEnv,
  isLaunchConfigDirty,
  launchFieldsDiffer,
  patchField,
  regenerateLaunchConfig,
  useLaunchConfig,
} from '@/lib/launch-config';
import {
  appOpenLaunchfileDir,
  launcherError,
  readEnvFile,
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

function fieldReadout(field: LaunchField): string {
  const type = (field.fieldType || 'text').toLowerCase();
  const trimmed = field.value.trim();
  if (type === 'boolean') return isTruthyLaunchValue(field.value) ? 'Sim' : 'Não';
  return trimmed || '—';
}

function AppFieldEditor({
  field,
  launchId,
  disabled,
}: {
  field: LaunchField;
  launchId: string;
  disabled: boolean;
}) {
  const toast = useToast();
  const skipSave = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const type = (field.fieldType || 'text').toLowerCase();
  const discrete = field.key === 'kind' || type === 'boolean';

  function clearCloseTimer() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function persist(next: string) {
    if (next === field.value) return;
    patchField(launchId, field.key, next);
    void commit(launchId).catch((err) => toast.error(launcherError(err)));
  }

  function close(save: boolean) {
    clearCloseTimer();
    const skip = skipSave.current;
    skipSave.current = false;
    setEditing(false);
    if (save && !skip) persist(draft);
  }

  if (!editing) {
    const shown = fieldReadout(field);
    return (
      <span
        className={cx(formStyles.readout, shown === '—' && formStyles.readoutEmpty)}
        onDoubleClick={() => {
          if (disabled) return;
          skipSave.current = false;
          setDraft(field.value);
          setEditing(true);
        }}
      >
        {shown}
      </span>
    );
  }

  const editingField = { ...field, value: draft };
  return (
    <div
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        if (discrete) {
          clearCloseTimer();
          closeTimer.current = window.setTimeout(() => close(true), 180);
          return;
        }
        close(true);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          skipSave.current = true;
          setDraft(field.value);
          setEditing(false);
        }
        if (event.key === 'Enter' && type !== 'multiline' && field.key !== 'env') {
          event.preventDefault();
          (event.target as HTMLElement | null)?.blur?.();
        }
      }}
    >
      <LaunchFieldControl
        field={editingField}
        onChange={(value) => {
          setDraft(value);
          if (!discrete) return;
          clearCloseTimer();
          skipSave.current = false;
          setEditing(false);
          if (value === field.value) return;
          patchField(launchId, field.key, value);
          void commit(launchId).catch((err) => toast.error(launcherError(err)));
        }}
        onError={(message) => toast.error(message)}
      />
    </div>
  );
}

function isEnvField(key: string) {
  const name = key.toLowerCase();
  return name === 'env' || name.startsWith('env.');
}

function ProjectEnvTab({
  launchId,
  fields,
  busy,
  onImportEnv,
  showImport = true,
  plain = false,
}: {
  launchId: string;
  fields: LaunchField[];
  busy: boolean;
  onImportEnv: () => void;
  showImport?: boolean;
  plain?: boolean;
}) {
  const entries = fields
    .filter((field) => field.key.toLowerCase().startsWith('env.'))
    .map((field) => ({ key: field.key, name: field.key.slice(4), value: field.value }));

  return (
    <FormCard plain={plain} aria-label="Variáveis de ambiente">
      <FormCard.Header
        title={showImport ? 'Variáveis' : ''}
        subtitle="Valores do bloco env deste Launchfile."
        actions={
          showImport ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={onImportEnv}>
              Importar variáveis
            </Button>
          ) : undefined
        }
      />
      {entries.length === 0 ? (
        <FormCard.Hint>Este Launchfile não tem variáveis.</FormCard.Hint>
      ) : (
        entries.map((entry) => (
          <FormRow key={entry.key} label={entry.name} stack={plain}>
            <EnvValueControl
              value={entry.value}
              readout={plain}
              fieldKey={entry.key}
              launchId={launchId}
              disabled={busy}
            />
          </FormRow>
        ))
      )}
    </FormCard>
  );
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

function EnvValueControl({
  value,
  readout = false,
  fieldKey,
  launchId,
  disabled = false,
}: {
  value: string;
  readout?: boolean;
  fieldKey?: string;
  launchId?: string;
  disabled?: boolean;
}) {
  const toast = useToast();
  const skipSave = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (readout && editing) {
    const kind = parsedPrimitive(value);
    const finish = (save: boolean) => {
      const skip = skipSave.current;
      skipSave.current = false;
      setEditing(false);
      if (!save || skip || draft === value || !fieldKey || !launchId) return;
      patchField(launchId, fieldKey, draft);
      void commit(launchId).catch((err) => toast.error(launcherError(err)));
    };
    const keys = {
      autoFocus: true,
      'aria-label': fieldKey ?? value,
      onBlur: () => finish(true),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          skipSave.current = true;
          setDraft(value);
          setEditing(false);
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      },
    };
    if (kind === 'boolean') {
      return (
        <Checkbox
          checked={parsedTruthy(draft)}
          onChange={(checked) => {
            const next = checked ? 'true' : 'false';
            setDraft(next);
            skipSave.current = false;
            setEditing(false);
            if (next === value || !fieldKey || !launchId) return;
            patchField(launchId, fieldKey, next);
            void commit(launchId).catch((err) => toast.error(launcherError(err)));
          }}
        />
      );
    }
    if (kind === 'number') {
      return (
        <Input
          type="number"
          inputMode="decimal"
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          {...keys}
        />
      );
    }
    if (kind === 'url') {
      return (
        <Input
          type="url"
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          {...keys}
        />
      );
    }
    return (
      <Input
        value={draft}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        {...keys}
      />
    );
  }

  if (readout) {
    const trimmed = value.trim();
    const shown = !trimmed ? '—' : parsedPrimitive(trimmed) === 'boolean' ? (parsedTruthy(trimmed) ? 'Sim' : 'Não') : trimmed;
    return (
      <span
        className={cx(formStyles.readout, !trimmed && formStyles.readoutEmpty)}
        onDoubleClick={() => {
          if (disabled || !fieldKey || !launchId) return;
          skipSave.current = false;
          setDraft(value);
          setEditing(true);
        }}
      >
        {shown}
      </span>
    );
  }
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

function LaunchConfigForm({
  appId: launchId,
  loaded,
  fields,
  busy,
  showSave = true,
  pane = 'both',
  showTools = true,
  onSaveFields,
  onImportEnv,
  onGenerateDeepseek,
  onOpenFolder,
}: {
  appId: string;
  loaded?: LaunchConfigView;
  fields: LaunchField[];
  busy: boolean;
  showSave?: boolean;
  pane?: 'both' | 'app' | 'env';
  showTools?: boolean;
  onSaveFields: () => void;
  onImportEnv: () => void;
  onGenerateDeepseek: () => void;
  onOpenFolder: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'app' | 'env'>('app');
  if (!loaded) return null;

  const working = fields.length ? fields : loaded.fields;
  const visibleFields = working.filter((field) => field.key !== 'hint' && !isEnvField(field.key));
  const dirty = launchFieldsDiffer(loaded.fields, working);

  const showApp = pane === 'app' || (pane === 'both' && tab === 'app');
  const showEnv = pane === 'env' || (pane === 'both' && tab === 'env');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: pane === 'both' ? 16 : 0, marginBottom: pane === 'both' ? 20 : 0 }}>
      {pane === 'both' ? (
      <TabFilter
        aria-label="Executável"
        value={tab}
        onChange={(value) => setTab(value === 'env' ? 'env' : 'app')}
        tabs={[
          { value: 'app', label: 'App' },
          { value: 'env', label: 'Variáveis' },
        ]}
      />
      ) : null}
      {showEnv ? (
        <ProjectEnvTab launchId={launchId} fields={working} busy={busy} showImport={showTools} plain={!showTools} onImportEnv={onImportEnv} />
      ) : null}
      {showApp ? (
      <FormCard plain={!showTools} aria-label="Configuração de execução">
        {showTools ? (
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
        ) : (
          <FormCard.Header title="" subtitle="Nome, runtime, tipo e comandos deste Launchfile." />
        )}
        {visibleFields.map((field) => (
          <FormRow key={field.key} label={field.label} stack={!showTools}>
            {showTools ? (
              <LaunchFieldControl
                field={field}
                onChange={(value) => patchField(launchId, field.key, value)}
                onError={(message) => toast.error(message)}
              />
            ) : (
              <AppFieldEditor field={field} launchId={launchId} disabled={busy} />
            )}
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

export function useLaunchConfigActions(launchId: string) {
  const toast = useToast();
  const config = useLaunchConfig(launchId);
  const [configBusy, setConfigBusy] = useState(false);
  const progress = useAppProgressStore((s) => s.byId[launchId]);
  const setProgress = useAppProgressStore((s) => s.setProgress);
  const clearProgress = useAppProgressStore((s) => s.clearProgress);

  async function saveFields() {
    if (!launchId || !isLaunchConfigDirty(launchId)) return;
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
    if (!launchId) return;
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

  async function importEnv() {
    if (!launchId || useAppProgressStore.getState().isBusy(launchId) || configBusy) return;
    setConfigBusy(true);
    try {
      const selected = await openDialog({ multiple: false, title: 'Importar variáveis' });
      if (typeof selected !== 'string' || !selected) return;
      const entries = await readEnvFile(selected);
      const count = await importLaunchEnv(launchId, entries);
      if (count === 0) toast.info('O arquivo não tem variáveis.');
      else toast.success(count === 1 ? '1 variável gravada no Launchfile.' : `${count} variáveis gravadas no Launchfile.`);
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
    }
  }

  async function openLaunchDir() {
    if (!launchId) return;
    try {
      await appOpenLaunchfileDir(launchId);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return {
    config,
    progress,
    busy: configBusy || Boolean(progress),
    saveFields,
    generateWithDeepseek,
    importEnv,
    openLaunchDir,
  };
}

export function LaunchConfigPanel({
  app,
  showHeading = false,
  showSave = true,
  pane = 'both',
  showTools = true,
}: {
  app: AppView;
  showHeading?: boolean;
  showSave?: boolean;
  pane?: 'both' | 'app' | 'env';
  showTools?: boolean;
}) {
  const launchId = appId(app);
  const tools = useLaunchConfigActions(launchId);

  const body = (
    <>
      {tools.config.error ? <InlineAlert>{launcherError(tools.config.error)}</InlineAlert> : null}
      {tools.progress ? <AppProgressBar progress={tools.progress} /> : null}
      <LaunchConfigForm
        appId={launchId}
        loaded={tools.config.data}
        fields={tools.config.fields}
        busy={tools.busy}
        showSave={showSave}
        pane={pane}
        showTools={showTools}
        onSaveFields={() => void tools.saveFields()}
        onImportEnv={() => void tools.importEnv()}
        onGenerateDeepseek={() => void tools.generateWithDeepseek()}
        onOpenFolder={() => void tools.openLaunchDir()}
      />
    </>
  );

  if (!showHeading) return body;
  return (
    <PageShell>
      <PageShell.Heading subtitle="Configuração de arranque e variáveis do projeto.">
        Executável {tools.config.data ? <StatusBadge label={tools.config.data.runnerLabel} tone="info" /> : null}
      </PageShell.Heading>
      {body}
    </PageShell>
  );
}
