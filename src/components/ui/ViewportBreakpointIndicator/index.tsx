'use client';

import { useEffect, useState } from 'react';
import {
  IconDeviceMobile,
  IconDeviceTablet,
  IconDeviceDesktop,
  IconDeviceDesktopAnalytics,
} from '@tabler/icons-react';
import styles from './ViewportBreakpointIndicator.module.css';

type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'ultrawide';

const BREAKPOINTS: {
  id: Breakpoint;
  label: string;
  min: number;
  Icon: typeof IconDeviceMobile;
}[] = [
  { id: 'mobile', label: 'Mobile', min: 0, Icon: IconDeviceMobile },
  { id: 'tablet', label: 'Tablet', min: 768, Icon: IconDeviceTablet },
  { id: 'desktop', label: 'Desktop', min: 1100, Icon: IconDeviceDesktop },
  { id: 'ultrawide', label: 'Ultrawide', min: 1600, Icon: IconDeviceDesktopAnalytics },
];

function resolveBreakpoint(width: number): (typeof BREAKPOINTS)[number] {
  for (let i = BREAKPOINTS.length - 1; i >= 0; i--) {
    if (width >= BREAKPOINTS[i].min) return BREAKPOINTS[i];
  }
  return BREAKPOINTS[0];
}

export function ViewportBreakpointIndicator() {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      setWidth(window.innerWidth);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (width === null) return null;

  const bp = resolveBreakpoint(width);
  const Icon = bp.Icon;

  return (
    <div className={styles.stack} aria-live="polite">
      <div
        className={styles.badge}
        aria-label={`Viewport: ${bp.label}, ${width} pixels`}
      >
        <Icon size={14} className={styles.icon} aria-hidden="true" />
        <span className={styles.label}>{bp.label}</span>
        <span className={styles.width}>{width}px</span>
      </div>
    </div>
  );
}
