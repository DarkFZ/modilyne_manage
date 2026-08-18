/**
 * Camada de acesso bruto ao LocalStorage.
 * Nenhuma outra parte do app deve chamar localStorage.getItem/setItem
 * diretamente para a chave de clientes — sempre passar por aqui, para que
 * o tratamento de corrupção de dados e de estouro de cota fique centralizado.
 */

import { STORAGE_KEY } from './constants.js';
import { normalizarCliente } from './validators.js';

/**
 * Lê e faz o parse do array de clientes persistido no LocalStorage.
 * Nunca lança exceção: qualquer problema (chave ausente, JSON corrompido,
 * ou dado que não seja um array) resulta em lista vazia. Cada registro passa
 * por normalizarCliente, que migra transparentemente dados de versões
 * anteriores do schema — assim nenhuma outra parte do app precisa saber que
 * um formato antigo já existiu.
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

  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch (erro) {
    console.error('[Storage] JSON corrompido em "clientes_estilista". Retornando lista vazia.', erro);
    return [];
  }

  if (!Array.isArray(dados)) {
    console.warn('[Storage] Conteúdo salvo não é um array; retornando lista vazia.');
    return [];
  }

  // Cada registro é normalizado individualmente: um único cliente com dado
  // inesperado não pode derrubar a lista inteira — melhor perder um registro
  // (com aviso no console) do que esconder todos os outros da tela.
  const clientes = [];
  for (const clienteBruto of dados) {
    try {
      const cliente = normalizarCliente(clienteBruto);
      if (cliente) clientes.push(cliente);
    } catch (erro) {
      console.error('[Storage] Registro de cliente ignorado por erro ao normalizar.', clienteBruto, erro);
    }
  }
  return clientes;
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
