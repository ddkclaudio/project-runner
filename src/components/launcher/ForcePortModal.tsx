import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useLibraryMutations } from '@/components/launcher/LibraryCard';
import { launcherError, type AppView } from '@/lib/launcher-api';
import { logInfo, logWarn } from '@/lib/activity-log';
import { useToast } from '@/components/ui/Toast';

export type PortBusyDetail = {
  app: AppView;
  executable?: string;
  port?: number | null;
  pid?: number | null;
  processName?: string | null;
  message: string;
};

declare global {
  interface WindowEventMap {
    'painel-port-busy': CustomEvent<PortBusyDetail>;
  }
}

export function ForcePortModal() {
  const toast = useToast();
  const actions = useLibraryMutations();
  const [pending, setPending] = useState<PortBusyDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onBusy(event: CustomEvent<PortBusyDetail>) {
      const detail = event.detail;
      logWarn(
        'force-modal',
        `porta ocupada app=${detail.app.folderName || detail.app.name} port=${detail.port ?? '?'} pid=${detail.pid ?? '?'}`,
      );
      setPending(detail);
    }
    window.addEventListener('painel-port-busy', onBusy);
    return () => window.removeEventListener('painel-port-busy', onBusy);
  }, []);

  async function confirmForce() {
    if (!pending) return;
    setBusy(true);
    logInfo(
      'force-modal',
      `confirmar force app=${pending.app.folderName || pending.app.name} port=${pending.port ?? '?'}`,
    );
    try {
      const result = await actions.launch(pending.app, pending.executable, { force: true });
      if (result?.started) setPending(null);
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen={Boolean(pending)}
      onClose={() => {
        if (!busy) setPending(null);
      }}
      title="Porta em uso"
    >
      <Modal.Content>
        <InlineAlert variant="warning">{pending?.message}</InlineAlert>
        {pending?.port != null || pending?.processName || pending?.pid != null ? (
          <Modal.Hint>
            {[
              pending.port != null ? `Porta ${pending.port}` : null,
              pending.processName || null,
              pending.pid != null ? `PID ${pending.pid}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Modal.Hint>
        ) : null}
        {busy ? (
          <Modal.Text>
            A libertar a porta, instalar dependências se necessário e arrancar a app… Isto pode demorar.
          </Modal.Text>
        ) : null}
      </Modal.Content>
      <Modal.Footer>
        <Button type="button" disabled={busy} onClick={() => setPending(null)}>
          Cancelar
        </Button>
        <Button type="button" variant="secondary" disabled={busy} loading={busy} onClick={() => void confirmForce()}>
          Forçar inicialização
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
