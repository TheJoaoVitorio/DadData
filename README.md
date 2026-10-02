# DadData

Cliente desktop universal para bancos de dados modernos e legados. Desenvolvido em **Electron**, **React**, **TypeScript** e **Tailwind CSS**, com foco em interoperabilidade, performance e uma interface orientada a desenvolvedores baseada no design system do **AbacatePay**.

---

## Visão Geral

O **DadData** foi projetado para atender tanto sistemas contemporâneos quanto ecossistemas empresariais legados (ERPs em Delphi, FoxPro, WinDev, Clipper e VB6), permitindo conectar, inspecionar schemas, consultar, manipular dados (CRUD) e exportar relatórios sem necessidade de middlewares complexos.

---

## Motores de Banco de Dados Suportados

### Legados & Baseados em Arquivo (Desktop / ERP)
- **Firebird (.FDB)**: Suporte a Dialetos 1 e 3 (v1.5 a v5.0) via socket nativo TCP/IP com resolução de caminhos Windows 8.3.
- **dBase / FoxPro / Clipper (.DBF)**: Leitura de arquivos `.DBF` individuais e diretórios com múltiplas tabelas.
- **Borland / Corel Paradox (.DB)**: Decodificação de arquivos Paradox v3.5 a v7.0, incluindo suporte a campos de auto-incremento e blocos múltiplos.
- **Microsoft Access (.MDB / .ACCDB)**: Conexão via engine Jet / ACE com introspecção de tabelas e dados.
- **PC SOFT HFSQL / HyperFileSQL (.FIC)**: Leitura de tabelas clássicas de aplicações WinDev / WebDev.
- **NexusDB (.NX1)**: Suporte a tabelas do motor Delphi NexusDB v4.

### Modernos, Cloud & NoSQL
- **PostgreSQL**: v9.x a v17.x, com navegação estruturada por schemas (`public`, schemas customizados, views).
- **MySQL & MariaDB**: v5.5 a v8.4.
- **Microsoft SQL Server**: T-SQL, catalogação de schemas e compatibilidade com instâncias nomeadas.
- **SQLite 3**: Arquivos locais em disco ou bancos em memória.
- **MongoDB**: Coleções NoSQL com documentos BSON/JSON.

---

## Recursos da Aplicação

- **Explorador de Esquemas (Sidebar)**:
  - Navegação em árvore de tabelas, views, schemas e metadados de colunas (tipagem e chaves primárias).
  - Filtro em tempo real para bases com centenas de entidades.
  - Pinning/favoritos para acesso rápido às tabelas de uso frequente.
- **Editor SQL / NoSQL**:
  - Syntax highlighting para queries, atalhos de snippets (`SELECT *`, `WHERE`, `ORDER BY`, `COUNT`).
  - Execução via `Ctrl+Enter` com telemetria de latência em milissegundos.
- **Data Grid Interativo & CRUD**:
  - **Edição Inline**: Duplo clique em qualquer célula para alteração rápida com validação de tipos.
  - **Inserção de Registros**: Gaveta lateral dinâmica adaptada ao schema da tabela selecionada.
  - **Exclusão Segura**: Confirmação visual para remoção de registros por chave primária.
  - Paginação, ordenação multi-coluna e busca textual inline.
- **Motor de Exportação**:
  - **CSV**: UTF-8 com suporte a BOM para compatibilidade com Microsoft Excel.
  - **Excel (.xlsx)**: Geração de planilhas nativas formatadas via streaming, preservando tipos de dados.
- **Design System AbacatePay**:
  - Paleta em tons escuros de petróleo (`#0C1818`, `#112323`), acentos em verde abacate neon (`#00F566`) e superfícies contrastadas.
  - Tipografia técnica com **Fustat** e **JetBrains Mono**.
  - Livre de elementos gráficos superficiais e focado na ergonomia do desenvolvedor.

---

## Arquitetura do Projeto

O código segue a separação estrita de camadas do Electron (Clean Architecture / Hexagonal):

```
DadData/
├── src/
│   ├── main/                 # Processo Principal do Electron
│   │   ├── index.ts          # Ciclo de vida da janela e flags de segurança
│   │   ├── ipc/              # Contratos tipados de IPC entre Main e Renderer
│   │   └── export/           # Serviços de exportação de dados (CSV e Excel)
│   ├── preload/              # Context Isolation bridge (window.api)
│   ├── drivers/              # Adaptadores de banco de dados (DatabaseDriver)
│   │   ├── firebird/         # Driver nativo Firebird (node-firebird)
│   │   ├── paradox/          # Parser binário Borland Paradox
│   │   ├── dbf/              # Parser binário dBase/FoxPro
│   │   ├── sqlite/           # Driver SQLite via WebAssembly/sql.js
│   │   └── ...               # Postgres, MySQL, MSSQL, Mongo, HFSQL, NexusDB
│   ├── renderer/             # Interface React (Vite)
│   │   └── src/
│   │       ├── components/   # UI: DataGrid, SqlEditor, Sidebar, Header, Drawers
│   │       ├── services/     # Cliente seguro de IPC
│   │       └── index.css     # Tokens do design system AbacatePay
│   └── shared/               # Tipos TypeScript e contratos de IPC compartilhados
└── tests/                    # Suíte de testes automatizados com Vitest
```

---

## Primeiros Passos

### Pré-requisitos
- **Node.js**: v18+ (recomendado v20+)
- **npm** ou **pnpm**
- **Git**

### Instalação
```bash
git clone https://github.com/TheJoaoVitorio/DadData.git
cd DadData
npm install
```

### Desenvolvimento
Inicie o Electron com recarregamento em tempo real (HMR):
```bash
npm run dev
```

### Testes Automatizados
Validação dos drivers de banco de dados, parsing e integridade:
```bash
npm test
```

### Build de Produção
Gera os executáveis do Electron e os bundles otimizados:
```bash
npm run build
```

---

## Licença

Distribuído sob a licença **MIT**. Consulte `LICENSE` para mais informações.

Desenvolvido por **[João Vitório](https://github.com/TheJoaoVitorio)**.
