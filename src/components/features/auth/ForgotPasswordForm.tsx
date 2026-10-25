import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IconMail, IconArrowLeft, IconCircleCheck } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/auth-api';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthPage, AuthCard, BrandMark, InlineAlert, Input, Button } from '@/components/ui';
import styles from './auth.module.css';

export function ForgotPasswordForm() {
  const { requestReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const normalized = email.trim().toLowerCase();
    try {
      const nextCode = await requestReset(normalized);
      setCode(nextCode);
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const resetHref = code
    ? `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}&code=${encodeURIComponent(code)}`
    : '/reset-password';

  return (
    <AuthPage>
      <AuthCard>
        <AuthCard.Header
          brand={<BrandMark badge={null} size="md" />}
          title="Recuperar senha"
          subtitle="Informe o e-mail da conta. O código aparece nesta tela."
        />
        <AuthCard.Body as="form" onSubmit={handleSubmit}>
          {error ? <AuthErrorAlert error={{ message: error }} /> : null}
          {sent ? (
            <>
              <InlineAlert variant="success" icon={<IconCircleCheck size={18} style={{ flexShrink: 0 }} />}>
                Se existir uma conta para <strong>{email.trim()}</strong>, o código de redefinição
                fica disponível abaixo. Não há envio de e-mail neste app.
              </InlineAlert>
              {code ? (
                <div className={styles.devLinkBox}>
                  <p className={styles.devLinkTitle}>Código local</p>
                  <p className={styles.devLinkHint}>
                    Use <strong>{code}</strong> para definir uma nova senha. O código expira em 15
                    minutos.
                  </p>
                  <Link to={resetHref} className={styles.devLink}>
                    Abrir redefinição
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.field}>
              <Input
                type="email"
                label="E-mail"
                leftIcon={<IconMail size={15} />}
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          )}
          {!sent ? (
            <Button type="submit" variant="secondary" size="lg" loading={loading} style={{ width: '100%' }}>
              Gerar código
            </Button>
          ) : null}
          <AuthCard.Hint>
            <Link to="/login" className={styles.backLink}>
              <IconArrowLeft size={13} />
              Voltar ao login
            </Link>
          </AuthCard.Hint>
        </AuthCard.Body>
      </AuthCard>
    </AuthPage>
  );
}
