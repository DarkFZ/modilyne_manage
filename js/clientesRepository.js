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
import { gerarId, dataAtualISO, diasDesde, diasAte } from './utils.js';
import { criarMedidasVazias, validarClienteBasico, validarPedidoBasico } from './validators.js';
import { DIAS_AVISO_ENTREGA } from './constants.js';

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
 * - Sem 'id' (ou id inexistente na base): cria um novo registro, gerando id,
 *   dataCadastro, medidas vazias (únicas e editáveis) e lista de pedidos vazia.
 * - Com 'id' existente: atualiza apenas os dados cadastrais (nome, telefone,
 *   email, observações), preservando medidas e pedidos já armazenados.
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
      observacoes: clienteObjeto.observacoes ?? '',
      medidas: criarMedidasVazias(),
      pedidos: []
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
    observacoes: clienteObjeto.observacoes ?? clienteAtual.observacoes,
    // medidas e pedidos nunca são aceitos via este método — só pelas
    // funções dedicadas abaixo (atualizarMedidas / *Pedido).
    medidas: clienteAtual.medidas,
    pedidos: clienteAtual.pedidos
  };

  clientes[indiceExistente] = clienteAtualizado;
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a atualização do cliente no LocalStorage.' };
  }
  return { sucesso: true, cliente: clienteAtualizado };
}

/**
 * Remove um cliente (e todo seu histórico de pedidos) da base local.
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
 * Atualiza o conjunto único de medidas de um cliente. Diferente do antigo
 * histórico de medições, cada cliente tem apenas um conjunto de medidas,
 * sempre editável — os diferentes pedidos (peças) é que têm seu próprio
 * histórico, controlado por adicionarPedido/editarPedido.
 * @param {string} clienteId
 * @param {Partial<{unidade: string, superior: object, inferior: object, detalhes: string}>} dadosMedidas
 * @returns {{sucesso: boolean, medidas?: import('./validators.js').Medidas, erro?: string}}
 */
export function atualizarMedidas(clienteId, dadosMedidas = {}) {
  const clientes = lerStorage();
  const indice = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indice === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const medidasAtuais = clientes[indice].medidas ?? criarMedidasVazias();
  /** @type {import('./validators.js').Medidas} */
  const medidasAtualizadas = {
    unidade: dadosMedidas.unidade || medidasAtuais.unidade,
    atualizadoEm: dataAtualISO(),
    superior: { ...medidasAtuais.superior, ...(dadosMedidas.superior ?? {}) },
    inferior: { ...medidasAtuais.inferior, ...(dadosMedidas.inferior ?? {}) },
    detalhes: dadosMedidas.detalhes ?? medidasAtuais.detalhes
  };

  clientes[indice].medidas = medidasAtualizadas;
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a atualização das medidas no LocalStorage.' };
  }
  return { sucesso: true, medidas: medidasAtualizadas };
}

/**
 * Registra um novo pedido (peça encomendada) para um cliente, entrando no
 * kanban de processo já na primeira etapa (pagamento_entrada).
 * @param {string} clienteId
 * @param {Partial<{descricao: string, preco: number|null, numeroParcelas: number, valorEntrada: number|null, custoMateriais: number|null, dataEntregaPrevista: string}>} dadosPedido
 * @returns {{sucesso: boolean, pedido?: import('./validators.js').Pedido, erro?: string}}
 */
