---
name: software-architecture
description: >-
  Diretrizes de arquitetura de software, padrão de pastas e separação de responsabilidades para o projeto DadData em Electron, TypeScript e React.
---

# Software Architecture Guidelines

## Visão Geral
O DadData adota uma arquitetura em camadas e desacoplada, adequada para aplicativos desktop modernos construídos com Electron, TypeScript e React.

## Estrutura de Diretórios Padronizada

```text
DadData/
├── .agents/                    # Skills e diretrizes dos agentes
│   └── skills/
├── samples/                    # Bancos de dados de amostra para testes imediatos (SQLite, DBF, Paradox, etc.)
├── src/
│   ├── main/                   # Processo Principal do Electron (Node.js)
│   │   ├── index.ts            # Ponto de entrada do app Electron
│   │   ├── ipc/                # Handlers IPC registrados
│   │   ├── export/             # Mecanismo de exportação (CSV, XLSX)
│   │   └── dialogs/            # Caixas de diálogo nativas (Abrir arquivo, Salvar)
│   ├── preload/                # ContextBridge e isolamento seguro
│   │   └── index.ts            # Expõe API tipada para window.api
│   ├── shared/                 # Tipos, interfaces e constantes compartilhadas
│   │   ├── types/              # Tipos de banco, conexões, queries, CRUD
│   │   └── ipc-channels.ts     # Nomes de canais IPC unificados
│   ├── drivers/                # Camada de Conectores e Drivers de Banco de Dados
│   │   ├── driver-interface.ts # Interface unificada DatabaseDriver
│   │   ├── driver-manager.ts   # Factory & Registry de conexões ativas
│   │   ├── sqlite/             # Driver SQLite
│   │   ├── postgres/           # Driver PostgreSQL (múltiplas versões)
│   │   ├── mysql/              # Driver MySQL / MariaDB
│   │   ├── mssql/              # Driver SQL Server
│   │   ├── mongodb/            # Driver MongoDB
│   │   ├── firebird/           # Driver Firebird
│   │   ├── dbf/                # Driver DBF (dBase / FoxPro)
│   │   ├── access/             # Driver Microsoft Access MDB/ACCDB
│   │   ├── paradox/            # Driver Paradox .DB
│   │   ├── hfsql/              # Driver HFSQL .FIC
│   │   └── nexusdb/            # Driver NexusDB
│   └── renderer/               # Interface do Usuário (React + Tailwind + Nocra UI Kit)
│       ├── src/
│       │   ├── assets/         # Ícones, ilustrações, gradientes
│       │   ├── components/     # Componentes visuais atômicos e moleculares
│       │   │   ├── ui/         # Botões pílula, inputs, badges, modais
│       │   │   ├── layout/     # Sidebar, Header, WindowControls
│       │   │   ├── editor/     # Query Editor (syntax highlight, Ctrl+Enter)
│       │   │   ├── grid/       # Data Table interativo com CRUD e paginação
│       │   │   ├── connections/# Modal/form de nova conexão com presets
│       │   │   └── export/     # Diálogo e ações de exportação (Excel / CSV)
│       │   ├── hooks/          # Hooks customizados (useDatabase, useQuery, etc.)
│       │   ├── styles/         # CSS global com tokens do Nocra UI Kit
│       │   ├── App.tsx         # Componente raiz da aplicação
│       │   └── main.tsx        # Ponto de entrada do React
├── tests/                      # Suíte de testes automatizados (Vitest)
│   ├── drivers/                # Testes de drivers e parsers de arquivos
│   ├── export/                 # Testes de exportação CSV/XLSX
│   └── shared/                 # Validações de schemas e utilitários
└── package.json
```

## Princípios de Projeto
1. **Segurança IPC**: Nunca habilitar `nodeIntegration: true`. Sempre utilizar `contextIsolation: true` com Preload bridge.
2. **Adapter Pattern**: Todos os conectores de banco de dados implementam a interface `DatabaseDriver`. O frontend nunca fala diretamente com detalhes de driver.
3. **Imutabilidade e Tipagem**: Todo tráfego IPC utiliza tipos definidos em `src/shared/types/`.
