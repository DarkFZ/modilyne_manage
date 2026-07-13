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
  adicionarNovaMedicao,
  excluirMedicao,
  obterUltimaMedicao,
  compararMedicoes,
  listarClientesInativos,
  exportarBackupJSON,
  exportarClienteIndividualJSON,
  importarBackupJSON,
  apagarTodosDados,
  diasDesde
} from './index.js';

const CAMPOS_MEDIDAS = {
  superior: {
    busto: 'Busto', subbusto: 'Sub-busto', separacaoBusto: 'Separação busto',
    alturaBusto: 'Altura busto', cinturaAlta: 'Cintura alta', ombroAOmbro: 'Ombro a ombro',
    comprimentoOmbro: 'Comprimento ombro', larguraCostas: 'Largura costas',
    comprimentoBraco: 'Comprimento braço', bicep: 'Bíceps', pulso: 'Pulso'
  },
  inferior: {
    quadril: 'Quadril', alturaQuadril: 'Altura quadril', ganchoTotal: 'Gancho total',
    coxa: 'Coxa', joelho: 'Joelho', cinturaAoChao: 'Cintura ao chão'
  },
  geral: { altura: 'Altura', peso: 'Peso' }
};

const estado = {
  clienteAtualId: null
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
      abrirDetalheCliente(estado.clienteAtualId, 'medidas');
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
  const data = new Date(dataISO);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarValor(valor) {
  return valor === null || valor === undefined || valor === '' ? '—' : valor;
}

// ---------- Lista de clientes ----------

function renderLista(termoBusca = '') {
  el('campo-busca').value = termoBusca;
  const clientes = termoBusca ? buscarClientesPorNome(termoBusca) : obterTodosClientes();
  const container = el('lista-clientes');
  container.innerHTML = '';

  el('lista-vazia').classList.toggle('escondido', clientes.length > 0);

  for (const cliente of clientes) {
    const ultimaMedicao = cliente.historicoMedidas[0];
    const cartao = document.createElement('div');
    cartao.className = 'cartao-cliente';
    cartao.innerHTML = `
      <h3></h3>
      <p class="tel"></p>
      <p class="ultima"></p>
    `;
    cartao.querySelector('h3').textContent = cliente.nome;
    cartao.querySelector('.tel').textContent = cliente.telefone || 'Sem telefone';
    cartao.querySelector('.ultima').textContent = ultimaMedicao
      ? `Última medição: ${formatarData(ultimaMedicao.data)}`
      : 'Sem medições registradas';
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
  el('cliente-silhueta').value = cliente?.perfil?.silhueta || '';
  el('cliente-postura').value = cliente?.perfil?.postura || '';
  el('cliente-observacoes').value = cliente?.perfil?.observacoes || '';
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
    perfil: {
      silhueta: el('cliente-silhueta').value,
      postura: el('cliente-postura').value,
      observacoes: el('cliente-observacoes').value
    }
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
  el('detalhe-silhueta').textContent = formatarValor(cliente.perfil?.silhueta);
  el('detalhe-postura').textContent = formatarValor(cliente.perfil?.postura);
  el('detalhe-observacoes').textContent = formatarValor(cliente.perfil?.observacoes);
  el('detalhe-cadastro').textContent = formatarData(cliente.dataCadastro);

  renderMedicoes(cliente);
  renderSelecaoComparacao(cliente);
  ativarAba(abaInicial);
  mostrarView('detalhe');
}

function ativarAba(nomeAba) {
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
  const confirmado = await confirmar(`Excluir "${cliente.nome}" e todo o histórico de medidas? Esta ação não pode ser desfeita.`);
  if (!confirmado) return;
  if (relatarResultado(excluirCliente(estado.clienteAtualId), 'Cliente excluída.')) {
    renderLista();
    mostrarView('lista');
  }
});

// ---------- Medidas ----------

function renderMedicoes(cliente) {
  const container = el('lista-medicoes');
  container.innerHTML = '';
  el('medicoes-vazio').classList.toggle('escondido', cliente.historicoMedidas.length > 0);

  cliente.historicoMedidas.forEach((medicao, indice) => {
    const detalhes = document.createElement('details');
    detalhes.className = 'cartao-medicao';
    detalhes.open = indice === 0;

    const linhas = ['superior', 'inferior', 'geral']
      .flatMap((grupo) =>
        Object.entries(CAMPOS_MEDIDAS[grupo]).map(
          ([campo, rotulo]) => `<tr><td>${rotulo}</td><td>${formatarValor(medicao.medidas[grupo][campo])}</td></tr>`
        )
      )
      .join('');

    detalhes.innerHTML = `
      <summary>
        <span>${medicao.evento}</span>
        <span class="medicao-meta">${formatarData(medicao.data)}</span>
      </summary>
      <table class="tabela-medidas">
        <thead><tr><th>Medida</th><th>Valor (${medicao.unidade})</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <button class="botao botao-perigo excluir-medicao">Excluir esta medição</button>
    `;

    detalhes.querySelector('.excluir-medicao').addEventListener('click', async (evento) => {
      evento.preventDefault();
      const confirmado = await confirmar(`Excluir a medição "${medicao.evento}" de ${formatarData(medicao.data)}?`);
      if (!confirmado) return;
      if (relatarResultado(excluirMedicao(cliente.id, medicao.idMedicao), 'Medição excluída.')) {
        abrirDetalheCliente(cliente.id, 'medidas');
      }
    });

    container.appendChild(detalhes);
  });
}

function construirCamposMedicao() {
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

el('btn-nova-medicao').addEventListener('click', () => {
  el('form-medicao').reset();
  el('medicao-unidade').value = 'cm';
  mostrarView('form-medicao');
});

el('form-medicao').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const dadosMedidas = { unidade: el('medicao-unidade').value || 'cm', superior: {}, inferior: {}, geral: {} };

  document.querySelectorAll('#form-medicao input[data-grupo]').forEach((input) => {
    const valor = input.value.trim();
    dadosMedidas[input.dataset.grupo][input.dataset.campo] = valor === '' ? null : Number(valor);
  });

  const resultado = adicionarNovaMedicao(estado.clienteAtualId, dadosMedidas, el('medicao-evento').value);
  if (relatarResultado(resultado, 'Medição registrada.')) {
    abrirDetalheCliente(estado.clienteAtualId, 'medidas');
  }
});

