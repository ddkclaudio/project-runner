import { loggedInvoke as invoke } from '@/lib/activity-log';

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
  /** URL local enquanto corre (ex. http://localhost:3000/react-gh-pages). */
  openUrl?: string | null;
  /** PID do processo (Task Manager) enquanto corre. */
  runningPid?: number | null;
  /** Nome do processo (ex. node.exe) enquanto corre. */
  runningProcessName?: string | null;
  /** A pasta instalada é um clone git. */
  gitClone?: boolean;
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
  deepseekApiToken: string;
  cloudflareApiToken: string;
  cloudflaredPath: string;
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

export type CloudflareMode = 'quick' | 'named';

export type CloudflareConfig = {
  mode: CloudflareMode;
  startWithApp: boolean;
  portOverride?: number | null;
  hostname?: string | null;
  tunnelName?: string | null;
};

export type HostnameClaim = {
  hostname: string;
  folderName: string;
  name: string;
  repository: string;
};

export type CloudflareView = {
  config: CloudflareConfig;
  effectivePort?: number | null;
  cloudflaredAvailable: boolean;
  cloudflaredPath: string;
  /** Caminho absoluto encontrado via where/which. */
  cloudflaredDetected?: string | null;
  hasApiToken: boolean;
  running: boolean;
  publicUrl?: string | null;
  pid?: number | null;
  mode?: CloudflareMode | null;
  /** Hostnames named já reservados por apps desta org. */
  hostnameClaims?: HostnameClaim[];
};

export type CloudflareSaveInput = {
  mode: CloudflareMode;
  startWithApp: boolean;
  portOverride?: number | null;
  hostname?: string | null;
  tunnelName?: string | null;
};

export type CloudflareZone = {
  id: string;
  name: string;
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
  /** Porta ocupada — pedir confirmação para matar o processo e relançar. */
  needsForce?: boolean;
  executables: string[];
  closeAfterLaunch: boolean;
  message: string;
  openUrl?: string | null;
  forcePort?: number | null;
  forcePid?: number | null;
  forceProcessName?: string | null;
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

export type CommunicationNode = {
  id: string;
  folderName: string;
  repository: string;
  name: string;
  x: number;
  y: number;
  /** O Run flow inicia esta app quando ela está parada. */
  alwaysOn: boolean;
};

export type CommunicationEdge = {
  id: string;
  source: string;
  target: string;
};

export type CommunicationsGraph = {
  nodes: CommunicationNode[];
  edges: CommunicationEdge[];
};

export function communicationsGet() {
  return invoke<CommunicationsGraph>('communications_get');
}

export function communicationsSave(graph: CommunicationsGraph) {
  return invoke<CommunicationsGraph>('communications_save', { graph });
}

export function communicationsOpenDir() {
  return invoke<void>('communications_open_dir');
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

export function appLaunch(repository: string, executable?: string, force = false) {
  return invoke<LaunchResult>('app_launch', {
    repository,
    executable: executable ?? null,
    force,
  });
}

export type StopResult = {
  tunnelStopped: boolean;
};

export function appStop(repository: string) {
  return invoke<StopResult>('app_stop', { repository });
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

export function appOpenLaunchfileDir(repository: string) {
  return invoke<void>('app_open_launchfile_dir', { repository });
}

export function appExecutables(repository: string) {
  return invoke<string[]>('app_executables', { repository });
}

export function appSetExecutable(repository: string, executable: string) {
  return invoke<void>('app_set_executable', { repository, executable });
}

export type LaunchFieldType = 'text' | 'number' | 'boolean' | 'url' | 'multiline';

export type LaunchField = {
  key: string;
  label: string;
  value: string;
  /** Tipo de input no formulário Executável. */
  fieldType?: LaunchFieldType | string;
};

export type LaunchConfigView = {
  runnerId: string;
  runnerLabel: string;
  configPath: string | null;
  relativePath: string | null;
  editable: boolean;
  fields: LaunchField[];
  raw: string;
  rawLanguage: string;
  canCreateManifest: boolean;
};

export type LaunchConfigSave = {
  fields?: LaunchField[];
  raw?: string;
  createManifest?: boolean;
};

export function appLaunchConfigGet(repository: string) {
  return invoke<LaunchConfigView>('app_launch_config_get', { repository });
}

export function appLaunchConfigSave(repository: string, input: LaunchConfigSave) {
  return invoke<LaunchConfigView>('app_launch_config_save', { repository, input });
}

export function appGenerateLaunchfile(repository: string) {
  return invoke<string>('app_generate_launchfile', { repository });
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

export function appCloudflareGet(repository: string) {
  return invoke<CloudflareView>('app_cloudflare_get', { repository });
}

export function appCloudflareSave(repository: string, input: CloudflareSaveInput) {
  return invoke<CloudflareView>('app_cloudflare_save', { repository, input });
}

export function appCloudflareStart(repository: string) {
  return invoke<CloudflareView>('app_cloudflare_start', { repository });
}

export function appCloudflareStop(repository: string) {
  return invoke<CloudflareView>('app_cloudflare_stop', { repository });
}

export function appCloudflareStatus(repository: string) {
  return invoke<CloudflareView>('app_cloudflare_status', { repository });
}

export function appCloudflareZones() {
  return invoke<CloudflareZone[]>('app_cloudflare_zones');
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

export type DataLocation = {
  current: string;
  default: string;
  customConfigured: boolean;
};

export type SetDataLocationResult = {
  current: string;
  restartRequired: boolean;
};

export function getDataLocation() {
  return invoke<DataLocation>('get_data_location');
}

export function setDataLocation(path: string) {
  return invoke<SetDataLocationResult>('set_data_location', { path });
}

export function launcherError(err: unknown): string {
  if (typeof err === 'string' && err.trim()) return err;
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Não foi possível concluir.';
}

/** Link da app: pasta (única). String sem `/` = pasta; com `/` = legado dono/nome. */
export function appHref(
  appOrRepo: string | { repository: string; folderName?: string | null },
  section = '',
) {
  if (typeof appOrRepo !== 'string') {
    const folder = appOrRepo.folderName?.trim();
    if (folder) {
      const base = `/app/${encodeURIComponent(folder)}`;
      return section ? `${base}/${section}` : base;
    }
    return appHref(appOrRepo.repository, section);
  }
  if (!appOrRepo.includes('/')) {
    const base = `/app/${encodeURIComponent(appOrRepo)}`;
    return section ? `${base}/${section}` : base;
  }
  const [owner, name] = appOrRepo.split('/');
  const base = `/apps/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  return section ? `${base}/${section}` : base;
}

export function statusLabel(status: string) {
  if (status === 'installed') return 'Instalada';
  if (status === 'update') return 'Atualização';
  return 'Por instalar';
}
