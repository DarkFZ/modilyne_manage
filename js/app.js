/**
 * Camada de UI: liga o DOM aos módulos de lógica em js/index.js.
 * Nenhuma regra de negócio mora aqui — apenas leitura de formulários,
 * renderização e navegação entre "views" (seções mostradas/escondidas).
 */
import {
  obterTodosClientes,
  obterClientePorId,
  buscarClientesPorNome,
  salvarCliente,
  excluirCliente,
  atualizarMedidas,
  adicionarPedido,
  editarPedido,
  atualizarStatusPedido,
  excluirPedido,
  obterPedidosProximosPrazo,
  marcarNotificacaoEnviada,
  listarClientesInativos,
  exportarBackupJSON,
  exportarClienteIndividualJSON,
  importarBackupJSON,
  apagarTodosDados,
  diasDesde,
  diasAte,
  STATUS_PEDIDO,
  DIAS_AVISO_ENTREGA
} from './index.js';

const CAMPOS_MEDIDAS = {
  superior: {
    ombro: 'Ombro', busto: 'Busto', cinturaAlta: 'Cintura alta', cintura: 'Cintura',
    ombroCintura: 'Ombro à cintura', braco: 'Braço'
  },
  inferior: {
    quadril: 'Quadril', cinturaJoelho: 'Cintura ao joelho', cinturaPe: 'Cintura ao pé'
  }
};

const estado = {
  clienteAtualId: null,
  abaAtual: 'perfil'
};

const el = (id) => document.getElementById(id);

// ---------- Navegação entre views ----------

function mostrarView(nomeView) {
  document.querySelectorAll('.view').forEach((secao) => secao.classList.add('escondido'));
  el(`view-${nomeView}`).classList.remove('escondido');
  el('menu-dropdown').classList.add('escondido');
}

document.querySelectorAll('[data-voltar-para]').forEach((botao) => {
  botao.addEventListener('click', () => {
    const destino = botao.dataset.voltarPara;
    if (destino === 'lista') {
      renderLista();
      mostrarView('lista');
    } else if (destino === 'detalhe') {
      abrirDetalheCliente(estado.clienteAtualId, estado.abaAtual);
    }
  });
});

// ---------- Toast / feedback ----------

let toastTimeout;
function toast(mensagem, tipo = 'neutro') {
  const elemento = el('toast');
  elemento.textContent = mensagem;
  elemento.className = 'toast';
  if (tipo === 'erro') elemento.classList.add('toast-erro');
  if (tipo === 'sucesso') elemento.classList.add('toast-sucesso');
  elemento.classList.remove('escondido');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elemento.classList.add('escondido'), 3200);
}

function relatarResultado(resultado, mensagemSucesso) {
  if (resultado.sucesso) {
    toast(mensagemSucesso, 'sucesso');
  } else {
    toast(resultado.erro || 'Ocorreu um erro inesperado.', 'erro');
  }
  return resultado.sucesso;
}

// ---------- Diálogo de confirmação ----------

function confirmar(mensagem) {
  return new Promise((resolve) => {
    const overlay = el('dialogo-confirmacao');
    el('dialogo-mensagem').textContent = mensagem;
    overlay.classList.remove('escondido');

    const limpar = (resultado) => {
      overlay.classList.add('escondido');
      btnConfirmar.removeEventListener('click', onConfirmar);
      btnCancelar.removeEventListener('click', onCancelar);
      resolve(resultado);
    };
    const btnConfirmar = el('dialogo-confirmar');
    const btnCancelar = el('dialogo-cancelar');
    const onConfirmar = () => limpar(true);
    const onCancelar = () => limpar(false);
    btnConfirmar.addEventListener('click', onConfirmar);
    btnCancelar.addEventListener('click', onCancelar);
  });
}

// ---------- Formatação ----------

