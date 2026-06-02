# EstoqueXisto: Gestão Operacional de POS & Logística Reversa

Sistema corporativo projetado para otimização e controle de estoque de terminais físicos de pagamento (máquinas de cartão/POS), integrando distribuição de vendas e fluxos de logística reversa.

## 🚀 Funcionalidades Principais

* **Motor de Importação Inteligente**: Processamento de planilhas de seriais em lotes com validação automática contra duplicidade de registros.
* **Fluxo de Logística Reversa**: Mapeamento do ciclo de devolução de terminais via Correios, contendo campos para código de rastreio e acompanhamento.
* **Painel de Controle de Vendas**: Dashboard de desempenho de consultores e supervisores separados por região (Sergipe e Alagoas).
* **Controle de Acessos Dinâmico (RBAC)**: Permissões restritas de visibilidade para perfis como Estoquista, Supervisor, Administrador e Consultor.

## 🛠️ Stack Tecnológica

* **Front-end**: React, TypeScript, Vite, TailwindCSS.
* **Banco de Dados**: Supabase (PostgreSQL).
* **Processamento no Servidor**: PL/pgSQL (RPCs customizados para validação rápida de metas de vendas semanais).

## ⚙️ Configuração Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente baseando-se no arquivo `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Execute o projeto em desenvolvimento:
   ```bash
   npm run dev
   ```
