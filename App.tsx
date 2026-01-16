
import React, { useState, createContext, useMemo, useEffect } from 'react';
import { Maquina, UserProfile, Pedido, Importacao, ImportacaoItem, EventoMaquina, MotivoBaixa, StatusEstoque, Devolucao, Regiao } from './types';
import LoginScreen from './components/LoginScreen';
import Layout from './components/Layout';

interface AppContextType {
  currentUser: UserProfile | null;
  pedidos: Pedido[];
  maquinas: Maquina[];
  importacoes: Importacao[];
  importacaoItens: ImportacaoItem[];
  eventos: EventoMaquina[];
  devolucoes: Devolucao[];
  executarImportacao: (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string, regiao?: Regiao) => void;
  atribuirEmLote: (maquinaIds: string[], supervisorId: number, consultorNome: string) => void;
  atualizarMaquina: (maquinaId: string, supervisorId: number, consultorNome: string) => void;
  baixarEmLote: (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => void;
  desfazerBaixa: (maquinaId: string, justificativa: string) => void;
  disponibilizarEmLote: (maquinaIds: string[]) => void;
  registrarDevolucao: (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => void;
  atualizarEnvioDevolucao: (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => void;
  logout: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  
  const [pedidos, setPedidos] = useState<Pedido[]>(() => JSON.parse(localStorage.getItem('pedidos') || '[]'));
  const [maquinas, setMaquinas] = useState<Maquina[]>(() => JSON.parse(localStorage.getItem('maquinas') || '[]'));
  const [importacoes, setImportacoes] = useState<Importacao[]>(() => JSON.parse(localStorage.getItem('importacoes') || '[]'));
  const [importacaoItens, setImportacaoItens] = useState<ImportacaoItem[]>(() => JSON.parse(localStorage.getItem('importacao_itens') || '[]'));
  const [eventos, setEventos] = useState<EventoMaquina[]>(() => JSON.parse(localStorage.getItem('eventos_maquina') || '[]'));
  const [devolucoes, setDevolucoes] = useState<Devolucao[]>(() => JSON.parse(localStorage.getItem('devolucoes') || '[]'));

  useEffect(() => {
    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    localStorage.setItem('maquinas', JSON.stringify(maquinas));
    localStorage.setItem('importacoes', JSON.stringify(importacoes));
    localStorage.setItem('importacao_itens', JSON.stringify(importacaoItens));
    localStorage.setItem('eventos_maquina', JSON.stringify(eventos));
    localStorage.setItem('devolucoes', JSON.stringify(devolucoes));
  }, [pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes]);

  const handleLogin = (perfil: UserProfile) => setCurrentUser(perfil);
  const handleLogout = () => setCurrentUser(null);

  const executarImportacao = (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string, regiao?: Regiao) => {
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

    const counts = {
        total: processados.length,
        inseridos: novasMaquinas.length,
        invalidos: processados.filter(i => i.status === 'INVALIDO').length
    };

    if (pedidoExistente) {
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { 
            ...p, 
            qtd_importada: p.qtd_importada + counts.inseridos, 
            status_importacao: (qtdEsperada && (p.qtd_importada + counts.inseridos) >= qtdEsperada) ? 'COMPLETA' : 'PARCIAL',
            qtd_esperada: qtdEsperada || p.qtd_esperada,
            regiao: regiao || p.regiao
        } : p));
    } else {
        setPedidos(prev => [{
            id: pedidoId,
            codigo_pedido: codigoPedido,
            qtd_esperada: qtdEsperada,
            qtd_importada: counts.inseridos,
            status_importacao: (qtdEsperada && counts.inseridos >= qtdEsperada) ? 'COMPLETA' : 'PARCIAL',
            regiao: regiao,
            criado_em: dataBase,
            criado_por: currentUser?.nome || 'Sistema'
        }, ...prev]);
    }

    setImportacoes(prev => [{
        id: importId, pedido_id: pedidoId, arquivo_nome: arquivoNome, importado_em: new Date().toISOString(),
        importado_por: currentUser?.nome || 'Sistema', total_linhas_lidas: counts.total,
        seriais_validos: processados.filter(i => i.status !== 'INVALIDO').length,
        invalidos: counts.invalidos, duplicados_arquivo: processados.filter(i => i.status === 'DUPLICADO_ARQUIVO').length,
        duplicados_sistema: processados.filter(i => i.status === 'DUPLICADO_SISTEMA').length,
        maquinas_inseridas: counts.inseridos, status: counts.invalidos > 0 ? 'PROCESSADA_COM_ERROS' : 'PROCESSADA'
    }, ...prev]);
    setImportacaoItens(prev => [...novosLogs, ...prev]);
    setMaquinas(prev => [...novasMaquinas, ...prev]);
    setEventos(prev => [...novosEventos, ...prev]);
  };

  const atribuirEmLote = (maquinaIds: string[], supervisorId: number, consultorNome: string) => {
    const timestamp = new Date().toISOString();
    const novosEventos: EventoMaquina[] = [];

    setMaquinas(prev => prev.map(m => {
        if (maquinaIds.includes(m.id)) {
            novosEventos.push({
                id: crypto.randomUUID(),
                maquina_id: m.id,
                tipo_evento: 'ATRIBUICAO',
                criado_em: timestamp,
                criado_por: currentUser?.nome || 'Sistema',
                payload: { before: { status: m.status_estoque, supervisor: m.supervisor_id, consultor: m.consultor_nome }, after: { status: 'ATRIBUIDA', supervisor: supervisorId, consultor: consultorNome } }
            });
            return { ...m, status_estoque: 'ATRIBUIDA', supervisor_id: supervisorId, consultor_nome: consultorNome, atribuido_em: timestamp };
        }
        return m;
    }));
    setEventos(prev => [...novosEventos, ...prev]);
  };

  const atualizarMaquina = (maquinaId: string, supervisorId: number, consultorNome: string) => {
    const timestamp = new Date().toISOString();
    setMaquinas(prev => prev.map(m => {
        if (m.id === maquinaId) {
             const novoEvento: EventoMaquina = {
                id: crypto.randomUUID(),
                maquina_id: m.id,
                tipo_evento: 'EDICAO',
                criado_em: timestamp,
                criado_por: currentUser?.nome || 'Sistema',
                payload: { before: { supervisor: m.supervisor_id, consultor: m.consultor_nome }, after: { supervisor: supervisorId, consultor: consultorNome } }
            };
            setEventos(prevEv => [novoEvento, ...prevEv]);
            
            const novoStatus: StatusEstoque = supervisorId ? 'ATRIBUIDA' : 'DISPONIVEL';
            
            return { 
                ...m, 
                supervisor_id: supervisorId, 
                consultor_nome: consultorNome, 
                status_estoque: m.status_estoque === 'BAIXADA' ? 'BAIXADA' : novoStatus,
                atribuido_em: m.atribuido_em || timestamp 
            };
        }
        return m;
    }));
  };

  const baixarEmLote = (maquinaIds: string[], motivo: MotivoBaixa, observacao: string, dataBaixa?: string) => {
    const timestamp = dataBaixa ? new Date(dataBaixa + 'T12:00:00').toISOString() : new Date().toISOString();
    const novosEventos: EventoMaquina[] = [];

    setMaquinas(prev => prev.map(m => {
        if (maquinaIds.includes(m.id)) {
            novosEventos.push({
                id: crypto.randomUUID(),
                maquina_id: m.id,
                tipo_evento: 'BAIXA',
                criado_em: timestamp,
                criado_por: currentUser?.nome || 'Sistema',
                payload: { before: { status: m.status_estoque }, after: { status: 'BAIXADA', motivo, observacao } }
            });
            return { 
                ...m, 
                status_estoque: 'BAIXADA', 
                motivo_baixa: motivo, 
                observacao_baixa: observacao,
                baixado_em: timestamp,
                baixado_por: currentUser?.nome || 'Sistema'
            };
        }
        return m;
    }));
    setEventos(prev => [...novosEventos, ...prev]);
  };

  const desfazerBaixa = (maquinaId: string, justificativa: string) => {
    const timestamp = new Date().toISOString();
    
    setMaquinas(prev => {
        const machine = prev.find(m => m.id === maquinaId);
        if (!machine) return prev;

        const novoStatus: StatusEstoque = machine.supervisor_id ? 'ATRIBUIDA' : 'DISPONIVEL';
        
        const novoEvento: EventoMaquina = {
            id: crypto.randomUUID(),
            maquina_id: maquinaId,
            tipo_evento: 'DESFAZER_BAIXA',
            criado_em: timestamp,
            criado_por: currentUser?.nome || 'Sistema',
            justificativa,
            payload: { before: { status: 'BAIXADA' }, after: { status: novoStatus } }
        };

        setEventos(evs => [novoEvento, ...evs]);

        return prev.map(m => {
            if (m.id === maquinaId) {
                return { 
                    ...m, 
                    status_estoque: novoStatus, 
                    motivo_baixa: undefined, 
                    observacao_baixa: undefined,
                    baixado_em: undefined,
                    baixado_por: undefined
                };
            }
            return m;
        });
    });
  };

  const disponibilizarEmLote = (maquinaIds: string[]) => {
    const timestamp = new Date().toISOString();
    const novosEventos: EventoMaquina[] = [];

    setMaquinas(prev => prev.map(m => {
        if (maquinaIds.includes(m.id)) {
            novosEventos.push({
                id: crypto.randomUUID(),
                maquina_id: m.id,
                tipo_evento: 'EDICAO',
                criado_em: timestamp,
                criado_por: currentUser?.nome || 'Sistema',
                payload: { 
                    before: { status: m.status_estoque, supervisor: m.supervisor_id, consultor: m.consultor_nome }, 
                    after: { status: 'DISPONIVEL', supervisor: undefined, consultor: undefined } 
                }
            });
            return { 
                ...m, 
                status_estoque: 'DISPONIVEL', 
                supervisor_id: undefined, 
                consultor_nome: undefined,
                atribuido_em: undefined 
            };
        }
        return m;
    }));
    setEventos(prev => [...novosEventos, ...prev]);
  };

  const registrarDevolucao = (dados: Omit<Devolucao, 'id' | 'criado_em' | 'criado_por'>) => {
      const novaDevolucao: Devolucao = {
          id: crypto.randomUUID(),
          criado_em: new Date().toISOString(),
          criado_por: currentUser?.nome || 'Sistema',
          ...dados
      };
      setDevolucoes(prev => [novaDevolucao, ...prev]);
  };

  const atualizarEnvioDevolucao = (id: string, dados: { data_envio_correios: string, codigo_rastreio: string, observacao_envio: string }) => {
    setDevolucoes(prev => prev.map(d => d.id === id ? { ...d, ...dados } : d));
  };

  const contextValue = useMemo(() => ({
    currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes,
    executarImportacao, atribuirEmLote, atualizarMaquina, baixarEmLote, desfazerBaixa, disponibilizarEmLote, registrarDevolucao, atualizarEnvioDevolucao, logout: handleLogout,
  }), [currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos, devolucoes, disponibilizarEmLote]);

  return (
    <AppContext.Provider value={contextValue}>
      {currentUser ? <Layout /> : <LoginScreen onLogin={handleLogin} />}
    </AppContext.Provider>
  );
};

export default App;
