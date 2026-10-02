# DadData Agents & Team Guild

Este arquivo documenta a equipe de agentes autônomos e suas competências no projeto **DadData**. Cada agente possui especialização dedicada, ferramentas e escopo de atuação para garantir desenvolvimento de alta qualidade, estabilidade e arquitetura limpa.

---

## 👥 Especialistas e Papéis

### 1. 🏛️ Arquiteto de Software (`software-architect`)
- **Escopo**: Arquitetura do projeto, padronização de pastas, separação entre camadas (Main, Preload, Renderer, Shared e Drivers).
- **Padrões de Mercado**:
  - Clean Architecture & Ports-and-Adapters (Hexagonal Architecture).
  - Factory Pattern e Adapter Pattern para drivers de banco de dados (`DatabaseDriver`).
  - Strict Context Isolation e segurança no IPC do Electron.
  - Tipagem estrita ponta a ponta com TypeScript.
- **Skill Associada**: `.agents/skills/software-architecture/SKILL.md`

---

### 2. 🗄️ Especialista em Bancos de Dados (`database-specialist`)
- **Escopo**: Conexão, introspecção de schema, execução de queries, CRUD e parsing de bancos de dados modernos e legados.
- **Motores Cobertos**:
  - **Legados Desktop / ERP**:
    - Paradox (`.DB` - Paradox 3.5 a 7.0)
    - Microsoft Access (`.MDB` e `.ACCDB`)
    - HFSQL / HyperFileSQL PC SOFT (`.FIC`, `.NDX`)
    - NexusDB
    - DBF (dBase III/IV/FoxPro/Clipper)
    - Firebird (1.5 a 5.0)
  - **Modernos & Cloud**:
    - PostgreSQL (v9.x a v17.x)
    - MySQL (5.5 a 8.4) & MariaDB
    - Microsoft SQL Server (T-SQL)
    - SQLite 3 (em memória e arquivo)
    - MongoDB (NoSQL)
- **Funcionalidades**:
  - Introspecção completa de tabelas, campos, chaves primárias e tipos de dados.
  - Execução de queries personalizadas com medição de latência.
  - Operações CRUD unificadas (Inserção, Atualização, Exclusão).
- **Skill Associada**: `.agents/skills/database-connectors/SKILL.md`

---

### 3. ⚙️ Especialista em Backend (`backend-specialist`)
- **Escopo**: Electron Main Process, Node.js, contratos de IPC, gerenciamento de pooling de conexões e exportação.
- **Mecanismos**:
  - Gerenciamento de ciclo de vida de instâncias de conexões ativas.
  - Mecanismo de exportação de dados para **CSV** e **Excel (.xlsx)** com paginação/streaming de alto desempenho.
  - Diálogos nativos do Electron para salvar arquivos e selecionar arquivos de bancos locais (.db, .dbf, .fic, .mdb, .sqlite).
  - Tratamento resiliente de falhas de rede e timeouts.
- **Skill Associada**: `.agents/skills/backend-ipc-engine/SKILL.md`

---

### 4. 🎨 Especialista em FrontEnd (`frontend-specialist`)
- **Escopo**: Interface de Usuário (UI) e Experiência do Usuário (UX) com React, TypeScript e Tailwind CSS.
- **Design System: Nocra UI Kit**:
  - Estética minimalista, etérea e fluida com degradê pastel suave de fundo (aura violeta, rosa e ciano).
  - Cards flutuantes com cantos generosamente arredondados (`rounded-2xl` e `rounded-3xl`) e elevações suaves.
  - Sidebar elegante com ícones minimalistas, seletor de conexões salvas e explorador de tabelas.
  - Barra de ações e busca/prompt inferior flutuante ("Floating Query Bar") com botões pílula e atalhos rápidos.
  - Editor SQL/NoSQL sofisticado (modo card escuro destacado ou claro, syntax highlighting, atalho `Ctrl+Enter`).
  - Grid de dados (Data Table) completo e interativo:
    - Edição inline de células (duplo clique).
    - Adicionar novos registros.
    - Exclusão com modal de confirmação.
    - Exportação com um clique para CSV e Excel.
- **Skill Associada**: `.agents/skills/nocra-design-system/SKILL.md`

---

### 5. 🧪 Engenheiro de Testes e QA (`test-engineer`)
- **Escopo**: Validação automatizada e contínua a cada funcionalidade desenvolvida.
- **Cobertura de Testes**:
  - Testes unitários de drivers e parsers de arquivos binários legados (.dbf, .db, .fic, .mdb).
  - Testes de CRUD em bancos de dados.
  - Testes do exportador para CSV e Excel gerando arquivos válidos.
  - Testes de integridade do IPC e contratos entre Renderer e Main.
  - Verificação de ausência de regressões antes da liberação de cada commit.
- **Skill Associada**: `.agents/skills/testing-suite/SKILL.md`

---

### 6. 📦 Gerente de Commits (`git-commit-manager`)
- **Escopo**: Versionamento de código, histórico git limpo e semântico.
- **Convenções**:
  - Padrão **Conventional Commits**:
    - `feat:` Nova funcionalidade
    - `fix:` Correção de bug
    - `refactor:` Melhoria interna de código
    - `test:` Inclusão ou atualização de testes
    - `docs:` Documentação
    - `chore:` Configurações e dependências
  - Commits atômicos realizados a cada funcionalidade entregue e aprovada pelos testes.
- **Skill Associada**: `.agents/skills/git-commits/SKILL.md`
