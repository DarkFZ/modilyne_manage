/**
 * Módulo de operações de dados (CRUD) sobre a base de clientes.
 * Todas as funções são "puras" no sentido de que dependem apenas do
 * LocalStorage via storage.js — nenhuma referência a DOM ou UI aqui.
 *
 * Convenção de retorno para operações de escrita: em vez de lançar
 * exceções, cada função devolve { sucesso: boolean, erro?: string, ...dados }
 * para que a camada de UI decida como exibir o problema ao usuário.
 */

import { lerStorage, gravarStorage } from './storage.js';
import { gerarId, dataAtualISO, diasDesde } from './utils.js';
import { criarEstruturaMedidasVazia, validarClienteBasico } from './validators.js';
import { UNIDADE_PADRAO } from './constants.js';

/**
 * Retorna todos os clientes cadastrados.
 * @returns {import('./validators.js').Cliente[]}
 */
export function obterTodosClientes() {
  return lerStorage();
}

/**
 * Busca um cliente específico pelo id.
 * @param {string} id
 * @returns {import('./validators.js').Cliente|null}
 */
export function obterClientePorId(id) {
  const clientes = lerStorage();
  return clientes.find((cliente) => cliente.id === id) ?? null;
}

/**
 * Busca clientes por trecho do nome (case-insensitive, sem acentuação
 * sensível a maiúsculas). Útil para uma barra de busca na listagem.
 * @param {string} termo
 * @returns {import('./validators.js').Cliente[]}
 */
export function buscarClientesPorNome(termo) {
  const termoNormalizado = (termo ?? '').trim().toLowerCase();
  if (!termoNormalizado) return lerStorage();
  return lerStorage().filter((cliente) => cliente.nome.toLowerCase().includes(termoNormalizado));
}

/**
 * Cria ou atualiza um cliente.
 * - Sem 'id' (ou id inexistente na base): cria um novo registro, gerando id
 *   e dataCadastro, com historicoMedidas vazio.
 * - Com 'id' existente: atualiza apenas os dados cadastrais (nome, telefone,
 *   email, perfil), preservando o historicoMedidas já armazenado.
 * @param {Partial<import('./validators.js').Cliente>} clienteObjeto
 * @returns {{sucesso: boolean, cliente?: import('./validators.js').Cliente, erro?: string}}
 */
export function salvarCliente(clienteObjeto) {
  const validacao = validarClienteBasico(clienteObjeto);
  if (!validacao.valido) {
    return { sucesso: false, erro: validacao.erro };
  }

  const clientes = lerStorage();
  const indiceExistente = clienteObjeto.id
    ? clientes.findIndex((cliente) => cliente.id === clienteObjeto.id)
    : -1;

  if (indiceExistente === -1) {
    /** @type {import('./validators.js').Cliente} */
    const novoCliente = {
      id: gerarId('cli'),
      nome: clienteObjeto.nome.trim(),
      telefone: clienteObjeto.telefone ?? '',
      email: clienteObjeto.email ?? '',
      dataCadastro: dataAtualISO(),
      perfil: {
        silhueta: clienteObjeto.perfil?.silhueta ?? '',
        postura: clienteObjeto.perfil?.postura ?? '',
        observacoes: clienteObjeto.perfil?.observacoes ?? ''
      },
      historicoMedidas: []
    };

    clientes.push(novoCliente);
    if (!gravarStorage(clientes)) {
      return { sucesso: false, erro: 'Falha ao persistir o novo cliente no LocalStorage.' };
    }
    return { sucesso: true, cliente: novoCliente };
  }

  const clienteAtual = clientes[indiceExistente];
  /** @type {import('./validators.js').Cliente} */
  const clienteAtualizado = {
    ...clienteAtual,
    nome: clienteObjeto.nome.trim(),
    telefone: clienteObjeto.telefone ?? clienteAtual.telefone,
    email: clienteObjeto.email ?? clienteAtual.email,
    perfil: {
      silhueta: clienteObjeto.perfil?.silhueta ?? clienteAtual.perfil.silhueta,
      postura: clienteObjeto.perfil?.postura ?? clienteAtual.perfil.postura,
      observacoes: clienteObjeto.perfil?.observacoes ?? clienteAtual.perfil.observacoes
    },
    // historicoMedidas nunca é aceito via este método — só por adicionarNovaMedicao/excluirMedicao.
    historicoMedidas: clienteAtual.historicoMedidas
  };

  clientes[indiceExistente] = clienteAtualizado;
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a atualização do cliente no LocalStorage.' };
  }
  return { sucesso: true, cliente: clienteAtualizado };
}

