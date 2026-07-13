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
  constants.js            chave do LocalStorage, versão de backup, unidade padrão
  utils.js                geração de id (cli_/med_) e datas ISO
  storage.js               leitura/escrita crua no LocalStorage, com tratamento de corrupção e cota
  validators.js            schema (JSDoc typedefs), validação de cliente e de arrays importados
  clientesRepository.js     CRUD de clientes e medições + consultas/relatórios
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
  perfil: {
    silhueta: string,
    postura: string,
    observacoes: string
  },
  historicoMedidas: [
    {
      idMedicao: 'med_<timestamp>',
      data: string,           // ISO 8601
      evento: string,         // nome do evento/vestido
      unidade: string,        // 'cm' por padrão
      medidas: {
        superior: {
          busto, subbusto, separacaoBusto, alturaBusto, cinturaAlta,
          ombroAOmbro, comprimentoOmbro, larguraCostas, comprimentoBraco,
          bicep, pulso            // number | null
        },
        inferior: {
          quadril, alturaQuadril, ganchoTotal, coxa, joelho, cinturaAoChao   // number | null
        },
        geral: { altura, peso }    // number | null
      }
    },
    // ...mais recente sempre em historicoMedidas[0]
  ]
}
```

Campos de medida não informados são sempre preenchidos com `null` (nunca
ficam ausentes), para que o schema seja previsível em qualquer registro.

## API

### `clientesRepository.js`

| Função | Descrição |
|---|---|
| `obterTodosClientes()` | Retorna o array completo de clientes (`[]` se vazio). |
| `obterClientePorId(id)` | Retorna o cliente ou `null`. |
| `buscarClientesPorNome(termo)` | Filtro case-insensitive por trecho do nome. |
| `salvarCliente(clienteObjeto)` | Cria (sem `id`) ou atualiza dados cadastrais (com `id` existente). Nunca sobrescreve `historicoMedidas` na atualização. |
| `excluirCliente(id)` | Remove o cliente e todo o histórico. |
| `adicionarNovaMedicao(clienteId, dadosMedidas, nomeEvento)` | Insere uma medição no topo do histórico. |
| `editarMedicao(clienteId, idMedicao, dadosMedidas, nomeEvento)` | Atualiza os campos de uma medição já registrada, sem mudar sua posição no histórico. |
| `excluirMedicao(clienteId, idMedicao)` | Remove uma medição específica (registro por engano). |
| `obterUltimaMedicao(clienteId)` | Medição mais recente (`historicoMedidas[0]`) ou `null`. |
| `compararMedicoes(clienteId, idRecente, idAnterior)` | Diff campo a campo entre duas medições (`{ anterior, recente, diferenca }`). |
| `listarClientesInativos(diasLimite = 180)` | Clientes sem medição (ou cadastro) há mais de N dias — para lembrete de recontato. |

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

- `criarEstruturaMedidasVazia()` — schema de medidas com todos os campos em `null`.
- `validarClienteBasico(cliente)` — valida antes de salvar.
- `validarArrayClientesImportado(dados)` — valida um backup antes de importar.

## Uso

```js
import {
  salvarCliente,
  adicionarNovaMedicao,
  obterTodosClientes,
  exportarBackupJSON,
  importarBackupJSON
} from './js/index.js';

const { cliente } = salvarCliente({ nome: 'Maria Silva', telefone: '11999990000' });

adicionarNovaMedicao(
  cliente.id,
  { superior: { busto: 90 }, geral: { altura: 165 } },
  'Vestido de festa'
);

console.log(obterTodosClientes());

exportarBackupJSON(); // dispara download no navegador
```

## Decisão de design: geração de id

`gerarId(prefixo)` segue o formato `prefixo_timestamp` (ex: `cli_1731520000000`).
Duas chamadas no mesmo milissegundo — por exemplo, duas medições adicionadas
em lote via código — colidiriam e quebrariam buscas/exclusões por id. Por
isso o gerador mantém um contador interno que só entra em ação nesse caso
raro de colisão (`med_1731520000000_1`), preservando o formato simples do
schema no caso normal. Esse bug foi pego e corrigido durante os testes
(ver seção abaixo).

## Testes

Os módulos foram validados com um smoke test em Node (mock de `localStorage`
e `document`/`Blob`), cobrindo 24 casos: CRUD completo, criação/atualização/
exclusão de cliente e medição, comparação entre medições, busca por nome,
clientes inativos, exportação (base completa e ficha individual), e
importação (JSON corrompido, array estruturalmente inválido, e importação
válida substituindo a base).

Nenhum framework de teste foi adicionado ao projeto — o teste foi um script
avulso usado para validar a implementação antes da entrega.
