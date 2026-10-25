import { invoke } from '@tauri-apps/api/core';

export type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  activeOrgId?: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
  activeOrg?: {
    id: string;
    name: string;
    slug: string;
    role: string;
    isOwner: boolean;
  } | null;
};

export const SESSION_STORAGE_KEY = 'painel-session';

export function registerAccount(name: string, email: string, password: string) {
  return invoke<AuthSession>('register', { name, email, password });
}

export function loginAccount(email: string, password: string) {
  return invoke<AuthSession>('login', { email, password });
}

export function logoutAccount(token: string) {
  return invoke<void>('logout', { token });
}

export function currentAccount(token: string) {
  return invoke<AuthUser | null>('current_user', { token });
}

export function requestPasswordReset(email: string) {
  return invoke<{ code: string | null }>('forgot_password', { email });
}

export function confirmPasswordReset(email: string, code: string, password: string) {
  return invoke<void>('reset_password', { email, code, password });
}

export function authErrorMessage(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Não foi possível concluir. Tente novamente.';
}