/**
 * Remove um cliente (e todo seu histórico) da base local.
 * @param {string} id
 * @returns {{sucesso: boolean, erro?: string}}
 */
export function excluirCliente(id) {
  const clientes = lerStorage();
  const existe = clientes.some((cliente) => cliente.id === id);
  if (!existe) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const restantes = clientes.filter((cliente) => cliente.id !== id);
  if (!gravarStorage(restantes)) {
    return { sucesso: false, erro: 'Falha ao persistir a exclusão no LocalStorage.' };
  }
  return { sucesso: true };
}

/**
 * Adiciona uma nova medição ao topo do histórico de um cliente (a mais
 * recente sempre em historicoMedidas[0]). Campos de medida não informados
 * são preenchidos com null, mantendo o schema sempre completo.
 * @param {string} clienteId
 * @param {Partial<{superior: object, inferior: object, geral: object, unidade: string}>} dadosMedidas
 * @param {string} nomeEvento - Nome do evento/vestido associado à medição.
 * @returns {{sucesso: boolean, medicao?: import('./validators.js').Medicao, erro?: string}}
 */
export function adicionarNovaMedicao(clienteId, dadosMedidas = {}, nomeEvento = '') {
  const clientes = lerStorage();
  const indice = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indice === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const estruturaVazia = criarEstruturaMedidasVazia();
  /** @type {import('./validators.js').Medicao} */
  const novaMedicao = {
    idMedicao: gerarId('med'),
    data: dataAtualISO(),
    evento: nomeEvento?.trim() || 'Sem descrição',
    unidade: dadosMedidas.unidade || UNIDADE_PADRAO,
    medidas: {
      superior: { ...estruturaVazia.superior, ...(dadosMedidas.superior ?? {}) },
      inferior: { ...estruturaVazia.inferior, ...(dadosMedidas.inferior ?? {}) },
      geral: { ...estruturaVazia.geral, ...(dadosMedidas.geral ?? {}) }
    }
  };

  clientes[indice].historicoMedidas.unshift(novaMedicao);
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a nova medição no LocalStorage.' };
  }
  return { sucesso: true, medicao: novaMedicao };
}

/**
 * Atualiza os campos de uma medição já registrada (ex: valor digitado
 * errado), sem alterar sua posição no histórico nem o idMedicao. Campos de
 * medida não informados em dadosMedidas mantêm o valor já salvo.
 * @param {string} clienteId
 * @param {string} idMedicao
 * @param {Partial<{superior: object, inferior: object, geral: object, unidade: string}>} dadosMedidas
 * @param {string} nomeEvento - Nome do evento/vestido associado à medição.
 * @returns {{sucesso: boolean, medicao?: import('./validators.js').Medicao, erro?: string}}
 */
export function editarMedicao(clienteId, idMedicao, dadosMedidas = {}, nomeEvento = '') {
  const clientes = lerStorage();
  const indiceCliente = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indiceCliente === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const historico = clientes[indiceCliente].historicoMedidas;
  const indiceMedicao = historico.findIndex((medicao) => medicao.idMedicao === idMedicao);
  if (indiceMedicao === -1) {
    return { sucesso: false, erro: 'Medição não encontrada.' };
  }

  const medicaoAtual = historico[indiceMedicao];
  /** @type {import('./validators.js').Medicao} */
  const medicaoAtualizada = {
    ...medicaoAtual,
    evento: nomeEvento?.trim() || 'Sem descrição',
    unidade: dadosMedidas.unidade || medicaoAtual.unidade,
    medidas: {
      superior: { ...medicaoAtual.medidas.superior, ...(dadosMedidas.superior ?? {}) },
      inferior: { ...medicaoAtual.medidas.inferior, ...(dadosMedidas.inferior ?? {}) },
      geral: { ...medicaoAtual.medidas.geral, ...(dadosMedidas.geral ?? {}) }
    }
  };

  historico[indiceMedicao] = medicaoAtualizada;
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a atualização da medição no LocalStorage.' };
  }
  return { sucesso: true, medicao: medicaoAtualizada };
}

