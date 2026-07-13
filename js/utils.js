/**
 * Utilitários puros de geração de identificadores e datas.
 * Não dependem de LocalStorage nem de DOM.
 */

let ultimoTimestamp = 0;
let contadorColisao = 0;

/**
 * Gera um identificador seguindo o padrão '{prefixo}_{timestamp}'.
 *
 * Duas chamadas no mesmo milissegundo (ex: salvar duas medições em lote via
 * código, ou cliques muito rápidos) receberiam o mesmo timestamp e, portanto,
 * o mesmo id — o que quebraria buscas e exclusões por id mais adiante. Por
 * isso mantemos um contador interno que só entra em ação nesse caso raro de
 * colisão, preservando o formato '{prefixo}_{timestamp}' do schema sempre
 * que possível.
 * @param {string} prefixo - Prefixo semântico (ex: 'cli', 'med').
 * @returns {string} Identificador único no formato exigido pelo schema.
 */
export function gerarId(prefixo) {
  const agora = Date.now();
  if (agora === ultimoTimestamp) {
    contadorColisao += 1;
    return `${prefixo}_${agora}_${contadorColisao}`;
  }
  ultimoTimestamp = agora;
  contadorColisao = 0;
  return `${prefixo}_${agora}`;
}

/**
 * Retorna a data/hora atual em formato ISO 8601, usado em todo o schema
 * (dataCadastro, data de medição) para manter consistência de fuso e ordenação.
 * @returns {string}
 */
export function dataAtualISO() {
  return new Date().toISOString();
}

/**
 * Calcula quantos dias inteiros se passaram entre uma data ISO e agora.
 * @param {string} dataISO
 * @returns {number}
 */
export function diasDesde(dataISO) {
  const referencia = new Date(dataISO).getTime();
  if (Number.isNaN(referencia)) return Infinity;
  return Math.floor((Date.now() - referencia) / (1000 * 60 * 60 * 24));
}
