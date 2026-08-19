/**
 * Validação de schema: garante que os objetos manipulados pelo app (e,
 * principalmente, os arquivos de backup importados por um terceiro) respeitam
 * a estrutura mínima esperada antes de tocarem no LocalStorage.
 */

import { CAMPOS_OBRIGATORIOS_CLIENTE, UNIDADE_PADRAO, MAX_PARCELAS, PERCENTUAL_MINIMO_ENTRADA } from './constants.js';

/**
 * @typedef {Object} MedidasSuperior
 * @property {number|null} ombro
 * @property {number|null} busto
 * @property {number|null} cinturaAlta
 * @property {number|null} cintura
 * @property {number|null} ombroCintura
 * @property {number|null} braco
 *
 * @typedef {Object} MedidasInferior
 * @property {number|null} quadril
 * @property {number|null} cinturaJoelho
 * @property {number|null} cinturaPe
 *
 * @typedef {Object} Medidas
 * @property {string} unidade
 * @property {string|null} atualizadoEm
 * @property {MedidasSuperior} superior
 * @property {MedidasInferior} inferior
 * @property {string} detalhes
 *
 * @typedef {Object} Pedido
 * @property {string} idPedido
 * @property {string} descricao
 * @property {number|null} preco
 * @property {number} numeroParcelas - Entre 1 e MAX_PARCELAS; 1 significa pagamento à vista.
 * @property {number|null} valorEntrada - Só usado quando numeroParcelas > 1; mínimo PERCENTUAL_MINIMO_ENTRADA do preço.
 * @property {number|null} custoMateriais - Quanto foi gasto em materiais para esta peça, para o controlo de ganhos/gastos.
 * @property {string} dataCriacao
 * @property {string} dataEntregaPrevista
 * @property {string} status
 * @property {string|null} ultimaNotificacao
 *
 * @typedef {Object} DespesasFixas
 * @property {number} aluguer
 * @property {number} eletricidade
 * @property {number} agua
 *
 * @typedef {Object} Cliente
 * @property {string} id
 * @property {string} nome
 * @property {string} telefone
 * @property {string} email
 * @property {string} dataCadastro
 * @property {string} observacoes
 * @property {Medidas} medidas
 * @property {Pedido[]} pedidos
 */

/**
 * Monta a estrutura de medidas com todos os campos do schema presentes e
 * zerados (null). Usar como base e sobrepor apenas os campos informados,
 * assim nenhum campo fica ausente independente do que a UI enviar.
 * @returns {Medidas}
 */
export function criarMedidasVazias() {
  return {
    unidade: UNIDADE_PADRAO,
    atualizadoEm: null,
    superior: {
      ombro: null,
      busto: null,
      cinturaAlta: null,
      cintura: null,
      ombroCintura: null,
      braco: null
    },
    inferior: {
      quadril: null,
      cinturaJoelho: null,
      cinturaPe: null
    },
    detalhes: ''
  };
}

/**
 * Migra o conjunto de medidas de um registro no formato antigo (histórico de
 * medições por evento, com outro conjunto de campos) ou garante que um
 * registro já no formato atual tenha todas as chaves do schema presentes.
 * @param {Object} clienteBruto - Registro como veio do LocalStorage.
 * @returns {Medidas}
 */
