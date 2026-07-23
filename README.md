# EstoqueXisto: Sistema Inteligente de Gestão de Estoque POS & Logística Reversa

O **EstoqueXisto** é um sistema corporativo completo de alta performance desenvolvido para a gestão de terminais físicos de pagamento (máquinas de cartão / POS). A plataforma automatiza todo o ciclo de vida dos ativos — desde a entrada em lote do fornecedor, distribuição para equipes e consultores de vendas, até a baixa automatizada via planilhas de adquirentes (Mercado Pago) e o controle de logística reversa.

---

## 🎯 Principais Módulos e Funcionalidades

### 1. 📥 Gestão de Entrada de Estoque
* **Importação de Lotes de Entrada**: Leitura inteligente de arquivos `.xlsx` e `.csv` com prévia detalhada e validação automática contra seriais duplicados no arquivo ou no sistema.
* **Registro Manual Avulso**: Cadastro rápido de máquinas individuais vinculadas a lotes específicos e regiões operacionais.

### 2. ⚡ Automação de Baixa de Vendas Mercado Pago (Com Rollback)
* **Importação Direta de Vendas MP**: Leitura automática de planilhas de vendas exportadas do Mercado Pago (`SN Device`, `vendedor/consultor`, `HUB`, `Data Venda`, `TBVISITA_TIPO_VISITA`).
* **Pareamento Inteligente de Seriais**: Algoritmo que realiza pareamento exato e remoção flexível de prefixos de modelo (ex: `N950NCD...` &rarr; `NCD...`), alcançando 100% de reconhecimento nas planilhas.
* **Atribuição Automática de Dados**: Preenchimento automático de consultor, equipe/supervisor a partir das siglas do HUB (`SE03_PE` &rarr; `SE 03`, `AL01_PE` &rarr; `AL 01`), motivo da baixa e data da venda.
* **Histórico & Reversão em Lote (*Rollback*)**: Painel com o histórico de todas as importações realizadas com opção de **"Cancelar / Reverter Lote"** em 1 clique, restaurando o status de todas as máquinas afetadas de volta ao estado anterior (`DISPONÍVEL` / `ATRIBUÍDA`).

### 3. 🔄 Distribuição, Movimentação & Auditoria
* **Distribuição em Lote**: Atribuição em massa de máquinas para consultores e supervisores por região.
* **Transferência Regional**: Movimentação rápida de ativos entre regiões operacionais (**Sergipe** e **Alagoas**).
* **Trilha de Auditoria Irrecusável**: Gravação de histórico de eventos para cada serial (`IMPORTADA`, `ATRIBUICAO`, `EDICAO`, `BAIXA`, `DESFAZER_BAIXA`) com dados de usuário, data/hora e payload detalhado.

### 4. 📦 Logística Reversa & Devoluções
* **Controle de Terminais Devolvidos**: Registro do ciclo de devolução de máquinas atreladas a consultores e supervisores.
* **Acompanhamento de Envio**: Controle de datas de entrega, observações iniciais e rastreamento de transporte via código dos Correios.

### 5. 📊 Painel de Controle, Relatórios & Inteligência
* **Dashboard Executivo**: Métricas visuais e gráficos dinâmicos de distribuição por status, equipe e região.
* **Calculadora de Ganhos / Metas**: Mapeamento de vendas e projeção de metas por consultor.
* **Ferramenta de Limpeza de Dados**: Detecção de discrepâncias e seriais duplicados.

### 6. 🔒 Controle de Acesso Baseado em Perfis (RBAC)
* **Administrador**: Acesso irrestrito a todas as regiões, configurações e logs.
* **Estoquista**: Foco na gestão operativa de entrada, atribuição e baixa de estoque.
* **Supervisor**: Visibilidade restrita aos ativos e consultores sob sua supervisão na sua região.
* **Consultor**: Acompanhamento de metas e atividades individuais.

---

## 🛠️ Arquitetura e Stack Tecnológica

| Camada | Tecnologias Utilizadas |
| :--- | :--- |
| **Front-end** | React 19, TypeScript, Vite, TailwindCSS |
| **Componentes de UI & Ícones** | Lucide React, Componentes modulares customizados |
| **Processamento de Arquivos** | SheetJS (XLSX), FileReader API |
| **Visualização de Dados** | Recharts (Gráficos interativos) |
| **Banco de Dados & Backend** | Supabase (PostgreSQL), Row Level Security (RLS) |
| **Regras do Banco (Server-side)** | PL/pgSQL RPCs customizados (ex: `get_vendas_semana_atual`) |

---

## 💡 Diferenciais Comerciais & Proposta de Valor (Sales Pitch)

1. **Economia de Tempo Operacional**: Redução drástica de horas semanais gastas no trabalho manual do estoquista. Baixas de centenas de máquinas processadas em segundos.
2. **Risco Zero de Erro Operacional (Rollback Segurado)**: Capacidade de desfazer completamente qualquer importação incorreta sem corromper a base de dados.
3. **Rastreabilidade de Ponta a Ponta**: Transparência total sobre a localização, responsável e estado de cada equipamento física e financeiramente.
4. **Alta Escalabilidade**: Arquitetura otimizada para carregar e processar milhares de registros no Supabase sem gargalos de memória ou limites de paginação.

---

## ⚙️ Configuração e Execução Local

```bash
# 1. Instalar as dependências
npm install

# 2. Executar o servidor de desenvolvimento
npm run dev

# 3. Gerar build de produção
npm run build
```
