
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';
import ImportWizard from './ImportWizard';
import { FileTextIcon, EditIcon } from './ui/Icons';
import { SUPERVISORES } from '../constants';
import { MotivoVenda, Maquina } from '../types';

const Cadastros: React.FC = () => {
    const context = useContext(AppContext);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    
    // Filtros Unificados
    const [filterPedido, setFilterPedido] = useState('');
    const [filterSerial, setFilterSerial] = useState('');
    const [filterData, setFilterData] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterOp, setFilterOp] = useState('');
    const [filterConsultor, setFilterConsultor] = useState('');

    const [showVendidas, setShowVendidas] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchAction, setBatchAction] = useState<'atribuir' | 'vender' | null>(null);
    const [batchData, setBatchData] = useState({ 
        supervisor: '', 
        consultor: '', 
        motivo: 'VENDA' as MotivoVenda, 
        obs: ''
    });

    // Estado para edição individual
    const [editingMachine, setEditingMachine] = useState<Maquina | null>(null);
    const [editData, setEditData] = useState({ supervisor: '', consultor: '' });

    if (!context) return null;
    const { pedidos, maquinas, atribuirEmLote, venderEmLote, atualizarMaquina, currentUser } = context;
    const isReadOnly = currentUser?.perfil === 'Supervisor';

    // Reseta página ao mudar filtros
    useEffect(() => { setCurrentPage(1); }, [filterPedido, filterSerial, filterData, filterOp, filterConsultor, showVendidas, filterStatus]);
    
    // Reseta filtro de status ao mudar aba
    useEffect(() => { setFilterStatus(''); }, [showVendidas]);

    // Lógica de Filtragem Geral
    const filteredInventory = useMemo(() => {
        let list = maquinas;

        // 1. Filtro de Permissão (Supervisor vê apenas as suas)
        if (isReadOnly) {
            list = list.filter(m => m.supervisor_id === currentUser?.supervisorId);
        }

        // 2. Filtro de Status (Abas Ativas/Vendidas)
        list = list.filter(m => (showVendidas ? m.status_estoque === 'VENDIDA' : m.status_estoque !== 'VENDIDA'));

        // 3. Filtros de Input do Usuário
        return list.filter(m => {
            // Busca o pedido relacionado para filtrar pelo código
            const pedidoRelacionado = pedidos.find(p => p.id === m.pedido_id);
            const matchPedido = filterPedido ? pedidoRelacionado?.codigo_pedido.toUpperCase().includes(filterPedido.trim().toUpperCase()) : true;

            const matchSerial = filterSerial ? m.serial.includes(filterSerial.trim().toUpperCase()) : true;
            const matchData = filterData ? m.criado_em.startsWith(filterData) : true;
            const matchStatus = filterStatus ? m.status_estoque === filterStatus : true;
            const matchOp = filterOp ? m.supervisor_id === parseInt(filterOp) : true;
            const matchConsultor = filterConsultor ? m.consultor_nome?.toUpperCase().includes(filterConsultor.trim().toUpperCase()) : true;

            return matchPedido && matchSerial && matchData && matchStatus && matchOp && matchConsultor;
        });
    }, [maquinas, pedidos, isReadOnly, currentUser, showVendidas, filterPedido, filterSerial, filterData, filterStatus, filterOp, filterConsultor]);

    // Paginação
    const paginatedInventory = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInventory.slice(start, start + itemsPerPage);
    }, [filteredInventory, currentPage]);

    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

    const toggleSelect = (id: string) => {
        if (isReadOnly) return;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleConfirmAction = () => {
        if (batchAction === 'atribuir') {
            // Agora permite atribuir apenas a operação, sem consultor obrigatório
            if (!batchData.supervisor) return alert("Selecione a operação.");
            atribuirEmLote(selectedIds, parseInt(batchData.supervisor), batchData.consultor);
        } else if (batchAction === 'vender') {
            venderEmLote(selectedIds, batchData.motivo, batchData.obs);
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
                        {isReadOnly ? 'Consulta de estoque atribuído.' : 'Gerenciamento completo de ativos.'}
                    </p>
                </div>
                {!isReadOnly && (
                    <div className="flex gap-4">
                        {selectedIds.length > 0 && (
                            <>
                                <button onClick={() => setBatchAction('atribuir')} className="bg-indigo-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-900 transition animate-fadeIn">
                                    Distribuir ({selectedIds.length})
                                </button>
                                {!showVendidas && (
                                    <button onClick={() => setBatchAction('vender')} className="bg-red-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-900 transition animate-fadeIn">
                                        Vender ({selectedIds.length})
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
                            <button onClick={() => setShowVendidas(false)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${!showVendidas ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>Ativas</button>
                            <button onClick={() => setShowVendidas(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${showVendidas ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-600'}`}>Vendidas</button>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 gap-4 ${!showVendidas ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Lote / Pedido</label>
                            <input 
                                type="text" 
                                placeholder="CÓDIGO..." 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600 placeholder:text-slate-300"
                                value={filterPedido}
                                onChange={(e) => setFilterPedido(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Data Importação</label>
                            <input 
                                type="date" 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600"
                                value={filterData}
                                onChange={(e) => setFilterData(e.target.value)}
                                style={{ colorScheme: 'light' }}
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Serial</label>
                            <input 
                                type="text" 
                                placeholder="DIGITE O SERIAL..." 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600 placeholder:text-slate-300"
                                value={filterSerial}
                                onChange={(e) => setFilterSerial(e.target.value)}
                            />
                        </div>
                        {!showVendidas && (
                            <div>
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
                        <div>
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
                        <div>
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
                                {!isReadOnly && <th className="p-5 w-10 text-center"><input type="checkbox" className="w-4 h-4 accent-blue-700" onChange={(e) => {
                                    if(e.target.checked) setSelectedIds(paginatedInventory.map(m => m.id));
                                    else setSelectedIds([]);
                                }} checked={paginatedInventory.length > 0 && selectedIds.length >= paginatedInventory.length} /></th>}
                                <th className="p-5">Lote / Data</th>
                                <th className="p-5">Número de Serial</th>
                                <th className="p-5">Status</th>
                                <th className="p-5">Responsável / Operação</th>
                                {!isReadOnly && !showVendidas && <th className="p-5 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginatedInventory.map(m => {
                                const pedido = pedidos.find(p => p.id === m.pedido_id);
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => toggleSelect(m.id)}>
                                        {!isReadOnly && <td className="p-5 text-center"><input type="checkbox" checked={selectedIds.includes(m.id)} readOnly className="w-5 h-5 accent-blue-700" /></td>}
                                        <td className="p-5">
                                            <p className="font-black text-blue-800 text-xs uppercase">{pedido?.codigo_pedido || 'N/A'}</p>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight mt-1">{new Date(m.criado_em).toLocaleDateString()}</p>
                                        </td>
                                        <td className="p-5 font-mono font-black text-slate-900 text-base group-hover:text-blue-800 transition-colors">{m.serial}</td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 rounded-lg font-black text-[9px] border-2 uppercase ${m.status_estoque === 'DISPONIVEL' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : m.status_estoque === 'ATRIBUIDA' ? 'bg-indigo-100 text-indigo-950 border-indigo-300' : 'bg-red-100 text-red-950 border-red-300'}`}>
                                                {m.status_estoque}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <p className="font-black text-slate-900 text-xs">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                            <p className="text-[9px] font-black text-slate-600 uppercase">{m.consultor_nome || 'N/A'}</p>
                                        </td>
                                        {!isReadOnly && !showVendidas && (
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
                                    <td colSpan={6} className="p-10 text-center font-black text-slate-400 uppercase text-xs tracking-widest italic">
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

            {/* Modal de Atribuição em Lote */}
            <Modal isOpen={!!batchAction} onClose={() => setBatchAction(null)} title={batchAction === 'atribuir' ? "Atribuição em Lote" : "Venda em Lote"}>
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
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.motivo} onChange={e => setBatchData({...batchData, motivo: e.target.value as MotivoVenda})}>
                                <option value="VENDA">VENDA</option>
                                <option value="POS_VENDA">PÓS-VENDA</option>
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
                        <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={editData.supervisor} onChange={e => setEditData({...editData, supervisor: e.target.value})}>
                            <option value="">SELECIONE A OPERAÇÃO *</option>
                            {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
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
