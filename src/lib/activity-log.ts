import { invoke } from '@tauri-apps/api/core';

type Level = 'INFO' | 'WARN' | 'ERROR';

function write(level: Level, source: string, message: string, detail?: string) {
  void invoke('log_write', {
    level,
    source,
    message,
    detail: detail ?? null,
  }).catch(() => undefined);
}

export function logInfo(source: string, message: string, detail?: string) {
  write('INFO', source, message, detail);
}

export function logWarn(source: string, message: string, detail?: string) {
  write('WARN', source, message, detail);
}

export function logError(source: string, message: string, detail?: string) {
  write('ERROR', source, message, detail);
}

export function logPath() {
  return invoke<string>('log_path');
}

export function logOpenFolder() {
  return invoke<string>('log_open_folder');
}

function errDetail(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.stack || err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Comandos de polling / leitura frequente — só erros. */
const QUIET_OK = new Set([
  'library_list',
  'app_detail',
  'settings_get',
  'launcher_boot',
  'current_user',
  'list_orgs',
  'current_org',
  'list_members',
  'list_invites',
  'get_data_location',
  'app_branches',
  'app_releases',
  'app_changelog',
  'app_launch_config_get',
  'app_executables',
  'app_cloudflare_get',
  'app_cloudflare_status',
  'log_write',
  'log_path',
  'log_open_folder',
]);

/** invoke com registo de sucesso/erro (não regista log_write para evitar loop). */
export async function loggedInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const result = await invoke<T>(cmd, args);
    if (!QUIET_OK.has(cmd)) {
      const summary =
        result && typeof result === 'object' && result !== null
          ? summarizeResult(cmd, result as Record<string, unknown>)
          : 'ok';
      logInfo('invoke', `${cmd} ${summary}`);
    }
    return result;
  } catch (err) {
    logError('invoke', `${cmd} failed`, errDetail(err));
    throw err;
  }
}

function summarizeResult(cmd: string, result: Record<string, unknown>): string {
  if (cmd === 'app_launch') {
    if (result.needsForce) return `needs_force port=${result.forcePort ?? '?'} pid=${result.forcePid ?? '?'}`;
    if (result.started) return 'started';
    if (result.needsChoice) return 'needs_choice';
    return 'ok';
  }
  if (cmd === 'app_cloudflare_start' || cmd === 'app_cloudflare_stop') {
    const url = typeof result.publicUrl === 'string' ? result.publicUrl : '';
    const running = result.running === true ? 'running' : 'stopped';
    return url ? `${running} ${url}` : running;
  }
  if (typeof result.message === 'string' && result.message.trim()) {
    return result.message.slice(0, 120);
  }
  return 'ok';
}

let handlersInstalled = false;

/** Erros globais da UI → painel.log */
export function installActivityLogHandlers() {
  if (handlersInstalled || typeof window === 'undefined') return;
  handlersInstalled = true;

  window.addEventListener('error', (event) => {
    const stack = event.error instanceof Error ? event.error.stack : undefined;
    logError('ui', event.message || 'window.onerror', stack || `${event.filename}:${event.lineno}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error) {
      logError('ui', `unhandledrejection: ${reason.message}`, reason.stack);
    } else {
      logError('ui', 'unhandledrejection', errDetail(reason));
    }
  });

  logInfo('ui', 'activity log handlers installed');
}