function formatarData(dataISO) {
  if (!dataISO) return '—';
  const data = new Date(dataISO);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarValor(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

function formatarPreco(preco) {
  return typeof preco === 'number'
    ? preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}

function formatarPrazo(diasRestantes) {
  if (diasRestantes === null || diasRestantes === undefined) return '';
  if (diasRestantes < 0) return `Atrasado ${Math.abs(diasRestantes)} dia(s)`;
  if (diasRestantes === 0) return 'Entrega hoje';
  if (diasRestantes === 1) return 'Entrega amanhã';
  return `Faltam ${diasRestantes} dias`;
}

// ---------- Lista de clientes ----------

function renderLista(termoBusca = '') {
  el('campo-busca').value = termoBusca;
  const clientes = (termoBusca ? buscarClientesPorNome(termoBusca) : obterTodosClientes()).slice().reverse();
  const container = el('lista-clientes');
  container.innerHTML = '';

  el('lista-vazia').classList.toggle('escondido', clientes.length > 0);

  for (const cliente of clientes) {
    const pedidosAbertos = cliente.pedidos.filter((pedido) => pedido.status !== 'entregue').length;
    const proximoPrazo = cliente.pedidos
      .filter((pedido) => pedido.status !== 'entregue' && pedido.dataEntregaPrevista)
      .map((pedido) => diasAte(pedido.dataEntregaPrevista))
      .filter((dias) => dias !== null && dias <= DIAS_AVISO_ENTREGA)
      .sort((a, b) => a - b)[0];

    const cartao = document.createElement('div');
    cartao.className = 'cartao-cliente';
    cartao.innerHTML = `
      <h3></h3>
      <p class="tel"></p>
      <p class="pedidos"></p>
      <p class="aviso-prazo escondido"></p>
    `;
    cartao.querySelector('h3').textContent = cliente.nome;
    cartao.querySelector('.tel').textContent = cliente.telefone || 'Sem telefone';
    cartao.querySelector('.pedidos').textContent = pedidosAbertos > 0
      ? `${pedidosAbertos} pedido(s) em andamento`
      : 'Sem pedidos em andamento';

    if (proximoPrazo !== undefined) {
      const aviso = cartao.querySelector('.aviso-prazo');
      aviso.textContent = formatarPrazo(proximoPrazo);
      aviso.classList.remove('escondido');
      aviso.classList.add(proximoPrazo < 0 ? 'aviso-atrasado' : 'aviso-proximo');
    }

    cartao.addEventListener('click', () => abrirDetalheCliente(cliente.id, 'perfil'));
    container.appendChild(cartao);
  }
}

el('campo-busca').addEventListener('input', (evento) => renderLista(evento.target.value));

// ---------- Formulário de cliente (novo / editar) ----------

function abrirFormularioCliente(cliente = null) {
  el('form-cliente').reset();
  el('cliente-id').value = cliente?.id || '';
  el('form-cliente-titulo').textContent = cliente ? 'Editar cliente' : 'Nova cliente';
  el('cliente-nome').value = cliente?.nome || '';
  el('cliente-telefone').value = cliente?.telefone || '';
  el('cliente-email').value = cliente?.email || '';
  el('cliente-observacoes').value = cliente?.observacoes || '';
  mostrarView('form-cliente');
  el('cliente-nome').focus();
}

el('btn-nova-cliente').addEventListener('click', () => abrirFormularioCliente());

el('form-cliente').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const id = el('cliente-id').value || undefined;
  const resultado = salvarCliente({
    id,
    nome: el('cliente-nome').value,
    telefone: el('cliente-telefone').value,
    email: el('cliente-email').value,
    observacoes: el('cliente-observacoes').value
  });

  if (relatarResultado(resultado, id ? 'Dados atualizados.' : 'Cliente cadastrada.')) {
    if (id) {
      abrirDetalheCliente(id, 'perfil');
    } else {
      renderLista();
      mostrarView('lista');
    }
  }
});

// ---------- Detalhe do cliente ----------

function abrirDetalheCliente(clienteId, abaInicial = 'perfil') {
  const cliente = obterClientePorId(clienteId);
  if (!cliente) {
    toast('Cliente não encontrado.', 'erro');
    renderLista();
    mostrarView('lista');
    return;
  }

  estado.clienteAtualId = clienteId;

  el('detalhe-nome').textContent = cliente.nome;
  el('detalhe-contato').textContent = [cliente.telefone, cliente.email].filter(Boolean).join(' · ') || 'Sem contato registrado';
  el('detalhe-observacoes').textContent = formatarValor(cliente.observacoes);
  el('detalhe-cadastro').textContent = formatarData(cliente.dataCadastro);

  renderMedidas(cliente);
  renderPedidos(cliente);
  ativarAba(abaInicial);
  mostrarView('detalhe');
}

