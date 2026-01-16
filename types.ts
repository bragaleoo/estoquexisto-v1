
export type Perfil = 'Administrador' | 'Estoquista' | 'Supervisor' | 'Consultor';

export type StatusImportacao = 'PARCIAL' | 'COMPLETA';
export type StatusItemImportacao = 'INSERIDO' | 'DUPLICADO_ARQUIVO' | 'DUPLICADO_SISTEMA' | 'INVALIDO';
export type StatusEstoque = 'DISPONIVEL' | 'ATRIBUIDA' | 'BAIXADA';
export type MotivoBaixa = 'VENDA' | 'POS_VENDA' | 'ERRO_OPERACIONAL' | 'DEVOLUCAO' | 'OUTRO';
export type Regiao = 'SERGIPE' | 'ALAGOAS';

export interface Pedido {
  id: string;
  codigo_pedido: string;
  qtd_esperada?: number;
  qtd_importada: number;
  status_importacao: StatusImportacao;
  regiao?: Regiao;
  criado_em: string;
  criado_por: string;
}

export interface Maquina {
  id: string;
  serial: string;
  pedido_id: string;
  import_id: string;
  status_estoque: StatusEstoque;
  supervisor_id?: number;
  consultor_nome?: string;
  atribuido_em?: string;
  baixado_em?: string;
  baixado_por?: string;
  motivo_baixa?: MotivoBaixa;
  observacao_baixa?: string;
  criado_em: string;
}

export interface Devolucao {
    id: string;
    serial: string;
    supervisor_id: number;
    consultor_nome: string;
    data_entrega: string; // Data da entrega inicial
    observacao_inicial: string;
    
    // Informações de Envio (preenchidas na segunda etapa)
    data_envio_correios?: string;
    codigo_rastreio?: string;
    observacao_envio?: string;

    criado_em: string;
    criado_por: string;
}

export interface EventoMaquina {
    id: string;
    maquina_id: string;
    tipo_evento: 'IMPORTADA' | 'ATRIBUICAO' | 'EDICAO' | 'BAIXA' | 'DESFAZER_BAIXA';
    criado_em: string;
    criado_por: string;
    justificativa?: string;
    payload: any;
}

export interface Importacao {
  id: string;
  pedido_id: string;
  arquivo_nome: string;
  importado_em: string;
  importado_por: string;
  total_linhas_lidas: number;
  seriais_validos: number;
  invalidos: number;
  duplicados_arquivo: number;
  duplicados_sistema: number;
  maquinas_inseridas: number;
  status: 'PROCESSADA' | 'PROCESSADA_COM_ERROS';
}

export interface ImportacaoItem {
  id: string;
  import_id: string;
  linha_numero: number;
  serial_original: string;
  serial_normalizado: string;
  status_item: StatusItemImportacao;
  erro_motivo?: string;
}

export interface UserProfile {
  perfil: Perfil;
  supervisorId?: number;
  nome: string;
}

export interface Supervisor {
  id: number;
  nome: string;
}

export type Page = 'dashboard' | 'cadastros' | 'pedidos' | 'relatorios' | 'devolucoes' | 'calculadora';
