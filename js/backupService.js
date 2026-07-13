/**
 * Módulo de privacidade e segurança: toda a base de clientes vive apenas no
 * LocalStorage do navegador (nada é enviado a servidores). Este módulo dá ao
 * usuário controle total sobre esse dado local — exportar, importar e apagar.
 */

import { STORAGE_KEY, VERSAO_BACKUP } from './constants.js';
import { lerStorage, gravarStorage } from './storage.js';
import { validarArrayClientesImportado } from './validators.js';

/**
 * Dispara o download nativo de um Blob JSON com o nome de arquivo informado.
 * Função interna de apoio — não faz parte do contrato público do módulo.
 * @param {string} conteudo
 * @param {string} nomeArquivo
 */
function baixarArquivoJSON(conteudo, nomeArquivo) {
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta toda a base local em um arquivo .json baixado pelo navegador,
 * nomeado 'backup_estilista_AAAA-MM-DD.json'.
 * @returns {{sucesso: boolean, erro?: string}}
 */
export function exportarBackupJSON() {
  try {
    const clientes = lerStorage();
    if (clientes.length === 0) {
      return { sucesso: false, erro: 'Não há dados cadastrados para exportar.' };
    }

    const conteudo = JSON.stringify(
      { versao: VERSAO_BACKUP, exportadoEm: new Date().toISOString(), clientes },
      null,
      2
    );
    const dataFormatada = new Date().toISOString().slice(0, 10);
    baixarArquivoJSON(conteudo, `backup_estilista_${dataFormatada}.json`);
    return { sucesso: true };
  } catch (erro) {
    console.error('[Backup] Falha ao gerar o arquivo de exportação.', erro);
    return { sucesso: false, erro: 'Falha inesperada ao gerar o backup.' };
  }
}

/**
 * Exporta a ficha de um único cliente (dados cadastrais + histórico completo
 * de medidas) em um .json separado — útil para enviar a ficha a outra
 * costureira sem expor a base inteira de clientes.
 * @param {string} clienteId
 * @returns {{sucesso: boolean, erro?: string}}
 */
export function exportarClienteIndividualJSON(clienteId) {
  try {
    const cliente = lerStorage().find((item) => item.id === clienteId);
    if (!cliente) {
      return { sucesso: false, erro: 'Cliente não encontrado.' };
    }

    const conteudo = JSON.stringify(cliente, null, 2);
    const nomeArquivoSeguro = cliente.nome.trim().replace(/\s+/g, '_').toLowerCase();
    const dataFormatada = new Date().toISOString().slice(0, 10);
    baixarArquivoJSON(conteudo, `ficha_${nomeArquivoSeguro}_${dataFormatada}.json`);
    return { sucesso: true };
  } catch (erro) {
    console.error('[Backup] Falha ao exportar ficha individual.', erro);
    return { sucesso: false, erro: 'Falha inesperada ao exportar a ficha do cliente.' };
  }
}

/**
 * Importa um backup a partir do conteúdo textual de um arquivo .json.
 * Faz o parse dentro de um try/catch (arquivo corrompido não derruba o app),
 * valida se o resultado é um array de clientes estruturalmente válido, e só
 * então substitui integralmente a base local.
 * @param {string} arquivoTexto - Conteúdo bruto do arquivo (ex: via FileReader.readAsText).
 * @returns {{sucesso: boolean, erro?: string, totalClientes?: number}}
 */
export function importarBackupJSON(arquivoTexto) {
  let conteudo;
  try {
    conteudo = JSON.parse(arquivoTexto);
  } catch (erro) {
    return { sucesso: false, erro: 'Arquivo corrompido ou que não contém um JSON válido.' };
  }

  // Aceita tanto o formato de backup completo ({ versao, clientes }) quanto
  // um array puro de clientes, para compatibilidade com exports mais simples.
  const clientesImportados = Array.isArray(conteudo) ? conteudo : conteudo?.clientes;

  const validacao = validarArrayClientesImportado(clientesImportados);
  if (!validacao.valido) {
    return { sucesso: false, erro: validacao.erro };
  }

  if (!gravarStorage(clientesImportados)) {
    return { sucesso: false, erro: 'Falha ao gravar os dados importados no LocalStorage.' };
  }

  return { sucesso: true, totalClientes: clientesImportados.length };
}

/**
 * Apaga permanentemente toda a base de clientes do LocalStorage.
 * A confirmação com o usuário ("tem certeza?") é responsabilidade da UI —
 * esta função apenas executa a remoção quando chamada.
 * @returns {{sucesso: boolean, erro?: string}}
 */
export function apagarTodosDados() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { sucesso: true };
  } catch (erro) {
    console.error('[Backup] Falha ao apagar os dados locais.', erro);
    return { sucesso: false, erro: 'Falha ao apagar os dados locais.' };
  }
}
