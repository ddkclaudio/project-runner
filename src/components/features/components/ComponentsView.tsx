'use client';
import { PageShell } from '@/components/ui/PageShell';
import { PageLoading } from '@/components/ui/PageLoading';
import { Skeleton } from '@/components/ui/Skeleton';
import { SectionSidebar } from '@/components/ui/SectionSidebar';
import { ComingSoon } from '@/components/ui/ComingSoon';

import { useState } from 'react';
import {
  IconPlus,
  IconTrash,
  IconArrowRight,
  IconSearch,
  IconSparkles,
  IconAlertTriangle,
  IconHistory,
  IconBuilding,
  IconAffiliate,
  IconPencil,
  IconUser,
  IconStar,
  IconLock,
  IconBulb,
  IconSettings,
  IconRobot,
} from '@tabler/icons-react';
import { appName, chatNavLabel } from '@/lib/brand';
import {
  Button,
  Input,
  DateInput,
  PasswordInput,
  Textarea,
  MarkdownEditor,
  Checkbox,
  Toggle,
  Slider,
  Select,
  type SelectOption,
  FilterDropdown,
  FormCard,
  FormRow,
  AuthCard,
  BrandMark,
  RozttaLogo,
  InlineAlert,
  useToast,
  Divider,
  Autocomplete,
  PricingTooltip,
  TextLink,
  SwitcherDropdown,
  SwitcherPanel,
  type SwitcherItem,
  Modal,
  ItemCard,
  DataTable,
  type TableColumn,
  RowActions,
  GridView,
  ViewToolbar,
  type ViewMode,
  StatusBadge,
  TabFilter,
  type TabFilterItem,
  NavMenuItem,
  UserAvatar,
  DropdownMenuRoot,
  DropdownMenuPanel,
  DropdownMenuSeparator,
  DropdownMenuSectionLabel,
  DropdownMenuHeader,
  FeedbackButton,
  TopbarActionButton,
  Topbar,
  TopbarBrand,
  TopbarSeparator,
  TopbarCrumb,
  TopbarMenuButton,
  TopbarConnectButton,
  TopbarRightControls,
  TopbarMetaPill,
  TopbarBranchLabel,
  TopbarBreadcrumb,
  AlertButton,
  SideDrawer,
  SideDrawerIconButton,
  NotificationsMenu,
  NotificationsDrawer,
  DEMO_NOTIFICATIONS,
  TimezonePicker,
  LogoutMenuItem,
  SearchableListPanel,
  CommandPalette,
  ProfileMenu,
  ThemeModeGrid,
  ServiceRow,
  DangerZone,
  Kbd,
  PreferenceToggleRow,
  PieChart,
} from '@/components/ui';
import { FlowCanvasCatalogDemo } from '@/components/ui/FlowCanvas';
import { ThemeSelector } from '@/components/ui/ThemeSelector';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import type { Theme } from '@/hooks/useThemePreference';
import styles from './ComponentsView.module.css';

const BASIC_OPTIONS: SelectOption[] = [
  { value: 'opcao1', label: 'Opção 1' },
  { value: 'opcao2', label: 'Opção 2' },
  { value: 'opcao3', label: 'Opção 3' },
];

const PREFIX_OPTIONS: SelectOption[] = [
  { value: 'br', label: 'Brasil', prefix: '🇧🇷' },
  { value: 'us', label: 'Estados Unidos', prefix: '🇺🇸' },
  { value: 'es', label: 'Espanha', prefix: '🇪🇸' },
];

const GROUP_OPTIONS: SelectOption[] = [
  { value: 'pdf', label: 'Relatório PDF', group: 'Exportar' },
  { value: 'xlsx', label: 'Planilha Excel', group: 'Exportar' },
  { value: 'csv', label: 'Arquivo CSV', group: 'Exportar' },
  { value: 'view', label: 'Visualizar em tela', group: 'Ações' },
  { value: 'print', label: 'Imprimir', group: 'Ações' },
];

const DISABLED_OPTIONS: SelectOption[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo (Indisponível)', disabled: true },
];

const SWITCHER_DEMO_ITEMS: SwitcherItem[] = [
  {
    id: 'org-1',
    label: 'Construtora Alpha',
    leading: <IconBuilding size={14} aria-hidden="true" />,
  },
  { id: 'org-2', label: 'Engenharia Beta', leading: <IconBuilding size={14} aria-hidden="true" /> },
  { id: 'org-3', label: 'Obras Gamma', leading: <IconBuilding size={14} aria-hidden="true" /> },
];

interface DemoItem {
  id: string;
  name: string;
  role: string;
  status: 'ativo' | 'inativo';
}
const DEMO_ROWS: DemoItem[] = [
  { id: '1', name: 'Ana Silva', role: 'Engenheira', status: 'ativo' },
  { id: '2', name: 'Bruno Costa', role: 'Mestre de obras', status: 'ativo' },
  { id: '3', name: 'Carla Matos', role: 'Arquiteta', status: 'inativo' },
];

function ToastCatalogDemo() {
  const toast = useToast();
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Toast</h2>
      <p className={styles.sectionDesc}>
        Notificações no canto inferior direito via <code>useToast()</code>. Somem sozinhas em 5s
        (success / error / info / warning).
      </p>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Disparar</span>
        <div className={styles.field} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => toast.success('Alterações salvas com sucesso.')}
          >
            Success
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => toast.error('Falha ao salvar. Tente novamente.')}
          >
            Error
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info('Sincronização em segundo plano.', { title: 'Info' })}
          >
            Info
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast.warning('Verba próxima do limite.', {
                title: 'Atenção',
                description: 'Revise os pedidos pendentes.',
              })
            }
          >
            Warning
          </Button>
        </div>
      </div>
    </section>
  );
}

interface ComponentsViewProps {
  secao?: string;
}

