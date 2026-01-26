
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';
import ImportWizard from './ImportWizard';
import { FileTextIcon, EditIcon, RefreshCwIcon, CreditCardIcon, ChevronDownIcon } from './ui/Icons';
import { SUPERVISORES } from '../constants';
import { MotivoBaixa, Maquina, Regiao, StatusEstoque } from '../types';

type SortField = 'responsavel' | 'serial' | 'data' | 'lote' | 'status' | null;
type SortDirection = 'asc' | 'desc';

const Cadastros: React.FC = () => {
    const context = useContext(AppContext);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isManualModalOpen, setManualModalOpen] = useState(false);
    
    const [filterPedido, setFilterPedido] = useState('');
    const [filterSerial, setFilterSerial] = useState('');
    const [filterDataImportacao, setFilterDataImportacao] = useState('');
    const [filterDataAtribuicao, setFilterDataAtribuicao] = useState('');
    const [filterDataBaixa, setFilterDataBaixa] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterOp, setFilterOp] = useState('');
    const [filterConsultor, setFilterConsultor] = useState('');
    const [filterRegiao, setFilterRegiao] = useState(''); 

    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const [showBaixadas, setShowBaixadas] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [batchAction, setBatchAction] = useState<'atribuir' | 'baixar' | 'disponibilizar' | 'regiao' | null>(null);
    const [batchData, setBatchData] = useState({ 
        supervisor: '', 
        consultor: '', 
        motivo: 'VENDA' as MotivoBaixa, 
        obs: '',
        dataBaixa: new Date().toISOString().split('T')[0],
        novaRegiao: '' as Regiao | ''
    });

    const [manualData, setManualData] = useState({
        serial: '',
        loteCode: '',
        regiao: '' as Regiao | ''
    });

    const [editingMachine, setEditingMachine] = useState<Maquina | null>(null);
    const [editData, setEditData] = useState({ supervisor: '', consultor: '', regiao: '' as Regiao | '' });

    if (!context) return null;
    const { pedidos, maquinas, registrarMaquinaManual, atribuirEmLote, baixarEmLote, atualizarMaquina, disponibilizarEmLote, alterarRegiaoEmLote, currentUser, triggerRefresh } = context;
    const isSupervisor = currentUser?.perfil === 'Supervisor';
    const hasFixedRegiao = !!currentUser?.regiao;

    const listaConsultores = useMemo(() => {
        const nomes = maquinas
            .filter(m => {
                if (!hasFixedRegiao) return true;
                const p = pedidos.find(pd => pd.id === m.pedido_id);
                return (m.regiao || p?.regiao) === currentUser.regiao;
            })
            .map(m => m.consultor_nome)
            .filter((nome): nome is string => !!nome && nome.trim() !== '');
        return Array.from(new Set(nomes)).sort((a: string, b: string) => a.localeCompare(b));
    }, [maquinas, currentUser, pedidos, hasFixedRegiao]);

    const listaPedidos = useMemo(() => {
        return pedidos
            .filter(p => !hasFixedRegiao || p.regiao === currentUser.regiao)
            .map(p => p.codigo_pedido).sort((a: string, b: string) => a.localeCompare(b));
    }, [pedidos, currentUser, hasFixedRegiao]);

    useEffect(() => { setCurrentPage(1); }, [filterPedido, filterSerial, filterDataImportacao, filterDataAtribuicao, filterDataBaixa, filterOp, filterConsultor, showBaixadas, filterStatus, filterRegiao]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const filteredInventory = useMemo(() => {
        let list = [...maquinas];
        
        if (isSupervisor) {
            list = list.filter(m => m.supervisor_id === currentUser?.supervisorId);
        }
        
        if (hasFixedRegiao) {
            list = list.filter(m => {
                const p = pedidos.find(pd => pd.id === m.pedido_id);
                const reg = m.regiao || p?.regiao;
                // Se a máquina não tem região no banco, mas o usuário tem região fixa, 
                // mostramos apenas se não houver conflito explícito.
                return !reg || reg === currentUser.regiao;
            });
        }

        list = list.filter(m => (showBaixadas ? m.status_estoque === 'BAIXADA' : m.status_estoque !== 'BAIXADA'));

        const filtered = list.filter(m => {
            const pedidoRelacionado = pedidos.find(p => p.id === m.pedido_id);
            const regiaoEfetiva = m.regiao || pedidoRelacionado?.regiao;

            const matchPedido = filterPedido ? (pedidoRelacionado?.codigo_pedido || 'SEM LOTE').toUpperCase().includes(filterPedido.trim().toUpperCase()) : true;
            const matchSerial = filterSerial ? m.serial.includes(filterSerial.trim().toUpperCase()) : true;
            const matchDataImp = filterDataImportacao ? m.criado_em.startsWith(filterDataImportacao) : true;
            const matchStatus = filterStatus ? m.status_estoque === filterStatus : true;
            const matchOp = filterOp ? m.supervisor_id === parseInt(filterOp) : true;
            const matchConsultor = filterConsultor ? (m.consultor_nome || '').toUpperCase().includes(filterConsultor.trim().toUpperCase()) : true;
            const matchRegiao = filterRegiao ? regiaoEfetiva === filterRegiao : true;

            return matchPedido && matchSerial && matchDataImp && matchStatus && matchOp && matchConsultor && matchRegiao;
        });

        const statusWeight: Record<string, number> = { 'ATRIBUIDA': 0, 'DISPONIVEL': 1, 'BAIXADA': 2 };

        return filtered.sort((a, b) => {
            if (sortField) {
                let valA: any = ''; let valB: any = '';
                if (sortField === 'responsavel') { valA = a.consultor_nome || 'ZZZ'; valB = b.consultor_nome || 'ZZZ'; }
                else if (sortField === 'serial') { valA = a.serial; valB = b.serial; }
                else if (sortField === 'status') { valA = statusWeight[a.status_estoque]; valB = statusWeight[b.status_estoque]; return sortDirection === 'asc' ? valA - valB : valB - valA; }
                
                if (typeof valA === 'string') {
                    const comp = valA.localeCompare(valB);
                    return sortDirection === 'asc' ? comp : -comp;
                }
            }
            return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
        });
    }, [maquinas, pedidos, isSupervisor, currentUser, showBaixadas, filterPedido, filterSerial, filterDataImportacao, filterStatus, filterOp, filterConsultor, filterRegiao, hasFixedRegiao, sortField, sortDirection]);

    const handleConfirmAction = async () => {
        if (batchAction === 'atribuir') {
            await atribuirEmLote(selectedIds, parseInt(batchData.supervisor), batchData.consultor.trim().toUpperCase());
        } else if (batchAction === 'baixar') {
            await baixarEmLote(selectedIds, batchData.motivo, batchData.obs, batchData.dataBaixa);
        } else if (batchAction === 'disponibilizar') {
            await disponibilizarEmLote(selectedIds);
        } else if (batchAction === 'regiao') {
            await alterarRegiaoEmLote(selectedIds, batchData.novaRegiao as Regiao);
        }
        setSelectedIds([]);
        setBatchAction(null);
    };

    const handleManualSubmit = async () => {
        if (!manualData.serial || !manualData.loteCode) return alert("Serial e Lote são obrigatórios.");
        await registrarMaquinaManual(manualData.serial.trim().toUpperCase(), manualData.loteCode.trim().toUpperCase(), (manualData.regiao || currentUser?.regiao) as Regiao);
        setManualModalOpen(false);
    };

    const openEditModal = (e: React.MouseEvent, m: Maquina) => {
        e.stopPropagation();
        setEditingMachine(m);
        setEditData({ 
            supervisor: m.supervisor_id?.toString() || '', 
            consultor: m.consultor_nome || '',
            regiao: m.regiao || pedidos.find(p => p.id === m.pedido_id)?.regiao || ''
        });
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Estoque Geral</h1>
                    <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">
                        Visualizando {filteredInventory.length} de {maquinas.length} ativos no banco.
                    </p>
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                    {selectedIds.length > 0 && (
                        <button onClick={() => setBatchAction('atribuir')} className="bg-indigo-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg">Distribuir ({selectedIds.length})</button>
                    )}
                    <button onClick={triggerRefresh} className="bg-slate-200 text-slate-700 px-5 py-3 rounded-xl shadow-md hover:bg-slate-300 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                        <RefreshCwIcon className="w-5 h-5" /> Atualizar Tela
                    </button>
                    <button onClick={() => setManualModalOpen(true)} className="bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-slate-900 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                        <CreditCardIcon className="w-5 h-5" /> Novo Registro
                    </button>
                    <button onClick={() => setImportModalOpen(true)} className="bg-blue-700 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-blue-800 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                        <FileTextIcon className="w-5 h-5" /> Importar Lote
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b-2 border-slate-200 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Filtros de Busca</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setShowBaixadas(false)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${!showBaixadas ? 'bg-blue-700 text-white shadow-lg' : 'bg-slate-200 text-slate-600'}`}>Ativas</button>
                            <button onClick={() => setShowBaixadas(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${showBaixadas ? 'bg-red-700 text-white shadow-lg' : 'bg-slate-200 text-slate-600'}`}>Baixadas</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-8">
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Pedido / Lote</label><input type="text" placeholder="BUSCAR LOTE..." className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600" value={filterPedido} onChange={e => setFilterPedido(e.target.value.toUpperCase())} /></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Serial</label><input type="text" placeholder="SERIAL..." className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600" value={filterSerial} onChange={e => setFilterSerial(e.target.value.toUpperCase())} /></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Status</label><select className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="">TODOS</option><option value="DISPONIVEL">DISPONÍVEL</option><option value="ATRIBUIDA">ATRIBUÍDA</option></select></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Região</label><select disabled={hasFixedRegiao} className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black" value={hasFixedRegiao ? currentUser.regiao : filterRegiao} onChange={e => setFilterRegiao(e.target.value)}><option value="">TODAS</option><option value="SERGIPE">SERGIPE</option><option value="ALAGOAS">ALAGOAS</option></select></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Operação</label><select className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black" value={filterOp} onChange={e => setFilterOp(e.target.value)}><option value="">TODAS</option>{SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-950 font-black border-b-2 border-slate-200 uppercase text-[10px]">
                            <tr>
                                {!isSupervisor && <th className="p-5 w-10 text-center"><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? filteredInventory.map(m => m.id) : [])} checked={filteredInventory.length > 0 && selectedIds.length >= filteredInventory.length} /></th>}
                                <th className="p-5 cursor-pointer" onClick={() => handleSort('serial')}>Número de Serial <SortIndicator field="serial" /></th>
                                <th className="p-5">Lote / Importação</th>
                                <th className="p-5 cursor-pointer" onClick={() => handleSort('status')}>Status <SortIndicator field="status" /></th>
                                <th className="p-5 cursor-pointer" onClick={() => handleSort('responsavel')}>Responsável / Operação <SortIndicator field="responsavel" /></th>
                                <th className="p-5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredInventory.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage).map(m => {
                                const pedido = pedidos.find(p => p.id === m.pedido_id);
                                const reg = m.regiao || pedido?.regiao;
                                return (
                                    <tr key={m.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.includes(m.id) ? 'bg-blue-50/50' : ''}`} onClick={() => !isSupervisor && setSelectedIds(prev => prev.includes(m.id) ? prev.filter(i => i !== m.id) : [...prev, m.id])}>
                                        {!isSupervisor && <td className="p-5 text-center"><input type="checkbox" checked={selectedIds.includes(m.id)} readOnly className="w-5 h-5 accent-blue-700" /></td>}
                                        <td className="p-5 font-mono font-black text-slate-900 text-base">{m.serial}</td>
                                        <td className="p-5">
                                            <p className={`font-black uppercase text-xs ${pedido ? 'text-blue-800' : 'text-red-600'}`}>
                                                {pedido?.codigo_pedido || 'SEM LOTE'}
                                            </p>
                                            {reg && <span className="inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase border bg-slate-100">{reg}</span>}
                                        </td>
                                        <td className="p-5"><span className={`px-3 py-1 rounded-lg font-black text-[9px] border-2 uppercase ${m.status_estoque === 'DISPONIVEL' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : m.status_estoque === 'ATRIBUIDA' ? 'bg-indigo-100 text-indigo-950 border-indigo-300' : 'bg-red-100 text-red-950 border-red-300'}`}>{m.status_estoque}</span></td>
                                        <td className="p-5">
                                            <p className="font-black text-slate-900 text-xs uppercase">{m.consultor_nome || 'LIVRE'}</p>
                                            <p className="text-[9px] font-black text-slate-500 uppercase">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                        </td>
                                        <td className="p-5">
                                            <button onClick={e => openEditModal(e, m)} className="p-2 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-all"><EditIcon className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <Modal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} title="Importar Novo Lote"><ImportWizard onSuccess={() => setImportModalOpen(false)} /></Modal>
            <Modal isOpen={isManualModalOpen} onClose={() => setManualModalOpen(false)} title="Novo Registro Manual">
                <div className="space-y-4">
                    <input type="text" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 uppercase" placeholder="SERIAL" value={manualData.serial} onChange={e => setManualData({...manualData, serial: e.target.value.toUpperCase()})} />
                    <input type="text" list="pedidos-list" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 uppercase" placeholder="LOTE" value={manualData.loteCode} onChange={e => setManualData({...manualData, loteCode: e.target.value.toUpperCase()})} />
                    <datalist id="pedidos-list">{listaPedidos.map(p => <option key={p} value={p} />)}</datalist>
                    <button onClick={handleManualSubmit} className="w-full bg-slate-950 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl">Salvar Registro</button>
                </div>
            </Modal>
        </div>
    );
};

const SortIndicator = ({ field }: { field: SortField }) => {
    return <ChevronDownIcon className="w-3 h-3 ml-1 opacity-20 inline" />;
};

export default Cadastros;