function ativarAba(nomeAba) {
  estado.abaAtual = nomeAba;
  document.querySelectorAll('.aba').forEach((botao) => {
    const ativa = botao.dataset.aba === nomeAba;
    botao.classList.toggle('aba-ativa', ativa);
    botao.setAttribute('aria-selected', String(ativa));
  });
  document.querySelectorAll('.painel-aba').forEach((painel) => {
    painel.classList.toggle('escondido', painel.id !== `aba-${nomeAba}`);
  });
}

document.querySelectorAll('.aba').forEach((botao) => {
  botao.addEventListener('click', () => ativarAba(botao.dataset.aba));
});

el('btn-editar-cliente').addEventListener('click', () => {
  abrirFormularioCliente(obterClientePorId(estado.clienteAtualId));
});

el('btn-exportar-ficha').addEventListener('click', () => {
  relatarResultado(exportarClienteIndividualJSON(estado.clienteAtualId), 'Ficha exportada.');
});

el('btn-excluir-cliente').addEventListener('click', async () => {
  const cliente = obterClientePorId(estado.clienteAtualId);
  const confirmado = await confirmar(`Excluir "${cliente.nome}" e todo o histórico de pedidos? Esta ação não pode ser desfeita.`);
  if (!confirmado) return;
  if (relatarResultado(excluirCliente(estado.clienteAtualId), 'Cliente excluída.')) {
    renderLista();
    mostrarView('lista');
  }
});

// ---------- Medidas (únicas por cliente, sempre editáveis) ----------

function renderMedidas(cliente) {
  const medidas = cliente.medidas;

  el('medidas-atualizado').textContent = medidas.atualizadoEm
    ? `Atualizadas em ${formatarData(medidas.atualizadoEm)}`
    : 'Ainda não há medidas registradas.';

  const listaSuperior = el('medidas-superior');
  listaSuperior.innerHTML = Object.entries(CAMPOS_MEDIDAS.superior)
    .map(([campo, rotulo]) => `<dt>${rotulo}</dt><dd>${formatarValor(medidas.superior[campo])}${medidas.superior[campo] !== null ? ` ${medidas.unidade}` : ''}</dd>`)
    .join('');

  const listaInferior = el('medidas-inferior');
  listaInferior.innerHTML = Object.entries(CAMPOS_MEDIDAS.inferior)
    .map(([campo, rotulo]) => `<dt>${rotulo}</dt><dd>${formatarValor(medidas.inferior[campo])}${medidas.inferior[campo] !== null ? ` ${medidas.unidade}` : ''}</dd>`)
    .join('');

  el('medidas-detalhes').textContent = formatarValor(medidas.detalhes);
}

function construirCamposMedidas() {
  for (const grupo of Object.keys(CAMPOS_MEDIDAS)) {
    const container = el(`campos-${grupo}`);
    container.innerHTML = '';
    for (const [campo, rotulo] of Object.entries(CAMPOS_MEDIDAS[grupo])) {
      const label = document.createElement('label');
      label.className = 'campo';
      label.innerHTML = `<span>${rotulo}</span><input type="number" step="0.1" data-grupo="${grupo}" data-campo="${campo}" />`;
      container.appendChild(label);
    }
  }
}

el('btn-editar-medidas').addEventListener('click', () => {
  const cliente = obterClientePorId(estado.clienteAtualId);
  const medidas = cliente.medidas;

  el('medidas-unidade').value = medidas.unidade || 'cm';
  el('medidas-campo-detalhes').value = medidas.detalhes || '';

  document.querySelectorAll('#form-medidas input[data-grupo]').forEach((input) => {
    const valor = medidas[input.dataset.grupo][input.dataset.campo];
    input.value = valor === null || valor === undefined ? '' : valor;
  });

  mostrarView('form-medidas');
});

