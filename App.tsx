
import React, { useState, createContext, useMemo, useEffect } from 'react';
import { Maquina, UserProfile, Pedido, Importacao, ImportacaoItem, EventoMaquina, MotivoBaixa, StatusEstoque, Devolucao, Regiao, ItemBaixaMP } from './types';
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
  atribuirEmLote: (maquinaIds: string[], supervisorId: number, consultorNome: string, dataAtribuicao?: string) => Promise<void>;
  atualizarMaquina: (maquinaId: string, supervisorId: number, consultorNome: string, novaRegiao?: Regiao) => Promise<void>;
  baixarEmLote: (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => Promise<void>;
  executarBaixaMercadoPago: (itens: ItemBaixaMP[], cadastrarNaoEncontradas?: boolean, arquivoNome?: string) => Promise<void>;
  cancelarLoteBaixaMP: (importId: string) => Promise<void>;
  desfazerBaixa: (maquinaId: string, justificativa: string) => Promise<void>;
  disponibilizarEmLote: (maquinaIds: string[]) => Promise<void>;
  alterarRegiaoEmLote: (maquinaIds: string[], novaRegiao: Regiao) => Promise<void>;
  registrarDevolucao: (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => Promise<void>;
  atualizarEnvioDevolucao: (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => Promise<void>;
  editarDevolucao: (id: string, dados: { serial: string, supervisor_id: number, consultor_nome: string, data_entrega: string, observacao_inicial: string }) => Promise<void>;
  excluirDevolucao: (id: string) => Promise<void>;
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

  // Função para buscar TODAS as máquinas, contornando o limite de 1000 do Supabase
  const fetchAllMaquinas = async (): Promise<Maquina[]> => {
    let allData: Maquina[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('maquinas')
        .select('*')
        .order('id', { ascending: false })
        .range(from, from + step - 1);

      if (error) {
        console.error("Erro ao buscar máquinas:", error);
        hasMore = false;
      } else if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += step;
        if (data.length < step) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (refreshTrigger === 0) setLoading(true);
      else setIsSyncing(true);

      try {
        const [pRes, mData, iRes, itRes, eRes, dRes] = await Promise.all([
          supabase.from('pedidos').select('*').order('criado_em', { ascending: false }),
          fetchAllMaquinas(),
          supabase.from('importacoes').select('*').order('importado_em', { ascending: false }),
          supabase.from('importacao_itens').select('*'),
          supabase.from('eventos_maquina').select('*').order('criado_em', { ascending: false }),
          supabase.from('devolucoes').select('*').order('criado_em', { ascending: false })
        ]);

        if (pRes.data) setPedidos(pRes.data);
        setMaquinas(mData);
        if (iRes.data) setImportacoes(iRes.data);
        if (itRes.data) setImportacaoItens(itRes.data);
        if (eRes.data) setEventos(eRes.data);
        if (dRes.data) setDevolucoes(dRes.data);

      } catch (err) {
        console.error("Erro ao sincronizar:", err);
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    };

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

        if (pError || !pedidoData) throw new Error("Erro ao preparar lote: " + (pError?.message || 'Sem retorno'));
        const pedidoId = pedidoData.id;

        const maquinasParaSalvar: any[] = [];
        const novosLogs: ImportacaoItem[] = [];
        const novosEventos: EventoMaquina[] = [];

        processados.forEach(item => {
            const serialExistenteId = dbMap.get(item.normalizado);
            let itemStatus = item.status;
            let itemMotivo = item.motivo;

            if (itemStatus === 'INSERIDO' && serialExistenteId) {
                itemStatus = 'INSERIDO';
                itemMotivo = 'Serial recuperado do banco e vinculado a este lote';
            }

            novosLogs.push({ 
                id: crypto.randomUUID(), 
                import_id: importId, 
                linha_numero: item.linha, 
                serial_original: item.original, 
                serial_normalizado: item.normalizado, 
                status_item: itemStatus, 
                erro_motivo: itemMotivo 
            });

            if (itemStatus === 'INSERIDO') {
                const mId = serialExistenteId || crypto.randomUUID();
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
                    baixado_em: null,
                    motivo_baixa: null
                });
                novosEventos.push({ 
                    id: crypto.randomUUID(), 
                    maquina_id: mId, 
                    tipo_evento: serialExistenteId ? 'EDICAO' : 'IMPORTADA', 
                    criado_em: new Date().toISOString(), 
                    criado_por: currentUser?.nome || 'Sistema', 
                    payload: { after: { status: 'DISPONIVEL', pedido: codigoPedido, regiao, resgatada: !!serialExistenteId } } 
                });
            }
        });

        await supabase.from('importacoes').insert({ 
            id: importId, 
            pedido_id: pedidoId, 
            arquivo_nome: arquivoNome, 
            importado_em: new Date().toISOString(), 
            importado_por: currentUser?.nome || 'Sistema', 
            total_linhas_lidas: processados.length, 
            seriais_validos: processados.filter(i => i.status !== 'INVALIDO').length, 
            invalidos: processados.filter(i => i.status === 'INVALIDO').length, 
            maquinas_inseridas: maquinasParaSalvar.length, 
            status: 'PROCESSADA' 
        });

        const chunkSize = 200;
        if (novosLogs.length > 0) {
            for (let i = 0; i < novosLogs.length; i += chunkSize) {
                await supabase.from('importacao_itens').insert(novosLogs.slice(i, i + chunkSize));
            }
        }

        if (maquinasParaSalvar.length > 0) {
            for (let i = 0; i < maquinasParaSalvar.length; i += chunkSize) {
                await supabase.from('maquinas').upsert(maquinasParaSalvar.slice(i, i + chunkSize), { onConflict: 'serial' });
            }
            for (let i = 0; i < novosEventos.length; i += chunkSize) {
                await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
            }
        }

        const { count } = await supabase.from('maquinas').select('*', { count: 'exact', head: true }).eq('pedido_id', pedidoId);
        await supabase.from('pedidos').update({ 
            qtd_importada: count || 0, 
            status_importacao: (qtdEsperada && (count || 0) >= qtdEsperada) ? 'COMPLETA' : 'PARCIAL' 
        }).eq('id', pedidoId);

        triggerRefresh();
    } catch (err) {
        console.error("ERRO CRÍTICO NA GRAVAÇÃO:", err);
        throw err;
    } finally {
        setIsSyncing(false);
    }
  };

  const registrarMaquinaManual = async (serial: string, loteCode: string, regiao?: Regiao) => {
    setIsSyncing(true);
    const timestamp = new Date().toISOString();
    let pedido = pedidos.find(p => p.codigo_pedido.toUpperCase() === loteCode.toUpperCase());
    let pedidoId: string;

    if (!pedido) {
      pedidoId = crypto.randomUUID();
      await supabase.from('pedidos').insert({ id: pedidoId, codigo_pedido: loteCode.toUpperCase(), qtd_importada: 1, status_importacao: 'PARCIAL', regiao, criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema' });
    } else {
      pedidoId = pedido.id;
    }

    await supabase.from('maquinas').upsert({ 
        serial: serial.toUpperCase(), 
        pedido_id: pedidoId, 
        status_estoque: 'DISPONIVEL', 
        regiao,
        supervisor_id: null,
        consultor_nome: null,
        atribuido_em: null,
        baixado_em: null
    }, { onConflict: 'serial' });

    triggerRefresh();
  };

  const atribuirEmLote = async (maquinaIds: string[], supervisorId: number, consultorNome: string, dataAtribuicao?: string) => {
    setIsSyncing(true);
    const timestamp = dataAtribuicao ? new Date(dataAtribuicao + 'T12:00:00').toISOString() : new Date().toISOString();
    await supabase.from('maquinas').update({ status_estoque: 'ATRIBUIDA', supervisor_id: supervisorId, consultor_nome: consultorNome, atribuido_em: timestamp }).in('id', maquinaIds);
    const novosEventos = maquinaIds.map(id => ({ id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'ATRIBUICAO', criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema', payload: { after: { status: 'ATRIBUIDA', supervisor: supervisorId, consultor: consultorNome, data_atribuicao: timestamp } } }));
    const chunkSize = 200;
    for (let i = 0; i < novosEventos.length; i += chunkSize) {
        await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
    }
    triggerRefresh();
  };

  const atualizarMaquina = async (maquinaId: string, supervisorId: number, consultorNome: string, novaRegiao?: Regiao) => {
    setIsSyncing(true);
    const timestamp = new Date().toISOString();
    const currentMachine = maquinas.find(m => m.id === maquinaId);
    const currentStatus = currentMachine?.status_estoque || 'DISPONIVEL';
    
    // Se já estiver baixada, mantém baixada. Caso contrário, define baseado na presença de supervisor.
    const novoStatus: StatusEstoque = currentStatus === 'BAIXADA' ? 'BAIXADA' : (supervisorId ? 'ATRIBUIDA' : 'DISPONIVEL');
    
    await supabase.from('maquinas').update({ supervisor_id: supervisorId, consultor_nome: consultorNome, status_estoque: novoStatus, regiao: novaRegiao }).eq('id', maquinaId);
    await supabase.from('eventos_maquina').insert({ id: crypto.randomUUID(), maquina_id: maquinaId, tipo_evento: 'EDICAO', criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema', payload: { after: { supervisor: supervisorId, consultor: consultorNome, regiao: novaRegiao, status: novoStatus } } });
    triggerRefresh();
  };

  const baixarEmLote = async (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => {
    setIsSyncing(true);
    const timestamp = dataBaixa ? new Date(dataBaixa + 'T12:00:00').toISOString() : new Date().toISOString();
    await supabase.from('maquinas').update({ status_estoque: 'BAIXADA', motivo_baixa: motivo, observacao_baixa: observacao, baixado_em: timestamp, baixado_por: currentUser?.nome || 'Sistema' }).in('id', maquinaIds);
    const novosEventos = maquinaIds.map(id => ({ id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'BAIXA', criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema', payload: { after: { status: 'BAIXADA', motivo, observacao } } }));
    const chunkSize = 200;
    for (let i = 0; i < novosEventos.length; i += chunkSize) {
        await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
    }
    triggerRefresh();
  };

  const executarBaixaMercadoPago = async (itens: ItemBaixaMP[], cadastrarNaoEncontradas: boolean = false, arquivoNome?: string) => {
    setIsSyncing(true);
    try {
      const timestamp = new Date().toISOString();
      const currentUserNome = currentUser?.nome || 'Sistema';

      const itensParaProcessar = itens.filter(item => 
        item.statusProcessamento === 'PRONTA' || (cadastrarNaoEncontradas && item.statusProcessamento === 'NAO_ENCONTRADA')
      );

      if (itensParaProcessar.length === 0) return;

      const importId = crypto.randomUUID();
      const batchSerials = itensParaProcessar.map(i => i.serialNormalizado);
      const { data: dbMatches } = await supabase.from('maquinas').select('id, serial, pedido_id, regiao, atribuido_em').in('serial', batchSerials);
      const dbMap = new Map<string, any>();
      dbMatches?.forEach(m => dbMap.set(m.serial, m));

      let loteMpId: string | null = null;
      const loteCode = 'LOTE_MERCADOPAGO_AUTO';
      let pedidoMp = pedidos.find(p => p.codigo_pedido === loteCode);
      if (!pedidoMp) {
        loteMpId = crypto.randomUUID();
        await supabase.from('pedidos').insert({
          id: loteMpId,
          codigo_pedido: loteCode,
          qtd_importada: 0,
          status_importacao: 'PARCIAL',
          criado_em: timestamp,
          criado_por: currentUserNome
        });
      } else {
        loteMpId = pedidoMp.id;
      }

      const maquinasParaUpsert: any[] = [];
      const novosEventos: EventoMaquina[] = [];

      for (const item of itensParaProcessar) {
        const existing = (item.maquinaIdExistente ? maquinas.find(m => m.id === item.maquinaIdExistente) : null) || dbMap.get(item.serialNormalizado);
        const mId = existing?.id || item.maquinaIdExistente || crypto.randomUUID();
        const serialFinal = existing?.serial || item.serialNormalizado;
        const pedidoId = existing?.pedido_id || loteMpId;
        let dataBaixaIso = timestamp;
        if (item.dataBaixa) {
          try {
            dataBaixaIso = new Date(item.dataBaixa.includes('T') ? item.dataBaixa : item.dataBaixa + 'T12:00:00').toISOString();
          } catch {
            dataBaixaIso = timestamp;
          }
        }

        maquinasParaUpsert.push({
          id: mId,
          serial: serialFinal,
          pedido_id: pedidoId,
          status_estoque: 'BAIXADA',
          supervisor_id: item.supervisorId || null,
          consultor_nome: item.consultorNome || null,
          regiao: item.regiao || existing?.regiao || null,
          baixado_em: dataBaixaIso,
          atribuido_em: existing?.atribuido_em || dataBaixaIso,
          baixado_por: currentUserNome,
          motivo_baixa: item.motivoBaixa || 'VENDA',
          observacao_baixa: item.observacaoBaixa || 'Baixa Automática Mercado Pago'
        });

        novosEventos.push({
          id: crypto.randomUUID(),
          maquina_id: mId,
          tipo_evento: 'BAIXA',
          criado_em: timestamp,
          criado_por: currentUserNome,
          payload: {
            import_id: importId,
            after: {
              status: 'BAIXADA',
              motivo: item.motivoBaixa || 'VENDA',
              consultor: item.consultorNome,
              supervisor: item.supervisorId,
              data_baixa: dataBaixaIso,
              observacao: item.observacaoBaixa,
              fonte: 'IMPORTACAO_MP'
            }
          }
        });
      }

      await supabase.from('importacoes').insert({
        id: importId,
        pedido_id: loteMpId,
        arquivo_nome: arquivoNome || 'Planilha Mercado Pago (Baixa)',
        importado_em: timestamp,
        importado_por: currentUserNome,
        total_linhas_lidas: itens.length,
        seriais_validos: itensParaProcessar.length,
        invalidos: itens.filter(i => i.statusProcessamento === 'INVALIDA').length,
        maquinas_inseridas: itensParaProcessar.length,
        status: 'PROCESSADA'
      });

      const chunkSize = 200;
      if (maquinasParaUpsert.length > 0) {
        for (let i = 0; i < maquinasParaUpsert.length; i += chunkSize) {
          await supabase.from('maquinas').upsert(maquinasParaUpsert.slice(i, i + chunkSize), { onConflict: 'serial' });
        }
        for (let i = 0; i < novosEventos.length; i += chunkSize) {
          await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
        }
      }

      triggerRefresh();
    } catch (err) {
      console.error("Erro na baixa automatizada Mercado Pago:", err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const cancelarLoteBaixaMP = async (importId: string) => {
    setIsSyncing(true);
    try {
      const timestamp = new Date().toISOString();
      const currentUserNome = currentUser?.nome || 'Sistema';

      const { data: eventosLote } = await supabase.from('eventos_maquina').select('maquina_id, payload').eq('tipo_evento', 'BAIXA');
      const maquinaIdsDoLote: string[] = [];

      eventosLote?.forEach(ev => {
        if (ev.payload?.import_id === importId) {
          maquinaIdsDoLote.push(ev.maquina_id);
        }
      });

      if (maquinaIdsDoLote.length > 0) {
        const { data: maquinasAfetadas } = await supabase.from('maquinas').select('id, supervisor_id').in('id', maquinaIdsDoLote);

        if (maquinasAfetadas && maquinasAfetadas.length > 0) {
          for (const m of maquinasAfetadas) {
            const novoStatus: StatusEstoque = m.supervisor_id ? 'ATRIBUIDA' : 'DISPONIVEL';
            await supabase.from('maquinas').update({
              status_estoque: novoStatus,
              baixado_em: null,
              baixado_por: null,
              motivo_baixa: null,
              observacao_baixa: null
            }).eq('id', m.id);
          }

          const novosEventos = maquinasAfetadas.map(m => ({
            id: crypto.randomUUID(),
            maquina_id: m.id,
            tipo_evento: 'DESFAZER_BAIXA',
            criado_em: timestamp,
            criado_por: currentUserNome,
            justificativa: `Cancelamento de lote de baixa automatizada MP #${importId.slice(0, 8)}`,
            payload: { after: { status: m.supervisor_id ? 'ATRIBUIDA' : 'DISPONIVEL' } }
          }));

          const chunkSize = 200;
          for (let i = 0; i < novosEventos.length; i += chunkSize) {
            await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
          }
        }
      }

      await supabase.from('importacoes').update({ status: 'CANCELADA' }).eq('id', importId);

      triggerRefresh();
    } catch (err) {
      console.error('Erro ao cancelar lote de baixa MP:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const disponibilizarEmLote = async (maquinaIds: string[]) => {
    setIsSyncing(true);
    const timestamp = new Date().toISOString();
    await supabase.from('maquinas').update({ 
        status_estoque: 'DISPONIVEL', 
        supervisor_id: null, 
        consultor_nome: null, 
        atribuido_em: null,
        baixado_em: null,
        motivo_baixa: null,
        observacao_baixa: null,
        baixado_por: null
    }).in('id', maquinaIds);
    const novosEventos = maquinaIds.map(id => ({ id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'EDICAO', criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema', payload: { after: { status: 'DISPONIVEL' } } }));
    const chunkSize = 200;
    for (let i = 0; i < novosEventos.length; i += chunkSize) {
        await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
    }
    triggerRefresh();
  };

  const alterarRegiaoEmLote = async (maquinaIds: string[], novaRegiao: Regiao) => {
    setIsSyncing(true);
    const timestamp = new Date().toISOString();
    await supabase.from('maquinas').update({ regiao: novaRegiao }).in('id', maquinaIds);
    const novosEventos = maquinaIds.map(id => ({ id: crypto.randomUUID(), maquina_id: id, tipo_evento: 'EDICAO', criado_em: timestamp, criado_por: currentUser?.nome || 'Sistema', payload: { after: { regiao: novaRegiao } } }));
    const chunkSize = 200;
    for (let i = 0; i < novosEventos.length; i += chunkSize) {
        await supabase.from('eventos_maquina').insert(novosEventos.slice(i, i + chunkSize));
    }
    triggerRefresh();
  };

  const desfazerBaixa = async (maquinaId: string, justificativa: string) => {
    setIsSyncing(true);
    const machine = maquinas.find(m => m.id === maquinaId);
    if (!machine) return;
    const novoStatus: StatusEstoque = machine.supervisor_id ? 'ATRIBUIDA' : 'DISPONIVEL';
    await supabase.from('maquinas').update({ status_estoque: novoStatus, motivo_baixa: null, observacao_baixa: null, baixado_em: null, baixado_por: null }).eq('id', maquinaId);
    await supabase.from('eventos_maquina').insert({ id: crypto.randomUUID(), maquina_id: maquinaId, tipo_evento: 'DESFAZER_BAIXA', criado_em: new Date().toISOString(), criado_por: currentUser?.nome || 'Sistema', justificativa, payload: { after: { status: novoStatus } } });
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

  const editarDevolucao = async (id: string, dados: { serial: string, supervisor_id: number, consultor_nome: string, data_entrega: string, observacao_inicial: string }) => {
    setIsSyncing(true);
    await supabase.from('devolucoes').update(dados).eq('id', id);
    triggerRefresh();
  };

  const excluirDevolucao = async (id: string) => {
    setIsSyncing(true);
    await supabase.from('devolucoes').delete().eq('id', id);
    triggerRefresh();
  };

  const contextValue = useMemo(() => ({
    currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes, loading, isSyncing, triggerRefresh,
    executarImportacao, registrarMaquinaManual, atribuirEmLote, atualizarMaquina, baixarEmLote, executarBaixaMercadoPago, cancelarLoteBaixaMP, desfazerBaixa, disponibilizarEmLote, alterarRegiaoEmLote, registrarDevolucao, atualizarEnvioDevolucao, editarDevolucao, excluirDevolucao, login: handleLogin, logout: handleLogout,
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
