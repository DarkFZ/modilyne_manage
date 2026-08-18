# Modilyne (PWA local-first)

PWA de atelier de costura, com módulos de lógica pura em JavaScript ES6.
Sem backend: toda a base de clientes vive no `LocalStorage` do navegador, sob
a chave `clientes_estilista`. Nenhum dado sai da máquina do usuário a menos
que ele exporte um backup manualmente.

A lógica (`js/*Repository.js`, `validators.js`, `storage.js`, `backupService.js`)
é isolada de DOM/UI e reexportada por `js/index.js`, único ponto de import
usado pela camada de interface (`index.html`, `css/style.css`, `js/app.js`).

## Estrutura

```
js/
  constants.js            chave do LocalStorage, versão de backup, unidade padrão, etapas do kanban
  utils.js                geração de id (cli_/ped_) e datas ISO (diasDesde/diasAte)
  storage.js               leitura/escrita crua no LocalStorage, com tratamento de corrupção e cota
  validators.js            schema (JSDoc typedefs), validação de cliente, de pedido e de arrays importados
  clientesRepository.js     CRUD de clientes, medidas e pedidos + consultas/relatórios
  backupService.js          exportar/importar/apagar dados (privacidade)
  index.js                  reexporta tudo — único ponto de import para a UI
```

## Schema de dados

Cada cliente salvo em `clientes_estilista` segue esta forma:

```js
{
  id: 'cli_<timestamp>',
  nome: string,
  telefone: string,
  email: string,
  dataCadastro: string,       // ISO 8601
  observacoes: string,

  // Único conjunto de medidas por cliente, sempre editável (não é histórico).
  medidas: {
    unidade: string,           // 'cm' por padrão
    atualizadoEm: string|null, // ISO 8601, null enquanto nunca editado
    superior: {
      ombro, busto, cinturaAlta, cintura, ombroCintura, braco   // number | null
    },
    inferior: {
      quadril, cinturaJoelho, cinturaPe                          // number | null
    },
    detalhes: string
  },

  // Um cliente pode ter vários pedidos (peças), cada um com seu próprio
  // kanban de pagamento/processo e prazo de entrega.
  pedidos: [
    {
      idPedido: 'ped_<timestamp>',
      descricao: string,           // peça encomendada, ex: 'Vestido de festa'
      preco: number|null,
      dataCriacao: string,         // ISO 8601
      dataEntregaPrevista: string, // 'AAAA-MM-DD'
      status: string,              // ver STATUS_PEDIDO em constants.js
      ultimaNotificacao: string|null // 'AAAA-MM-DD' do último aviso de prazo emitido
    },
    // ...mais recente sempre em pedidos[0]
  ]
}
```

Campos de medida não informados são sempre preenchidos com `null` (nunca
ficam ausentes), para que o schema seja previsível em qualquer registro.

### Kanban de pedidos

Cada pedido avança por estas etapas (`STATUS_PEDIDO` em `constants.js`),
nesta ordem:

`pagamento_entrada` → `corte` → `costura` → `acabamento` → `pagamento_restante` → `entregue`

O histórico de peças feitas (com preço) é o próprio conjunto de pedidos —
inclusive os já `entregue` continuam visíveis na sua coluna do kanban.

### Aviso de entrega próxima

`obterPedidosProximosPrazo(diasAntecedencia = DIAS_AVISO_ENTREGA)` (padrão:
3 dias, ver `constants.js`) lista pedidos não entregues cuja
`dataEntregaPrevista` está a poucos dias ou já vencida. A UI (`app.js`)
consulta essa lista ao abrir o app e, uma vez por dia por pedido
(controlado por `ultimaNotificacao`), mostra um toast e — se a permissão do
navegador for concedida — uma notificação via `Notification` API. Como o
app é 100% local e sem servidor, esse aviso só dispara enquanto o app está
aberto no navegador; não há push em segundo plano.

## API

### `clientesRepository.js`

