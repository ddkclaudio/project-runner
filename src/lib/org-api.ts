import { loggedInvoke as invoke } from '@/lib/activity-log';
import { SESSION_STORAGE_KEY } from '@/lib/auth-api';

export type PublicOrg = {
  id: string;
  name: string;
  slug: string;
  role: string;
  isOwner: boolean;
};

export type PublicMember = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
};

export type PublicInvite = {
  id: string;
  orgId: string;
  email: string;
  role: string;
  code: string;
  expires: number;
};

function tokenOrThrow(): string {
  try {
    const token = localStorage.getItem(SESSION_STORAGE_KEY);
    if (token) return token;
  } catch {
    /* ignore */
  }
  throw new Error('Sessão inválida.');
}

export function listOrgs() {
  return invoke<PublicOrg[]>('list_orgs', { token: tokenOrThrow() });
}

export function currentOrg() {
  return invoke<PublicOrg | null>('current_org', { token: tokenOrThrow() });
}

export function createOrg(name: string) {
  return invoke<PublicOrg>('create_org', { token: tokenOrThrow(), name });
}

export function setActiveOrg(orgId: string) {
  return invoke<PublicOrg>('set_active_org', { token: tokenOrThrow(), orgId });
}

export function listMembers(orgId: string) {
  return invoke<PublicMember[]>('list_members', { token: tokenOrThrow(), orgId });
}

export function listInvites(orgId: string) {
  return invoke<PublicInvite[]>('list_invites', { token: tokenOrThrow(), orgId });
}

export function inviteMember(orgId: string, email: string, role = 'member') {
  return invoke<PublicInvite>('invite_member', { token: tokenOrThrow(), orgId, email, role });
}

export function acceptInvite(code: string) {
  return invoke<PublicOrg>('accept_invite', { token: tokenOrThrow(), code });
}

export function revokeInvite(orgId: string, inviteId: string) {
  return invoke<void>('revoke_invite', { token: tokenOrThrow(), orgId, inviteId });
}

export function removeMember(orgId: string, targetUserId: string) {
  return invoke<void>('remove_member', { token: tokenOrThrow(), orgId, targetUserId });
}

export function updateMemberRole(orgId: string, targetUserId: string, role: string) {
  return invoke<void>('update_member_role', { token: tokenOrThrow(), orgId, targetUserId, role });
}
