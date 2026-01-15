
import React, { useState, createContext, useMemo, useEffect } from 'react';
import { Maquina, UserProfile, Pedido, Importacao, ImportacaoItem, EventoMaquina, MotivoVenda, StatusEstoque } from './types';
import LoginScreen from './components/LoginScreen';
import Layout from './components/Layout';

interface AppContextType {
  currentUser: UserProfile | null;
  pedidos: Pedido[];
  maquinas: Maquina[];
  importacoes: Importacao[];
  importacaoItens: ImportacaoItem[];
  eventos: EventoMaquina[];
  executarImportacao: (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string) => void;
  atribuirEmLote: (maquinaIds: string[], supervisorId: number, consultorNome: string) => void;
  atualizarMaquina: (maquinaId: string, supervisorId: number, consultorNome: string) => void;
  venderEmLote: (maquinaIds: string[], motivo: MotivoVenda, observacao: string) => void;
  desfazerVenda: (maquinaId: string, justificativa: string) => void;
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

  useEffect(() => {
    localStorage.setItem('pedidos', JSON.stringify(pedidos));
    localStorage.setItem('maquinas', JSON.stringify(maquinas));
    localStorage.setItem('importacoes', JSON.stringify(importacoes));
    localStorage.setItem('importacao_itens', JSON.stringify(importacaoItens));
    localStorage.setItem('eventos_maquina', JSON.stringify(eventos));
  }, [pedidos, maquinas, importacoes, importacaoItens, eventos]);

  const handleLogin = (perfil: UserProfile) => setCurrentUser(perfil);
  const handleLogout = () => setCurrentUser(null);

  const executarImportacao = (codigoPedido: string, qtdEsperada: number | undefined, arquivoNome: string, processados: any[], dataPedido?: string) => {
    const importId = crypto.randomUUID();
    let pedidoExistente = pedidos.find(p => p.codigo_pedido === codigoPedido);
    const pedidoId = pedidoExistente ? pedidoExistente.id : crypto.randomUUID();

    // Define a data base: se o usuário passou uma data (YYYY-MM-DD), usamos ela (meio-dia para evitar timezone issues), senão usa agora.
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
          criado_em: dataBase // Usa a data definida pelo usuário ou atual
        });
        novosEventos.push({
            id: crypto.randomUUID(),
            maquina_id: mId,
            tipo_evento: 'IMPORTADA',
            criado_em: new Date().toISOString(), // Evento de log é sempre "agora"
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
            qtd_esperada: qtdEsperada || p.qtd_esperada
            // Nota: Não atualizamos a data de criação de um pedido existente para manter histórico, 
            // mas as novas máquinas usarão a data informada.
        } : p));
    } else {
        setPedidos(prev => [{
            id: pedidoId,
            codigo_pedido: codigoPedido,
            qtd_esperada: qtdEsperada,
            qtd_importada: counts.inseridos,
            status_importacao: (qtdEsperada && counts.inseridos >= qtdEsperada) ? 'COMPLETA' : 'PARCIAL',
            criado_em: dataBase, // Novo pedido usa a data informada
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
            
            // Se tinha supervisor e agora mudou, mantém como atribuída. Se não tinha nada, pode virar atribuída.
            const novoStatus: StatusEstoque = supervisorId ? 'ATRIBUIDA' : 'DISPONIVEL';
            
            return { 
                ...m, 
                supervisor_id: supervisorId, 
                consultor_nome: consultorNome, 
                status_estoque: m.status_estoque === 'VENDIDA' ? 'VENDIDA' : novoStatus,
                atribuido_em: m.atribuido_em || timestamp 
            };
        }
        return m;
    }));
  };

  const venderEmLote = (maquinaIds: string[], motivo: MotivoVenda, observacao: string) => {
    const timestamp = new Date().toISOString();
    const novosEventos: EventoMaquina[] = [];

    setMaquinas(prev => prev.map(m => {
        if (maquinaIds.includes(m.id)) {
            novosEventos.push({
                id: crypto.randomUUID(),
                maquina_id: m.id,
                tipo_evento: 'VENDA',
                criado_em: timestamp,
                criado_por: currentUser?.nome || 'Sistema',
                payload: { before: { status: m.status_estoque }, after: { status: 'VENDIDA', motivo, observacao } }
            });
            return { 
                ...m, 
                status_estoque: 'VENDIDA', 
                motivo_venda: motivo, 
                observacao_venda: observacao,
                vendido_em: timestamp,
                vendido_por: currentUser?.nome || 'Sistema'
            };
        }
        return m;
    }));
    setEventos(prev => [...novosEventos, ...prev]);
  };

  const desfazerVenda = (maquinaId: string, justificativa: string) => {
    const timestamp = new Date().toISOString();
    
    setMaquinas(prev => {
        const machine = prev.find(m => m.id === maquinaId);
        if (!machine) return prev;

        const novoStatus: StatusEstoque = machine.supervisor_id ? 'ATRIBUIDA' : 'DISPONIVEL';
        
        // Registrar Evento
        const novoEvento: EventoMaquina = {
            id: crypto.randomUUID(),
            maquina_id: maquinaId,
            tipo_evento: 'DESFAZER_VENDA',
            criado_em: timestamp,
            criado_por: currentUser?.nome || 'Sistema',
            justificativa,
            payload: { before: { status: 'VENDIDA' }, after: { status: novoStatus } }
        };

        setEventos(evs => [novoEvento, ...evs]);

        return prev.map(m => {
            if (m.id === maquinaId) {
                return { 
                    ...m, 
                    status_estoque: novoStatus, 
                    motivo_venda: undefined, 
                    observacao_venda: undefined,
                    vendido_em: undefined,
                    vendido_por: undefined
                };
            }
            return m;
        });
    });
  };

  const contextValue = useMemo(() => ({
    currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos,
    executarImportacao, atribuirEmLote, atualizarMaquina, venderEmLote, desfazerVenda, logout: handleLogout,
  }), [currentUser, pedidos, maquinas, importacoes, importacaoItens, eventos]);

  return (
    <AppContext.Provider value={contextValue}>
      {currentUser ? <Layout /> : <LoginScreen onLogin={handleLogin} />}
    </AppContext.Provider>
  );
};

export default App;