| Função | Descrição |
|---|---|
| `obterTodosClientes()` | Retorna o array completo de clientes (`[]` se vazio). |
| `obterClientePorId(id)` | Retorna o cliente ou `null`. |
| `buscarClientesPorNome(termo)` | Filtro case-insensitive por trecho do nome. |
| `salvarCliente(clienteObjeto)` | Cria (sem `id`) ou atualiza dados cadastrais (com `id` existente). Nunca sobrescreve `medidas`/`pedidos` na atualização. |
| `excluirCliente(id)` | Remove o cliente e todo o histórico de pedidos. |
| `atualizarMedidas(clienteId, dadosMedidas)` | Atualiza o conjunto único e editável de medidas do cliente. |
| `adicionarPedido(clienteId, dadosPedido)` | Cria um pedido novo, já na etapa `pagamento_entrada`. |
| `editarPedido(clienteId, idPedido, dadosPedido)` | Atualiza descrição/preço/data de um pedido, sem mudar seu status. |
| `atualizarStatusPedido(clienteId, idPedido, novoStatus)` | Move o pedido para outra etapa do kanban. |
| `excluirPedido(clienteId, idPedido)` | Remove um pedido específico. |
| `marcarNotificacaoEnviada(clienteId, idPedido, dataISO)` | Marca que o aviso de prazo já foi emitido hoje para aquele pedido. |
| `obterPedidosProximosPrazo(diasAntecedencia = 3)` | Pedidos não entregues com entrega próxima ou atrasada, para o aviso da UI. |
| `listarClientesInativos(diasLimite = 180)` | Clientes sem pedido (ou cadastro) há mais de N dias — para lembrete de recontato. |

Todas as funções de escrita retornam `{ sucesso: boolean, erro?: string, ...dados }`
em vez de lançar exceção — a UI decide como exibir cada falha.

### `backupService.js`

| Função | Descrição |
|---|---|
| `exportarBackupJSON()` | Baixa `backup_estilista_AAAA-MM-DD.json` com toda a base. Falha se não houver dados. |
| `exportarClienteIndividualJSON(clienteId)` | Baixa a ficha de um único cliente (`ficha_<nome>_<data>.json`). |
| `importarBackupJSON(arquivoTexto)` | Faz `JSON.parse` protegido, valida estrutura (array + campos obrigatórios), e só então **substitui** a base local. |
| `apagarTodosDados()` | Apaga toda a base local (a confirmação com o usuário é responsabilidade da UI). |

### `validators.js`

- `criarMedidasVazias()` — schema de medidas com todos os campos em `null`.
- `validarClienteBasico(cliente)` — valida antes de salvar um cliente.
- `validarPedidoBasico(pedido)` — valida antes de salvar um pedido.
- `validarArrayClientesImportado(dados)` — valida um backup antes de importar.

## Uso

```js
import {
  salvarCliente,
  atualizarMedidas,
  adicionarPedido,
  atualizarStatusPedido,
  obterTodosClientes,
  exportarBackupJSON,
  importarBackupJSON
} from './js/index.js';

const { cliente } = salvarCliente({ nome: 'Maria Silva', telefone: '11999990000' });

atualizarMedidas(cliente.id, { superior: { busto: 90 }, detalhes: 'Prefere caimento solto' });

const { pedido } = adicionarPedido(cliente.id, {
  descricao: 'Vestido de festa',
  preco: 450,
  dataEntregaPrevista: '2026-09-01'
});

atualizarStatusPedido(cliente.id, pedido.idPedido, 'corte');

console.log(obterTodosClientes());

exportarBackupJSON(); // dispara download no navegador
```

## Decisão de design: geração de id

`gerarId(prefixo)` segue o formato `prefixo_timestamp` (ex: `cli_1731520000000`).
Duas chamadas no mesmo milissegundo — por exemplo, dois pedidos criados
em lote via código — colidiriam e quebrariam buscas/exclusões por id. Por
isso o gerador mantém um contador interno que só entra em ação nesse caso
raro de colisão (`ped_1731520000000_1`), preservando o formato simples do
schema no caso normal.

## Testes

O redesenho do schema (medidas únicas por cliente + pedidos com kanban de
pagamento/processo) foi validado manualmente ponta a ponta em um navegador
real (Chromium via Playwright): cadastro de cliente, edição de medidas,
criação de pedido e progressão pelas 6 etapas do kanban até `entregue`,
sem erros no console.

Nenhum framework de teste automatizado foi adicionado ao projeto.