function migrarMedidas(clienteBruto) {
  const vazias = criarMedidasVazias();

  if (clienteBruto.medidas && typeof clienteBruto.medidas === 'object') {
    return {
      unidade: clienteBruto.medidas.unidade || vazias.unidade,
      atualizadoEm: clienteBruto.medidas.atualizadoEm ?? null,
      superior: { ...vazias.superior, ...clienteBruto.medidas.superior },
      inferior: { ...vazias.inferior, ...clienteBruto.medidas.inferior },
      detalhes: clienteBruto.medidas.detalhes ?? ''
    };
  }

  // Formato antigo: só existiam silhueta/postura (em 'perfil') e um histórico
  // de medições com outro conjunto de campos — só busto/cinturaAlta/quadril
  // têm equivalente direto no schema atual; o resto vira observação em texto
  // para não desaparecer silenciosamente.
  const ultimaMedicaoAntiga = Array.isArray(clienteBruto.historicoMedidas)
    ? clienteBruto.historicoMedidas[0]
    : null;
  const medidasAntigas = ultimaMedicaoAntiga?.medidas;

  const notasMigradas = [
    clienteBruto.perfil?.silhueta ? `Silhueta (dado antigo): ${clienteBruto.perfil.silhueta}` : null,
    clienteBruto.perfil?.postura ? `Postura (dado antigo): ${clienteBruto.perfil.postura}` : null
  ].filter(Boolean);

  return {
    unidade: medidasAntigas?.unidade || ultimaMedicaoAntiga?.unidade || vazias.unidade,
    atualizadoEm: ultimaMedicaoAntiga?.data ?? null,
    superior: {
      ...vazias.superior,
      busto: medidasAntigas?.superior?.busto ?? null,
      cinturaAlta: medidasAntigas?.superior?.cinturaAlta ?? null
    },
    inferior: {
      ...vazias.inferior,
      quadril: medidasAntigas?.inferior?.quadril ?? null
    },
    detalhes: notasMigradas.join(' — ')
  };
}

/**
 * Migra o histórico antigo de medições (uma por evento/vestido) para o
 * novo conceito de pedidos, preservando o histórico de peças feitas mesmo
 * sem preço/prazo (que não existiam no formato antigo). Marca como
 * 'entregue' por ser um registro do passado, sem status real conhecido.
 * @param {Object} clienteBruto - Registro como veio do LocalStorage.
 * @returns {Pedido[]}
 */
function migrarPedidos(clienteBruto) {
  if (Array.isArray(clienteBruto.pedidos)) {
    // Pedidos salvos antes do parcelamento/custo de materiais existirem não
    // têm esses campos — tratados aqui como pagamento à vista (1x) sem
    // custo de materiais registrado, o comportamento que sempre existiu.
    return clienteBruto.pedidos.map((pedido) => ({
      ...pedido,
      numeroParcelas: Number.isInteger(pedido.numeroParcelas) ? pedido.numeroParcelas : 1,
      valorEntrada: typeof pedido.valorEntrada === 'number' ? pedido.valorEntrada : null,
      custoMateriais: typeof pedido.custoMateriais === 'number' ? pedido.custoMateriais : null
    }));
  }
  if (!Array.isArray(clienteBruto.historicoMedidas)) return [];

  return clienteBruto.historicoMedidas.map((medicao, indice) => ({
    idPedido: `ped_migrado_${medicao.idMedicao || indice}`,
    descricao: medicao.evento?.trim() || 'Peça (migrada de versão anterior)',
    preco: null,
    numeroParcelas: 1,
    valorEntrada: null,
    custoMateriais: null,
    dataCriacao: medicao.data || '',
    dataEntregaPrevista: '',
    status: 'entregue',
    ultimaNotificacao: null
  }));
}

/**
 * Garante que o objeto de despesas fixas mensais sempre tenha os três campos
 * do schema como números válidos (nunca NaN/undefined), preenchendo com 0
 * qualquer valor ausente ou inválido.
 * @param {Object} despesasBruto
 * @returns {DespesasFixas}
 */
export function normalizarDespesas(despesasBruto) {
  const numeroOuZero = (valor) => (typeof valor === 'number' && !Number.isNaN(valor) ? valor : 0);
  return {
    aluguer: numeroOuZero(despesasBruto?.aluguer),
    eletricidade: numeroOuZero(despesasBruto?.eletricidade),
    agua: numeroOuZero(despesasBruto?.agua)
  };
}

/**
 * Garante que um cliente lido do LocalStorage — seja do formato atual ou de
 * uma versão anterior do schema — sempre tenha o formato esperado pela
 * aplicação, migrando dados antigos em vez de descartá-los. Chamada uma
 * única vez, na camada de leitura do storage.
 * @param {Object} clienteBruto
 * @returns {Cliente}
 */