// ---------- Comparação de medições ----------

function renderSelecaoComparacao(cliente) {
  const opcoes = cliente.historicoMedidas
    .map((m) => `<option value="${m.idMedicao}">${m.evento} — ${formatarData(m.data)}</option>`)
    .join('');
  el('select-medicao-recente').innerHTML = opcoes;
  el('select-medicao-anterior').innerHTML = opcoes;
  if (cliente.historicoMedidas.length > 1) {
    el('select-medicao-anterior').selectedIndex = 1;
  }
  el('resultado-comparacao').innerHTML = '';
}

el('btn-comparar').addEventListener('click', () => {
  const idRecente = el('select-medicao-recente').value;
  const idAnterior = el('select-medicao-anterior').value;
  const container = el('resultado-comparacao');

  if (!idRecente || !idAnterior) {
    container.innerHTML = '<p class="estado-vazio">É preciso ter ao menos duas medições para comparar.</p>';
    return;
  }
  if (idRecente === idAnterior) {
    container.innerHTML = '<p class="estado-vazio">Escolha duas medições diferentes.</p>';
    return;
  }

  const resultado = compararMedicoes(estado.clienteAtualId, idRecente, idAnterior);
  if (!resultado.sucesso) {
    toast(resultado.erro, 'erro');
    return;
  }

  const linhas = ['superior', 'inferior', 'geral']
    .flatMap((grupo) =>
      Object.entries(CAMPOS_MEDIDAS[grupo]).map(([campo, rotulo]) => {
        const diff = resultado.diffs[grupo][campo];
        const classeDiferenca = diff.diferenca > 0 ? 'diferenca-positiva' : diff.diferenca < 0 ? 'diferenca-negativa' : '';
        const sinal = diff.diferenca > 0 ? '+' : '';
        return `<tr>
          <td>${rotulo}</td>
          <td>${formatarValor(diff.anterior)}</td>
          <td>${formatarValor(diff.recente)}</td>
          <td class="${classeDiferenca}">${diff.diferenca === null ? '—' : sinal + diff.diferenca}</td>
        </tr>`;
      })
    )
    .join('');

  container.innerHTML = `
    <table class="tabela-medidas">
      <thead><tr><th>Medida</th><th>Anterior</th><th>Recente</th><th>Diferença</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
});

// ---------- Clientes inativas ----------

function renderInativas() {
  const clientes = listarClientesInativos(180);
  const container = el('lista-inativas');
  container.innerHTML = '';
  el('inativas-vazio').classList.toggle('escondido', clientes.length > 0);

  for (const cliente of clientes) {
    const referencia = cliente.historicoMedidas[0]?.data || cliente.dataCadastro;
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

el('btn-menu').addEventListener('click', (evento) => {
  evento.stopPropagation();
  const dropdown = el('menu-dropdown');
  const aberto = !dropdown.classList.contains('escondido');
  dropdown.classList.toggle('escondido', aberto);
  el('btn-menu').setAttribute('aria-expanded', String(!aberto));
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

// ---------- Inicialização ----------

construirCamposMedicao();
renderLista();
mostrarView('lista');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((erro) => {
      console.error('[App] Falha ao registrar o service worker.', erro);
    });
  });
}
