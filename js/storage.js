/**
 * Camada de acesso bruto ao LocalStorage.
 * Nenhuma outra parte do app deve chamar localStorage.getItem/setItem
 * diretamente para a chave de clientes — sempre passar por aqui, para que
 * o tratamento de corrupção de dados e de estouro de cota fique centralizado.
 */

import { STORAGE_KEY } from './constants.js';

/**
 * Lê e faz o parse do array de clientes persistido no LocalStorage.
 * Nunca lança exceção: qualquer problema (chave ausente, JSON corrompido,
 * ou dado que não seja um array) resulta em lista vazia.
 * @returns {Array<Object>}
 */
export function lerStorage() {
  let bruto;
  try {
    bruto = localStorage.getItem(STORAGE_KEY);
  } catch (erro) {
    console.error('[Storage] LocalStorage indisponível neste ambiente.', erro);
    return [];
  }

  if (!bruto) return [];

  try {
    const dados = JSON.parse(bruto);
    if (!Array.isArray(dados)) {
      console.warn('[Storage] Conteúdo salvo não é um array; retornando lista vazia.');
      return [];
    }
    return dados;
  } catch (erro) {
    console.error('[Storage] JSON corrompido em "clientes_estilista". Retornando lista vazia.', erro);
    return [];
  }
}

/**
 * Serializa e grava o array de clientes no LocalStorage.
 * @param {Array<Object>} clientes
 * @returns {boolean} true se a gravação foi concluída com sucesso.
 */
export function gravarStorage(clientes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
    return true;
  } catch (erro) {
    if (erro && erro.name === 'QuotaExceededError') {
      console.error('[Storage] Cota do LocalStorage excedida. Sugira exportar um backup e liberar espaço.');
    } else {
      console.error('[Storage] Falha inesperada ao gravar no LocalStorage.', erro);
    }
    return false;
  }
}