export function adicionarPedido(clienteId, dadosPedido = {}) {
  const validacao = validarPedidoBasico(dadosPedido);
  if (!validacao.valido) {
    return { sucesso: false, erro: validacao.erro };
  }

  const clientes = lerStorage();
  const indice = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indice === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const numeroParcelas = dadosPedido.numeroParcelas === undefined || dadosPedido.numeroParcelas === ''
    ? 1
    : Number(dadosPedido.numeroParcelas);

  /** @type {import('./validators.js').Pedido} */
  const novoPedido = {
    idPedido: gerarId('ped'),
    descricao: dadosPedido.descricao.trim(),
    preco: dadosPedido.preco === '' || dadosPedido.preco === undefined ? null : Number(dadosPedido.preco),
    numeroParcelas,
    valorEntrada: numeroParcelas > 1 ? Number(dadosPedido.valorEntrada) : null,
    custoMateriais: dadosPedido.custoMateriais === '' || dadosPedido.custoMateriais === undefined || dadosPedido.custoMateriais === null
      ? null
      : Number(dadosPedido.custoMateriais),
    dataCriacao: dataAtualISO(),
    dataEntregaPrevista: dadosPedido.dataEntregaPrevista || '',
    status: 'pagamento_entrada',
    ultimaNotificacao: null
  };

  clientes[indice].pedidos.unshift(novoPedido);
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir o novo pedido no LocalStorage.' };
  }
  return { sucesso: true, pedido: novoPedido };
}

/**
 * Atualiza os dados (descrição, preço, data prevista) de um pedido já
 * existente, sem alterar seu status no kanban.
 * @param {string} clienteId
 * @param {string} idPedido
 * @param {Partial<{descricao: string, preco: number|null, numeroParcelas: number, valorEntrada: number|null, custoMateriais: number|null, dataEntregaPrevista: string}>} dadosPedido
 * @returns {{sucesso: boolean, pedido?: import('./validators.js').Pedido, erro?: string}}
 */
export function editarPedido(clienteId, idPedido, dadosPedido = {}) {
  const validacao = validarPedidoBasico(dadosPedido);
  if (!validacao.valido) {
    return { sucesso: false, erro: validacao.erro };
  }

  const clientes = lerStorage();
  const indiceCliente = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indiceCliente === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const pedidos = clientes[indiceCliente].pedidos;
  const indicePedido = pedidos.findIndex((pedido) => pedido.idPedido === idPedido);
  if (indicePedido === -1) {
    return { sucesso: false, erro: 'Pedido não encontrado.' };
  }

  const numeroParcelas = dadosPedido.numeroParcelas === undefined || dadosPedido.numeroParcelas === ''
    ? 1
    : Number(dadosPedido.numeroParcelas);

  const pedidoAtual = pedidos[indicePedido];
  /** @type {import('./validators.js').Pedido} */
  const pedidoAtualizado = {
    ...pedidoAtual,
    descricao: dadosPedido.descricao.trim(),
    preco: dadosPedido.preco === '' || dadosPedido.preco === undefined ? null : Number(dadosPedido.preco),
    numeroParcelas,
    valorEntrada: numeroParcelas > 1 ? Number(dadosPedido.valorEntrada) : null,
    custoMateriais: dadosPedido.custoMateriais === '' || dadosPedido.custoMateriais === undefined || dadosPedido.custoMateriais === null
      ? null
      : Number(dadosPedido.custoMateriais),
    dataEntregaPrevista: dadosPedido.dataEntregaPrevista || pedidoAtual.dataEntregaPrevista
  };

  pedidos[indicePedido] = pedidoAtualizado;
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a atualização do pedido no LocalStorage.' };
  }
  return { sucesso: true, pedido: pedidoAtualizado };
}

/**
 * Move um pedido para outra etapa do kanban de pagamento/processo.
 * @param {string} clienteId
 * @param {string} idPedido
 * @param {string} novoStatus - Uma das chaves de STATUS_PEDIDO.
 * @returns {{sucesso: boolean, pedido?: import('./validators.js').Pedido, erro?: string}}
 */
export function atualizarStatusPedido(clienteId, idPedido, novoStatus) {
  const clientes = lerStorage();
  const indiceCliente = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indiceCliente === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const pedidos = clientes[indiceCliente].pedidos;
  const indicePedido = pedidos.findIndex((pedido) => pedido.idPedido === idPedido);
  if (indicePedido === -1) {
    return { sucesso: false, erro: 'Pedido não encontrado.' };
  }

  pedidos[indicePedido] = { ...pedidos[indicePedido], status: novoStatus };
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a mudança de status no LocalStorage.' };
  }
  return { sucesso: true, pedido: pedidos[indicePedido] };
}

