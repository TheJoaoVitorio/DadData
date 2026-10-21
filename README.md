# DadData

Cliente desktop universal para bancos de dados modernos e legados. Desenvolvido com **Tauri v2**, motor nativo em **Rust**, **React 19**, **TypeScript** e **Tailwind CSS**, com foco em desempenho extremo, baixo consumo de memória/energia e virtualização completa de dados.

---

## Visão Geral

O **DadData** foi projetado para conectar, inspecionar schemas, consultar, manipular dados (CRUD) e exportar relatórios tanto em ecossistemas empresariais legados (ERPs em Delphi, FoxPro, WinDev, Clipper e VB6) quanto em bancos modernos e cloud, utilizando um backend nativo assíncrono em Rust de alta performance.

---

## Motores de Banco de Dados Suportados

### Legados & Baseados em Arquivo (Desktop / ERP)
- **Firebird (.FDB)**: Dialetos 1 e 3 (v1.5 a v5.0) via socket nativo TCP/IP com decodificação Windows-1252.
- **dBase / FoxPro / Clipper (.DBF)**: Leitura de arquivos `.DBF` e diretórios com múltiplas tabelas.
- **Borland / Corel Paradox (.DB)**: Decodificação de arquivos Paradox v3.5 a v7.0, incluindo auto-incremento e blocos secundários.
- **Microsoft Access (.MDB / .ACCDB)**: Conexão via engine Jet / ACE com introspecção de tabelas e dados.
- **PC SOFT HFSQL / HyperFileSQL (.FIC)**: Leitura de tabelas clássicas de aplicações WinDev / WebDev.
- **NexusDB (.NX1)**: Suporte a tabelas do motor Delphi NexusDB v4.

### Modernos, Cloud & NoSQL
- **PostgreSQL**: Conexão assíncrona nativa com pooling via `tokio-postgres` e `deadpool-postgres`, navegação em schemas (`public`, schemas customizados, views).
- **SQLite 3**: Operações nativas compiladas com `rusqlite`.
- **MySQL & MariaDB**: v5.5 a v8.4.
- **Microsoft SQL Server**: T-SQL, catalogação de schemas e compatibilidade com instâncias nomeadas.
- **MongoDB**: Coleções NoSQL com documentos BSON/JSON.

---

## Recursos da Aplicação

- **Motor Nativo Rust de Alta Performance**:
  - Pool de conexões assíncrono e pooling com Tokio.
  - Exportação nativa direta em Rust para CSV e Excel (.xlsx) estilizado (`rust_xlsxwriter`).
  - Consumo mínimo de memória RAM e overhead zero de CPU.
- **Virtual Scrolling & Windowing Inteligente**:
  - Renderização virtual sob demanda: exibe tabelas com 400.000+ linhas montando apenas os elementos visíveis na viewport.
  - Zero travamentos, rolagem fluida a 60fps e consumo de energia ultra-baixo.
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
  - Paginação por demanda (fetch infinito).

---

## Arquitetura do Projeto

```
DadData/
├── src-tauri/                # Backend Nativo em Rust (Tauri v2)
│   ├── src/
│   │   ├── main.rs           # Ponto de entrada do executável desktop
│   │   ├── lib.rs            # Registro de estado, plugins e comandos Tauri
│   │   ├── commands.rs       # #[tauri::command] handlers de conexão, query e CRUD
│   │   └── engine/           # Motor nativo de bancos de dados
│   │       ├── postgres.rs   # tokio-postgres + deadpool-postgres
│   │       ├── sqlite.rs     # rusqlite nativo
│   │       ├── export.rs     # Streaming CSV & Excel com rust_xlsxwriter
│   │       └── types.rs      # Tipos compartilhados com serde
│   ├── Cargo.toml            # Dependências Rust
│   └── tauri.conf.json       # Configurações do Tauri v2
├── src/
│   ├── renderer/             # Frontend React 19 + TypeScript + Tailwind CSS
│   │   └── src/
│   │       ├── components/   # UI: DataGrid virtualizado, SqlEditor, Sidebar, Header
│   │       ├── services/     # Cliente seguro de comunicação Tauri invoke
│   │       └── index.css     # Design system e tokens de cores
│   ├── shared/               # Tipos TypeScript compartilhados
│   └── services/             # Utilitários de exportação e serviços
└── tests/                    # Suíte de testes automatizados com Vitest
```

---

## Primeiros Passos

### Pré-requisitos
- **Rust**: `rustc` e `cargo` instalados ([rustup.rs](https://rustup.rs/))
- **Node.js**: v18+ (recomendado v20+)
- **npm** ou **pnpm**
- **Git**

### Instalação
```bash
git clone https://github.com/TheJoaoVitorio/DadData.git
cd DadData
npm install
```

### Desenvolvimento Desktop (Tauri v2 + Rust)
Inicie o aplicativo Desktop com recarregamento em tempo real (HMR):
```bash
npm run desktop
# ou
npm run tauri:dev
```

### Desenvolvimento Web Preview (Vite)
Para testar a interface diretamente no navegador:
```bash
npm run dev
```

### Testes Automatizados
Validação dos drivers de banco de dados, parsing e integridade:
```bash
npm test
```

### Build de Produção
Gera o executável desktop nativo ultra-leve via Tauri e Rust:
```bash
npm run tauri:build
```

---

## Licença

Distribuído sob a licença **MIT**. Consulte `LICENSE` para mais informações.

Desenvolvido por **[João Vitório](https://github.com/TheJoaoVitorio)**.
