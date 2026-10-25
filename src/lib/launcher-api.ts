import { invoke } from '@tauri-apps/api/core';

export type AppEntry = {
  name: string;
  repository: string;
  folderName: string;
  installPath?: string | null;
  appIconUrl?: string | null;
  preferredVersion?: string | null;
  skippedUpdateVersion?: string | null;
};

export type AppView = AppEntry & {
  configuredInstallPath?: string | null;
  iconPath?: string | null;
  installedVersion?: string | null;
  remoteVersion?: string | null;
  changelog?: string | null;
  status: 'not_installed' | 'installed' | 'update' | string;
  lastPlayed?: string | null;
  manuallyHidden: boolean;
  filterHidden: boolean;
  selectedExecutable?: string | null;
  running?: boolean;
  selectedBranch?: string | null;
};

export type LibrarySnapshot = {
  apps: AppView[];
  sortBy: string;
  useGrid: boolean;
  continueRepository?: string | null;
  installedOnly: boolean;
  dataDir: string;
};

export type PublicSettings = {
  appsPath: string;
  githubApiToken: string;
  platform: string;
  sortBy: string;
  useGridView: boolean;
  startFullscreen: boolean;
  closeAfterLaunch: boolean;
  backgroundImagePath: string;
  launcherMusicPath: string;
  musicVolume: number;
  backgroundOpacity: number;
  enableGamepadInput: boolean;
  linuxWindowsLaunchCommand: string;
  appListRepository: string;
  painelUpdateRepository: string;
  dataDir: string;
  appVersion: string;
};

export type InstallResult = {
  needsChoice: boolean;
  needsConfirm: boolean;
  assets: string[];
  warning?: string | null;
  message: string;
  installedVersion?: string | null;
};

export type LaunchResult = {
  started: boolean;
  needsChoice: boolean;
  executables: string[];
  closeAfterLaunch: boolean;
  message: string;
};

export type ReleaseInfo = {
  tag: string;
  name: string;
  published: string;
  body: string;
};

export type CatalogPayload = {
  repository: string;
  version: string;
  fromCache: boolean;
  groups: { name: string; apps: AppEntry[] }[];
};

export type UpdateStatus = {
  configured: boolean;
  updateAvailable: boolean;
  currentVersion: string;
  remoteVersion?: string | null;
  message: string;
};

export function launcherBoot() {
  return invoke<PublicSettings>('launcher_boot');
}

export function libraryList() {
  return invoke<LibrarySnapshot>('library_list');
}

export function libraryRefresh(force = false) {
  return invoke<LibrarySnapshot>('library_refresh', { force });
}

export function librarySave(entry: AppEntry, previous?: string) {
  return invoke<AppEntry>('library_save', { entry, previous: previous ?? null });
}

export function libraryRemove(repository: string) {
  return invoke<void>('library_remove', { repository });
}

export function libraryImport(raw: string) {
  return invoke<number>('library_import', { raw });
}

export function libraryExport() {
  return invoke<string>('library_export');
}

export function libraryValidate() {
  return invoke<number>('library_validate');
}

export function librarySetSort(sortBy: string) {
  return invoke<LibrarySnapshot>('library_set_sort', { sortBy });
}

export function librarySetFilter(installedOnly: boolean) {
  return invoke<LibrarySnapshot>('library_set_filter', { installedOnly });
}

export function appHide(repository: string, hidden: boolean) {
  return invoke<LibrarySnapshot>('app_hide', { repository, hidden });
}

export function appDetail(repository: string) {
  return invoke<AppView>('app_detail', { repository });
}

export function appInstall(repository: string, options?: { assetName?: string; tag?: string; confirmWine?: boolean }) {
  return invoke<InstallResult>('app_install', {
    repository,
    assetName: options?.assetName ?? null,
    tag: options?.tag ?? null,
    confirmWine: options?.confirmWine ?? false,
  });
}

export function appLaunch(repository: string, executable?: string) {
  return invoke<LaunchResult>('app_launch', { repository, executable: executable ?? null });
}

export function appStop(repository: string) {
  return invoke<void>('app_stop', { repository });
}

export function appBranches(repository: string) {
  return invoke<string[]>('app_branches', { repository });
}

export function appSetBranch(repository: string, branch: string) {
  return invoke<AppView>('app_set_branch', { repository, branch });
}

export function appOpenFolder(repository: string) {
  return invoke<void>('app_open_folder', { repository });
}

export function appExecutables(repository: string) {
  return invoke<string[]>('app_executables', { repository });
}

export function appSetExecutable(repository: string, executable: string) {
  return invoke<void>('app_set_executable', { repository, executable });
}

export function appSkipUpdate(repository: string, version?: string | null) {
  return invoke<AppView>('app_skip_update', { repository, version: version ?? null });
}

export function appDeleteInstall(repository: string) {
  return invoke<void>('app_delete_install', { repository });
}

export function appLocate(repository: string, path: string) {
  return invoke<void>('app_locate', { repository, path });
}

export function appSetIcon(repository: string, path: string) {
  return invoke<string>('app_set_icon', { repository, path });
}

export function appClearIcon(repository: string) {
  return invoke<void>('app_clear_icon', { repository });
}

export function appReleases(repository: string) {
  return invoke<ReleaseInfo[]>('app_releases', { repository });
}

export function appChangelog(repository: string) {
  return invoke<string>('app_changelog', { repository });
}

export function appShortcutDesktop(repository: string) {
  return invoke<string>('app_shortcut_desktop', { repository });
}

export function appShortcutSteam(repository: string) {
  return invoke<string>('app_shortcut_steam', { repository });
}

export function settingsGet() {
  return invoke<PublicSettings>('settings_get');
}

export function settingsSave(input: Omit<PublicSettings, 'dataDir' | 'appVersion'>) {
  return invoke<PublicSettings>('settings_save', { input });
}

export function catalogLoad() {
  return invoke<CatalogPayload>('catalog_load');
}

export function catalogAdd(entry: AppEntry) {
  return invoke<AppEntry>('catalog_add', { entry });
}

export function launcherCheckUpdate(force = false) {
  return invoke<UpdateStatus>('launcher_check_update', { force });
}

export function launcherApplyUpdate() {
  return invoke<string>('launcher_apply_update');
}

export function windowClose() {
  return invoke<void>('window_close');
}

export function launcherError(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Não foi possível concluir.';
}

export function appHref(repository: string, section = '') {
  const [owner, name] = repository.split('/');
  const base = `/apps/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  return section ? `${base}/${section}` : base;
}

export function statusLabel(status: string) {
  if (status === 'installed') return 'Instalada';
  if (status === 'update') return 'Atualização';
  return 'Por instalar';
}