/**
 * Remove uma medição específica do histórico de um cliente (ex: registro
 * lançado por engano). Não afeta os demais dados cadastrais.
 * @param {string} clienteId
 * @param {string} idMedicao
 * @returns {{sucesso: boolean, erro?: string}}
 */
export function excluirMedicao(clienteId, idMedicao) {
  const clientes = lerStorage();
  const indiceCliente = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indiceCliente === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const historico = clientes[indiceCliente].historicoMedidas;
  const existeMedicao = historico.some((medicao) => medicao.idMedicao === idMedicao);
  if (!existeMedicao) {
    return { sucesso: false, erro: 'Medição não encontrada.' };
  }

  clientes[indiceCliente].historicoMedidas = historico.filter(
    (medicao) => medicao.idMedicao !== idMedicao
  );
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a exclusão da medição no LocalStorage.' };
  }
  return { sucesso: true };
}

/**
 * Retorna a medição mais recente de um cliente (topo do histórico) ou null
 * se ele ainda não tiver nenhuma medição registrada.
 * @param {string} clienteId
 * @returns {import('./validators.js').Medicao|null}
 */
export function obterUltimaMedicao(clienteId) {
  const cliente = obterClientePorId(clienteId);
  return cliente?.historicoMedidas[0] ?? null;
}

/**
 * Compara duas medições do mesmo cliente campo a campo, útil para o
 * atelier visualizar rapidamente o que mudou no corpo da cliente entre
 * dois eventos (ex: antes/depois de uma dieta, ou entre duas provas).
 * @param {string} clienteId
 * @param {string} idMedicaoRecente
 * @param {string} idMedicaoAnterior
 * @returns {{sucesso: boolean, diffs?: Object, erro?: string}}
 */
export function compararMedicoes(clienteId, idMedicaoRecente, idMedicaoAnterior) {
  const cliente = obterClientePorId(clienteId);
  if (!cliente) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const recente = cliente.historicoMedidas.find((medicao) => medicao.idMedicao === idMedicaoRecente);
  const anterior = cliente.historicoMedidas.find((medicao) => medicao.idMedicao === idMedicaoAnterior);
  if (!recente || !anterior) {
    return { sucesso: false, erro: 'Uma ou ambas as medições informadas não foram encontradas.' };
  }

  const diffs = {};
  for (const grupo of /** @type {const} */ (['superior', 'inferior', 'geral'])) {
    diffs[grupo] = {};
    for (const campo of Object.keys(recente.medidas[grupo])) {
      const valorRecente = recente.medidas[grupo][campo];
      const valorAnterior = anterior.medidas[grupo][campo];
      const diferenca =
        typeof valorRecente === 'number' && typeof valorAnterior === 'number'
          ? Number((valorRecente - valorAnterior).toFixed(2))
          : null;
      diffs[grupo][campo] = { anterior: valorAnterior, recente: valorRecente, diferenca };
    }
  }

  return { sucesso: true, diffs };
}

/**
 * Lista clientes cuja última medição (ou cadastro, se nunca mediu) está
 * há mais de 'diasLimite' dias, útil para uma tela de "clientes inativas"
 * ou lembretes de recontato.
 * @param {number} [diasLimite=180]
 * @returns {import('./validators.js').Cliente[]}
 */
export function listarClientesInativos(diasLimite = 180) {
  return lerStorage().filter((cliente) => {
    const ultimaMedicao = cliente.historicoMedidas[0];
    const dataReferencia = ultimaMedicao ? ultimaMedicao.data : cliente.dataCadastro;
    return diasDesde(dataReferencia) >= diasLimite;
  });
}