export function normalizarCliente(clienteBruto) {
  if (!clienteBruto || typeof clienteBruto !== 'object') return clienteBruto;

  return {
    id: clienteBruto.id,
    nome: clienteBruto.nome ?? '',
    telefone: clienteBruto.telefone ?? '',
    email: clienteBruto.email ?? '',
    dataCadastro: clienteBruto.dataCadastro ?? '',
    observacoes: clienteBruto.observacoes ?? clienteBruto.perfil?.observacoes ?? '',
    medidas: migrarMedidas(clienteBruto),
    pedidos: migrarPedidos(clienteBruto)
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
 * Valida os campos mínimos de um pedido antes de salvar, incluindo as regras
 * de parcelamento: no máximo MAX_PARCELAS parcelas e, quando parcelado
 * (numeroParcelas > 1), uma entrada de pelo menos PERCENTUAL_MINIMO_ENTRADA
 * do preço da peça.
 * @param {Object} pedido
 * @returns {{valido: boolean, erro?: string}}
 */
export function validarPedidoBasico(pedido) {
  if (!pedido || typeof pedido !== 'object' || Array.isArray(pedido)) {
    return { valido: false, erro: 'O pedido precisa ser um objeto.' };
  }
  if (typeof pedido.descricao !== 'string' || !pedido.descricao.trim()) {
    return { valido: false, erro: 'A descrição da peça é obrigatória.' };
  }

  const numeroParcelas = pedido.numeroParcelas === undefined || pedido.numeroParcelas === ''
    ? 1
    : Number(pedido.numeroParcelas);
  if (!Number.isInteger(numeroParcelas) || numeroParcelas < 1 || numeroParcelas > MAX_PARCELAS) {
    return { valido: false, erro: `O número de parcelas deve ser entre 1 e ${MAX_PARCELAS}.` };
  }

  if (numeroParcelas > 1) {
    const preco = pedido.preco === '' || pedido.preco === undefined || pedido.preco === null
      ? null
      : Number(pedido.preco);
    if (preco === null || Number.isNaN(preco) || preco <= 0) {
      return { valido: false, erro: 'Informe o preço da peça para parcelar o pagamento.' };
    }

    const valorEntrada = pedido.valorEntrada === '' || pedido.valorEntrada === undefined || pedido.valorEntrada === null
      ? null
      : Number(pedido.valorEntrada);
    if (valorEntrada === null || Number.isNaN(valorEntrada)) {
      return { valido: false, erro: 'Informe o valor de entrada para parcelar o pagamento.' };
    }
    if (valorEntrada > preco) {
      return { valido: false, erro: 'A entrada não pode ser maior que o preço total.' };
    }

    const minimoEntrada = preco * PERCENTUAL_MINIMO_ENTRADA;
    if (valorEntrada < minimoEntrada) {
      return {
        valido: false,
        erro: `A entrada mínima é de ${Math.round(PERCENTUAL_MINIMO_ENTRADA * 100)}% do preço (${minimoEntrada.toFixed(2)}).`
      };
    }
  }

  if (pedido.custoMateriais !== undefined && pedido.custoMateriais !== '' && pedido.custoMateriais !== null) {
    const custoMateriais = Number(pedido.custoMateriais);
    if (Number.isNaN(custoMateriais) || custoMateriais < 0) {
      return { valido: false, erro: 'O custo dos materiais precisa ser um número válido e não negativo.' };
    }
  }

  return { valido: true };
}

/**
 * Valida estruturalmente o array de clientes vindo de um arquivo de backup
 * importado, garantindo que cada registro tenha os campos mínimos exigidos
 * pelo schema e que 'pedidos' (quando presente) seja de fato um array.
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

    if ('pedidos' in cliente && !Array.isArray(cliente.pedidos)) {
      return {
        valido: false,
        erro: `Os pedidos do cliente "${cliente.nome}" (posição ${indice}) precisam ser um array.`
      };
    }
  }

  return { valido: true };
}
