'use client';

import { cx } from '@/utils';
import styles from './AiSummaryText.module.css';

const SUMMARY_BULLET_RE = /^\s*[-*•]\s+(.+)$/;
const SUMMARY_NUMBERED_RE = /^\s*\d+[.)]\s+(.+)$/;

type SummaryBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] };

/** Separa parágrafos e linhas de lista (`- item` / `1. item`). */
function parseSummaryBlocks(text: string): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (list?.items.length) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    }
    list = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const bullet = raw.match(SUMMARY_BULLET_RE);
    const numbered = raw.match(SUMMARY_NUMBERED_RE);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const item = (bullet?.[1] ?? numbered?.[1] ?? '').trim();
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [item] };
      } else {
        list.items.push(item);
      }
      continue;
    }
    flushList();
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const last = blocks[blocks.length - 1];
    if (last?.type === 'p') last.text += `\n${trimmed}`;
    else blocks.push({ type: 'p', text: trimmed });
  }
  flushList();
  return blocks;
}

export function AiSummaryText({ text, className }: { text: string; className?: string }) {
  const blocks = parseSummaryBlocks(text);
  return (
    <div className={cx(styles.text, className)}>
      {blocks.map((block, i) =>
        block.type === 'list' ? (
          block.ordered ? (
            <ol key={i} className={styles.list}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          ) : (
            <ul key={i} className={styles.list}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )
        ) : (
          <p key={i} className={styles.paragraph}>
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
