/**
 * Validação de schema: garante que os objetos manipulados pelo app (e,
 * principalmente, os arquivos de backup importados por um terceiro) respeitam
 * a estrutura mínima esperada antes de tocarem no LocalStorage.
 */

import { CAMPOS_OBRIGATORIOS_CLIENTE } from './constants.js';

/**
 * @typedef {Object} MedidasSuperior
 * @property {number|null} busto
 * @property {number|null} subbusto
 * @property {number|null} separacaoBusto
 * @property {number|null} alturaBusto
 * @property {number|null} cinturaAlta
 * @property {number|null} ombroAOmbro
 * @property {number|null} comprimentoOmbro
 * @property {number|null} larguraCostas
 * @property {number|null} comprimentoBraco
 * @property {number|null} bicep
 * @property {number|null} pulso
 *
 * @typedef {Object} MedidasInferior
 * @property {number|null} quadril
 * @property {number|null} alturaQuadril
 * @property {number|null} ganchoTotal
 * @property {number|null} coxa
 * @property {number|null} joelho
 * @property {number|null} cinturaAoChao
 *
 * @typedef {Object} MedidasGeral
 * @property {number|null} altura
 * @property {number|null} peso
 *
 * @typedef {Object} Medicao
 * @property {string} idMedicao
 * @property {string} data
 * @property {string} evento
 * @property {string} unidade
 * @property {{superior: MedidasSuperior, inferior: MedidasInferior, geral: MedidasGeral}} medidas
 *
 * @typedef {Object} Cliente
 * @property {string} id
 * @property {string} nome
 * @property {string} telefone
 * @property {string} email
 * @property {string} dataCadastro
 * @property {{silhueta: string, postura: string, observacoes: string}} perfil
 * @property {Medicao[]} historicoMedidas
 */

/**
 * Monta a estrutura de medidas com todos os campos do schema presentes e
 * zerados (null). Usar como base e sobrepor apenas os campos informados,
 * assim nenhum campo fica ausente independente do que a UI enviar.
 * @returns {{superior: MedidasSuperior, inferior: MedidasInferior, geral: MedidasGeral}}
 */
export function criarEstruturaMedidasVazia() {
  return {
    superior: {
      busto: null,
      subbusto: null,
      separacaoBusto: null,
      alturaBusto: null,
      cinturaAlta: null,
      ombroAOmbro: null,
      comprimentoOmbro: null,
      larguraCostas: null,
      comprimentoBraco: null,
      bicep: null,
      pulso: null
    },
    inferior: {
      quadril: null,
      alturaQuadril: null,
      ganchoTotal: null,
      coxa: null,
      joelho: null,
      cinturaAoChao: null
    },
    geral: {
      altura: null,
      peso: null
    }
  };
}

/**
 * Valida os campos mínimos de um objeto de cliente antes de salvar.
 * @param {Object} cliente
 * @returns {{valido: boolean, erro?: string}}
 */
export function validarClienteBasico(cliente) {
  if (!cliente || typeof cliente !== 'object' || Array.isArray(cliente)) {
    return { valido: false, erro: 'O cliente precisa ser um objeto.' };
  }
  if (typeof cliente.nome !== 'string' || !cliente.nome.trim()) {
    return { valido: false, erro: 'O nome do cliente é obrigatório.' };
  }
  return { valido: true };
}

/**
 * Valida estruturalmente o array de clientes vindo de um arquivo de backup
 * importado, garantindo que cada registro tenha os campos mínimos exigidos
 * pelo schema e que 'historicoMedidas' seja de fato um array.
 * @param {*} dados - Conteúdo já parseado (JSON.parse) do arquivo importado.
 * @returns {{valido: boolean, erro?: string}}
 */
export function validarArrayClientesImportado(dados) {
  if (!Array.isArray(dados)) {
    return { valido: false, erro: 'O arquivo importado precisa conter um array de clientes.' };
  }

  for (let indice = 0; indice < dados.length; indice += 1) {
    const cliente = dados[indice];

    if (!cliente || typeof cliente !== 'object' || Array.isArray(cliente)) {
      return { valido: false, erro: `Registro na posição ${indice} não é um objeto válido.` };
    }

    const campoAusente = CAMPOS_OBRIGATORIOS_CLIENTE.find((campo) => !(campo in cliente));
    if (campoAusente) {
      return {
        valido: false,
        erro: `Registro na posição ${indice} está sem o campo obrigatório "${campoAusente}".`
      };
    }

    if (!Array.isArray(cliente.historicoMedidas)) {
      return {
        valido: false,
        erro: `O histórico de medidas do cliente "${cliente.nome}" (posição ${indice}) precisa ser um array.`
      };
    }
  }

  return { valido: true };
}
