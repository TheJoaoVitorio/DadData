---
name: nocra-design-system
description: >-
  Diretrizes de design, tokens de cor, tipografia e componentes do Nocra UI Kit para a interface minimalista do DadData.
---

# Nocra Design System Guidelines

## Estética Central
O design é inspirado nas interfaces modernas de IA (Nocra UI Kit):
- **Cores & Atmosfera**: Fundo suave perolado com degradê iridescente e auras de luz ambiente difusa em tons pastel (violeta #E0D7FE, rosa #FCE7F3, ciano #E0F2FE).
- **Cartões Flutuantes**: Cantos generosamente arredondados (`rounded-2xl` de 16px a `rounded-3xl` de 24px-28px). Superfícies em branco puro (`#FFFFFF`) com elevações muito suaves e bordas ultra-finas e sutis (`border border-black/[0.04]` ou `border-white/80`).
- **Botões Pílula (Pill Buttons)**: Elementos de ação com cantos totalmente arredondados (`rounded-full`), botões primários escuros sofisticados (`bg-[#121217] hover:bg-black text-white`) e botões secundários com superfícies de vidro suave (`bg-white/80 hover:bg-white text-gray-800 border border-gray-200/60`).
- **Floating Prompt/Query Bar**: Barra inferior flutuante elegante com borda em sutil anel de gradiente iridescente, seletor de banco/modelo e botão de execução com ícone ✨.
- **Tipografia**: Sans-serif limpa e geométrica (Inter / Plus Jakarta Sans), hierarquia clara com pesos `font-semibold` nos títulos e `font-normal` no corpo.
- **Tabela de Dados (Data Grid)**:
  - Cabeçalhos de coluna limpos com letras maiúsculas ou títulos legíveis e sutis.
  - Linhas com espaçamento generoso, hover delicado (`hover:bg-slate-50/70`).
  - Badges de tipo e status coloridos de forma discreta (verde pastel para texto, azul para números, roxo para chaves/ids).
  - Ações rápidas contextuais: inline edit, delete e modal para inserção.

## Paleta de Cores
- **Background Aura**:
  - `linear-gradient(135deg, #F5F3FF 0%, #FAF5FF 35%, #F0FDF4 70%, #EFF6FF 100%)`
- **Surface Principal**: `#FFFFFF` com `backdrop-blur-md`
- **Surface Secundária**: `#F8FAFC`
- **Editor Dark Card**: `#111116` com texto em tons de neon pastel suave (rosa #F472B6, ciano #38BDF8, verde #4ADE80, amarelo #FBBF24).
- **Primary Action**: `#121217` (preto carvão com alta legibilidade)
- **Accent**: Gradiente iridescente sutil (`from-purple-500 via-pink-400 to-sky-400`).
