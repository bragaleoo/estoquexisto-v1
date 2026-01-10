
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';
import ImportWizard from './ImportWizard';
import { ListIcon, CreditCardIcon, FileTextIcon, ChevronDownIcon, XIcon } from './ui/Icons';
import { SUPERVISORES } from '../constants';
import { MotivoBaixa, Maquina, Pedido } from '../types';

const Cadastros: React.FC = () => {
    const context = useContext(AppContext);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Pedido | null>(null);
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

    if (!context) return null;
    const { pedidos, maquinas, atribuirEmLote, baixarEmLote, currentUser } = context;
    const isReadOnly = currentUser?.perfil === 'Supervisor';

    useEffect(() => { setCurrentPage(1); }, [selectedOrder, showBaixadas]);

    const filteredPedidos = useMemo(() => {
        const term = searchTerm.trim().toUpperCase();
        return pedidos.filter(p => p.codigo_pedido.includes(term));
    }, [pedidos, searchTerm]);

    const orderInventory = useMemo(() => {
        if (!selectedOrder) return [];
        let list = maquinas.filter(m => m.pedido_id === selectedOrder.id);
        if (isReadOnly) list = list.filter(m => m.supervisor_id === currentUser?.supervisorId);
        return list.filter(m => (showBaixadas ? m.status_estoque === 'BAIXADA' : m.status_estoque !== 'BAIXADA'));
    }, [maquinas, selectedOrder, showBaixadas, isReadOnly, currentUser]);

    const paginatedInventory = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return orderInventory.slice(start, start + itemsPerPage);
    }, [orderInventory, currentPage]);

    const totalPages = Math.ceil(orderInventory.length / itemsPerPage);

    const toggleSelect = (id: string) => {
        if (isReadOnly) return;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleConfirmAction = () => {
        if (batchAction === 'atribuir') {
            if (!batchData.supervisor || !batchData.consultor) return alert("Selecione o supervisor e o consultor.");
            atribuirEmLote(selectedIds, parseInt(batchData.supervisor), batchData.consultor);
        } else if (batchAction === 'baixar') {
            baixarEmLote(selectedIds, batchData.motivo, batchData.obs);
        }
        setSelectedIds([]);
        setBatchAction(null);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Estoque & Logística</h1>
                    <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">{isReadOnly ? 'Consulta de estoque atribuído.' : 'Distribuição e baixa de equipamentos.'}</p>
                </div>
                {!selectedOrder && !isReadOnly && (
                    <button onClick={() => setImportModalOpen(true)} className="bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-blue-800 transition flex items-center gap-2 font-black uppercase text-xs">
                        <FileTextIcon className="w-5 h-5" /> Importar Lote
                    </button>
                )}
            </div>

            {!selectedOrder ? (
                <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-slate-200">
                    <input type="text" placeholder="BUSCAR LOTE POR CÓDIGO..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-5 border-2 border-slate-200 rounded-2xl bg-slate-50 focus:border-blue-700 outline-none text-slate-950 font-black mb-8" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPedidos.map(p => (
                            <div key={p.id} onClick={() => setSelectedOrder(p)} className="border-2 border-slate-200 rounded-3xl p-6 cursor-pointer hover:border-blue-700 hover:shadow-xl transition-all group bg-white">
                                <span className="font-mono font-black text-blue-800 text-xl block mb-2">{p.codigo_pedido}</span>
                                <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">{p.qtd_importada} máquinas em estoque</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <button onClick={() => {setSelectedOrder(null); setSelectedIds([]);}} className="text-slate-900 font-black flex items-center gap-2 hover:text-blue-700 transition uppercase text-xs border-2 border-slate-200 px-4 py-2 rounded-xl bg-white">
                        ← Voltar aos Lotes
                    </button>

                    <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                        <div className="p-6 bg-slate-50 border-b-2 border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                            <h2 className="text-xl font-black text-slate-900">Lote: <span className="text-blue-800">{selectedOrder.codigo_pedido}</span></h2>
                            <div className="flex gap-2">
                                <button onClick={() => setShowBaixadas(false)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${!showBaixadas ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>Ativas</button>
                                <button onClick={() => setShowBaixadas(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${showBaixadas ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-600'}`}>Baixadas</button>
                            </div>
                            {selectedIds.length > 0 && !isReadOnly && (
                                <div className="flex gap-2">
                                    <button onClick={() => setBatchAction('atribuir')} className="bg-indigo-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase">Distribuir ({selectedIds.length})</button>
                                    {!showBaixadas && <button onClick={() => setBatchAction('baixar')} className="bg-red-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase">Baixar ({selectedIds.length})</button>}
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-950 font-black border-b-2 border-slate-200 uppercase text-[10px]">
                                    <tr>
                                        {!isReadOnly && <th className="p-5 w-10"></th>}
                                        <th className="p-5">Número de Serial</th>
                                        <th className="p-5">Status</th>
                                        <th className="p-5">Responsável</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedInventory.map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleSelect(m.id)}>
                                            {!isReadOnly && <td className="p-5"><input type="checkbox" checked={selectedIds.includes(m.id)} readOnly className="w-5 h-5 accent-blue-700" /></td>}
                                            <td className="p-5 font-mono font-black text-slate-900">{m.serial}</td>
                                            <td className="p-5">
                                                <span className={`px-3 py-1 rounded-lg font-black text-[9px] border-2 uppercase ${m.status_estoque === 'DISPONIVEL' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : m.status_estoque === 'ATRIBUIDA' ? 'bg-indigo-100 text-indigo-950 border-indigo-300' : 'bg-red-100 text-red-950 border-red-300'}`}>
                                                    {m.status_estoque}
                                                </span>
                                            </td>
                                            <td className="p-5">
                                                <p className="font-black text-slate-900 text-xs">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                                <p className="text-[9px] font-black text-slate-600 uppercase">{m.consultor_nome || 'N/A'}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} title="Importar Novo Lote">
                <ImportWizard onSuccess={() => setImportModalOpen(false)} />
            </Modal>

            <Modal isOpen={!!batchAction} onClose={() => setBatchAction(null)} title={batchAction === 'atribuir' ? "Atribuição em Lote" : "Baixa em Lote"}>
                <div className="space-y-4">
                    <p className="text-sm font-black text-slate-950 uppercase">{selectedIds.length} máquinas selecionadas.</p>
                    {batchAction === 'atribuir' ? (
                        <>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.supervisor} onChange={e => setBatchData({...batchData, supervisor: e.target.value})}>
                                <option value="">SELECIONE O SUPERVISOR</option>
                                {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                            <input type="text" placeholder="NOME DO CONSULTOR" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" value={batchData.consultor} onChange={e => setBatchData({...batchData, consultor: e.target.value})} />
                        </>
                    ) : (
                        <>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.motivo} onChange={e => setBatchData({...batchData, motivo: e.target.value as MotivoBaixa})}>
                                <option value="VENDA">VENDA</option>
                                <option value="ERRO_OPERACIONAL">ERRO OPERACIONAL</option>
                                <option value="DEVOLUCAO">DEVOLUÇÃO</option>
                            </select>
                            <textarea placeholder="OBSERVAÇÕES" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 h-24" value={batchData.obs} onChange={e => setBatchData({...batchData, obs: e.target.value})} />
                        </>
                    )}
                    <button onClick={handleConfirmAction} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl">Confirmar Operação</button>
                </div>
            </Modal>
        </div>
    );
};

export default Cadastros;
