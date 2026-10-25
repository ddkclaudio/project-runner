import styles from './FeedbackButton.module.css';

interface FeedbackButtonProps {
  onClick?: () => void;
}

export function FeedbackButton({ onClick }: FeedbackButtonProps) {
  return (
    <button
      type="button"
      className={styles.feedback}
      onClick={onClick}
      aria-label="Enviar feedback"
    >
      Feedback
    </button>
  );
}
