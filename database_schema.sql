-- Estrutura de tabela sugerida para o Supabase
CREATE TABLE atividades_consultores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    consultor_id UUID NOT NULL, -- FK para users/auth
    tipo_atividade TEXT CHECK (tipo_atividade IN ('VISITA', 'VENDA')) NOT NULL,
    segmento TEXT CHECK (segmento IN ('PF', 'PJ')) NOT NULL,
    nome_cliente TEXT NOT NULL,
    observacao TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Índices para performance
    idx_consultor_data (consultor_id, data_criacao)
);

-- RPC para buscar somatório de vendas da semana atual para validar meta
CREATE OR REPLACE FUNCTION get_vendas_semana_atual(consultor_id_in UUID)
RETURNS BIGINT AS $$
DECLARE
  total_vendas BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_vendas
  FROM atividades_consultores
  WHERE consultor_id = consultor_id_in
    AND tipo_atividade = 'VENDA'
    AND data_criacao >= date_trunc('week', CURRENT_DATE);
  RETURN total_vendas;
END;
$$ LANGUAGE plpgsql;
