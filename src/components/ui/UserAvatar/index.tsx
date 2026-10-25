'use client';

import { useEffect, useMemo, useState } from 'react';
import { cx } from '@/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './UserAvatar.module.css';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

const HUGE_DATA_URL_CHARS = 80_000;

interface UserAvatarProps {
  /** URL da foto. Sem valor / erro → iniciais. */
  src?: string | null;
  alt: string;
  size?: UserAvatarSize;
  className?: string;
}

function initialsFrom(alt: string): string {
  const parts = alt.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function isAssetsCdnUrl(_src: string): boolean {
  return false;
}

/** CloudFront e data/blob precisam de referer padrão; no-referrer só em fotos externas. */
function referrerPolicyFor(src: string): 'no-referrer' | undefined {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return undefined;
  if (isAssetsCdnUrl(src)) return undefined;
  return 'no-referrer';
}

/**
 * Skeleton no carregamento; foto visível no onLoad (sem opacity na img:
 * isso ficava preso após soft-nav). Data URLs enormes são compactadas.
 */
export function UserAvatar({ src, alt, size = 'sm', className }: UserAvatarProps) {
  const px = size === 'sm' ? 26 : size === 'md' ? 36 : 72;
  const trimmedSrc = src?.trim() || '';
  const initials = useMemo(() => initialsFrom(alt), [alt]);
  const [displaySrc, setDisplaySrc] = useState(trimmedSrc);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBroken(false);
    setLoaded(false);

    if (!trimmedSrc) {
      setDisplaySrc('');
      return;
    }

    if (trimmedSrc.startsWith('data:') && trimmedSrc.length > HUGE_DATA_URL_CHARS) {
      setDisplaySrc(trimmedSrc);
      return () => {
        cancelled = true;
      };
    }

    setDisplaySrc(trimmedSrc);
    return () => {
      cancelled = true;
    };
  }, [trimmedSrc]);

  const policy = referrerPolicyFor(displaySrc);
  const showPhoto = Boolean(displaySrc) && !broken;
  const showSkeleton = Boolean(trimmedSrc) && !broken && !loaded;

  return (
    <span
      className={cx(styles.root, styles[size], className)}
      style={{ width: px, height: px }}
      role="img"
      aria-label={alt}
      aria-busy={showSkeleton || undefined}
    >
      {showPhoto ? (
        <img
          key={displaySrc}
          src={displaySrc}
          alt=""
          width={px}
          height={px}
          className={styles.photo}
          {...(policy ? { referrerPolicy: policy } : {})}
          decoding="async"
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) {
              queueMicrotask(() => setLoaded(true));
            }
          }}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0) setLoaded(true);
          }}
          onError={() => setBroken(true)}
        />
      ) : null}
      {showSkeleton ? (
        <span className={styles.skeleton} aria-hidden="true">
          <Skeleton shape="round" width={px} height={px} />
        </span>
      ) : null}
      {!trimmedSrc || broken ? (
        <span className={styles.initialsFace} aria-hidden="true">
          {initials}
        </span>
      ) : null}
    </span>
  );
}
