import { InlineAlert } from '@/components/ui';
import styles from './auth.module.css';

export function AuthErrorAlert({ error }: { error: { message: string; hint?: string } }) {
  return (
    <InlineAlert variant="error">
      <div className={styles.authErrorBody}>
        <p className={styles.authErrorMessage}>{error.message}</p>
        {error.hint ? <p className={styles.authErrorHint}>{error.hint}</p> : null}
      </div>
    </InlineAlert>
  );
}