el('form-medidas').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const dadosMedidas = { unidade: el('medidas-unidade').value || 'cm', superior: {}, inferior: {}, detalhes: el('medidas-campo-detalhes').value };

  document.querySelectorAll('#form-medidas input[data-grupo]').forEach((input) => {
    const valor = input.value.trim();
    dadosMedidas[input.dataset.grupo][input.dataset.campo] = valor === '' ? null : Number(valor);
  });

  const resultado = atualizarMedidas(estado.clienteAtualId, dadosMedidas);
  if (relatarResultado(resultado, 'Medidas atualizadas.')) {
    abrirDetalheCliente(estado.clienteAtualId, 'medidas');
  }
});

// ---------- Pedidos (kanban de pagamento/processo) ----------

function renderPedidos(cliente) {
  const container = el('kanban-pedidos');
  container.innerHTML = '';
  el('pedidos-vazio').classList.toggle('escondido', cliente.pedidos.length > 0);

  for (const status of STATUS_PEDIDO) {
    const coluna = document.createElement('div');
    coluna.className = 'kanban-coluna';

    const pedidosDaColuna = cliente.pedidos.filter((pedido) => pedido.status === status.chave);

    coluna.innerHTML = `
      <h3 class="kanban-coluna-titulo">${status.rotulo} <span class="kanban-contagem">${pedidosDaColuna.length}</span></h3>
      <div class="kanban-cartoes"></div>
    `;

    const cartoesContainer = coluna.querySelector('.kanban-cartoes');
    pedidosDaColuna.forEach((pedido) => {
      cartoesContainer.appendChild(criarCartaoPedido(cliente, pedido, status.chave));
    });

    container.appendChild(coluna);
  }
}

function criarCartaoPedido(cliente, pedido, statusAtual) {
  const indiceAtual = STATUS_PEDIDO.findIndex((s) => s.chave === statusAtual);
  const diasRestantes = pedido.dataEntregaPrevista ? diasAte(pedido.dataEntregaPrevista) : null;

  const cartao = document.createElement('div');
  cartao.className = 'kanban-cartao';

  let classeAviso = '';
  let textoAviso = '';
  if (diasRestantes !== null && statusAtual !== 'entregue') {
    textoAviso = formatarPrazo(diasRestantes);
    classeAviso = diasRestantes < 0 ? 'aviso-atrasado' : diasRestantes <= DIAS_AVISO_ENTREGA ? 'aviso-proximo' : '';
  }

  cartao.innerHTML = `
    <p class="kanban-cartao-titulo"></p>
    <p class="kanban-cartao-preco"></p>
    <p class="kanban-cartao-entrega"></p>
    ${textoAviso ? `<p class="kanban-cartao-aviso ${classeAviso}">${textoAviso}</p>` : ''}
    <div class="kanban-cartao-acoes">
      <button class="botao-icone-pequeno botao-voltar-etapa" title="Etapa anterior" ${indiceAtual === 0 ? 'disabled' : ''}>&larr;</button>
      <button class="botao-icone-pequeno botao-avancar-etapa" title="Próxima etapa" ${indiceAtual === STATUS_PEDIDO.length - 1 ? 'disabled' : ''}>&rarr;</button>
      <button class="botao-icone-pequeno botao-editar-pedido" title="Editar pedido">✎</button>
      <button class="botao-icone-pequeno botao-excluir-pedido" title="Excluir pedido">🗑</button>
    </div>
  `;

  cartao.querySelector('.kanban-cartao-titulo').textContent = pedido.descricao;
  cartao.querySelector('.kanban-cartao-preco').textContent = formatarPreco(pedido.preco);
  cartao.querySelector('.kanban-cartao-entrega').textContent = pedido.dataEntregaPrevista
    ? `Entrega: ${formatarData(pedido.dataEntregaPrevista)}`
    : 'Sem data de entrega definida';

  cartao.querySelector('.botao-voltar-etapa').addEventListener('click', () => {
    if (indiceAtual === 0) return;
    moverStatusPedido(pedido.idPedido, STATUS_PEDIDO[indiceAtual - 1].chave);
  });
  cartao.querySelector('.botao-avancar-etapa').addEventListener('click', () => {
    if (indiceAtual === STATUS_PEDIDO.length - 1) return;
    moverStatusPedido(pedido.idPedido, STATUS_PEDIDO[indiceAtual + 1].chave);
  });
  cartao.querySelector('.botao-editar-pedido').addEventListener('click', () => abrirFormularioPedido(pedido));
  cartao.querySelector('.botao-excluir-pedido').addEventListener('click', async () => {
    const confirmado = await confirmar(`Excluir o pedido "${pedido.descricao}"?`);
    if (!confirmado) return;
    if (relatarResultado(excluirPedido(cliente.id, pedido.idPedido), 'Pedido excluído.')) {
      abrirDetalheCliente(cliente.id, 'pedidos');
    }
  });

  return cartao;
}

