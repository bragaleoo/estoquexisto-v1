
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
  isSyncing: boolean;
  triggerRefresh: () => void;
  executarImportacao: (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string, regiao?: Regiao) => Promise<void>;
  registrarMaquinaManual: (serial: string, loteCode: string, regiao?: Regiao) => Promise<void>;
  atribuirEmLote: (maquinaIds: string[], supervisorId: number, consultorNome: string) => Promise<void>;
  atualizarMaquina: (maquinaId: string, supervisorId: number, consultorNome: string, novaRegiao?: Regiao) => Promise<void>;
  baixarEmLote: (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => Promise<void>;
  desfazerBaixa: (maquinaId: string, justificativa: string) => Promise<void>;
  disponibilizarEmLote: (maquinaIds: string[]) => Promise<void>;
  alterarRegiaoEmLote: (maquinaIds: string[], novaRegiao: Regiao) => Promise<void>;
  registrarDevolucao: (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => Promise<void>;
  atualizarEnvioDevolucao: (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => Promise<void>;
  login: (user: UserProfile) => void;
  logout: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

const SESSION_KEY = 'xisto_user_session';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [importacoes, setImportacoes] = useState<Importacao[]>([]);
  const [importacaoItens, setImportacaoItens] = useState<ImportacaoItem[]>([]);
  const [eventos, setEventos] = useState<EventoMaquina[]>([]);
  const [devolucoes, setDevolucoes] = useState<Devolucao[]>([]);

  const fetchData = async () => {
    if (refreshTrigger === 0) setLoading(true);
    setIsSyncing(true);

    try {
      // Buscamos tudo do banco de dados de uma vez
      const [pRes, mRes, iRes, itRes, eRes, dRes] = await Promise.all([
        supabase.from('pedidos').select('*').order('criado_em', { ascending: false }),
        supabase.from('maquinas').select('*').order('criado_em', { ascending: false }),
        supabase.from('importacoes').select('*').order('importado_em', { ascending: false }),
        supabase.from('importacao_itens').select('*'),
        supabase.from('eventos_maquina').select('*').order('criado_em', { ascending: false }),
        supabase.from('devolucoes').select('*').order('criado_em', { ascending: false })
      ]);

      if (pRes.data) setPedidos(pRes.data);
      if (mRes.data) setMaquinas(mRes.data);
      if (iRes.data) setImportacoes(iRes.data);
      if (itRes.data) setImportacaoItens(itRes.data);
      if (eRes.data) setEventos(eRes.data);
      if (dRes.data) setDevolucoes(dRes.data);

    } catch (err) {
      console.error("Erro ao sincronizar com o banco:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (currentUser) fetchData();
    else setLoading(false);
  }, [refreshTrigger, currentUser]);

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const executarImportacao = async (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string, regiao?: Regiao) => {
    setIsSyncing(true);
    try {
        const batchSerials = processados.map(p => p.normalizado);
        const { data: dbMatches } = await supabase.from('maquinas').select('id, serial').in('serial', batchSerials);
        const dbMap = new Map<string, string>();
        dbMatches?.forEach(m => dbMap.set(m.serial, m.id));

        const importId = crypto.randomUUID();
        const dataBase = dataPedido ? new Date(dataPedido + 'T12:00:00').toISOString() : new Date().toISOString();

        const tempPedidoId = crypto.randomUUID();
        const { data: pedidoData, error: pError } = await supabase
            .from('pedidos')
            .upsert({ 
                id: tempPedidoId,
                codigo_pedido: codigoPedido.toUpperCase(), 
                qtd_esperada: qtdEsperada, 
                regiao, 
                criado_por: currentUser?.nome || 'Sistema'
            }, { onConflict: 'codigo_pedido' })
            .select()
            .single();

        if (pError || !pedidoData) throw new Error("Erro no Pedido: " + pError?.message);
        const pedidoId = pedidoData.id;

        const maquinasParaSalvar: any[] = [];
        const novosEventos: any[] = [];

        processados.forEach(item => {
            if (item.status === 'INSERIDO' || item.status === 'DUPLICADO_SISTEMA') {
                const mId = dbMap.get(item.normalizado) || crypto.randomUUID();
                maquinasParaSalvar.push({ 
                    id: mId, 
                    serial: item.normalizado, 
                    pedido_id: pedidoId, 
                    import_id: importId, 
                    status_estoque: 'DISPONIVEL', 
                    criado_em: dataBase, 
                    regiao,
                    supervisor_id: null,
                    consultor_nome: null,
                    atribuido_em: null,
                    baixado_em: null
                });
                novosEventos.push({ 
                    id: crypto.randomUUID(), 
                    maquina_id: mId, 
                    tipo_evento: dbMap.has(item.normalizado) ? 'EDICAO' : 'IMPORTADA', 
                    criado_em: new Date().toISOString(), 
                    criado_por: currentUser?.nome || 'Sistema', 
                    payload: { after: { status: 'DISPONIVEL', pedido: codigoPedido } } 
                });
            }
        });

        if (maquinasParaSalvar.length > 0) {
            await supabase.from('maquinas').upsert(maquinasParaSalvar, { onConflict: 'serial' });
            await supabase.from('eventos_maquina').insert(novosEventos);
        }

        // Recalcula total real
        const { count } = await supabase.from('maquinas').select('*', { count: 'exact', head: true }).eq('pedido_id', pedidoId);
        await supabase.from('pedidos').update({ qtd_importada: count || 0 }).eq('id', pedidoId);

        triggerRefresh();
    } catch (err) {
        console.error("Erro grave:", err);
        throw err;
    } finally {
        setIsSyncing(false);
    }
  };

  const registrarMaquinaManual = async (serial: string, loteCode: string, regiao?: Regiao) => {
    setIsSyncing(true);
    let pedido = pedidos.find(p => p.codigo_pedido.toUpperCase() === loteCode.toUpperCase());
    let pedidoId = pedido?.id;

    if (!pedidoId) {
      const { data: nP } = await supabase.from('pedidos').insert({ id: crypto.randomUUID(), codigo_pedido: loteCode.toUpperCase(), regiao, criado_por: currentUser?.nome || 'Sistema' }).select().single();
      pedidoId = nP?.id;
    }

    await supabase.from('maquinas').upsert({ serial: serial.toUpperCase(), pedido_id: pedidoId, status_estoque: 'DISPONIVEL', regiao }, { onConflict: 'serial' });
    triggerRefresh();
  };

  const atribuirEmLote = async (maquinaIds: string[], supervisorId: number, consultorNome: string) => {
    setIsSyncing(true);
    await supabase.from('maquinas').update({ status_estoque: 'ATRIBUIDA', supervisor_id: supervisorId, consultor_nome: consultorNome, atribuido_em: new Date().toISOString() }).in('id', maquinaIds);
    triggerRefresh();
  };

  const atualizarMaquina = async (maquinaId: string, supervisorId: number, consultorNome: string, novaRegiao?: Regiao) => {
    setIsSyncing(true);
    const status: StatusEstoque = supervisorId ? 'ATRIBUIDA' : 'DISPONIVEL';
    await supabase.from('maquinas').update({ supervisor_id: supervisorId, consultor_nome: consultorNome, status_estoque: status, regiao: novaRegiao }).eq('id', maquinaId);
    triggerRefresh();
  };

  const baixarEmLote = async (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => {
    setIsSyncing(true);
    const ts = dataBaixa ? new Date(dataBaixa + 'T12:00:00').toISOString() : new Date().toISOString();
    await supabase.from('maquinas').update({ status_estoque: 'BAIXADA', motivo_baixa: motivo, observacao_baixa: observacao, baixado_em: ts, baixado_por: currentUser?.nome || 'Sistema' }).in('id', maquinaIds);
    triggerRefresh();
  };

  const disponibilizarEmLote = async (maquinaIds: string[]) => {
    setIsSyncing(true);
    await supabase.from('maquinas').update({ status_estoque: 'DISPONIVEL', supervisor_id: null, consultor_nome: null, atribuido_em: null }).in('id', maquinaIds);
    triggerRefresh();
  };

  const alterarRegiaoEmLote = async (maquinaIds: string[], novaRegiao: Regiao) => {
    setIsSyncing(true);
    await supabase.from('maquinas').update({ regiao: novaRegiao }).in('id', maquinaIds);
    triggerRefresh();
  };

  const desfazerBaixa = async (maquinaId: string, justificativa: string) => {
    setIsSyncing(true);
    await supabase.from('maquinas').update({ status_estoque: 'DISPONIVEL', motivo_baixa: null, observacao_baixa: null, baixado_em: null }).eq('id', maquinaId);
    triggerRefresh();
  };

  const registrarDevolucao = async (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => {
    setIsSyncing(true);
    await supabase.from('devolucoes').insert({ id: crypto.randomUUID(), criado_em: new Date().toISOString(), criado_por: currentUser?.nome || 'Sistema', ...dados });
    triggerRefresh();
  };

  const atualizarEnvioDevolucao = async (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => {
    setIsSyncing(true);
    await supabase.from('devolucoes').update(dados).eq('id', id);
    triggerRefresh();
  };

  const contextValue = useMemo(() => ({
    currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes, loading, isSyncing, triggerRefresh,
    executarImportacao, registrarMaquinaManual, atribuirEmLote, atualizarMaquina, baixarEmLote, desfazerBaixa, disponibilizarEmLote, alterarRegiaoEmLote, registrarDevolucao, atualizarEnvioDevolucao, login: handleLogin, logout: handleLogout,
  }), [currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes, loading, isSyncing]);

  return (
    <AppContext.Provider value={contextValue}>
      {loading ? (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
           <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-white"></div>
        </div>
      ) : currentUser ? (
        <Layout />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </AppContext.Provider>
  );
};

export default App;
