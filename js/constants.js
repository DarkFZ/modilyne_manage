/**
 * Chave única usada para persistir a base de clientes no LocalStorage.
 * Manter centralizada evita strings mágicas espalhadas pelos módulos.
 * @type {string}
 */
export const STORAGE_KEY = 'clientes_estilista';

/** Chave usada para persistir as despesas fixas mensais (renda, água, eletricidade). */
export const STORAGE_KEY_DESPESAS = 'despesas_fixas_estilista';

/** Versão do formato de backup exportado (permite migrações futuras). */
export const VERSAO_BACKUP = 2;

/** Unidade padrão de medida quando nenhuma é informada. */
export const UNIDADE_PADRAO = 'cm';

/** Campos obrigatórios que todo registro de cliente precisa ter para ser considerado válido. */
export const CAMPOS_OBRIGATORIOS_CLIENTE = ['id', 'nome'];

/**
 * Etapas do kanban de pagamento/processo de um pedido, na ordem em que
 * normalmente acontecem no ateliê.
 * @type {Array<{chave: string, rotulo: string}>}
 */
export const STATUS_PEDIDO = [
  { chave: 'pagamento_entrada', rotulo: 'Pagamento entrada' },
  { chave: 'materiais', rotulo: 'Materiais' },
  { chave: 'corte', rotulo: 'Corte' },
  { chave: 'costura', rotulo: 'Costura' },
  { chave: 'acabamento', rotulo: 'Acabamento' },
  { chave: 'pagamento_restante', rotulo: 'Pagamento restante' },
  { chave: 'entregue', rotulo: 'Entregue' }
];

/** Quantos dias antes da entrega prevista o ateliê deve ser avisado. */
export const DIAS_AVISO_ENTREGA = 3;

/** Número máximo de parcelas aceito para o pagamento de um pedido. */
export const MAX_PARCELAS = 3;

/** Percentual mínimo do preço exigido como entrada quando o pedido é parcelado. */
export const PERCENTUAL_MINIMO_ENTRADA = 0.5;
