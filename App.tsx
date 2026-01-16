
import React, { useState, createContext, useMemo, useEffect } from 'react';
import { Maquina, UserProfile, Pedido, Importacao, ImportacaoItem, EventoMaquina, MotivoBaixa, StatusEstoque, Devolucao, Regiao } from './types';
import LoginScreen from './components/LoginScreen';
import Layout from './components/Layout';
import { supabase } from './supabase';

interface AppContextType {
  currentUser: UserProfile | null;
  pedidos: Pedido[];
  maquinas: Maquina[];
  importacoes: Importacao[];
  importacaoItens: ImportacaoItem[];
  eventos: EventoMaquina[];
  devolucoes: Devolucao[];
  loading: boolean;
  executarImportacao: (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string, regiao?: Regiao) => Promise<void>;
  atribuirEmLote: (maquinaIds: string[], supervisorId: number, consultorNome: string) => Promise<void>;
  atualizarMaquina: (maquinaId: string, supervisorId: number, consultorNome: string) => Promise<void>;
  baixarEmLote: (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => Promise<void>;
  desfazerBaixa: (maquinaId: string, justificativa: string) => Promise<void>;
  disponibilizarEmLote: (maquinaIds: string[]) => Promise<void>;
  registrarDevolucao: (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => Promise<void>;
  atualizarEnvioDevolucao: (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => Promise<void>;
  logout: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const [importacaoItens, setImportacaoItens] = useState<ImportacaoItem[]>([]);
  const [eventos, setEventos] = useState<EventoMaquina[]>([]);
  const [devolucoes, setDevolucoes] = useState<Devolucao[]>([]);

  // Carregamento Inicial do Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          supabase.from('pedidos').select('*').order('criado_em', { ascending: false }),
          supabase.from('maquinas').select('*'),
          supabase.from('importacoes').select('*').order('importado_em', { ascending: false }),
          supabase.from('importacao_itens').select('*'),
          supabase.from('eventos_maquina').select('*').order('criado_em', { ascending: false }),
          supabase.from('devolucoes').select('*').order('criado_em', { ascending: false })
        ]);

        results.forEach((res, index) => {
            if (res.status === 'fulfilled' && res.value.data) {
                const data = res.value.data;
                if (index === 0) setPedidos(data);
                if (index === 1) setMaquinas(data);
                if (index === 2) setImportacoes(data);
                if (index === 3) setImportacaoItens(data);
                if (index === 4) setEventos(data);
                if (index === 5) setDevolucoes(data);
            } else if (res.status === 'rejected') {
                console.error(`Erro ao carregar tabela index ${index}:`, res.reason);
            }
        });

      } catch (err) {
        console.error("Erro crítico ao carregar dados do Supabase:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLogin = (perfil: UserProfile) => setCurrentUser(perfil);
  const handleLogout = () => setCurrentUser(null);

  const executarImportacao = async (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string, regiao?: Regiao) => {
    const importId = crypto.randomUUID();
    let pedidoExistente = pedidos.find(p => p.codigo_pedido === codigoPedido);
    const pedidoId = pedidoExistente ? pedidoExistente.id : crypto.randomUUID();
    const dataBase = dataPedido ? new Date(dataPedido + 'T12:00:00').toISOString() : new Date().toISOString();

    const novasMaquinas: Maquina[] = [];
    const novosLogs: ImportacaoItem[] = [];
    const novosEventos: EventoMaquina[] = [];

    processados.forEach(item => {
      novosLogs.push({ id: crypto.randomUUID(), import_id: importId, linha_numero: item.linha, serial_original: item.original, serial_normalizado: item.normalizado, status_item: item.status, erro_motivo: item.motivo });

      if (item.status === 'INSERIDO') {
        const mId = crypto.randomUUID();
        novasMaquinas.push({
          id: mId,
          serial: item.normalizado,
          pedido_id: pedidoId,
          import_id: importId,
          status_estoque: 'DISPONIVEL',
          criado_em: dataBase
        });
        novosEventos.push({
            id: crypto.randomUUID(),
            maquina_id: mId,
            tipo_evento: 'IMPORTADA',
            criado_em: new Date().toISOString(),
            criado_por: currentUser?.nome || 'Sistema',
            payload: { after: { status: 'DISPONIVEL', pedido: codigoPedido } }
        });
      }
    });

    const inseridosCount = novasMaquinas.length;

    // Persistência Supabase
    if (!pedidoExistente) {
      await supabase.from('pedidos').insert({
        id: pedidoId, codigo_pedido: codigoPedido, qtd_esperada: qtdEsperada,
        qtd_importada: inseridosCount, status_importacao: (qtdEsperada && inseridosCount >= qtdEsperada) ? 'COMPLETA' : 'PARCIAL',
        regiao, criado_em: dataBase, criado_por: currentUser?.nome || 'Sistema'
      });
    } else {
      await supabase.from('pedidos').update({
        qtd_importada: pedidoExistente.qtd_importada + inseridosCount,
        status_importacao: (qtdEsperada && (pedidoExistente.qtd_importada + inseridosCount) >= qtdEsperada) ? 'COMPLETA' : 'PARCIAL',
        regiao: regiao || pedidoExistente.regiao
      }).eq('id', pedidoId);
    }

    await Promise.all([
      supabase.from('importacoes').insert({
        id: importId, pedido_id: pedidoId, arquivo_nome: arquivoNome, 
        importado_em: new Date().toISOString(), importado_por: currentUser?.nome || 'Sistema',
        total_linhas_lidas: processados.length, seriais_validos: processados.filter(i => i.status !== 'INVALIDO').length,
        invalidos: processados.filter(i => i.status === 'INVALIDO').length,
        maquinas_inseridas: inseridosCount, status: 'PROCESSADA'
      }),
      supabase.from('maquinas').insert(novasMaquinas),
      supabase.from('importacao_itens').insert(novosLogs),
      supabase.from('eventos_maquina').insert(novosEventos)
    ]);

    window.location.reload(); 
  };

  const atribuirEmLote = async (maquinaIds: string[], supervisorId: number, consultorNome: string) => {
    const timestamp = new Date().toISOString();
    
    await supabase.from('maquinas')
      .update({ status_estoque: 'ATRIBUIDA', supervisor_id: supervisorId, consultor_nome: consultorNome, atribuido_em: timestamp })
      .in('id', maquinaIds);

    const novosEventos = maquinaIds.map(id => ({
      id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'ATRIBUICAO',
      criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema',
      payload: { after: { status: 'ATRIBUIDA', supervisor: supervisorId, consultor: consultorNome } }
    }));

    await supabase.from('eventos_maquina').insert(novosEventos);
    window.location.reload();
  };

  const atualizarMaquina = async (maquinaId: string, supervisorId: number, consultorNome: string) => {
    const timestamp = new Date().toISOString();
    const novoStatus: StatusEstoque = supervisorId ? 'ATRIBUIDA' : 'DISPONIVEL';

    await supabase.from('maquinas')
      .update({ supervisor_id: supervisorId, consultor_nome: consultorNome, status_estoque: novoStatus })
      .eq('id', maquinaId);

    await supabase.from('eventos_maquina').insert({
      id: crypto.randomUUID(), maquina_id: maquinaId, tipo_evento: 'EDICAO',
      criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema',
      payload: { after: { supervisor: supervisorId, consultor: consultorNome } }
    });
    window.location.reload();
  };

  const baixarEmLote = async (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => {
    const timestamp = dataBaixa ? new Date(dataBaixa + 'T12:00:00').toISOString() : new Date().toISOString();
    
    await supabase.from('maquinas')
      .update({ 
        status_estoque: 'BAIXADA', motivo_baixa: motivo, 
        observacao_baixa: observacao, baixado_em: timestamp, 
        baixado_por: currentUser?.nome || 'Sistema' 
      })
      .in('id', maquinaIds);

    const novosEventos = maquinaIds.map(id => ({
      id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'BAIXA',
      criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema',
      payload: { after: { status: 'BAIXADA', motivo, observacao } }
    }));

    await supabase.from('eventos_maquina').insert(novosEventos);
    window.location.reload();
  };

  const disponibilizarEmLote = async (maquinaIds: string[]) => {
    const timestamp = new Date().toISOString();

    await supabase.from('maquinas')
      .update({ status_estoque: 'DISPONIVEL', supervisor_id: null, consultor_nome: null, atribuido_em: null })
      .in('id', maquinaIds);

    const novosEventos = maquinaIds.map(id => ({
      id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'EDICAO',
      criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema',
      payload: { after: { status: 'DISPONIVEL' } }
    }));

    await supabase.from('eventos_maquina').insert(novosEventos);
    window.location.reload();
  };

  const desfazerBaixa = async (maquinaId: string, justificativa: string) => {
    const machine = maquinas.find(m => m.id === maquinaId);
    if (!machine) return;
    const novoStatus: StatusEstoque = machine.supervisor_id ? 'ATRIBUIDA' : 'DISPONIVEL';

    await supabase.from('maquinas')
      .update({ 
        status_estoque: novoStatus, motivo_baixa: null, 
        observacao_baixa: null, baixado_em: null, baixado_por: null 
      })
      .eq('id', maquinaId);

    await supabase.from('eventos_maquina').insert({
      id: crypto.randomUUID(), maquina_id: maquinaId, tipo_evento: 'DESFAZER_BAIXA',
      criado_em: new Date().toISOString(), criado_por: currentUser?.nome || 'Sistema',
      justificativa, payload: { after: { status: novoStatus } }
    });
    window.location.reload();
  };

  const registrarDevolucao = async (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => {
    await supabase.from('devolucoes').insert({
      id: crypto.randomUUID(),
      criado_em: new Date().toISOString(),
      criado_por: currentUser?.nome || 'Sistema',
      ...dados
    });
    window.location.reload();
  };

  const atualizarEnvioDevolucao = async (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => {
    await supabase.from('devolucoes').update(dados).eq('id', id);
    window.location.reload();
  };

  const contextValue = useMemo(() => ({
    currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes, loading,
    executarImportacao, atribuirEmLote, atualizarMaquina, baixarEmLote, desfazerBaixa, disponibilizarEmLote, registrarDevolucao, atualizarEnvioDevolucao, logout: handleLogout,
  }), [currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes, loading]);

  return (
    <AppContext.Provider value={contextValue}>
      {currentUser ? <Layout /> : <LoginScreen onLogin={handleLogin} />}
    </AppContext.Provider>
  );
};

export default App;
