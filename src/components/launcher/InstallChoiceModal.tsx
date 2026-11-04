import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ChoiceList, useLibraryMutations } from '@/components/launcher/LibraryCard';
import type { AppView } from '@/lib/launcher-api';

export type InstallChoiceDetail = {
  app: AppView;
  assets: string[];
  warning?: string | null;
  confirm: boolean;
  tag?: string | null;
};

export type ExeChoiceDetail = {
  app: AppView;
  executables: string[];
};

declare global {
  interface WindowEventMap {
    'painel-install-choice': CustomEvent<InstallChoiceDetail>;
    'painel-exe-choice': CustomEvent<ExeChoiceDetail>;
  }
}

export function InstallChoiceModal() {
  const actions = useLibraryMutations();
  const [pending, setPending] = useState<InstallChoiceDetail | null>(null);
  const [exe, setExe] = useState<ExeChoiceDetail | null>(null);

  useEffect(() => {
    function onInstall(event: CustomEvent<InstallChoiceDetail>) {
      setPending(event.detail);
    }
    function onExe(event: CustomEvent<ExeChoiceDetail>) {
      setExe(event.detail);
    }
    window.addEventListener('painel-install-choice', onInstall);
    window.addEventListener('painel-exe-choice', onExe);
    return () => {
      window.removeEventListener('painel-install-choice', onInstall);
      window.removeEventListener('painel-exe-choice', onExe);
    };
  }, []);

  return (
    <>
      <Modal
        isOpen={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending?.confirm ? 'Confirmar instalação' : 'Escolher ficheiro'}
      >
        <Modal.Content>
          {pending?.warning ? <InlineAlert variant="warning">{pending.warning}</InlineAlert> : null}
          <Modal.Text>
            {pending?.confirm ? 'Confirme para continuar a instalação.' : 'Há mais do que um ficheiro compatível.'}
          </Modal.Text>
          <ChoiceList
            options={pending?.assets ?? []}
            onPick={(asset) => {
              const current = pending;
              setPending(null);
              if (current) {
                void actions.install(current.app, {
                  assetName: asset,
                  tag: current.tag ?? undefined,
                  confirmWine: true,
                });
              }
            }}
          />
        </Modal.Content>
      </Modal>
      <Modal isOpen={Boolean(exe)} onClose={() => setExe(null)} title="Escolher executável">
        <Modal.Content>
          <ChoiceList
            options={exe?.executables ?? []}
            onPick={(executable) => {
              const current = exe;
              setExe(null);
              if (current) void actions.launch(current.app, executable);
            }}
          />
        </Modal.Content>
      </Modal>
    </>
  );
}
