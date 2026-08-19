/**
 * Módulo de inteligência de negócio: agrega dados dos pedidos (receita,
 * custo de materiais) e das despesas fixas mensais (renda, água,
 * eletricidade) para alimentar o dashboard. Não faz nenhuma escrita nos
 * pedidos — só leitura via storage.js e agregação.
 *
 * "Fecho do dia" e "ganho mensal" usam dataCriacao do pedido como
 * referência (não existe, no schema atual, uma data separada de
 * recebimento de pagamento) — ou seja, medem pedidos registrados no
 * período, não o caixa efetivamente recebido.
 */

import { lerStorage, lerDespesas, gravarDespesas } from './storage.js';
import { normalizarDespesas } from './validators.js';
import { dataAtualISO } from './utils.js';

/**
 * Retorna as despesas fixas mensais salvas (renda, água, eletricidade),
 * sempre com os três campos presentes como números.
 * @returns {import('./validators.js').DespesasFixas}
 */
export function obterDespesasFixas() {
  return normalizarDespesas(lerDespesas());
}

/**
 * Salva as despesas fixas mensais.
 * @param {Partial<import('./validators.js').DespesasFixas>} dadosDespesas
 * @returns {{sucesso: boolean, despesas?: import('./validators.js').DespesasFixas, erro?: string}}
 */
export function salvarDespesasFixas(dadosDespesas) {
  const despesas = normalizarDespesas(dadosDespesas);
  if (!gravarDespesas(despesas)) {
    return { sucesso: false, erro: 'Falha ao persistir as despesas no LocalStorage.' };
  }
  return { sucesso: true, despesas };
}

/**
 * Achata a base de clientes numa lista única de pedidos, cada um anotado
 * com o nome do cliente a que pertence — conveniente para agregações que
 * não se importam com o agrupamento por cliente.
 * @returns {Array<import('./validators.js').Pedido & {clienteNome: string}>}
 */
function todosPedidos() {
  return lerStorage().flatMap((cliente) =>
    cliente.pedidos.map((pedido) => ({ ...pedido, clienteNome: cliente.nome }))
  );
}

/**
 * Resume receita e custo de materiais de um conjunto de pedidos.
 * @param {Array<import('./validators.js').Pedido>} pedidos
 * @returns {{totalPedidos: number, totalReceita: number, totalMateriais: number, lucroBruto: number}}
 */
function resumirPedidos(pedidos) {
  const totalReceita = pedidos.reduce((soma, pedido) => soma + (pedido.preco || 0), 0);
  const totalMateriais = pedidos.reduce((soma, pedido) => soma + (pedido.custoMateriais || 0), 0);
  return {
    totalPedidos: pedidos.length,
    totalReceita,
    totalMateriais,
    lucroBruto: totalReceita - totalMateriais
  };
}

/**
 * Fecho de conta do dia: pedidos registrados numa data específica (hoje,
 * por padrão), com receita total, custo de materiais e lucro bruto do dia.
 * @param {string} [dataISO] - Data no formato AAAA-MM-DD; hoje se omitida.
 * @returns {{data: string, totalPedidos: number, totalReceita: number, totalMateriais: number, lucroBruto: number, pedidos: Array}}
 */
export function obterFechoDiario(dataISO = dataAtualISO().slice(0, 10)) {
  const pedidosDoDia = todosPedidos().filter((pedido) => pedido.dataCriacao?.slice(0, 10) === dataISO);
  return { data: dataISO, ...resumirPedidos(pedidosDoDia), pedidos: pedidosDoDia };
}

/**
 * Ganho do mês: receita e custo de materiais dos pedidos registrados no
 * mês, descontadas as despesas fixas mensais (renda, água, eletricidade),
 * resultando no lucro líquido do período.
 * @param {string} [anoMes] - Mês no formato AAAA-MM; mês atual se omitido.
 * @returns {{anoMes: string, totalPedidos: number, totalReceita: number, totalMateriais: number, lucroBruto: number, despesasFixas: import('./validators.js').DespesasFixas, totalDespesasFixas: number, lucroLiquido: number}}
 */
export function obterGanhoMensal(anoMes = dataAtualISO().slice(0, 7)) {
  const pedidosDoMes = todosPedidos().filter((pedido) => pedido.dataCriacao?.slice(0, 7) === anoMes);
  const resumo = resumirPedidos(pedidosDoMes);
  const despesasFixas = obterDespesasFixas();
  const totalDespesasFixas = despesasFixas.aluguer + despesasFixas.eletricidade + despesasFixas.agua;

  return {
    anoMes,
    ...resumo,
    despesasFixas,
    totalDespesasFixas,
    lucroLiquido: resumo.lucroBruto - totalDespesasFixas
  };
}
