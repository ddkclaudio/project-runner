import { appName } from '@/lib/brand';

export interface NotificationItem {
  id: string;
  title: string;
  /** Snippet curto (lista / topo do modal). */
  body: string;
  /** Dossie longo (Markdown). */
  description?: string;
  /** @deprecated use description */
  detail?: string;
  time: string;
  unread?: boolean;
  tone?: 'info' | 'warning' | 'success' | 'danger';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | 'unknown' | null;
  contactName?: string | null;
  contactPhone?: string | null;
  network?: 'whatsapp' | 'instagram' | 'other' | null;
  accountId?: string | null;
  chatId?: string | null;
  chatTitle?: string | null;
  /** Team member / owner da conta monitorada (deep-link). */
  ownerId?: string | null;
  /** Obra MonitoraAI (alertas de job IBEN). */
  projectId?: string | null;
  createdAt?: string | null;
}

export const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    title: 'Cotação aprovada',
    body: 'A cotação #1042 foi aprovada e está pronta para pedido.',
    time: 'Há 5 min',
    unread: true,
    tone: 'success',
  },
  {
    id: '2',
    title: 'Alerta de orçamento',
    body: 'A verba de materiais elétricos atingiu 85% do limite.',
    time: 'Há 1 h',
    unread: true,
    tone: 'warning',
  },
  {
    id: '3',
    title: 'Novo colaborador',
    body: 'Ana Costa foi adicionada ao projeto como engenheira.',
    time: 'Ontem',
    unread: true,
    tone: 'info',
  },
  {
    id: '4',
    title: 'Pedido entregue',
    body: 'O pedido #889 foi marcado como recebido no canteiro.',
    time: 'Há 2 dias',
    unread: false,
    tone: 'success',
  },
  {
    id: '5',
    title: 'Revisão pendente',
    body: 'A revisão 1.1 aguarda sua aprovação para liberar a obra.',
    time: 'Há 3 dias',
    unread: false,
    tone: 'danger',
  },
  {
    id: '6',
    title: 'Fornecedor atualizado',
    body: 'Os dados cadastrais da Metalúrgica Sul foram alterados.',
    time: 'Há 3 dias',
    unread: false,
    tone: 'info',
  },
  {
    id: '7',
    title: 'Insumo em falta',
    body: 'O estoque de cimento CP-II está abaixo do mínimo configurado.',
    time: 'Há 4 dias',
    unread: true,
    tone: 'warning',
  },
  {
    id: '8',
    title: 'Sugestão de IA',
    body: 'Há 4 novas sugestões de otimização de custo no módulo de IA.',
    time: 'Há 4 dias',
    unread: true,
    tone: 'info',
  },
  {
    id: '9',
    title: 'Pedido atrasado',
    body: 'O pedido #912 ultrapassou a data prevista de entrega.',
    time: 'Há 5 dias',
    unread: true,
    tone: 'danger',
  },
  {
    id: '10',
    title: 'Composição publicada',
    body: 'A composição “Parede de alvenaria 15cm” foi publicada.',
    time: 'Há 5 dias',
    unread: false,
    tone: 'success',
  },
  {
    id: '11',
    title: 'Memória atualizada',
    body: 'Novos trechos foram indexados na memória da IA do projeto.',
    time: 'Há 6 dias',
    unread: false,
    tone: 'info',
  },
  {
    id: '12',
    title: 'Limite de tokens',
    body: 'O agente Diretor Técnico consumiu 70% do limite de tokens.',
    time: 'Há 6 dias',
    unread: true,
    tone: 'warning',
  },
  {
    id: '13',
    title: 'Solicitação criada',
    body: 'A solicitação de compra #221 foi aberta por Carlos Mendes.',
    time: 'Há 1 sem',
    unread: false,
    tone: 'info',
  },
  {
    id: '14',
    title: 'Cotação recusada',
    body: 'A cotação #1038 foi recusada pelo fornecedor Alpha.',
    time: 'Há 1 sem',
    unread: false,
    tone: 'danger',
  },
  {
    id: '15',
    title: 'Backup concluído',
    body: 'O backup semanal dos dados do projeto foi finalizado.',
    time: 'Há 1 sem',
    unread: false,
    tone: 'success',
  },
  {
    id: '16',
    title: 'Integração ERP',
    body: 'A sincronização com o ERP falhou em 2 itens de pedido.',
    time: 'Há 1 sem',
    unread: true,
    tone: 'warning',
  },
  {
    id: '17',
    title: 'Novo agente',
    body: 'O agente “Engenheiro Hidráulico” foi adicionado ao fluxo.',
    time: 'Há 2 sem',
    unread: false,
    tone: 'info',
  },
  {
    id: '18',
    title: 'Preço alterado',
    body: 'O preço do insumo “Vergalhão CA-50” subiu 4,2%.',
    time: 'Há 2 sem',
    unread: false,
    tone: 'warning',
  },
  {
    id: '19',
    title: 'Relatório disponível',
    body: 'O relatório mensal de gastos está pronto para download.',
    time: 'Há 2 sem',
    unread: false,
    tone: 'success',
  },
  {
    id: '20',
    title: 'Permissão alterada',
    body: 'Seu perfil passou a ter acesso de edição em Orçamento.',
    time: 'Há 2 sem',
    unread: false,
    tone: 'info',
  },
  {
    id: '21',
    title: 'Prazo de cotação',
    body: 'A cotação #1050 encerra em 24 horas.',
    time: 'Há 3 sem',
    unread: true,
    tone: 'warning',
  },
  {
    id: '22',
    title: 'Documento anexado',
    body: 'Um memorial descritivo foi anexado à composição #88.',
    time: 'Há 3 sem',
    unread: false,
    tone: 'info',
  },
  {
    id: '23',
    title: 'Falha de sincronização',
    body: 'Não foi possível sincronizar a pasta do Google Drive.',
    time: 'Há 3 sem',
    unread: false,
    tone: 'danger',
  },
  {
    id: '24',
    title: 'Meta atingida',
    body: 'A economia projetada do mês superou a meta de 8%.',
    time: 'Há 1 mês',
    unread: false,
    tone: 'success',
  },
  {
    id: '25',
    title: `Bem-vindo ao ${appName()}`,
    body: 'Configure alertas e preferências na sua conta para começar.',
    time: 'Há 1 mês',
    unread: false,
    tone: 'info',
  },
];

export function countUnread(items: NotificationItem[]): number {
  return items.filter((n) => n.unread).length;
}
