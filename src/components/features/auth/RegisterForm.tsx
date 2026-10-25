import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconLock, IconMail, IconUser } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { authErrorMessage } from '@/lib/auth-api';
import { AuthErrorAlert } from './AuthErrorAlert';
import { AuthPage, AuthCard, BrandMark, Input, PasswordInput, Button, TextLink } from '@/components/ui';
import styles from './auth.module.css';

export function RegisterForm() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
      await signUp(name, email, password);
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
          title="Criar conta"
          subtitle="Preencha os dados abaixo para acessar o painel."
        />
        <AuthCard.Body as="form" onSubmit={handleSubmit}>
          {error ? <AuthErrorAlert error={{ message: error }} /> : null}
          <div className={styles.field}>
            <Input
              label="Nome"
              leftIcon={<IconUser size={15} />}
              placeholder="O seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              disabled={loading}
            />
          </div>
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
          <div className={styles.field}>
            <PasswordInput
              label="Senha"
              leftIcon={<IconLock size={15} />}
              placeholder="Mínimo 6 caracteres"
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
              leftIcon={<IconLock size={15} />}
              placeholder="Repita a senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              disabled={loading}
              error={confirm.length > 0 && password !== confirm ? 'As senhas não coincidem.' : undefined}
            />
          </div>
          <Button type="submit" variant="secondary" size="lg" loading={loading} style={{ width: '100%', marginTop: 8 }}>
            Criar conta
          </Button>
          <AuthCard.Hint>
            Já tem uma conta?{' '}
            <TextLink variant="primary" href="/login">
              Entrar
            </TextLink>
          </AuthCard.Hint>
        </AuthCard.Body>
      </AuthCard>
    </AuthPage>
  );
}
