'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  IconAlertTriangle,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconBrain,
  IconCheck,
  IconClock,
  IconCopy,
  IconMessages,
  IconPhone,
  IconSparkles,
  IconUser,
  IconWorld,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { integrationRoutes } from '@/lib/integration-routes';
import { queryKeys } from '@/lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationItem } from './notifications';
import { cx } from '@/utils';
import styles from './NotificationDetail.module.css';

function modalIcon(tone?: NotificationItem['tone']) {
  if (tone === 'success') return <IconCheck size={16} aria-hidden="true" />;
  if (tone === 'info') return <IconSparkles size={16} aria-hidden="true" />;
  return <IconAlertTriangle size={16} aria-hidden="true" />;
}

function toneBorder(tone?: NotificationItem['tone']): string | undefined {
  if (tone === 'danger') return 'var(--status-danger, #e5484d)';
  if (tone === 'warning') return 'var(--status-warning, #f5a524)';
  if (tone === 'success') return 'var(--status-success, #30a46c)';
  if (tone === 'info') return 'var(--status-info, #3b82f6)';
  return undefined;
}

function toneHeroClass(tone?: NotificationItem['tone']): string {
  if (tone === 'danger') return styles.toneDanger;
  if (tone === 'warning') return styles.toneWarning;
  if (tone === 'success') return styles.toneSuccess;
  return styles.toneInfo;
}

function statusLabel(tone?: NotificationItem['tone']): string {
  if (tone === 'success') return 'Concluído';
  if (tone === 'danger') return 'Falhou';
  if (tone === 'warning') return 'Atenção';
  return 'Em andamento';
}

function riskLabel(level?: NotificationItem['riskLevel']): string {
  if (level === 'critical') return 'Crítico';
  if (level === 'high') return 'Alto';
  if (level === 'medium') return 'Médio';
  if (level === 'low') return 'Baixo';
  return 'Indefinido';
}

function riskToneClass(level?: NotificationItem['riskLevel']): string {
  if (level === 'critical') return styles.toneCritical;
  if (level === 'high') return styles.toneDanger;
  if (level === 'medium') return styles.toneWarning;
  return styles.toneInfo;
}

function networkLabel(network?: NotificationItem['network']): string {
  if (network === 'whatsapp') return 'WhatsApp';
  if (network === 'instagram') return 'Instagram';
  if (network === 'other') return 'Outra';
  return '—';
}

function NetworkIcon({ network }: { network?: NotificationItem['network'] }) {
  if (network === 'whatsapp') return <IconBrandWhatsapp size={14} aria-hidden="true" />;
  if (network === 'instagram') return <IconBrandInstagram size={14} aria-hidden="true" />;
  return <IconWorld size={14} aria-hidden="true" />;
}

function formatPhone(phone?: string | null): string {
  if (!phone?.trim()) return '—';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();
  return phone.trim().startsWith('+') ? phone.trim() : `+${digits}`;
}

function CopyFieldButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const canCopy = Boolean(value.trim()) && value.trim() !== '—';

  const onCopy = useCallback(async () => {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }, [canCopy, value]);

  return (
    <button
      type="button"
      className={cx(styles.copyBtn, copied && styles.copyBtnDone)}
      aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
      title={copied ? 'Copiado' : `Copiar ${label}`}
      disabled={!canCopy}
      onClick={(e) => {
        e.stopPropagation();
        void onCopy();
      }}
    >
      {copied ? (
        <IconCheck size={13} aria-hidden="true" />
      ) : (
        <IconCopy size={13} aria-hidden="true" />
      )}
    </button>
  );
}

function MetaRow({
  icon,
  label,
  children,
  copyValue,
  copyLabel,
}: {
  icon: ReactNode;
  label: string;
  children: React.ReactNode;
  copyValue: string;
  copyLabel: string;
}) {
  return (
    <div className={styles.metaRow}>
      <div className={styles.metaLeft}>
        <span className={styles.metaIcon}>{icon}</span>
        <div className={styles.metaText}>
          <span className={styles.metaLabel}>{label}</span>
          <div className={styles.metaValue}>{children}</div>
        </div>
      </div>
      <CopyFieldButton value={copyValue} label={copyLabel} />
    </div>
  );
}

export type AlertDetailModalProps = {
  item: NotificationItem | null;
  onClose: () => void;
  /** Destino do botão "Abrir conversa". Se omitido, usa rota padrão de Integrações. */
  conversationHref?: string | null;
  /** Destino do botão "Abrir análise" (página do membro). */
  analysisHref?: string | null;
  /** Destino do botão "Abrir sugestões" (job IBEN). */
  suggestionsHref?: string | null;
};

export function defaultConversationHref(item: NotificationItem): string | null {
  if (!item.accountId || !item.chatId) return null;
  return integrationRoutes.chat(item.accountId, item.chatId);
}

