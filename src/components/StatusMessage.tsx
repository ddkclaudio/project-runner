import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './StatusMessage.module.css';

const MARKER = /\[\[(\/settings\/[^[\]]+)\]\]/;

/** Texto de erro do launcher. `[[/settings/...]]` vira link no nome antes dos dois pontos. */
export function StatusMessage({ text }: { text: string }) {
  const parts = text.split(MARKER);
  const nodes: ReactNode[] = [parts[0]];
  for (let index = 1; index < parts.length; index += 2) {
    const href = parts[index];
    const body = parts[index + 1] ?? '';
    const colon = body.indexOf(':');
    if (colon > 0) {
      nodes.push(
        <Link key={`${href}:${index}`} className={styles.link} to={href}>
          {body.slice(0, colon)}
        </Link>,
      );
      nodes.push(body.slice(colon));
    } else {
      nodes.push(
        <Link key={`${href}:${index}`} className={styles.link} to={href}>
          {body}
        </Link>,
      );
    }
  }
  return <>{nodes}</>;
}
