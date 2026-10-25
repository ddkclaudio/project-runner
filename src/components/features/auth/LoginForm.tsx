import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/auth-api';
import { AuthErrorAlert } from './AuthErrorAlert';
import {
  AuthPage,
  AuthCard,
  BrandMark,
  Divider,
  Input,
  PasswordInput,
  Button,
  TextLink,
} from '@/components/ui';
import styles from './auth.module.css';

export function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
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
          brand={<BrandMark />}
          title="Entrar na sua conta"
          subtitle="Acesse o painel."
        />
        <AuthCard.Body as="form" onSubmit={handleSubmit}>
          {error ? <AuthErrorAlert error={{ message: error }} /> : null}
          <div className={styles.field}>
            <Input
              id="login-email"
              type="email"
              spellCheck={false}
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
          <div className={styles.field}>
            <PasswordInput
              id="login-password"
              label="Senha"
              toggleStyle="text"
              labelAction={<Link to="/forgot-password">Esqueci minha senha</Link>}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>
          <div className={styles.submitWrapper}>
            <Button type="submit" variant="secondary" size="lg" loading={loading} style={{ width: '100%' }}>
              Entrar
            </Button>
          </div>
          <Divider>ou</Divider>
          <AuthCard.Hint>
            Não tem uma conta?{' '}
            <TextLink variant="primary" href="/register">
              Criar conta
            </TextLink>
          </AuthCard.Hint>
        </AuthCard.Body>
      </AuthCard>
    </AuthPage>
  );
}