/**
 * Remove um pedido específico do histórico de um cliente.
 * @param {string} clienteId
 * @param {string} idPedido
 * @returns {{sucesso: boolean, erro?: string}}
 */
export function excluirPedido(clienteId, idPedido) {
  const clientes = lerStorage();
  const indiceCliente = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indiceCliente === -1) {
    return { sucesso: false, erro: 'Cliente não encontrado.' };
  }

  const pedidos = clientes[indiceCliente].pedidos;
  const existePedido = pedidos.some((pedido) => pedido.idPedido === idPedido);
  if (!existePedido) {
    return { sucesso: false, erro: 'Pedido não encontrado.' };
  }

  clientes[indiceCliente].pedidos = pedidos.filter((pedido) => pedido.idPedido !== idPedido);
  if (!gravarStorage(clientes)) {
    return { sucesso: false, erro: 'Falha ao persistir a exclusão do pedido no LocalStorage.' };
  }
  return { sucesso: true };
}

/**
 * Marca que já foi avisado hoje sobre a proximidade de entrega de um
 * pedido, evitando notificações repetidas a cada vez que o app é aberto.
 * @param {string} clienteId
 * @param {string} idPedido
 * @param {string} dataISO - Data (AAAA-MM-DD) em que o aviso foi emitido.
 * @returns {boolean}
 */
export function marcarNotificacaoEnviada(clienteId, idPedido, dataISO) {
  const clientes = lerStorage();
  const indiceCliente = clientes.findIndex((cliente) => cliente.id === clienteId);
  if (indiceCliente === -1) return false;

  const pedidos = clientes[indiceCliente].pedidos;
  const indicePedido = pedidos.findIndex((pedido) => pedido.idPedido === idPedido);
  if (indicePedido === -1) return false;

  pedidos[indicePedido] = { ...pedidos[indicePedido], ultimaNotificacao: dataISO };
  return gravarStorage(clientes);
}

/**
 * Lista, entre todos os clientes, os pedidos ainda não entregues cuja
 * entrega prevista está a poucos dias (ou já atrasada), para alimentar o
 * aviso de "entrega próxima" da UI.
 * @param {number} [diasAntecedencia=DIAS_AVISO_ENTREGA]
 * @returns {Array<{clienteId: string, clienteNome: string, pedido: import('./validators.js').Pedido, diasRestantes: number}>}
 */
export function obterPedidosProximosPrazo(diasAntecedencia = DIAS_AVISO_ENTREGA) {
  const resultado = [];
  for (const cliente of lerStorage()) {
    for (const pedido of cliente.pedidos) {
      if (pedido.status === 'entregue' || !pedido.dataEntregaPrevista) continue;
      const diasRestantes = diasAte(pedido.dataEntregaPrevista);
      if (diasRestantes === null || diasRestantes > diasAntecedencia) continue;
      resultado.push({ clienteId: cliente.id, clienteNome: cliente.nome, pedido, diasRestantes });
    }
  }
  return resultado.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/**
 * Lista clientes sem nenhum pedido criado (ou cadastro, se nunca fez
 * pedido) há mais de 'diasLimite' dias, útil para uma tela de "clientes
 * inativas" ou lembretes de recontato.
 * @param {number} [diasLimite=180]
 * @returns {import('./validators.js').Cliente[]}
 */
export function listarClientesInativos(diasLimite = 180) {
  return lerStorage().filter((cliente) => {
    const ultimoPedido = cliente.pedidos[0];
    const dataReferencia = ultimoPedido ? ultimoPedido.dataCriacao : cliente.dataCadastro;
    return diasDesde(dataReferencia) >= diasLimite;
  });
}
