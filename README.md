# DadData 🗄️⚡
> **Universal Modern & Legacy Database Client** — Inspirado no Beekeeper Studio, projetado com o design system minimalista **Nocra UI Kit** e arquitetado em Electron, React e TypeScript.

---

## 👥 Agentes Especialistas do Projeto (Guild)

O projeto conta com agentes dedicados e documentados em `AGENTS.md` e `.agents/skills/`:

| Agente | Especialidade | Papel no Projeto |
| :--- | :--- | :--- |
| 🏛️ **software-architect** | Arquitetura de Software | Padrões de pastas, Clean Architecture, isolamento Preload e interface unificada de drivers. |
| 🗄️ **database-specialist** | Bancos de Dados Modernos & Legados | Motores de banco, parsing de arquivos (.DBF, .DB, .FIC, .MDB, .NX1), introspecção e CRUD. |
| ⚙️ **backend-specialist** | Electron Main & IPC | Gerenciamento de pooling, IPC seguro tipado e motor de exportação streaming (CSV e Excel .xlsx). |
| 🎨 **frontend-specialist** | React, Tailwind & UI/UX | Replicar o design system minimalista Nocra UI Kit (cards ultra-arredondados, aura pastel, editor dark). |
| 🧪 **test-engineer** | Engenharia de Testes (QA) | Suíte automatizada Vitest validando drivers, parsing, CRUD e exportação contínua. |
| 📦 **git-commit-manager** | Versionamento e Commits | Histórico semântico e atômico (Conventional Commits) a cada funcionalidade aprovada. |

---

## 🚀 Bancos de Dados Suportados

### 💾 Bancos Legados de Arquivo / ERP:
- **dBase / FoxPro / Clipper (`.DBF`)**: Leitura e escrita nativa com suporte a tabelas isoladas ou diretórios inteiros de DBFs.
- **Paradox (`.DB`)**: Suporte a versões Borland/Corel 3.5 a 7.0 para sistemas Delphi legados.
- **Microsoft Access (`.MDB` / `.ACCDB`)**: Tabelas e consultas via motor Jet/ACE.
- **HFSQL / HyperFileSQL (`.FIC`)**: Formato clássico PC SOFT WinDev / WebDev.
- **NexusDB (`.NX1`)**: Tabelas de banco de dados Delphi.
- **Firebird (`.FDB`)**: Dialetos 1 e 3.

### ⚡ Bancos Modernos & Cloud:
- **SQLite 3**: Arquivo local ou memória, ultrarrápido com WebAssembly.
- **PostgreSQL**: Múltiplas versões (v9.x a v17.x) e múltiplos schemas.
- **MySQL & MariaDB**: Múltiplas versões (5.5 a 8.4).
- **Microsoft SQL Server**: T-SQL com suporte a instâncias nomeadas.
- **MongoDB**: Coleções NoSQL e documentos BSON/JSON.

---

## ✨ Funcionalidades Principais

1. **Conexão Universal**:
   - Conecte-se tanto a servidores de banco de dados remotos quanto a arquivos locais legados (.dbf, .db, .fic, .mdb, .sqlite, .nx1, .fdb) com diálogo nativo de busca de arquivos e pastas no Windows/Desktop.
2. **Editor SQL / NoSQL**:
   - Card escuro no estilo Nocra UI com atalhos de sintaxe (`SELECT *`, `WHERE`, `ORDER BY`, `COUNT(*)`).
   - Execução rápida com atalho `Ctrl+Enter`.
   - Medição precisa de latência de execução em milissegundos.
3. **Data Grid Interativo & Manipulação (CRUD)**:
   - Visualização com tipagem de colunas e detecção automática de Chave Primária (PK).
   - **Edição Inline**: Duplo clique em qualquer célula para alterar o valor instantaneamente.
   - **Inserção de Registros**: Modal dinâmico "Adicionar Linha" adaptado às colunas da tabela.
   - **Exclusão de Registros**: Botão de lixeira por linha com diálogo de confirmação.
   - Ordenação ascendente/descendente por coluna e busca em tempo real.
   - Paginação fluida.
4. **Exportação de Dados**:
   - **CSV**: Com cabeçalhos, separador configurável e codificação UTF-8 com BOM para abertura perfeita no Microsoft Excel.
   - **Excel (.xlsx)**: Criação de planilhas nativas formatadas com cabeçalhos estilizados, larguras automáticas de coluna e tipos numéricos/datas.
5. **Design System Nocra UI Kit**:
   - Auras difusas em degradê pastel iridescente no background.
   - Superfícies flutuantes com cantos arredondados generosos (`rounded-2xl` e `rounded-3xl`).
   - Floating Action / Query Bar com anel iridescente e botão `✨ Executar`.

---

## 🛠️ Como Executar o Projeto

### Instalação de Dependências
```bash
npm install
```

### Rodar a Suíte de Testes Automatizada (Vitest)
```bash
npm run test
```

### Modo de Desenvolvimento (Electron + Vite HMR)
```bash
npm run dev
```

### Compilar e Empacotar para Produção
```bash
npm run build
```
