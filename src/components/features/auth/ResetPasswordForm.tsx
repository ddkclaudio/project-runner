import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { IconArrowLeft, IconCircleCheck } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/auth-api';
import { AuthPage, AuthCard, BrandMark, InlineAlert, Input, PasswordInput, Button } from '@/components/ui';
import styles from './auth.module.css';

export function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !code.trim()) {
      setError('Informe o e-mail e o código gerado em Recuperar senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPage>
      <AuthCard>
        <AuthCard.Header
          brand={<BrandMark badge={null} size="md" />}
          title="Nova senha"
          subtitle="Use o código mostrado na tela de recuperação."
        />
        <AuthCard.Body as="form" onSubmit={handleSubmit}>
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
          {done ? (
            <InlineAlert variant="success" icon={<IconCircleCheck size={18} style={{ flexShrink: 0 }} />}>
              Senha atualizada. A abrir o login…
            </InlineAlert>
          ) : (
            <>
              <div className={styles.field}>
                <Input
                  type="email"
                  spellCheck={false}
                  label="E-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>
              <div className={styles.field}>
                <Input
                  label="Código"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoComplete="one-time-code"
                  required
                  disabled={loading}
                />
              </div>
              <div className={styles.field}>
                <PasswordInput
                  label="Nova senha"
                  toggleStyle="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
              </div>
              <div className={styles.field}>
                <PasswordInput
                  label="Confirmar senha"
                  toggleStyle="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
              </div>
              {(password.trim() || confirm.trim()) ? (
                <Button type="submit" variant="secondary" size="lg" loading={loading} style={{ width: '100%' }}>
                  Salvar
                </Button>
              ) : null}
            </>
          )}
          <AuthCard.Hint>
            <Link to="/forgot-password" className={styles.backLink}>
              <IconArrowLeft size={13} />
              Gerar outro código
            </Link>
          </AuthCard.Hint>
        </AuthCard.Body>
      </AuthCard>
    </AuthPage>
  );
}
