/**
 * Chave única usada para persistir a base de clientes no LocalStorage.
 * Manter centralizada evita strings mágicas espalhadas pelos módulos.
 * @type {string}
 */
export const STORAGE_KEY = 'clientes_estilista';

/** Versão do formato de backup exportado (permite migrações futuras). */
export const VERSAO_BACKUP = 1;

/** Unidade padrão de medida quando nenhuma é informada. */
export const UNIDADE_PADRAO = 'cm';

/** Campos obrigatórios que todo registro de cliente precisa ter para ser considerado válido. */
export const CAMPOS_OBRIGATORIOS_CLIENTE = ['id', 'nome', 'historicoMedidas'];