/** Modal com dossiê / análise do alerta + ação explícita para abrir a conversa. */
export function AlertDetailModal({
  item,
  onClose,
  conversationHref,
  analysisHref,
  suggestionsHref,
}: AlertDetailModalProps) {
  const router = useRouter();
  const qc = useQueryClient();

  const dossier = useMemo(() => {
    if (!item) return '';
    return item.description?.trim() || item.detail?.trim() || '';
  }, [item]);

  const snippet = item?.body?.trim() || '';
  const contactLabel = item?.contactName?.trim() || item?.chatTitle?.trim() || '—';
  const phoneLabel = formatPhone(item?.contactPhone);
  const chatHref =
    conversationHref !== undefined ? conversationHref : item ? defaultConversationHref(item) : null;
  const risk = riskLabel(item?.riskLevel);

  const openConversation = useCallback(() => {
    if (!chatHref) return;
    onClose();
    router.push(chatHref);
  }, [chatHref, onClose, router]);

  const openAnalysis = useCallback(() => {
    if (!analysisHref) return;
    onClose();
    router.push(analysisHref);
  }, [analysisHref, onClose, router]);

  const openSuggestions = useCallback(() => {
    if (!suggestionsHref) return;
    const projectId = item?.projectId?.trim();
    if (projectId) {
      void qc.invalidateQueries({ queryKey: queryKeys.recommendations.byProject(projectId) });
    }
    void qc.invalidateQueries({ queryKey: ['recommendations'] });
    onClose();
    router.push(suggestionsHref);
  }, [item?.projectId, onClose, qc, router, suggestionsHref]);

  const isChatAlert = Boolean(item?.accountId && item?.chatId);
  const showRiskHero = Boolean(item?.riskLevel);
  const showActions = Boolean(analysisHref || chatHref || suggestionsHref);

  return (
    <Modal
      isOpen={!!item}
      onClose={onClose}
      title={item?.title ?? 'Alerta'}
      icon={modalIcon(item?.tone)}
      leftBorderColor={toneBorder(item?.tone)}
      maxWidth={560}
    >
      {item && (
        <>
          <Modal.Content className={styles.detail}>
            {showRiskHero ? (
              <div className={cx(styles.hero, riskToneClass(item.riskLevel))}>
                <div className={styles.heroTop}>
                  <span className={styles.heroEyebrow}>Nível de risco</span>
                  <CopyFieldButton value={risk} label="risco" />
                </div>
                <div className={styles.heroRow}>
                  <span className={styles.heroBadge}>{risk}</span>
                  {item.time ? (
                    <span className={styles.heroTime}>
                      <IconClock size={13} aria-hidden="true" />
                      {item.time}
                    </span>
                  ) : null}
                </div>
                {snippet ? <p className={styles.heroSnippet}>{snippet}</p> : null}
              </div>
            ) : (
              <div className={cx(styles.hero, toneHeroClass(item.tone))}>
                <div className={styles.heroTop}>
                  <span className={cx(styles.heroBadge, styles.heroStatus)}>
                    {statusLabel(item.tone)}
                  </span>
                  {item.time ? (
                    <span className={styles.heroTime}>
                      <IconClock size={13} aria-hidden="true" />
                      {item.time}
                    </span>
                  ) : null}
                </div>
                {snippet ? <p className={styles.heroSnippet}>{snippet}</p> : null}
              </div>
            )}

            {isChatAlert ? (
              <div className={styles.metaCard}>
                <MetaRow
                  icon={<NetworkIcon network={item.network} />}
                  label="Rede"
                  copyValue={networkLabel(item.network)}
                  copyLabel="rede"
                >
                  {networkLabel(item.network)}
                </MetaRow>
                <MetaRow
                  icon={<IconUser size={14} aria-hidden="true" />}
                  label="Contato"
                  copyValue={contactLabel === '—' ? '' : contactLabel}
                  copyLabel="contato"
                >
                  {contactLabel}
                </MetaRow>
                <MetaRow
                  icon={<IconPhone size={14} aria-hidden="true" />}
                  label="Telefone"
                  copyValue={phoneLabel === '—' ? '' : phoneLabel}
                  copyLabel="telefone"
                >
                  {phoneLabel}
                </MetaRow>
                {item.time ? (
                  <MetaRow
                    icon={<IconClock size={14} aria-hidden="true" />}
                    label="Quando"
                    copyValue={item.time}
                    copyLabel="quando"
                  >
                    {item.time}
                  </MetaRow>
                ) : null}
              </div>
            ) : null}

            {isChatAlert && dossier ? (
              <section className={styles.dossier}>
                <div className={styles.dossierHeader}>
                  <div>
                    <h3 className={styles.dossierTitle}>Análise da conversa</h3>
                    <p className={styles.dossierHint}>
                      Relatório técnico para conferência no histórico
                    </p>
                  </div>
                  <CopyFieldButton value={dossier} label="analise" />
                </div>
                <div className={styles.body}>
                  <div className={styles.markdown}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{dossier}</ReactMarkdown>
                  </div>
                </div>
              </section>
            ) : null}

            {isChatAlert && snippet && !dossier ? (
              <div className={styles.snippetOnly}>
                <div className={styles.dossierHeader}>
                  <h3 className={styles.dossierTitle}>Resumo</h3>
                  <CopyFieldButton value={snippet} label="resumo" />
                </div>
              </div>
            ) : null}
          </Modal.Content>
          {showActions ? (
            <Modal.Footer>
              {chatHref ? (
                <Button
                  variant="secondary"
                  leftIcon={<IconMessages size={14} />}
                  onClick={openConversation}
                >
                  Abrir conversa
                </Button>
              ) : null}
              {analysisHref ? (
                <Button
                  variant="secondary"
                  leftIcon={<IconAlertTriangle size={14} />}
                  onClick={openAnalysis}
                >
                  Abrir análise
                </Button>
              ) : null}
              {suggestionsHref ? (
                <Button
                  variant="primary"
                  leftIcon={<IconBrain size={14} />}
                  onClick={openSuggestions}
                >
                  Abrir sugestões
                </Button>
              ) : null}
            </Modal.Footer>
          ) : null}
        </>
      )}
    </Modal>
  );
}
