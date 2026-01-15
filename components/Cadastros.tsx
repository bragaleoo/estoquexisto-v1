
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';
import ImportWizard from './ImportWizard';
import { FileTextIcon, EditIcon } from './ui/Icons';
import { SUPERVISORES } from '../constants';
import { MotivoBaixa, Maquina, Regiao } from '../types';

const Cadastros: React.FC = () => {
    const context = useContext(AppContext);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    
    // Filtros Unificados
    const [filterPedido, setFilterPedido] = useState('');
    const [filterSerial, setFilterSerial] = useState('');
    const [filterDataImportacao, setFilterDataImportacao] = useState('');
    const [filterDataAtribuicao, setFilterDataAtribuicao] = useState('');
    const [filterDataBaixa, setFilterDataBaixa] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterOp, setFilterOp] = useState('');
    const [filterConsultor, setFilterConsultor] = useState('');
    const [filterRegiao, setFilterRegiao] = useState(''); // Novo filtro

    const [showBaixadas, setShowBaixadas] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchAction, setBatchAction] = useState<'atribuir' | 'baixar' | null>(null);
    const [batchData, setBatchData] = useState({ 
        supervisor: '', 
        consultor: '', 
        motivo: 'VENDA' as MotivoBaixa, 
        obs: ''
    });

    // Estado para edição individual
    const [editingMachine, setEditingMachine] = useState<Maquina | null>(null);
    const [editData, setEditData] = useState({ supervisor: '', consultor: '' });

    if (!context) return null;
    const { pedidos, maquinas, atribuirEmLote, baixarEmLote, atualizarMaquina, currentUser } = context;
    const isSupervisor = currentUser?.perfil === 'Supervisor';

    // Reseta página ao mudar filtros
    useEffect(() => { setCurrentPage(1); }, [filterPedido, filterSerial, filterDataImportacao, filterDataAtribuicao, filterDataBaixa, filterOp, filterConsultor, showBaixadas, filterStatus, filterRegiao]);
    
    // Reseta filtro de status ao mudar aba
    useEffect(() => { setFilterStatus(''); }, [showBaixadas]);

    // Função auxiliar para determinar a região do supervisor
    const getSupervisorRegion = (supervisorName: string): Regiao | null => {
        const name = supervisorName.toUpperCase();
        if (name.startsWith('AJU') || name.startsWith('SE')) return 'SERGIPE';
        if (name.startsWith('MAC')) return 'ALAGOAS';
        return null;
    };

    // Lógica de Filtragem Geral
    const filteredInventory = useMemo(() => {
        let list = maquinas;

        // 1. Filtro de Permissão (Supervisor vê apenas as suas)
        if (isSupervisor) {
            list = list.filter(m => m.supervisor_id === currentUser?.supervisorId);
        }

        // 2. Filtro de Status (Abas Ativas/Baixadas)
        list = list.filter(m => (showBaixadas ? m.status_estoque === 'BAIXADA' : m.status_estoque !== 'BAIXADA'));

        // 3. Filtros de Input do Usuário
        return list.filter(m => {
            // Busca o pedido relacionado para filtrar pelo código
            const pedidoRelacionado = pedidos.find(p => p.id === m.pedido_id);
            const matchPedido = filterPedido ? pedidoRelacionado?.codigo_pedido.toUpperCase().includes(filterPedido.trim().toUpperCase()) : true;

            const matchSerial = filterSerial ? m.serial.includes(filterSerial.trim().toUpperCase()) : true;
            
            // Filtros de Datas
            const matchDataImp = filterDataImportacao ? m.criado_em.startsWith(filterDataImportacao) : true;
            const matchDataAtrib = filterDataAtribuicao ? (m.atribuido_em && m.atribuido_em.startsWith(filterDataAtribuicao)) : true;
            const matchDataBaixa = filterDataBaixa ? (m.baixado_em && m.baixado_em.startsWith(filterDataBaixa)) : true;

            const matchStatus = filterStatus ? m.status_estoque === filterStatus : true;
            const matchOp = filterOp ? m.supervisor_id === parseInt(filterOp) : true;
            const matchConsultor = filterConsultor ? m.consultor_nome?.toUpperCase().includes(filterConsultor.trim().toUpperCase()) : true;

            // Filtro de Região
            let matchRegiao = true;
            if (filterRegiao) {
                const sup = SUPERVISORES.find(s => s.id === m.supervisor_id);
                if (!sup) {
                     matchRegiao = false;
                } else {
                    const nome = sup.nome.toUpperCase();
                    if (filterRegiao === 'SERGIPE') {
                        matchRegiao = nome.startsWith('AJU') || nome.startsWith('SE');
                    } else if (filterRegiao === 'ALAGOAS') {
                        matchRegiao = nome.startsWith('MAC');
                    }
                }
            }

            return matchPedido && matchSerial && matchDataImp && matchDataAtrib && matchDataBaixa && matchStatus && matchOp && matchConsultor && matchRegiao;
        });
    }, [maquinas, pedidos, isSupervisor, currentUser, showBaixadas, filterPedido, filterSerial, filterDataImportacao, filterDataAtribuicao, filterDataBaixa, filterStatus, filterOp, filterConsultor, filterRegiao]);

    // Paginação
    const paginatedInventory = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInventory.slice(start, start + itemsPerPage);
    }, [filteredInventory, currentPage]);

    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

    const toggleSelect = (id: string) => {
        if (isSupervisor) return;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const checkRegionConflict = (ids: string[], supervisorId: number) => {
        const supervisor = SUPERVISORES.find(s => s.id === supervisorId);
        if (!supervisor) return false;

        const supRegion = getSupervisorRegion(supervisor.nome);
        if (!supRegion) return false; // Supervisor sem região definida (pode ser genérico)

        const conflictingMachines = maquinas.filter(m => ids.includes(m.id)).filter(m => {
            const pedido = pedidos.find(p => p.id === m.pedido_id);
            // Se o pedido tem região e é diferente da região do supervisor, é conflito
            return pedido?.regiao && pedido.regiao !== supRegion;
        });

        if (conflictingMachines.length > 0) {
            const pedidoExemplo = pedidos.find(p => p.id === conflictingMachines[0].pedido_id);
            const msg = `ATENÇÃO: Você está tentando atribuir máquinas de um lote de ${pedidoExemplo?.regiao} para um supervisor de ${supRegion}.\n\nIsso pode ser um erro operacional. Deseja continuar mesmo assim?`;
            return !window.confirm(msg); // Retorna true se o usuário CANCELAR (não quiser continuar)
        }
        return false;
    };

    const handleConfirmAction = () => {
        if (batchAction === 'atribuir') {
            if (!batchData.supervisor) return alert("Selecione a operação.");
            
            // Validação de Conflito de Região
            const cancel = checkRegionConflict(selectedIds, parseInt(batchData.supervisor));
            if (cancel) return;

            atribuirEmLote(selectedIds, parseInt(batchData.supervisor), batchData.consultor);
        } else if (batchAction === 'baixar') {
            baixarEmLote(selectedIds, batchData.motivo, batchData.obs);
        }
        setSelectedIds([]);
        setBatchAction(null);
    };

    const openEditModal = (e: React.MouseEvent, m: Maquina) => {
        e.stopPropagation();
        setEditingMachine(m);
        setEditData({
            supervisor: m.supervisor_id?.toString() || '',
            consultor: m.consultor_nome || ''
        });
    };

    const handleSaveEdit = () => {
        if (editingMachine && editData.supervisor) {
            // Validação de Conflito de Região
            const cancel = checkRegionConflict([editingMachine.id], parseInt(editData.supervisor));
            if (cancel) return;

            atualizarMaquina(editingMachine.id, parseInt(editData.supervisor), editData.consultor);
            setEditingMachine(null);
        } else {
            alert("A operação é obrigatória na edição.");
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Estoque Geral</h1>
                    <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">
                        {isSupervisor ? 'Consulta de estoque atribuído.' : 'Gerenciamento completo de ativos.'}
                    </p>
                </div>
                {!isSupervisor && (
                    <div className="flex gap-4">
                        {selectedIds.length > 0 && (
                            <>
                                <button onClick={() => setBatchAction('atribuir')} className="bg-indigo-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-900 transition animate-fadeIn">
                                    Distribuir ({selectedIds.length})
                                </button>
                                {!showBaixadas && (
                                    <button onClick={() => setBatchAction('baixar')} className="bg-red-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-900 transition animate-fadeIn">
                                        Baixar ({selectedIds.length})
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={() => setImportModalOpen(true)} className="bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-800 transition flex items-center gap-2 font-black uppercase text-xs">
                            <FileTextIcon className="w-5 h-5" /> Importar Lote
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                
                {/* Barra de Filtros */}
                <div className="p-6 bg-slate-50 border-b-2 border-slate-200 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                            Filtros de Busca 
                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">{filteredInventory.length} encontrados</span>
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => setShowBaixadas(false)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${!showBaixadas ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>Ativas</button>
                            <button onClick={() => setShowBaixadas(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${showBaixadas ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-600'}`}>Baixadas</button>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-8`}>
                        <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Lote / Pedido</label>
                            <input 
                                type="text" 
                                placeholder="CÓDIGO..." 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600 placeholder:text-slate-300"
                                value={filterPedido}
                                onChange={(e) => setFilterPedido(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Serial</label>
                            <input 
                                type="text" 
                                placeholder="DIGITE O SERIAL..." 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600 placeholder:text-slate-300"
                                value={filterSerial}
                                onChange={(e) => setFilterSerial(e.target.value)}
                            />
                        </div>
                         {/* Filtros de Data */}
                         <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Data Importação</label>
                            <input 
                                type="date" 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                value={filterDataImportacao}
                                onChange={(e) => setFilterDataImportacao(e.target.value)}
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Data Atribuição</label>
                            <input 
                                type="date" 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                value={filterDataAtribuicao}
                                onChange={(e) => setFilterDataAtribuicao(e.target.value)}
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                         {showBaixadas && (
                             <div className="md:col-span-1">
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Data Baixa</label>
                                <input 
                                    type="date" 
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                    value={filterDataBaixa}
                                    onChange={(e) => setFilterDataBaixa(e.target.value)}
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        )}

                        {!showBaixadas && (
                            <div className="md:col-span-1">
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Status</label>
                                <select 
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="">TODOS</option>
                                    <option value="DISPONIVEL">DISPONÍVEL</option>
                                    <option value="ATRIBUIDA">ATRIBUÍDA</option>
                                </select>
                            </div>
                        )}
                         <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Região</label>
                            <select 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                value={filterRegiao}
                                onChange={(e) => setFilterRegiao(e.target.value)}
                            >
                                <option value="">TODAS</option>
                                <option value="SERGIPE">SERGIPE (AJU/SE)</option>
                                <option value="ALAGOAS">ALAGOAS (MAC)</option>
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Operação</label>
                            <select 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                value={filterOp}
                                onChange={(e) => setFilterOp(e.target.value)}
                            >
                                <option value="">TODAS</option>
                                {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Consultor</label>
                            <input 
                                type="text" 
                                placeholder="NOME..." 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600 placeholder:text-slate-300"
                                value={filterConsultor}
                                onChange={(e) => setFilterConsultor(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-950 font-black border-b-2 border-slate-200 uppercase text-[10px]">
                            <tr>
                                {!isSupervisor && <th className="p-5 w-10 text-center"><input type="checkbox" className="w-4 h-4 accent-blue-700" onChange={(e) => {
                                    if(e.target.checked) setSelectedIds(paginatedInventory.map(m => m.id));
                                    else setSelectedIds([]);
                                }} checked={paginatedInventory.length > 0 && selectedIds.length >= paginatedInventory.length} /></th>}
                                <th className="p-5">Lote / Importação</th>
                                <th className="p-5">Número de Serial</th>
                                <th className="p-5">Status</th>
                                <th className="p-5">Atribuído em</th>
                                {showBaixadas && <th className="p-5">Baixado em</th>}
                                <th className="p-5">Responsável / Operação</th>
                                {!showBaixadas && <th className="p-5 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginatedInventory.map(m => {
                                const pedido = pedidos.find(p => p.id === m.pedido_id);
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => toggleSelect(m.id)}>
                                        {!isSupervisor && <td className="p-5 text-center"><input type="checkbox" checked={selectedIds.includes(m.id)} readOnly className="w-5 h-5 accent-blue-700" /></td>}
                                        <td className="p-5">
                                            <p className="font-black text-blue-800 text-xs uppercase">{pedido?.codigo_pedido || 'N/A'}</p>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight mt-1">{new Date(m.criado_em).toLocaleDateString()}</p>
                                            {pedido?.regiao && (
                                                <span className={`mt-1 inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase ${pedido.regiao === 'SERGIPE' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                    {pedido.regiao}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-5 font-mono font-black text-slate-900 text-base group-hover:text-blue-800 transition-colors">{m.serial}</td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 rounded-lg font-black text-[9px] border-2 uppercase ${m.status_estoque === 'DISPONIVEL' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : m.status_estoque === 'ATRIBUIDA' ? 'bg-indigo-100 text-indigo-950 border-indigo-300' : 'bg-red-100 text-red-950 border-red-300'}`}>
                                                {m.status_estoque}
                                            </span>
                                        </td>
                                        {/* Nova Coluna: Atribuído Em */}
                                        <td className="p-5 text-xs font-black text-slate-700 uppercase">
                                            {m.atribuido_em ? new Date(m.atribuido_em).toLocaleDateString() : '-'}
                                        </td>
                                        {/* Nova Coluna: Baixado Em */}
                                        {showBaixadas && (
                                            <td className="p-5 text-xs font-black text-slate-700 uppercase">
                                                {m.baixado_em ? new Date(m.baixado_em).toLocaleDateString() : '-'}
                                            </td>
                                        )}
                                        <td className="p-5">
                                            <p className="font-black text-slate-900 text-xs">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                            <p className="text-[9px] font-black text-slate-600 uppercase">{m.consultor_nome || 'N/A'}</p>
                                        </td>
                                        {!showBaixadas && (
                                            <td className="p-5">
                                                <button 
                                                    onClick={(e) => openEditModal(e, m)}
                                                    className="p-2 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-all"
                                                    title="Editar atribuição"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {paginatedInventory.length === 0 && (
                                <tr>
                                    <td colSpan={showBaixadas ? 7 : 7} className="p-10 text-center font-black text-slate-400 uppercase text-xs tracking-widest italic">
                                        Nenhuma máquina encontrada com os filtros atuais.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                     <div className="p-6 border-t-2 border-slate-200 flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Mostrando {paginatedInventory.length} de {filteredInventory.length} registros
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase text-slate-700 disabled:opacity-50 hover:border-blue-600 transition"
                            >
                                Anterior
                            </button>
                            <div className="px-4 py-2 bg-slate-200 rounded-xl font-black text-[10px] text-slate-900 flex items-center">
                                {currentPage} / {totalPages}
                            </div>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase text-slate-700 disabled:opacity-50 hover:border-blue-600 transition"
                            >
                                Próxima
                            </button>
                        </div>
                     </div>
                )}
            </div>

            <Modal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} title="Importar Novo Lote">
                <ImportWizard onSuccess={() => setImportModalOpen(false)} />
            </Modal>

            {/* Modal de Atribuição/Baixa em Lote */}
            <Modal isOpen={!!batchAction} onClose={() => setBatchAction(null)} title={batchAction === 'atribuir' ? "Atribuição em Lote" : "Baixa em Lote"}>
                <div className="space-y-4">
                    <p className="text-sm font-black text-slate-950 uppercase">{selectedIds.length} máquinas selecionadas.</p>
                    {batchAction === 'atribuir' ? (
                        <>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.supervisor} onChange={e => setBatchData({...batchData, supervisor: e.target.value})}>
                                <option value="">SELECIONE A OPERAÇÃO *</option>
                                {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                            <input type="text" placeholder="NOME DO CONSULTOR (OPCIONAL)" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" value={batchData.consultor} onChange={e => setBatchData({...batchData, consultor: e.target.value})} />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">O consultor pode ser informado posteriormente via edição.</p>
                        </>
                    ) : (
                        <>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.motivo} onChange={e => setBatchData({...batchData, motivo: e.target.value as MotivoBaixa})}>
                                <option value="VENDA">VENDA</option>
                                <option value="POS_VENDA">PÓS-VENDA</option>
                                <option value="DEVOLUCAO">DEVOLUÇÃO</option>
                                <option value="ERRO_OPERACIONAL">ERRO OPERACIONAL</option>
                                <option value="OUTRO">OUTRO</option>
                            </select>
                            <textarea placeholder="OBSERVAÇÕES" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 h-24" value={batchData.obs} onChange={e => setBatchData({...batchData, obs: e.target.value})} />
                        </>
                    )}
                    <button onClick={handleConfirmAction} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">Confirmar Operação</button>
                </div>
            </Modal>

            {/* Modal de Edição Individual */}
            <Modal isOpen={!!editingMachine} onClose={() => setEditingMachine(null)} title="Editar Atribuição">
                 <div className="space-y-4">
                    <div className="bg-slate-100 p-4 rounded-xl">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Máquina</p>
                        <p className="text-lg font-black text-slate-900 font-mono">{editingMachine?.serial}</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Operação</label>
                        <select 
                            disabled={isSupervisor}
                            className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 disabled:opacity-50 disabled:bg-slate-100" 
                            value={editData.supervisor} 
                            onChange={e => setEditData({...editData, supervisor: e.target.value})}
                        >
                            <option value="">SELECIONE A OPERAÇÃO *</option>
                            {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                        {isSupervisor && <p className="text-[9px] text-red-500 font-black mt-1 uppercase">Você só pode alterar o consultor.</p>}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Consultor</label>
                        <input type="text" placeholder="NOME DO CONSULTOR" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" value={editData.consultor} onChange={e => setEditData({...editData, consultor: e.target.value})} />
                    </div>
                    <button onClick={handleSaveEdit} className="w-full bg-blue-700 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl mt-4">Salvar Alterações</button>
                 </div>
            </Modal>
        </div>
    );
};

export default Cadastros;
