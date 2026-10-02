---
name: testing-suite
description: >-
  Estratégia e execução de testes automatizados com Vitest para validar drivers de banco de dados, CRUD, exportação e integridade do DadData.
---

# Testing Suite Skill

## Diretrizes de Qualidade
Após cada implementação, o agente de testes deve executar a suíte correspondente e validar:
1. **Drivers & Conexões**:
   - Conexão e desconexão limpa sem vazamento de recursos.
   - Introspecção de tabelas e colunas com tipos de dados mapeados.
   - Execução de queries simples e complexas.
2. **Operações CRUD**:
   - Inserção de novos registros e verificação de retorno.
   - Atualização de registros existentes por chave primária.
   - Exclusão com confirmação e validação do registro removido.
3. **Parsers Legados (DBF, Paradox, Access, HFSQL)**:
   - Leitura de amostras de teste reais em `samples/`.
   - Decodificação correta de cabeçalhos binários, campos e linhas.
4. **Motor de Exportação**:
   - Validação da integridade dos arquivos CSV gerados (delimitadores e escape).
   - Validação dos arquivos Excel (.xlsx) gerados.

## Comando de Execução
```bash
npm run test
```
