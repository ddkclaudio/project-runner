'use client';

import { useId } from 'react';
import { cx } from '@/utils';
import { ROZTTA_R_MAIN, ROZTTA_R_MASK_INNER, ROZTTA_R_STEM } from './rozttaPaths';
import styles from './RozttaLogo.module.css';

interface RozttaLogoProps {
  /** Lado do SVG em px. Default 20. */
  size?: number;
  className?: string;
  /** Se true, inclui halo suave do estado idle. Default true. */
  halo?: boolean;
  title?: string;
}

/**
 * Marca R Roztta (estado idle), logo do site.
 */
export function RozttaLogo({ size = 20, className, halo = true, title }: RozttaLogoProps) {
  const uid = useId().replace(/:/g, '');
  const maskId = `rozttaMask-${uid}`;
  const haloFilterId = `rozttaHalo-${uid}`;

  return (
    <svg
      className={cx(styles.logo, className)}
      width={size}
      height={size}
      viewBox="0 0 288 288"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="288" height="288">
          <g dangerouslySetInnerHTML={{ __html: ROZTTA_R_MASK_INNER }} />
        </mask>
        {halo ? (
          <filter id={haloFilterId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        ) : null}
      </defs>

      {halo ? (
        <path
          fill="currentColor"
          filter={`url(#${haloFilterId})`}
          opacity="0.22"
          d={ROZTTA_R_MAIN}
        />
      ) : null}

      <g mask={`url(#${maskId})`}>
        <path fill="currentColor" d={ROZTTA_R_MAIN} />
        <path fill="currentColor" opacity="0.7" d={ROZTTA_R_STEM} />
      </g>
    </svg>
  );
}