export function ComponentsView({ secao = '' }: ComponentsViewProps) {
  const [nomeObra, setNomeObra] = useState('');
  const [busca, setBusca] = useState('');
  const [dataDemo, setDataDemo] = useState('');
  const [comAcao, setComAcao] = useState('');
  const [comErro, setComErro] = useState('');
  const [dirtyDemo, setDirtyDemo] = useState('Valor original');
  const dirtyDemoOriginal = 'Valor original';

  // Password input state
  const [senha, setSenha] = useState('');

  // Textarea state
  const [textoBasico, setTextoBasico] = useState('');
  const [textoComAcao, setTextoComAcao] = useState('');
  const [textoComErro, setTextoComErro] = useState('');
  const [textoDirty, setTextoDirty] = useState('Texto original');
  const [mdDemo, setMdDemo] = useState(
    '## Instruções para a IA\n\n- Priorize **segurança**\n- Responda em português\n',
  );
  const textoDirtyOriginal = 'Texto original';

  // New components demo state
  const [tableQuery, setTableQuery] = useState('');
  const [gridQuery, setGridQuery] = useState('');
  const [demoView, setDemoView] = useState<ViewMode>('list');
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sideDrawerOpen, setSideDrawerOpen] = useState(false);

  // Checkboxes
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(true);
  const [check3, setCheck3] = useState(false);

  // Selects
  const [selectBasic, setSelectBasic] = useState('opcao1');
  const [selectPrefix, setSelectPrefix] = useState('br');
  const [selectGroup, setSelectGroup] = useState('pdf');
  const [selectDisabled, setSelectDisabled] = useState('ativo');
  const [selectDirty, setSelectDirty] = useState('opcao1');
  const selectDirtyOriginal = 'opcao1';

  // Toggles
  const [toggle1, setToggle1] = useState(false);
  const [toggle2, setToggle2] = useState(true);

  // Sliders
  const [slider1, setSlider1] = useState(50);
  const [slider2, setSlider2] = useState(80);

  // Filters
  const [activeFilterDemo, setActiveFilterDemo] = useState<string | null>(null);
  const [filterSectionStatus, setFilterSectionStatus] = useState<string | null>(null);
  const [filterSectionSort, setFilterSectionSort] = useState('name');
  const [autocompleteDemo, setAutocompleteDemo] = useState('');
  const [autocompletePicked, setAutocompletePicked] = useState('');
  const AUTOCOMPLETE_DEMO_OPTIONS = [
    { id: '1', label: 'Av. Paulista, 1000 - São Paulo, SP' },
    { id: '2', label: 'R. Oscar Freire, 900 - São Paulo, SP' },
    { id: '3', label: 'Av. Atlântica, 1702 - Rio de Janeiro, RJ' },
  ];

  // Switcher
  const [activeSwitcherDemo, setActiveSwitcherDemo] = useState('org-1');
  const switcherDemoSelected = SWITCHER_DEMO_ITEMS.find((i) => i.id === activeSwitcherDemo);

  // TabFilter
  const [tabFilterDemo, setTabFilterDemo] = useState('todos');
  const TAB_FILTER_DEMO: TabFilterItem[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'abertos', label: 'Abertos' },
    { value: 'andamento', label: 'Em andamento' },
    { value: 'fechados', label: 'Fechados', badge: 3 },
  ];

  // Modals
  const [modalDemoOpen, setModalDemoOpen] = useState(false);

  // New header components
  const [searchablePanelQuery, setSearchablePanelQuery] = useState('');
  const [dropdownMenuOpen, setDropdownMenuOpen] = useState(false);
  const [tzPickerValue, setTzPickerValue] = useState('America/Sao_Paulo');
  const [themeModeDemo, setThemeModeDemo] = useState<Theme>('dark');
  const [prefToggleDemo, setPrefToggleDemo] = useState(true);

  const showBotoes = secao === '' || secao === 'botoes';
  const showInputs = secao === '' || secao === 'inputs';
  const showTextareas = secao === '' || secao === 'textareas';
  const showMarkdownEditor = secao === '' || secao === 'markdown-editor';
  const showCheckboxes = secao === '' || secao === 'checkboxes';
  const showSelects = secao === '' || secao === 'selects';
  const showToggles = secao === '' || secao === 'toggles';
  const showSliders = secao === '' || secao === 'sliders';
  const showFiltros = secao === '' || secao === 'filtros';
  const showFormCard = secao === '' || secao === 'form-card';
  const showPageShell = secao === '' || secao === 'page-shell';
  const showPageLoading = secao === '' || secao === 'page-loading';
  const showSkeleton = secao === '' || secao === 'skeleton';
  const showSectionSidebar = secao === '' || secao === 'section-sidebar';
  const showComingSoon = secao === '' || secao === 'coming-soon';
  const showAuthCard = secao === '' || secao === 'auth-card';
  const showBrandMark = secao === '' || secao === 'brand-mark';
  const showRozttaLogo = secao === '' || secao === 'roztta-logo';
  const showInlineAlert = secao === '' || secao === 'inline-alert';
  const showToast = secao === '' || secao === 'toast';
  const showDivider = secao === '' || secao === 'divider';
  const showAutocomplete = secao === '' || secao === 'autocomplete';
  const showPricingTooltip = secao === '' || secao === 'pricing-tooltip';
  const showTextLink = secao === '' || secao === 'text-link';
  const showSwitchers = secao === '' || secao === 'switchers';
  const showModais = secao === '' || secao === 'modais';
  const showDataTable = secao === '' || secao === 'tabelas';
  const showRowActions = secao === '' || secao === 'row-actions';
  const showGridView = secao === '' || secao === 'grid';
  const showItemCard = secao === '' || secao === 'item-card';
  const showViewToolbar = secao === '' || secao === 'toolbar';
  const showStatusBadges = secao === '' || secao === 'status-badges';
  const showTabFilter = secao === '' || secao === 'tab-filter';
  const showNavMenuItem = secao === '' || secao === 'nav-menu-item';
  const showDropdownMenu = secao === '' || secao === 'dropdown-menu';
  const showTopbarActionButton = secao === '' || secao === 'topbar-action-button';
  const showTopbar = secao === '' || secao === 'topbar';
  const showAlertButton = secao === '' || secao === 'alert-button';
  const showNotificationsDrawer = secao === '' || secao === 'notifications-drawer';
  const showSideDrawer = secao === '' || secao === 'side-drawer';
  const showFlowCanvas = secao === '' || secao === 'flow-canvas';
  const showThemeSelector = secao === '' || secao === 'theme-selector';
  const showThemeModeGrid = secao === '' || secao === 'theme-mode-grid';
  const showTimezonePicker = secao === '' || secao === 'timezone-picker';
  const showServiceRow = secao === '' || secao === 'service-row';
  const showDangerZone = secao === '' || secao === 'danger-zone';
  const showKbd = secao === '' || secao === 'kbd';
  const showPreferenceToggleRow = secao === '' || secao === 'preference-toggle-row';
  const showSearchableListPanel = secao === '' || secao === 'searchable-list-panel';
  const showCommandPalette = secao === '' || secao === 'command-palette';
  const showProfileMenu = secao === '' || secao === 'profile-menu';
  const showPieChart = secao === '' || secao === 'pie-chart';

  const filteredDemoRows = DEMO_ROWS.filter(
    (r) =>
      !tableQuery ||
      r.name.toLowerCase().includes(tableQuery.toLowerCase()) ||
      r.role.toLowerCase().includes(tableQuery.toLowerCase()),
  );

  const TABLE_COLUMNS: TableColumn<DemoItem>[] = [
    {
      key: 'name',
      label: 'NOME',
      sortable: true,
      render: (row) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '13px' }}>
            {row.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.role}</div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'CARGO',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{row.role}</span>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      sortable: true,
      render: (row) => (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background:
              row.status === 'ativo'
                ? 'color-mix(in srgb, var(--brand-green) 12%, transparent)'
                : 'var(--bg-muted)',
            color: row.status === 'ativo' ? 'var(--brand-green)' : 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}
        >
          {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
  ];

  return (
    <PageShell>
      <PageShell.Heading subtitle="Galeria de componentes reutilizáveis do sistema.">
        Componentes
      </PageShell.Heading>

      {showBotoes && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Botões</h2>
          <p className={styles.sectionDesc}>
            Variações de estilo, tamanho e estado do componente Button.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Variantes</span>
            <Button variant="primary">Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Perigo</Button>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Tamanhos</span>
            <Button size="sm">Pequeno</Button>
            <Button size="md">Médio</Button>
            <Button size="lg">Grande</Button>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com ícone</span>
            <Button variant="primary" leftIcon={<IconPlus size={14} />}>
              Adicionar
            </Button>
            <Button variant="secondary" rightIcon={<IconArrowRight size={14} />}>
              Avançar
            </Button>
            <Button variant="danger" leftIcon={<IconTrash size={14} />}>
              Excluir
            </Button>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estados</span>
            <Button variant="primary" loading>
              Carregando
            </Button>
            <Button variant="primary" disabled>
              Desabilitado
            </Button>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>FeedbackButton</span>
            <FeedbackButton />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Botão de texto usado no topbar
            </span>
          </div>
        </section>
      )}

      {showInputs && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Inputs</h2>
          <p className={styles.sectionDesc}>
            Variações de <code>Input</code>, <code>DateInput</code> (data em dd/mm/aaaa) e{' '}
            <code>PasswordInput</code> (senha com toggle, sem reimplementar o toggle na mão).
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Variantes</span>
            <div className={styles.field}>
              <Input
                type="text"
                variant="default"
                placeholder="Padrão"
                value={nomeObra}
                onChange={(e) => setNomeObra(e.target.value)}
                aria-label="Input padrão"
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <Input
                type="text"
                variant="ghost"
                placeholder="Ghost"
                aria-label="Input ghost"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Tamanhos</span>
            <div className={styles.field}>
              <Input
                type="text"
                inputSize="sm"
                placeholder="Pequeno"
                aria-label="Input pequeno"
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <Input
                type="text"
                inputSize="md"
                placeholder="Médio"
                aria-label="Input médio"
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <Input
                type="text"
                inputSize="lg"
                placeholder="Grande"
                aria-label="Input grande"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com ícone</span>
            <div className={styles.field}>
              <Input
                type="text"
                leftIcon={<IconSearch size={15} />}
                placeholder="Buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com limpar</span>
            <div className={styles.field}>
              <Input
                type="text"
                leftIcon={<IconSearch size={15} />}
                placeholder="Buscar..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                clearable
                onClear={() => setBusca('')}
                aria-label="Buscar com limpar"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Ação à direita</span>
            <div className={styles.field}>
              <Input
                type="text"
                placeholder="Descreva e peça sugestão de IA..."
                value={comAcao}
                onChange={(e) => setComAcao(e.target.value)}
                rightIcon={<IconSparkles size={15} />}
                onRightIconClick={() => setComAcao('Sugestão gerada pela IA ✨')}
                rightIconLabel="Sugestão de IA"
                aria-label="Campo com sugestão de IA"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com label</span>
            <div className={styles.field}>
              <Input
                type="text"
                label="Nome da obra"
                hint="Como a obra será identificada no sistema."
                placeholder="ex: Residencial Park View"
                aria-label="Nome da obra"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Data (pt-BR)</span>
            <div className={styles.field}>
              <DateInput
                value={dataDemo}
                onChange={setDataDemo}
                placeholder="dd/mm/aaaa"
                aria-label="Data em padrão brasileiro"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estados</span>
            <div className={styles.field}>
              <Input
                type="text"
                error="O nome da obra é obrigatório."
                placeholder="Com erro"
                value={comErro}
                onChange={(e) => setComErro(e.target.value)}
                aria-label="Input com erro"
                autoComplete="off"
              />
            </div>
            <div className={styles.field}>
              <Input
                type="text"
                disabled
                placeholder="Desabilitado"
                aria-label="Input desabilitado"
                autoComplete="off"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estado editado (isDirty)</span>
            <div className={styles.field}>
              <Input
                type="text"
                value={dirtyDemo}
                onChange={(e) => setDirtyDemo(e.target.value)}
                isDirty={dirtyDemo !== dirtyDemoOriginal}
                placeholder="Edite para ver a borda ambar"
                aria-label="Input isDirty demo"
                autoComplete="off"
              />
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                {dirtyDemo !== dirtyDemoOriginal
                  ? 'Campo editado \u2014 borda ambar ativa'
                  : 'Edite o campo acima para ativar o isDirty'}
              </p>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>PasswordInput</span>
            <div className={styles.field}>
              <PasswordInput
                label="Senha"
                leftIcon={<IconLock size={15} />}
                placeholder="Digite sua senha..."
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                hint="Especialização de Input com toggle mostrar/ocultar."
                autoComplete="current-password"
              />
            </div>
            <div className={styles.field}>
              <PasswordInput
                label="Senha"
                toggleStyle="text"
                labelAction={
                  <a href="#demo-forgot" onClick={(e) => e.preventDefault()}>
                    Esqueci minha senha
                  </a>
                }
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
        </section>
      )}

      {showTextareas && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Textareas</h2>
          <p className={styles.sectionDesc}>
            Variações de estilo, tamanho e estado do componente Textarea, mesmas funcionalidades do
            Input.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Variantes</span>
            <div className={styles.field}>
              <Textarea
                variant="default"
                placeholder="Padrão"
                value={textoBasico}
                onChange={(e) => setTextoBasico(e.target.value)}
                aria-label="Textarea padrão"
              />
            </div>
            <div className={styles.field}>
              <Textarea variant="ghost" placeholder="Ghost" aria-label="Textarea ghost" />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Tamanhos</span>
            <div className={styles.field}>
              <Textarea textareaSize="sm" placeholder="Pequeno" aria-label="Textarea pequeno" />
            </div>
            <div className={styles.field}>
              <Textarea textareaSize="md" placeholder="Médio" aria-label="Textarea médio" />
            </div>
            <div className={styles.field}>
              <Textarea textareaSize="lg" placeholder="Grande" aria-label="Textarea grande" />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com limpar</span>
            <div className={styles.field}>
              <Textarea
                placeholder="Digite algo para limpar..."
                value={textoBasico}
                onChange={(e) => setTextoBasico(e.target.value)}
                clearable
                onClear={() => setTextoBasico('')}
                aria-label="Textarea com limpar"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Ação de IA</span>
            <div className={styles.field}>
              <Textarea
                placeholder="Descreva e peça sugestão de IA..."
                value={textoComAcao}
                onChange={(e) => setTextoComAcao(e.target.value)}
                rightIcon={<IconSparkles size={15} />}
                onRightIconClick={() =>
                  setTextoComAcao(
                    'Sugestão gerada pela IA ✨\n\nAqui está o texto sugerido pelo modelo com base no contexto fornecido.',
                  )
                }
                rightIconLabel="Sugestão de IA"
                aria-label="Textarea com sugestão de IA"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com label</span>
            <div className={styles.field}>
              <Textarea
                label="Descrição da obra"
                hint="Detalhe o escopo, localização e características principais."
                placeholder="ex: Construção de residência unifamiliar com 3 quartos..."
                aria-label="Descrição da obra"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estados</span>
            <div className={styles.field}>
              <Textarea
                error="A descrição é obrigatória."
                placeholder="Com erro"
                value={textoComErro}
                onChange={(e) => setTextoComErro(e.target.value)}
                aria-label="Textarea com erro"
              />
            </div>
            <div className={styles.field}>
              <Textarea disabled placeholder="Desabilitado" aria-label="Textarea desabilitado" />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estado editado (isDirty)</span>
            <div className={styles.field}>
              <Textarea
                value={textoDirty}
                onChange={(e) => setTextoDirty(e.target.value)}
                isDirty={textoDirty !== textoDirtyOriginal}
                placeholder="Edite para ver a borda ambar"
                aria-label="Textarea isDirty demo"
              />
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                {textoDirty !== textoDirtyOriginal
                  ? 'Campo editado, borda âmbar ativa'
                  : 'Edite o texto acima para ativar o isDirty'}
              </p>
            </div>
          </div>
        </section>
      )}

      {showMarkdownEditor && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>MarkdownEditor</h2>
          <p className={styles.sectionDesc}>
            Componente único: toolbar + área de conteúdo WYSIWYG (Markdown). Temas claro/escuro,
            tipografia do {appName()}. Uso: org-settings e nova organização.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Editor completo</span>
            <div className={styles.field} style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
              <MarkdownEditor
                value={mdDemo}
                onChange={setMdDemo}
                aria-label="Demo MarkdownEditor"
                placeholder="Escreva instruções em Markdown…"
                minHeight={260}
              />
            </div>
          </div>
        </section>
      )}

      {showCheckboxes && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Checkboxes</h2>
          <p className={styles.sectionDesc}>Variações de estado e uso do componente Checkbox.</p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estados básicos</span>
            <div className={styles.field} style={{ display: 'flex', gap: '20px' }}>
              <Checkbox checked={check1} onChange={setCheck1}>
                {check1 ? 'Selecionado' : 'Não selecionado'}
              </Checkbox>
              <Checkbox checked={check2} onChange={setCheck2}>
                Padrão Selecionado
              </Checkbox>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com ação externa</span>
            <div
              className={styles.field}
              style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}
            >
              <Checkbox checked={check3} onChange={setCheck3}>
                Aceito os termos de uso
              </Checkbox>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Status do aceite: <strong>{check3 ? 'Aceito ✓' : 'Pendente'}</strong>
              </p>
            </div>
          </div>
        </section>
      )}

      {showSelects && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Selects</h2>
          <p className={styles.sectionDesc}>
            Variações de estilo, agrupamento e prefixos do componente Select.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Padrão</span>
            <div className={styles.field} style={{ maxWidth: '240px' }}>
              <Select
                value={selectBasic}
                onChange={setSelectBasic}
                options={BASIC_OPTIONS}
                placeholder="Selecione uma opção"
                aria-label="Select padrão"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com prefixos</span>
            <div className={styles.field} style={{ maxWidth: '240px' }}>
              <Select
                value={selectPrefix}
                onChange={setSelectPrefix}
                options={PREFIX_OPTIONS}
                placeholder="Selecione um país"
                aria-label="Select com prefixo"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Agrupados</span>
            <div className={styles.field} style={{ maxWidth: '240px' }}>
              <Select
                value={selectGroup}
                onChange={setSelectGroup}
                options={GROUP_OPTIONS}
                placeholder="Selecione uma ação"
                aria-label="Select agrupado"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Itens desativados</span>
            <div className={styles.field} style={{ maxWidth: '240px' }}>
              <Select
                value={selectDisabled}
                onChange={setSelectDisabled}
                options={DISABLED_OPTIONS}
                placeholder="Selecione o estado"
                aria-label="Select com item desativado"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estado editado (isDirty)</span>
            <div className={styles.field} style={{ maxWidth: '240px' }}>
              <Select
                value={selectDirty}
                onChange={setSelectDirty}
                options={BASIC_OPTIONS}
                isDirty={selectDirty !== selectDirtyOriginal}
                aria-label="Select isDirty demo"
              />
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                {selectDirty !== selectDirtyOriginal
                  ? 'Campo editado, borda âmbar ativa'
                  : 'Mude a opção acima para ativar o isDirty'}
              </p>
            </div>
          </div>
        </section>
      )}

      {showToggles && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Toggles</h2>
          <p className={styles.sectionDesc}>
            Botão de alternância (switch) para ligar/desligar opções.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Estados básicos</span>
            <div
              className={styles.field}
              style={{ display: 'flex', gap: '24px', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Toggle checked={toggle1} onChange={setToggle1} aria-label="Toggle 1" />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {toggle1 ? 'Ativado' : 'Desativado'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Toggle checked={toggle2} onChange={setToggle2} aria-label="Toggle 2" />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Padrão Ativado
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {showSliders && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sliders</h2>
          <p className={styles.sectionDesc}>
            Controle deslizante para seleção de valores numéricos contínuos.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Padrão</span>
            <div className={styles.field}>
              <Slider
                value={slider1}
                onChange={setSlider1}
                min={0}
                max={100}
                step={1}
                aria-label="Slider padrão"
              />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Passo de 5 em 5</span>
            <div className={styles.field}>
              <Slider
                value={slider2}
                onChange={setSlider2}
                min={0}
                max={100}
                step={5}
                aria-label="Slider passo 5"
              />
            </div>
          </div>
        </section>
      )}

      {showFiltros && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Filtros (FilterDropdown)</h2>
          <p className={styles.sectionDesc}>
            Botão com menu dropdown para filtros. Suporta lista simples ou <code>sections</code>{' '}
            (ex.: status + ordenação no mesmo ícone).
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Simples</span>
            <div
              className={styles.field}
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <FilterDropdown
                value={activeFilterDemo}
                onChange={setActiveFilterDemo}
                options={[
                  {
                    value: 'pendente',
                    label: 'Pendente',
                    icon: <IconAlertTriangle size={13} aria-hidden="true" />,
                    badge: 5,
                  },
                  {
                    value: 'sucesso',
                    label: 'Sucesso',
                    icon: <IconSparkles size={13} aria-hidden="true" />,
                    badge: 12,
                  },
                  {
                    value: 'historico',
                    label: 'Histórico',
                    icon: <IconHistory size={13} aria-hidden="true" />,
                    badge: 0,
                  },
                ]}
                aria-label="Filtro interativo"
              />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Filtro ativo: <strong>{activeFilterDemo ?? 'Nenhum'}</strong>
              </span>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Com seções</span>
            <div
              className={styles.field}
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <FilterDropdown
                title="Filtros e ordenação"
                aria-label="Filtros e ordenação"
                active={filterSectionStatus !== null || filterSectionSort !== 'name'}
                sections={[
                  {
                    id: 'status',
                    title: 'Status',
                    value: filterSectionStatus,
                    onChange: setFilterSectionStatus,
                    options: [
                      { value: 'ativo', label: 'Ativo' },
                      { value: 'pendente', label: 'Pendente' },
                    ],
                  },
                  {
                    id: 'sort',
                    title: 'Ordenar por',
                    value: filterSectionSort,
                    onChange: (v) => setFilterSectionSort(v ?? 'name'),
                    options: [
                      { value: 'name', label: 'Nome' },
                      { value: 'createdAt', label: 'Criação' },
                    ],
                    clearable: false,
                  },
                ]}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Status: <strong>{filterSectionStatus ?? 'Todos'}</strong> · Ordenação:{' '}
                <strong>{filterSectionSort}</strong>
              </span>
            </div>
          </div>
        </section>
      )}

      {showFormCard && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>FormCard + FormRow</h2>
          <p className={styles.sectionDesc}>
            Shell de formulário com header, linhas label/controle, hint e footer. Usado em{' '}
            <code>/projects/new</code> e formulários de organização.
          </p>
          <FormCard
            onSubmit={(e) => e.preventDefault()}
            aria-label="Demo FormCard"
            style={{ maxWidth: 640 }}
          >
            <FormCard.Header
              title="Exemplo de formulário"
              subtitle="Cabeçalho, linhas e ações reutilizáveis."
            />
            <FormRow label="Nome">
              <Input placeholder="Nome do item" />
              <FormCard.Hint>Texto de apoio abaixo do campo.</FormCard.Hint>
            </FormRow>
            <FormRow label="Tipo" showErrorText error="Campo obrigatório (demo)">
              <Select
                value="a"
                onChange={() => undefined}
                options={[
                  { value: 'a', label: 'Opção A' },
                  { value: 'b', label: 'Opção B' },
                ]}
              />
            </FormRow>
            <FormCard.Footer
              left={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Resumo</span>}
              right={
                <>
                  <Button type="button" variant="secondary">
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary">
                    Salvar
                  </Button>
                </>
              }
            />
          </FormCard>
        </section>
      )}

      {showPageShell && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PageShell</h2>
          <p className={styles.sectionDesc}>
            Container de página. Variante padrão: <code>max-width</code> + centralização (
            <code>--page-max-width</code>). Variante <code>fluid</code>: largura total (chat,
            agentes). Usado em settings, listas, forms, dashboard e ComingSoon.
          </p>
          <div
            style={{
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              background: 'var(--bg-muted)',
            }}
          >
            <PageShell maxWidth={520}>
              <PageShell.Heading
                icon={<IconBulb size={18} aria-hidden="true" />}
                subtitle="Largura limitada e centralizada no main. Ícone opcional."
              >
                Título da página
              </PageShell.Heading>
              <PageShell.Section label="Exemplo">
                <div
                  style={{
                    padding: 16,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    fontSize: 'var(--font-md)',
                  }}
                >
                  Conteúdo dentro do shell (cards, forms, etc.).
                </div>
              </PageShell.Section>
            </PageShell>
          </div>
        </section>
      )}

      {showPageLoading && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PageLoading</h2>
          <p className={styles.sectionDesc}>
            Fallback de rota / <code>next/dynamic</code>. Por padrão usa skeleton só na área de
            dados (<code>Table</code> ou <code>Fluid</code>), sem título/subtítulo.{' '}
            <code>mode=&quot;spinner&quot;</code> para o indicador clássico.
          </p>
          <div
            style={{
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              minHeight: 160,
            }}
          >
            <PageLoading label="Carregando exemplo…" />
          </div>
        </section>
      )}

      {showSkeleton && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skeleton</h2>
          <p className={styles.sectionDesc}>
            Placeholders animados só na área de dados: <code>Table</code>, <code>Cards</code>,{' '}
            <code>StatusCards</code>, <code>Fluid</code> (canvas). Títulos, subtítulos e toolbars
            ficam reais, sem skeleton. Em listagens/canvas, preferir <code>DataTable loading</code>{' '}
            / <code>GridView loading</code> / <code>FlowCanvas loading</code> (já incluem{' '}
            <code>useMinimumLoading</code>).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p className={styles.sectionDesc} style={{ marginBottom: 8 }}>
                Primitivos
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Skeleton width={40} height={40} shape="round" />
                <Skeleton width={160} height={14} shape="pill" />
                <Skeleton width={220} height={48} />
              </div>
            </div>
            <div>
              <p className={styles.sectionDesc} style={{ marginBottom: 8 }}>
                Table
              </p>
              <Skeleton.Table rows={4} cols={4} />
            </div>
            <div>
              <p className={styles.sectionDesc} style={{ marginBottom: 8 }}>
                Cards
              </p>
              <Skeleton.Cards count={3} />
            </div>
            <div>
              <p className={styles.sectionDesc} style={{ marginBottom: 8 }}>
                StatusCards
              </p>
              <Skeleton.StatusCards count={6} />
            </div>
          </div>
        </section>
      )}

      {showSectionSidebar && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>SectionSidebar</h2>
          <p className={styles.sectionDesc}>
            Sidebar secundária de seções (grupos + links + badge). Usada em{' '}
            <code>/projects/components</code>, settings do projeto, sugestões-IA e memória. Os
            wrappers de layout só montam os dados; o visual é compartilhado.
          </p>
          <div
            style={{
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              maxWidth: 280,
              height: 320,
            }}
          >
            <SectionSidebar
              title="Exemplo"
              ariaLabel="Demo SectionSidebar"
              groups={[
                {
                  title: 'GRUPO A',
                  items: [
                    { label: 'Geral', href: '#geral', active: true },
                    { label: 'Infraestrutura', href: '#infra' },
                    { label: 'Add-ons', href: '#addons', badge: 'BETA' },
                  ],
                },
                {
                  title: 'GRUPO B',
                  items: [
                    { label: 'API externa', href: '#api', external: true },
                    { label: 'Uso', href: '#uso', external: true },
                  ],
                },
              ]}
            />
          </div>
        </section>
      )}

      {showComingSoon && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ComingSoon</h2>
          <p className={styles.sectionDesc}>
            Placeholder de funcionalidade em desenvolvimento. Já inclui <code>PageShell</code>.
            Usado em rotas como <code>/projects/team</code>, billing e subpáginas de settings ainda
            não implementadas.
          </p>
          <div
            style={{
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-muted)',
            }}
          >
            <ComingSoon
              title="Exemplo"
              description="Demo do estado Em Breve com título, descrição e link de retorno."
              backHref="/projects/components"
              backLabel="Voltar ao catálogo"
            />
          </div>
        </section>
      )}

      {showAuthCard && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>AuthPage + AuthCard</h2>
          <p className={styles.sectionDesc}>
            Shell centralizado com fundo radial e card elevado (sombra). Usado em{' '}
            <code>/login</code>, register e recuperação de senha. No catálogo o{' '}
            <code>AuthPage</code> aparece sem forçar 100vh.
          </p>
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--border-default)',
              overflow: 'hidden',
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--brand-green) 8%, transparent) 0%, transparent 60%), var(--bg-base)',
              padding: '32px 16px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <AuthCard maxWidth={360}>
              <AuthCard.Header
                brand={<BrandMark />}
                title="Entrar na sua conta"
                subtitle="Demo do card elevado com animação de entrada."
              />
              <AuthCard.Body as="form" onSubmit={(e) => e.preventDefault()}>
                <InlineAlert variant="error">Exemplo de alerta de erro.</InlineAlert>
                <div style={{ marginBottom: 14 }}>
                  <Input label="E-mail" placeholder="seu@email.com" aria-label="E-mail demo" />
                </div>
                <Button type="submit" variant="primary" size="lg" style={{ width: '100%' }}>
                  Entrar
                </Button>
                <Divider>ou</Divider>
                <AuthCard.Hint>
                  Não tem conta?{' '}
                  <TextLink variant="primary" href="/register">
                    Criar conta
                  </TextLink>
                </AuthCard.Hint>
              </AuthCard.Body>
            </AuthCard>
          </div>
        </section>
      )}

      {showBrandMark && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>BrandMark</h2>
          <p className={styles.sectionDesc}>
            Pill de marca ({appName()} / badge opcional). Variantes com ou sem badge.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>sm + badge</span>
            <BrandMark />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>md sem badge</span>
            <BrandMark size="md" badge={null} />
          </div>
        </section>
      )}

      {showRozttaLogo && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>RozttaLogo</h2>
          <p className={styles.sectionDesc}>
            Marca R (estado idle), logo do site, usado no header e waits.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>20 / 32 / 48</span>
            <RozttaLogo size={20} halo={false} />
            <RozttaLogo size={32} />
            <RozttaLogo size={48} />
          </div>
        </section>
      )}

      {showInlineAlert && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>InlineAlert</h2>
          <p className={styles.sectionDesc}>
            Alerta compacto para formulários. Variantes: error, success, warning, info.
          </p>
          <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InlineAlert variant="error">E-mail ou senha incorretos.</InlineAlert>
            <InlineAlert variant="success" icon={<IconSparkles size={16} />}>
              Operação concluída com sucesso.
            </InlineAlert>
            <InlineAlert variant="warning">Verifique a pasta de spam.</InlineAlert>
            <InlineAlert variant="info">Dica: use um e-mail corporativo.</InlineAlert>
          </div>
        </section>
      )}

      {showToast && <ToastCatalogDemo />}

      {showDivider && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Divider</h2>
          <p className={styles.sectionDesc}>
            Divisor horizontal com label opcional (ex.: “ou” no login).
          </p>
          <div style={{ maxWidth: 360 }}>
            <Divider>ou</Divider>
            <Divider />
          </div>
        </section>
      )}

      {showAutocomplete && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Autocomplete</h2>
          <p className={styles.sectionDesc}>
            Input com lista de sugestões em portal (clamp na viewport). Usado no endereço da obra.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Demo</span>
            <div className={styles.field} style={{ maxWidth: 420, width: '100%' }}>
              <Autocomplete
                value={autocompleteDemo}
                onChange={setAutocompleteDemo}
                options={AUTOCOMPLETE_DEMO_OPTIONS.filter((o) =>
                  o.label.toLowerCase().includes(autocompleteDemo.toLowerCase()),
                )}
                onSelect={(opt) => {
                  setAutocompleteDemo(opt.label);
                  setAutocompletePicked(opt.label);
                }}
                placeholder="Digite um endereço…"
                aria-label="Autocomplete demo"
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Selecionado: {autocompletePicked || '—'}
              </span>
            </div>
          </div>
        </section>
      )}

      {showPricingTooltip && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PricingTooltip</h2>
          <p className={styles.sectionDesc}>
            Ícone de info com painel de plano/funcionalidades. Passe <code>features</code> por
            props.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Hover / clique</span>
            <PricingTooltip
              planLabel="Essencial"
              planPrice={25}
              features={[
                { id: 'a', label: `${appName()} Copilot`, active: true },
                { id: 'b', label: `${appName()} Autopilot`, active: false },
                { id: 'c', label: 'Limite de IA', active: true, detail: 'Teto: $10/mês' },
              ]}
            />
          </div>
        </section>
      )}

      {showTextLink && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TextLink</h2>
          <p className={styles.sectionDesc}>
            Link inline de texto para hints e copy. Aceita <code>href</code> (Next Link ou externo)
            ou <code>onClick</code> (botão estilizado como link).
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>default</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Saiba mais sobre <TextLink href="/projects">os planos</TextLink> e{' '}
              <TextLink onClick={() => undefined}>como é feita a cobrança</TextLink>.
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>muted</span>
            <TextLink variant="muted" href="/projects">
              Link secundário
            </TextLink>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>primary</span>
            <TextLink variant="primary" href="/projects">
              Link com destaque
            </TextLink>
          </div>
        </section>
      )}

      {showSwitchers && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Switchers (SwitcherDropdown + SwitcherPanel)</h2>
          <p className={styles.sectionDesc}>
            Dropdown com busca, lista selecionável e ações no rodapé. Usado no header para alternar
            organizações, projetos, dashboards e revisões. Com <code>loading</code>, o trigger
            mostra skeleton e <strong>não abre</strong> o painel (tempo mínimo via{' '}
            <code>useMinimumLoading</code>). No mobile, o <code>SwitcherPanel</code> embedded
            skeletoniza a lista.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Dropdown</span>
            <div className={styles.switcherField}>
              <SwitcherDropdown
                aria-label="Trocar organização (demo)"
                panelLabel="Organization switcher demo"
                searchPlaceholder="Buscar organização..."
                searchAriaLabel="Buscar organizações"
                items={SWITCHER_DEMO_ITEMS}
                selectedId={activeSwitcherDemo}
                onSelect={setActiveSwitcherDemo}
                getEmptyMessage={(query) =>
                  query ? `Nenhum resultado para "${query}"` : 'Nenhuma organização ainda.'
                }
                trigger={
                  <>
                    <IconAffiliate size={14} aria-hidden="true" />
                    <span>{switcherDemoSelected?.label ?? 'Selecionar org'}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.5px',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1px 5px',
                      }}
                    >
                      PRO
                    </span>
                  </>
                }
                actions={[
                  {
                    label: 'Nova organização',
                    icon: <IconPlus size={14} aria-hidden="true" />,
                    onClick: () => {},
                  },
                  {
                    label: 'Ver todas as organizações',
                    icon: <IconArrowRight size={14} aria-hidden="true" />,
                    onClick: () => {},
                  },
                ]}
              />
              <span className={styles.switcherStatus}>
                Selecionado: <strong>{switcherDemoSelected?.label ?? '—'}</strong>
              </span>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Panel embedded</span>
            <div
              className={styles.field}
              style={{
                width: '100%',
                maxWidth: 360,
                padding: 12,
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
              }}
            >
              <SwitcherPanel
                panelLabel="Organization panel demo"
                searchPlaceholder="Buscar organização..."
                searchAriaLabel="Buscar organizações"
                items={SWITCHER_DEMO_ITEMS}
                selectedId={activeSwitcherDemo}
                onSelect={setActiveSwitcherDemo}
                variant="embedded"
                autoFocus={false}
                getEmptyMessage={(query) =>
                  query ? `Nenhum resultado para "${query}"` : 'Nenhuma organização ainda.'
                }
              />
            </div>
          </div>
        </section>
      )}

      {showStatusBadges && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Status badges (StatusBadge)</h2>
          <p className={styles.sectionDesc}>
            Pílulas de status reutilizáveis para listagens CRUD. Use o prop <code>tone</code> para
            mapear estados semânticos (sucesso, alerta, perigo, etc.).
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Tons</span>
            <StatusBadge label="Neutral" tone="neutral" />
            <StatusBadge label="Success" tone="success" />
            <StatusBadge label="Warning" tone="warning" />
            <StatusBadge label="Danger" tone="danger" />
            <StatusBadge label="Info" tone="info" />
            <StatusBadge label="Muted" tone="muted" />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Exemplos CRUD</span>
            <StatusBadge label="Ativo" tone="success" />
            <StatusBadge label="Pendente" tone="warning" />
            <StatusBadge label="Em cotação" tone="warning" />
            <StatusBadge label="Pago" tone="success" />
            <StatusBadge label="Cancelado" tone="danger" />
          </div>
        </section>
      )}

      {showTabFilter && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tab filter (TabFilter)</h2>
          <p className={styles.sectionDesc}>
            Barra de tabs horizontais para filtrar listagens por status. Suporta badge numérico
            opcional em cada aba.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Padrão</span>
            <TabFilter
              tabs={TAB_FILTER_DEMO}
              value={tabFilterDemo}
              onChange={setTabFilterDemo}
              aria-label="Filtro de exemplo"
            />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Selecionado</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Tab ativa: <strong>{tabFilterDemo}</strong>
            </span>
          </div>
        </section>
      )}

      {showModais && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Modais (Modal)</h2>
          <p className={styles.sectionDesc}>
            Modal acessível com portal. Compounds: <code>Modal.Content</code>,{' '}
            <code>Modal.Field</code>, <code>Modal.FieldRow</code>, <code>Modal.Footer</code>,{' '}
            <code>Modal.Text</code>, <code>Modal.Hint</code>.
          </p>

          <div className={styles.row}>
            <span className={styles.rowLabel}>Visualização</span>
            <div className={styles.field}>
              <Button onClick={() => setModalDemoOpen(true)} variant="primary">
                Abrir Modal de Exemplo
              </Button>

              <Modal
                isOpen={modalDemoOpen}
                onClose={() => setModalDemoOpen(false)}
                title="Modal de Exemplo Reutilizável"
                icon={<IconSparkles size={15} style={{ color: 'var(--brand-green)' }} />}
                leftBorderColor="var(--brand-green)"
                ariaLabelledBy="demo-modal-title"
              >
                <Modal.Content>
                  <Modal.Text>
                    Use <code>Modal.Content</code>, <code>Modal.Field</code> e{' '}
                    <code>Modal.Footer</code> para formulários em modais, evita CSS duplicado e
                    mantém Select/Autocomplete acima do overlay.
                  </Modal.Text>
                  <Modal.Field label="Nome" required>
                    <Input placeholder="Ex.: Guincho até o galpão" />
                  </Modal.Field>
                  <Modal.FieldRow>
                    <Modal.Field label="Valor" optional>
                      <Input inputMode="decimal" placeholder="0" />
                    </Modal.Field>
                    <Modal.Field label="Status" optional>
                      <Select
                        value="estimado"
                        onChange={() => {}}
                        options={[
                          { value: 'estimado', label: 'Estimado' },
                          { value: 'pendente', label: 'Pendente' },
                        ]}
                        aria-label="Status"
                      />
                    </Modal.Field>
                  </Modal.FieldRow>
                  <Modal.Hint>Pressione Esc ou clique fora para fechar.</Modal.Hint>
                </Modal.Content>
                <Modal.Footer>
                  <Button onClick={() => setModalDemoOpen(false)} variant="secondary">
                    Fechar
                  </Button>
                  <Button onClick={() => setModalDemoOpen(false)} variant="primary">
                    Salvar
                  </Button>
                </Modal.Footer>
              </Modal>
            </div>
          </div>
        </section>
      )}

      {showDataTable && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DataTable</h2>
          <p className={styles.sectionDesc}>
            Tabela genérica com ordenação por coluna, célula de ações e estado vazio. Aceita
            qualquer tipo via generics. Com <code>loading</code>, renderiza skeleton nas linhas
            mantendo o header das colunas.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Com ações</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <DataTable<DemoItem>
                columns={TABLE_COLUMNS}
                rows={filteredDemoRows}
                keyField="id"
                rowActions={(row) => (
                  <RowActions
                    label={`Ações para ${row.name}`}
                    items={[
                      {
                        label: 'Editar',
                        icon: <IconPencil size={14} />,
                        onClick: () => setLastAction(`Editar: ${row.name}`),
                      },
                      {
                        label: 'Excluir',
                        icon: <IconTrash size={14} />,
                        danger: true,
                        onClick: () => setLastAction(`Excluir: ${row.name}`),
                      },
                    ]}
                  />
                )}
                emptyMessage="Nenhum resultado encontrado"
              />
              {lastAction && (
                <p style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Última ação: <strong>{lastAction}</strong>
                </p>
              )}
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Loading</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <DataTable<DemoItem>
                columns={TABLE_COLUMNS}
                rows={[]}
                keyField="id"
                loading
                loadingRows={4}
                rowActions={() => null}
              />
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Estado vazio</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <DataTable<DemoItem>
                columns={TABLE_COLUMNS}
                rows={[]}
                keyField="id"
                emptyMessage="Nenhum item encontrado nesta categoria."
              />
            </div>
          </div>
        </section>
      )}

      {showRowActions && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>RowActions</h2>
          <p className={styles.sectionDesc}>
            Botão kebab (⋮) com menu de contexto em posição fixa (viewport). Ideal para linhas de
            tabela com overflow:hidden.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Padrão</span>
            <div
              className={styles.field}
              style={{ display: 'flex', alignItems: 'center', gap: 16 }}
            >
              <RowActions
                label="Ações do item"
                items={[
                  {
                    label: 'Editar',
                    icon: <IconPencil size={14} />,
                    onClick: () => setLastAction('Editar'),
                  },
                  {
                    label: 'Favoritar',
                    icon: <IconStar size={14} />,
                    onClick: () => setLastAction('Favoritar'),
                  },
                  {
                    label: 'Excluir',
                    icon: <IconTrash size={14} />,
                    danger: true,
                    onClick: () => setLastAction('Excluir'),
                  },
                ]}
              />
              {lastAction && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Última ação: <strong>{lastAction}</strong>
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {showGridView && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>GridView</h2>
          <p className={styles.sectionDesc}>
            Grid responsivo genérico. Aceita um render prop <code>renderItem</code> para total
            controle do card. Com <code>loading</code>, exibe cards skeleton no mesmo layout.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Com cards</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <GridView<DemoItem>
                items={DEMO_ROWS}
                keyField="id"
                renderItem={(item) => (
                  <div
                    style={{
                      padding: '14px 16px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--bg-active)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconUser size={15} style={{ color: 'var(--text-muted)' }} />
                      </span>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {item.role}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Loading</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <GridView<DemoItem>
                items={[]}
                keyField="id"
                loading
                loadingCount={3}
                renderItem={() => null}
              />
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Estado vazio</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <GridView<DemoItem>
                items={[]}
                keyField="id"
                renderItem={() => null}
                emptyMessage="Nenhum item encontrado."
              />
            </div>
          </div>
        </section>
      )}

      {showItemCard && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ItemCard</h2>
          <p className={styles.sectionDesc}>
            Card reutilizável para grid views. Mesmo visual do ProjectCard, usa tokens{' '}
            <code>--bg-surface</code>, hover com <code>translateY(-2px)</code>. Aceita{' '}
            <code>actions</code> (RowActions ⋮) e <code>highlight</code> (borda verde).
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Padrão</span>
            <ItemCard>
              <div style={{ padding: '14px 16px' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: 4,
                  }}
                >
                  Título do item
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Subtítulo ou metadado
                </div>
              </div>
            </ItemCard>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Com ações (⋮)</span>
            <ItemCard
              actions={{
                label: 'Ações do item',
                items: [
                  { label: 'Editar', icon: <IconPencil size={14} />, onClick: () => {} },
                  {
                    label: 'Excluir',
                    icon: <IconTrash size={14} />,
                    danger: true,
                    onClick: () => {},
                  },
                ],
              }}
            >
              <div style={{ padding: '14px 16px' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: 4,
                  }}
                >
                  Item com menu
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Clique no ⋮ para ver ações
                </div>
              </div>
            </ItemCard>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Highlight</span>
            <ItemCard
              highlight
              actions={{
                label: 'Ações do item',
                items: [{ label: 'Editar', icon: <IconPencil size={14} />, onClick: () => {} }],
              }}
            >
              <div style={{ padding: '14px 16px' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    marginBottom: 4,
                  }}
                >
                  Melhor preço
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Borda e fundo com acento verde
                </div>
              </div>
            </ItemCard>
          </div>
        </section>
      )}

      {showNavMenuItem && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>NavMenuItem</h2>
          <p className={styles.sectionDesc}>
            Item de navegação reutilizável para sidebar e menus dropdown. Suporta{' '}
            <code>variant=&quot;sidebar&quot;</code> e <code>variant=&quot;menu&quot;</code>,
            ícones, estado ativo e estilo danger.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Menu variant</span>
            <div className={styles.field} style={{ maxWidth: 280 }}>
              <NavMenuItem
                label={chatNavLabel()}
                icon={<IconRobot size={14} />}
                variant="menu"
                role="menuitem"
              />
              <NavMenuItem
                label="Preferências"
                icon={<IconSettings size={14} />}
                variant="menu"
                active
                role="menuitem"
              />
              <NavMenuItem
                label="Sair"
                icon={<IconTrash size={14} />}
                variant="menu"
                danger
                role="menuitem"
              />
            </div>
          </div>
        </section>
      )}

      {showDropdownMenu && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DropdownMenu, UserAvatar e LogoutMenuItem</h2>
          <p className={styles.sectionDesc}>
            Blocos composáveis para menus dropdown: <code>DropdownMenuRoot</code>,{' '}
            <code>DropdownMenuPanel</code>, <code>DropdownMenuHeader</code>,{' '}
            <code>DropdownMenuSeparator</code>, <code>DropdownMenuSectionLabel</code>,{' '}
            <code>UserAvatar</code> e <code>LogoutMenuItem</code>.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>UserAvatar</span>
            <UserAvatar src="https://picsum.photos/seed/demo/80/80" alt="Usuário demo" size="sm" />
            <UserAvatar src="https://picsum.photos/seed/demo/80/80" alt="Usuário demo" size="md" />
            <UserAvatar alt="Maria Silva" size="sm" />
            <UserAvatar alt="Maria Silva" size="md" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              sm/md com foto · sm/md iniciais (sem photoURL)
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Painel aberto</span>
            <DropdownMenuRoot>
              <Button variant="secondary" onClick={() => setDropdownMenuOpen((p) => !p)}>
                {dropdownMenuOpen ? 'Fechar' : 'Abrir'} menu
              </Button>
              {dropdownMenuOpen && (
                <DropdownMenuPanel aria-label="Menu de exemplo">
                  <DropdownMenuHeader
                    avatar={
                      <UserAvatar
                        src="https://picsum.photos/seed/demo/80/80"
                        alt="Demo"
                        size="md"
                      />
                    }
                    name="João da Silva"
                    email="joao@exemplo.com"
                  />
                  <DropdownMenuSeparator />
                  <DropdownMenuSectionLabel>Opções</DropdownMenuSectionLabel>
                  <NavMenuItem label="Item 1" icon={<IconSettings size={14} />} variant="menu" />
                  <NavMenuItem label="Item 2" icon={<IconRobot size={14} />} variant="menu" />
                  <DropdownMenuSeparator />
                  <LogoutMenuItem onLogout={() => setLastAction('Logout clicado')} />
                </DropdownMenuPanel>
              )}
            </DropdownMenuRoot>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>LogoutMenuItem</span>
            <div className={styles.field} style={{ maxWidth: 260 }}>
              <LogoutMenuItem onLogout={() => setLastAction('Logout clicado')} />
              {lastAction === 'Logout clicado' && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Callback executado
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {showTopbarActionButton && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TopbarActionButton e ThemeToggle</h2>
          <p className={styles.sectionDesc}>
            Ícones clicáveis do topbar. <code>TopbarActionButton</code> é o botão genérico
            (novidades, etc.) e <code>ThemeToggle</code> alterna entre tema claro e escuro com ícone
            sol/lua.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Ações</span>
            <TopbarActionButton icon={<IconBulb size={16} />} label="Novidades" />
            <TopbarActionButton icon={<IconSearch size={16} />} label="Buscar" />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>ThemeToggle</span>
            <ThemeToggle />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Clique para alternar claro/escuro
            </span>
          </div>
        </section>
      )}

      {showTopbar && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Topbar</h2>
          <p className={styles.sectionDesc}>
            Shell e peças reutilizáveis do header: <code>Topbar</code>, <code>TopbarBrand</code>,{' '}
            <code>TopbarSeparator</code>, <code>TopbarCrumb</code>, <code>TopbarMenuButton</code>,{' '}
            <code>TopbarConnectButton</code>, <code>TopbarRightControls</code>,{' '}
            <code>TopbarMetaPill</code>.
          </p>
          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <Topbar
              left={
                <>
                  <TopbarMenuButton open={false} onClick={() => undefined} />
                  <TopbarBrand />
                  <TopbarSeparator />
                  <TopbarBreadcrumb>
                    <TopbarCrumb>
                      <IconAffiliate size={14} />
                      Acme Org
                      <TopbarMetaPill>PRO</TopbarMetaPill>
                    </TopbarCrumb>
                    <TopbarSeparator />
                    <TopbarCrumb active>
                      <TopbarBranchLabel>Principal</TopbarBranchLabel>
                      <TopbarMetaPill tone="amber">PADRÃO</TopbarMetaPill>
                    </TopbarCrumb>
                  </TopbarBreadcrumb>
                </>
              }
              right={<TopbarRightControls leading={<TopbarConnectButton />} />}
            />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Peças</span>
            <TopbarBrand />
            <TopbarSeparator />
            <TopbarCrumb active>Novo projeto</TopbarCrumb>
            <TopbarConnectButton />
            <TopbarMetaPill>TEAM</TopbarMetaPill>
            <TopbarMetaPill tone="amber">PADRÃO</TopbarMetaPill>
          </div>
        </section>
      )}

      {showAlertButton && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>AlertButton</h2>
          <p className={styles.sectionDesc}>
            Ícone de alertas com badge numérico no canto (estilo WhatsApp). Usado no topbar no lugar
            do antigo ícone de info/ajuda. O badge some quando <code>count</code> é 0 e exibe{' '}
            <code>99+</code> acima do máximo.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Sem alertas</span>
            <AlertButton count={0} />
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Com alertas</span>
            <AlertButton count={3} />
            <AlertButton count={12} />
            <AlertButton count={99} />
            <AlertButton count={150} />
          </div>
        </section>
      )}

      {showSideDrawer && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>SideDrawer</h2>
          <p className={styles.sectionDesc}>
            Painel lateral genérico que abre da direita (mesmo shell do drawer de alertas). Use para
            detalhes de conversa, filtros ou qualquer conteúdo auxiliar. Aceita <code>title</code>,{' '}
            <code>headerActions</code>, <code>footer</code> e <code>children</code>. No mobile ocupa
            a tela inteira.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Controlado</span>
            <Button variant="secondary" onClick={() => setSideDrawerOpen(true)}>
              Abrir SideDrawer
            </Button>
            <SideDrawer
              open={sideDrawerOpen}
              onClose={() => setSideDrawerOpen(false)}
              title="Dados da conversa"
              headerActions={
                <SideDrawerIconButton
                  label="Editar"
                  onClick={() => setSideDrawerOpen(false)}
                >
                  <IconPencil size={18} aria-hidden="true" />
                </SideDrawerIconButton>
              }
            >
              <div
                style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}
              >
                Conteúdo auxiliar (participantes, auditoria, etc.) entra como children.
              </div>
            </SideDrawer>
          </div>
        </section>
      )}

      {showNotificationsDrawer && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>NotificationsDrawer</h2>
          <p className={styles.sectionDesc}>
            Lista de alertas sobre o <code>SideDrawer</code> compartilhado. No desktop fica como
            drawer (~380px); no mobile ocupa a tela inteira. Use <code>NotificationsMenu</code> no
            header (botão + drawer) ou o drawer isolado. Com <code>loading</code>, skeleton só na
            lista (título/busca ficam reais) + <code>useMinimumLoading</code>.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Via header</span>
            <NotificationsMenu triggerOnly />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Abre o mesmo drawer do topbar
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Drawer controlado</span>
            <Button variant="secondary" onClick={() => setNotificationsOpen(true)}>
              Abrir alertas
            </Button>
            <NotificationsDrawer
              open={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              items={DEMO_NOTIFICATIONS}
            />
          </div>
        </section>
      )}

      {showFlowCanvas && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>FlowCanvas</h2>
          <p className={styles.sectionDesc}>
            Canvas de diagrama baseado em React Flow (@xyflow/react), com tema escuro, controles de
            zoom, fundo pontilhado e label de zoom. Usado na tela de Agentes; aceite{' '}
            <code>nodes</code>, <code>edges</code>, <code>nodeTypes</code> e callbacks para montar
            fluxos customizados. Com <code>loading</code>, exibe skeleton fluid +{' '}
            <code>useMinimumLoading</code> (~500ms) integrado.
          </p>
          <div
            className={styles.field}
            style={{
              width: '100%',
              maxWidth: 720,
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <FlowCanvasCatalogDemo />
          </div>
        </section>
      )}

      {showThemeSelector && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ThemeSelector</h2>
          <p className={styles.sectionDesc}>
            Lista de rádio para seleção de tema (Escuro, Claro, Escuro Clássico, Sistema). Usado
            dentro do ProfileMenu.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Visualização</span>
            <div
              className={styles.field}
              style={{
                maxWidth: 260,
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                padding: '8px 0',
                border: '1px solid var(--border-default)',
              }}
            >
              <ThemeSelector />
            </div>
          </div>
        </section>
      )}

      {showThemeModeGrid && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ThemeModeGrid</h2>
          <p className={styles.sectionDesc}>
            Grade de cards com preview do tema. Usada em Preferências da conta.
          </p>
          <div style={{ maxWidth: 480 }}>
            <ThemeModeGrid value={themeModeDemo} onChange={setThemeModeDemo} />
          </div>
        </section>
      )}

      {showServiceRow && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ServiceRow</h2>
          <p className={styles.sectionDesc}>
            Linha de identidade/conexão com ícone, título, detalhe e ação.
          </p>
          <div
            className={styles.field}
            style={{
              maxWidth: 560,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
            }}
          >
            <ServiceRow
              icon={<IconBuilding size={18} aria-hidden="true" />}
              title="GitHub"
              detail="usuario · email@exemplo.com"
              action={
                <Button type="button" variant="ghost" size="sm" aria-label="Editar">
                  <IconPencil size={14} aria-hidden="true" />
                </Button>
              }
            />
            <ServiceRow
              icon={<IconBuilding size={18} aria-hidden="true" />}
              title="GitHub"
              detail="Sincronize repositórios com projetos"
              action={
                <Button type="button" variant="primary" size="sm">
                  Conectar
                </Button>
              }
            />
          </div>
        </section>
      )}

      {showDangerZone && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DangerZone</h2>
          <p className={styles.sectionDesc}>
            Painel de ações destrutivas (ex.: exclusão de conta).
          </p>
          <div style={{ maxWidth: 560 }}>
            <DangerZone
              title="Solicitar exclusão da conta"
              description="A exclusão é permanente e não pode ser desfeita."
              action={
                <Button type="button" variant="danger" size="sm">
                  Solicitar exclusão
                </Button>
              }
            />
          </div>
        </section>
      )}

      {showKbd && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Kbd</h2>
          <p className={styles.sectionDesc}>Badge visual para atalhos de teclado.</p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Exemplos</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
              <Kbd>⇧N</Kbd>
            </div>
          </div>
        </section>
      )}

      {showPreferenceToggleRow && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PreferenceToggleRow</h2>
          <p className={styles.sectionDesc}>
            Linha de preferência com título, atalho opcional e Toggle.
          </p>
          <div
            className={styles.field}
            style={{
              maxWidth: 560,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
            }}
          >
            <PreferenceToggleRow
              title="Abrir menu de comandos"
              keys={['Ctrl', 'K']}
              checked={prefToggleDemo}
              onChange={setPrefToggleDemo}
            />
            <PreferenceToggleRow
              title="Enviar telemetria"
              description="Ajuda a melhorar o produto com dados de uso."
              checked={!prefToggleDemo}
              onChange={(v) => setPrefToggleDemo(!v)}
            />
          </div>
        </section>
      )}

      {showTimezonePicker && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TimezonePicker</h2>
          <p className={styles.sectionDesc}>
            Seletor de fuso horário com painel buscável. Variante `menu` no ProfileMenu; `field` em
            formulários (Preferências da conta).
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Menu</span>
            <div
              className={styles.field}
              style={{
                maxWidth: 260,
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                position: 'relative',
              }}
            >
              <TimezonePicker value={tzPickerValue} onChange={setTzPickerValue} side="right" />
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Campo</span>
            <div className={styles.field} style={{ maxWidth: 420, width: '100%' }}>
              <TimezonePicker
                variant="field"
                value={tzPickerValue}
                onChange={setTzPickerValue}
                aria-label="Fuso horário demo"
              />
            </div>
          </div>
        </section>
      )}

      {showSearchableListPanel && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>SearchableListPanel</h2>
          <p className={styles.sectionDesc}>
            Painel com campo de busca e lista filtrada. Usado pelo TimezonePicker e reutilizável
            para qualquer lista buscável.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Interativo</span>
            <SearchableListPanel
              query={searchablePanelQuery}
              onQueryChange={setSearchablePanelQuery}
              placeholder="Buscar item…"
              emptyMessage="Nenhum resultado"
              aria-label="Lista de exemplo"
              items={['Item A', 'Item B', 'Item C'].filter(
                (i) =>
                  !searchablePanelQuery ||
                  i.toLowerCase().includes(searchablePanelQuery.toLowerCase()),
              )}
              renderItem={(item: string) => (
                <div
                  key={item}
                  style={{
                    padding: '6px 16px',
                    fontSize: 'var(--font-md)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {item}
                </div>
              )}
            />
          </div>
        </section>
      )}

      {showCommandPalette && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>CommandPalette</h2>
          <p className={styles.sectionDesc}>
            Paleta de comandos com trigger pill (&quot;Buscar… Ctrl K&quot;) e modal de busca.
            Clique no trigger para abrir. No header, o atalho{' '}
            <kbd style={{ background: 'var(--bg-muted)', padding: '0 4px', borderRadius: 3 }}>
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd style={{ background: 'var(--bg-muted)', padding: '0 4px', borderRadius: 3 }}>
              K
            </kbd>{' '}
            também abre a paleta global.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Completo</span>
            <CommandPalette enableShortcut={false} />
          </div>
        </section>
      )}

      {showProfileMenu && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ProfileMenu</h2>
          <p className={styles.sectionDesc}>
            Menu de perfil do usuário composto por sub-componentes: UserAvatar, DropdownMenu,
            NavMenuItem, ThemeSelector, TimezonePicker e LogoutMenuItem.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>UserAvatar</span>
            <UserAvatar src="https://picsum.photos/seed/demo/80/80" alt="Usuário demo" size="sm" />
            <UserAvatar src="https://picsum.photos/seed/demo/80/80" alt="Usuário demo" size="md" />
            <UserAvatar alt="João" size="sm" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              sm = trigger, md = header · sem photoURL = iniciais
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Menu completo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ProfileMenu />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Clique no avatar para abrir
              </span>
            </div>
          </div>
        </section>
      )}

      {showViewToolbar && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ViewToolbar</h2>
          <p className={styles.sectionDesc}>
            Barra de busca + filtros + alternador de visualização (lista/grid). Filtros com{' '}
            <code>content</code> renderizam elemento raw; sem <code>content</code> renderizam como
            pill-button.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Com busca e toggle</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <ViewToolbar
                query={gridQuery}
                onQueryChange={setGridQuery}
                searchPlaceholder="Buscar itens..."
                view={demoView}
                onViewChange={setDemoView}
                filters={[
                  {
                    key: 'status',
                    label: 'Ativo',
                    active: false,
                    onClick: () => setLastAction('Filtrar: Ativo'),
                  },
                  {
                    key: 'tipo',
                    label: 'Tipo',
                    active: true,
                    onClick: () => setLastAction('Filtrar: Tipo'),
                  },
                ]}
                rightSlot={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<IconPlus size={14} />}
                    onClick={() => setLastAction('Novo item')}
                  >
                    Novo item
                  </Button>
                }
              />
              <p style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-muted)' }}>
                Vista: <strong>{demoView}</strong> · Busca:{' '}
                <strong>{gridQuery || '(vazia)'}</strong>
                {lastAction && (
                  <>
                    {' '}
                    · Ação: <strong>{lastAction}</strong>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Só busca</span>
            <div className={styles.field} style={{ width: '100%' }}>
              <ViewToolbar
                query={tableQuery}
                onQueryChange={setTableQuery}
                searchPlaceholder="Buscar..."
                showViewToggle={false}
              />
            </div>
          </div>
        </section>
      )}

      {showPieChart && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>PieChart</h2>
          <p className={styles.sectionDesc}>
            Gráfico de pizza (donut) com legenda. Use para distribuição relativa, tokens por
            categoria, share de runtime, etc.
          </p>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Exemplo</span>
            <div className={styles.field} style={{ width: '100%', maxWidth: 420 }}>
              <PieChart
                label="Tokens por categoria"
                totalLabel="12.450"
                slices={[
                  { id: 'a', label: 'Auditoria', value: 6200 },
                  { id: 'b', label: 'Chat (Dify)', value: 3100 },
                  { id: 'c', label: 'Imagens', value: 1800 },
                  { id: 'd', label: 'Áudio', value: 1350 },
                ]}
              />
            </div>
          </div>
        </section>
      )}
    </PageShell>
  );
}