function moverStatusPedido(idPedido, novoStatus) {
  const resultado = atualizarStatusPedido(estado.clienteAtualId, idPedido, novoStatus);
  if (relatarResultado(resultado, 'Status do pedido atualizado.')) {
    abrirDetalheCliente(estado.clienteAtualId, 'pedidos');
  }
}

function abrirFormularioPedido(pedido = null) {
  el('form-pedido').reset();
  el('pedido-id').value = pedido?.idPedido || '';
  el('form-pedido-titulo').textContent = pedido ? 'Editar pedido' : 'Novo pedido';
  el('pedido-descricao').value = pedido?.descricao || '';
  el('pedido-preco').value = pedido?.preco ?? '';
  el('pedido-data-entrega').value = pedido?.dataEntregaPrevista || '';
  mostrarView('form-pedido');
  el('pedido-descricao').focus();
}

el('btn-novo-pedido').addEventListener('click', () => abrirFormularioPedido());

el('form-pedido').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const dadosPedido = {
    descricao: el('pedido-descricao').value,
    preco: el('pedido-preco').value === '' ? null : Number(el('pedido-preco').value),
    dataEntregaPrevista: el('pedido-data-entrega').value
  };

  const idPedido = el('pedido-id').value;
  const resultado = idPedido
    ? editarPedido(estado.clienteAtualId, idPedido, dadosPedido)
    : adicionarPedido(estado.clienteAtualId, dadosPedido);

  if (relatarResultado(resultado, idPedido ? 'Pedido atualizado.' : 'Pedido registrado.')) {
    abrirDetalheCliente(estado.clienteAtualId, 'pedidos');
  }
});

// ---------- Aviso de entregas próximas ----------

async function verificarPedidosProximos() {
  const proximos = obterPedidosProximosPrazo(DIAS_AVISO_ENTREGA);
  if (proximos.length === 0) return;

  const hoje = new Date().toISOString().slice(0, 10);
  const pendentesDeAviso = proximos.filter(({ pedido }) => pedido.ultimaNotificacao !== hoje);
  if (pendentesDeAviso.length === 0) return;

  if (pendentesDeAviso.length === 1) {
    const { clienteNome, pedido, diasRestantes } = pendentesDeAviso[0];
    toast(`${clienteNome} — ${pedido.descricao}: ${formatarPrazo(diasRestantes)}.`, diasRestantes < 0 ? 'erro' : 'neutro');
  } else {
    toast(`${pendentesDeAviso.length} pedidos com entrega próxima ou atrasada.`, 'neutro');
  }

  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      pendentesDeAviso.forEach(({ clienteNome, pedido, diasRestantes }) => {
        new Notification(`${clienteNome} — entrega próxima`, {
          body: `${pedido.descricao}: ${formatarPrazo(diasRestantes)}.`,
          icon: 'assets/Modilyne_logo.svg'
        });
      });
    }
  }

  pendentesDeAviso.forEach(({ clienteId, pedido }) => marcarNotificacaoEnviada(clienteId, pedido.idPedido, hoje));
}

// ---------- Clientes inativas ----------

