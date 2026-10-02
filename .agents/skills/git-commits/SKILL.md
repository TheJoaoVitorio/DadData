---
name: git-commits
description: >-
  Diretrizes e automação de versionamento com Conventional Commits para cada funcionalidade entregue e testada no DadData.
---

# Git Commits Skill

## Padrão de Mensagens
Todas as alterações no repositório devem seguir a convenção:

```text
<tipo>(<escopo>): <descrição curta e imperativa>

[corpo opcional explicando o contexto e decisões de arquitetura]
```

### Tipos Permitidos:
- `feat`: Nova funcionalidade para o usuário (ex: driver DBF, exportação Excel, grid editável)
- `fix`: Correção de bug
- `test`: Adição ou modificação de testes automatizados
- `refactor`: Refatoração sem mudança de comportamento externo
- `docs`: Alterações na documentação
- `chore`: Configurações de build, dependências ou scripts

### Regra de Ouro:
Todo commit de `feat` ou `fix` só é realizado após os testes automatizados correspondentes passarem com 100% de sucesso.