function renderInativas() {
  const clientes = listarClientesInativos(180);
  const container = el('lista-inativas');
  container.innerHTML = '';
  el('inativas-vazio').classList.toggle('escondido', clientes.length > 0);

  for (const cliente of clientes) {
    const referencia = cliente.pedidos[0]?.dataCriacao || cliente.dataCadastro;
    const cartao = document.createElement('div');
    cartao.className = 'cartao-cliente';
    cartao.innerHTML = `<h3></h3><p></p>`;
    cartao.querySelector('h3').textContent = cliente.nome;
    cartao.querySelector('p').textContent = `Sem contato há ${diasDesde(referencia)} dias`;
    cartao.addEventListener('click', () => abrirDetalheCliente(cliente.id, 'perfil'));
    container.appendChild(cartao);
  }
}

// ---------- Menu / backup ----------

// Por padrão o menu abre para a esquerda (alinhado à direita do botão).
// Se isso o levaria para fora da tela — botão perto da borda esquerda —
// ele abre para a direita em vez disso.
function posicionarDropdown(dropdown) {
  dropdown.classList.remove('dropdown-abre-direita');
  if (dropdown.getBoundingClientRect().left < 0) {
    dropdown.classList.add('dropdown-abre-direita');
  }
}

el('btn-menu').addEventListener('click', (evento) => {
  evento.stopPropagation();
  const dropdown = el('menu-dropdown');
  const aberto = !dropdown.classList.contains('escondido');
  dropdown.classList.toggle('escondido', aberto);
  el('btn-menu').setAttribute('aria-expanded', String(!aberto));
  if (!aberto) posicionarDropdown(dropdown);
});

document.addEventListener('click', (evento) => {
  const container = document.querySelector('.menu-container');
  if (!container.contains(evento.target)) {
    el('menu-dropdown').classList.add('escondido');
  }
});

el('btn-inativas').addEventListener('click', () => {
  renderInativas();
  mostrarView('inativas');
});

el('btn-exportar-tudo').addEventListener('click', () => {
  relatarResultado(exportarBackupJSON(), 'Backup exportado.');
});

el('btn-importar').addEventListener('click', () => {
  el('menu-dropdown').classList.add('escondido');
  el('input-importar-arquivo').click();
});

el('input-importar-arquivo').addEventListener('change', async (evento) => {
  const arquivo = evento.target.files[0];
  evento.target.value = '';
  if (!arquivo) return;

  const confirmado = await confirmar('Importar este backup vai substituir toda a base de clientes atual. Continuar?');
  if (!confirmado) return;

  const texto = await arquivo.text();
  const resultado = importarBackupJSON(texto);
  if (relatarResultado(resultado, `Backup importado: ${resultado.totalClientes} cliente(s).`)) {
    renderLista();
    mostrarView('lista');
  }
});

el('btn-apagar-tudo').addEventListener('click', async () => {
  el('menu-dropdown').classList.add('escondido');
  const confirmado = await confirmar('Apagar TODOS os dados locais permanentemente? Considere exportar um backup antes.');
  if (!confirmado) return;
  if (relatarResultado(apagarTodosDados(), 'Todos os dados foram apagados.')) {
    renderLista();
    mostrarView('lista');
  }
});

// ---------- Tema claro/escuro ----------

const CHAVE_TEMA = 'atelier_tema_preferencia';

function obterTemaEfetivo() {
  const salvo = localStorage.getItem(CHAVE_TEMA);
  if (salvo === 'claro' || salvo === 'escuro') return salvo;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
}

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light');
  el('btn-tema').textContent = tema === 'escuro' ? '☀️' : '🌙';
  el('btn-tema').setAttribute('aria-label', tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro');
}

el('btn-tema').addEventListener('click', () => {
  const novoTema = obterTemaEfetivo() === 'escuro' ? 'claro' : 'escuro';
  localStorage.setItem(CHAVE_TEMA, novoTema);
  aplicarTema(novoTema);
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!localStorage.getItem(CHAVE_TEMA)) aplicarTema(obterTemaEfetivo());
});

aplicarTema(obterTemaEfetivo());

// ---------- Inicialização ----------

construirCamposMedidas();
renderLista();
mostrarView('lista');
verificarPedidosProximos();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((erro) => {
      console.error('[App] Falha ao registrar o service worker.', erro);
    });
  });
}
