
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
        dataAtribuicao: new Date().toISOString().split('T')[0],
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

    const getSupervisorRegion = (supervisorName: string): Regiao | null => {
        const name = supervisorName.toUpperCase();
        if (name.startsWith('SE')) return 'SERGIPE'; // SE 01, SE 02...
        if (name.startsWith('AL')) return 'ALAGOAS'; // AL 01, AL 02...
        // Fallback para nomes antigos caso ainda existam temporariamente no código
        if (name.startsWith('AJU')) return 'SERGIPE';
        if (name.startsWith('MAC')) return 'ALAGOAS';
        return null;
    };

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
        const isAdmin = currentUser?.perfil === 'Administrador';
        if (isSupervisor && !isAdmin) {
            list = list.filter(m => m.supervisor_id === currentUser?.supervisorId);
        }
        
        if (hasFixedRegiao && !isAdmin) {
            list = list.filter(m => {
                const p = pedidos.find(pd => pd.id === m.pedido_id);
                const reg = m.regiao || p?.regiao;
                return !reg || reg === currentUser.regiao;
            });
        }

        list = list.filter(m => (showBaixadas ? m.status_estoque === 'BAIXADA' : m.status_estoque !== 'BAIXADA'));

        const filtered = list.filter(m => {
            const pedidoRelacionado = pedidos.find(p => p.id === m.pedido_id);
            const regiaoEfetiva = m.regiao || pedidoRelacionado?.regiao;

            const matchPedido = filterPedido ? (pedidoRelacionado?.codigo_pedido || 'SEM LOTE').toUpperCase().includes(filterPedido.trim().toUpperCase()) : true;
            const matchSerial = filterSerial ? (m.serial || '').toUpperCase().includes(filterSerial.trim().toUpperCase()) : true;
            const matchDataImp = filterDataImportacao ? m.criado_em.startsWith(filterDataImportacao) : true;
            const matchDataAtrib = filterDataAtribuicao ? (m.atribuido_em && m.atribuido_em.startsWith(filterDataAtribuicao)) : true;
            const matchDataBaixa = filterDataBaixa ? (m.baixado_em && m.baixado_em.startsWith(filterDataBaixa)) : true;
            const matchStatus = filterStatus ? m.status_estoque === filterStatus : true;
            const matchOp = filterOp ? m.supervisor_id === parseInt(filterOp) : true;
            const matchConsultor = filterConsultor ? (m.consultor_nome || '').toUpperCase().includes(filterConsultor.trim().toUpperCase()) : true;
            const matchRegiao = filterRegiao ? regiaoEfetiva === filterRegiao : true;

            return matchPedido && matchSerial && matchDataImp && matchDataAtrib && matchDataBaixa && matchStatus && matchOp && matchConsultor && matchRegiao;
        });

        const statusWeight: Record<string, number> = {
            'ATRIBUIDA': 0,
            'DISPONIVEL': 1,
            'BAIXADA': 2
        };

        return filtered.sort((a, b) => {
            if (sortField) {
                let valA: any = '';
                let valB: any = '';

                if (sortField === 'responsavel') {
                    valA = a.consultor_nome || 'ZZZ'; 
                    valB = b.consultor_nome || 'ZZZ';
                    const comp = valA.localeCompare(valB);
                    return sortDirection === 'asc' ? comp : -comp;
                }
                
                if (sortField === 'serial') {
                    valA = a.serial;
                    valB = b.serial;
                    const comp = valA.localeCompare(valB);
                    return sortDirection === 'asc' ? comp : -comp;
                }

                if (sortField === 'status') {
                    valA = statusWeight[a.status_estoque] ?? 99;
                    valB = statusWeight[b.status_estoque] ?? 99;
                    return sortDirection === 'asc' ? valA - valB : valB - valA;
                }
            }

            const weightA = statusWeight[a.status_estoque] ?? 99;
            const weightB = statusWeight[b.status_estoque] ?? 99;
            if (weightA !== weightB) return weightA - weightB;
            return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
        });
    }, [maquinas, pedidos, isSupervisor, currentUser, showBaixadas, filterPedido, filterSerial, filterDataImportacao, filterDataAtribuicao, filterDataBaixa, filterStatus, filterOp, filterConsultor, filterRegiao, hasFixedRegiao, sortField, sortDirection]);

    const handleExportExcel = () => {
        if (filteredInventory.length === 0) return alert("Não há ativos para exportar.");
        const dataToExport = filteredInventory.map(m => {
            const pedido = pedidos.find(p => p.id === m.pedido_id);
            const supervisor = SUPERVISORES.find(s => s.id === m.supervisor_id);
            return {
                'SERIAL': m.serial,
                'LOTE': pedido?.codigo_pedido || 'N/A',
                'REGIAO_ATUAL': m.regiao || pedido?.regiao || 'N/A',
                'STATUS': m.status_estoque,
                'OPERACAO': supervisor?.nome || 'CENTRAL',
                'CONSULTOR': m.consultor_nome || 'N/A',
                'DATA_IMPORTACAO': m.criado_em ? new Date(m.criado_em).toLocaleDateString() : '-',
                'DATA_ATRIBUICAO': m.atribuido_em ? new Date(m.atribuido_em).toLocaleDateString() : '-',
                'DATA_BAIXA': m.baixado_em ? new Date(m.baixado_em).toLocaleDateString() : '-'
            };
        });
        const worksheet = (window as any).XLSX.utils.json_to_sheet(dataToExport);
        const workbook = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, "Estoque_Xisto");
        (window as any).XLSX.writeFile(workbook, `Estoque_Xisto_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const paginatedInventory = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInventory.slice(start, start + itemsPerPage);
    }, [filteredInventory, currentPage]);

    const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

    const toggleSelect = (id: string) => {
        if (isSupervisor) return;
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const checkRegionConflict = (ids: string[], supervisorId: number, regionOverride?: Regiao) => {
        const supervisor = SUPERVISORES.find(s => s.id === supervisorId);
        if (!supervisor) return false;
        const supRegion = getSupervisorRegion(supervisor.nome);
        if (!supRegion) return false;
        const conflictingMachines = maquinas.filter(m => ids.includes(m.id)).filter(m => {
            const pedido = pedidos.find(p => p.id === m.pedido_id);
            const regiaoAtual = regionOverride || m.regiao || pedido?.regiao;
            return regiaoAtual && regiaoAtual !== supRegion;
        });
        if (conflictingMachines.length > 0) {
            return !window.confirm(`ATENÇÃO: Este ativo está marcado como pertencente a outra região operacional.\n\nDeseja ignorar o conflito e atribuir a este supervisor?`);
        }
        return false;
    };

    const handleConfirmAction = async () => {
        if (batchAction === 'atribuir') {
            const supervisorId = parseInt(batchData.supervisor);
            if (!supervisorId) return alert("Selecione a operação.");
            if (checkRegionConflict(selectedIds, supervisorId)) return;
            await atribuirEmLote(selectedIds, supervisorId, batchData.consultor.trim().toUpperCase(), batchData.dataAtribuicao);
        } else if (batchAction === 'baixar') {
            await baixarEmLote(selectedIds, batchData.motivo, batchData.obs, batchData.dataBaixa);
        } else if (batchAction === 'disponibilizar') {
            await disponibilizarEmLote(selectedIds);
        } else if (batchAction === 'regiao') {
            if (!batchData.novaRegiao) return alert("Selecione a nova região.");
            await alterarRegiaoEmLote(selectedIds, batchData.novaRegiao as Regiao);
        }
        setSelectedIds([]);
        setBatchAction(null);
        setBatchData({ supervisor: '', consultor: '', motivo: 'VENDA', obs: '', dataBaixa: new Date().toISOString().split('T')[0], novaRegiao: '' });
    };

    const handleManualSubmit = async () => {
        if (!manualData.serial || !manualData.loteCode) return alert("Serial e Lote são obrigatórios.");
        const normSerial = manualData.serial.trim().toUpperCase();
        if (maquinas.some(m => m.serial === normSerial)) return alert("Este serial já está cadastrado no sistema.");
        const regiaoFinal = manualData.regiao || currentUser?.regiao || undefined;
        await registrarMaquinaManual(normSerial, manualData.loteCode.trim().toUpperCase(), regiaoFinal as Regiao);
        setManualModalOpen(false);
        setManualData({ serial: '', loteCode: '', regiao: '' });
    };

    const openEditModal = (e: React.MouseEvent, m: Maquina) => {
        e.stopPropagation();
        const pedido = pedidos.find(p => p.id === m.pedido_id);
        setEditingMachine(m);
        setEditData({ 
            supervisor: m.supervisor_id?.toString() || '', 
            consultor: m.consultor_nome || '',
            regiao: m.regiao || pedido?.regiao || ''
        });
    };

    const handleSaveEdit = async () => {
        if (!editingMachine) return;
        const supervisorId = parseInt(editData.supervisor);
        if (!supervisorId) return alert("A operação é obrigatória.");
        if (checkRegionConflict([editingMachine.id], supervisorId, editData.regiao as Regiao)) return;
        await atualizarMaquina(editingMachine.id, supervisorId, editData.consultor.trim().toUpperCase(), editData.regiao as Regiao);
        setEditingMachine(null);
    };

    const handleMakeAvailable = async () => {
        if (editingMachine && window.confirm("Deseja realmente tornar este ativo DISPONÍVEL?")) {
            await disponibilizarEmLote([editingMachine.id]);
            setEditingMachine(null);
        }
    };

    const SortIndicator = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronDownIcon className="w-3 h-3 ml-1 opacity-20" />;
        return <ChevronDownIcon className={`w-3 h-3 ml-1 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />;
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Estoque Geral {currentUser?.regiao ? `(${currentUser.regiao})` : ''}</h1>
                    <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">
                        Total Geral: {maquinas.length} ativos no banco.
                    </p>
                </div>
                {!isSupervisor && (
                    <div className="flex flex-wrap justify-end gap-3">
                        {selectedIds.length > 0 && (
                            <>
                                <button onClick={() => setBatchAction('atribuir')} className="bg-indigo-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-900 transition">Distribuir ({selectedIds.length})</button>
                                {!hasFixedRegiao && (
                                    <button onClick={() => setBatchAction('regiao')} className="bg-slate-950 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-black transition">Mudar Região ({selectedIds.length})</button>
                                )}
                                <button onClick={() => setBatchAction('disponibilizar')} className="bg-slate-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-700 transition">Disponibilizar ({selectedIds.length})</button>
                                {!showBaixadas && (
                                    <button onClick={() => setBatchAction('baixar')} className="bg-red-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-900 transition">Baixar ({selectedIds.length})</button>
                                )}
                            </>
                        )}
                        <button onClick={triggerRefresh} className="bg-slate-200 text-slate-700 px-5 py-3 rounded-xl shadow-md hover:bg-slate-300 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                            <RefreshCwIcon className="w-5 h-5" /> Sincronizar
                        </button>
                        <button onClick={handleExportExcel} className="bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-emerald-800 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">Exportar Excel</button>
                        <button onClick={() => setManualModalOpen(true)} className="bg-slate-800 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-slate-900 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                            <CreditCardIcon className="w-5 h-5" /> Novo Registro
                        </button>
                        <button onClick={() => setImportModalOpen(true)} className="bg-blue-700 text-white px-5 py-3 rounded-xl shadow-lg hover:bg-blue-800 transition flex items-center gap-2 font-black uppercase text-[10px] tracking-widest">
                            <FileTextIcon className="w-5 h-5" /> Importar Lote
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b-2 border-slate-200 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                            Filtros de Busca 
                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px]">{filteredInventory.length} encontrados</span>
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => setShowBaixadas(false)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${!showBaixadas ? 'bg-blue-700 text-white shadow-lg' : 'bg-slate-200 text-slate-600'}`}>Ativas</button>
                            <button onClick={() => setShowBaixadas(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition ${showBaixadas ? 'bg-red-700 text-white shadow-lg' : 'bg-slate-200 text-slate-600'}`}>Baixadas</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-8">
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Pedido</label><input type="text" placeholder="CÓDIGO..." className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600" value={filterPedido} onChange={e => setFilterPedido(e.target.value.toUpperCase())} /></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Serial</label><input type="text" placeholder="SERIAL..." className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600" value={filterSerial} onChange={e => setFilterSerial(e.target.value.toUpperCase())} /></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Data Imp.</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black outline-none" value={filterDataImportacao} onChange={e => setFilterDataImportacao(e.target.value)} /></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Data Atrib.</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black outline-none" value={filterDataAtribuicao} onChange={e => setFilterDataAtribuicao(e.target.value)} /></div>
                        {showBaixadas && (
                             <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Data Baixa</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black outline-none border-red-200" value={filterDataBaixa} onChange={e => setFilterDataBaixa(e.target.value)} /></div>
                        )}
                        {!showBaixadas && (
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Status</label>
                                <select className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                    <option value="">TODOS</option>
                                    <option value="DISPONIVEL">DISPONÍVEL</option>
                                    <option value="ATRIBUIDA">ATRIBUÍDA</option>
                                </select>
                            </div>
                        )}
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Região</label><select disabled={hasFixedRegiao} className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black" value={hasFixedRegiao ? currentUser.regiao : filterRegiao} onChange={e => setFilterRegiao(e.target.value)}><option value="">TODAS</option><option value="SERGIPE">SERGIPE</option><option value="ALAGOAS">ALAGOAS</option></select></div>
                        <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Operação</label><select className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black" value={filterOp} onChange={e => setFilterOp(e.target.value)}><option value="">TODAS</option>{SUPERVISORES.filter(s => {
                            if (!hasFixedRegiao) return true;
                            if (currentUser.regiao === 'SERGIPE') return s.nome.startsWith('SE');
                            if (currentUser.regiao === 'ALAGOAS') return s.nome.startsWith('AL');
                            return true;
                        }).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Consultor</label>
                            <input 
                                type="text" 
                                list="cadastros-consultores-list"
                                placeholder="BUSCAR..." 
                                className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-blue-600" 
                                value={filterConsultor} 
                                onChange={e => setFilterConsultor(e.target.value.toUpperCase())} 
                            />
                            <datalist id="cadastros-consultores-list">
                                {listaConsultores.map(nome => <option key={nome} value={nome} />)}
                            </datalist>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-950 font-black border-b-2 border-slate-200 uppercase text-[10px]">
                            <tr>
                                {!isSupervisor && <th className="p-5 w-10 text-center"><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? paginatedInventory.map(m => m.id) : [])} checked={paginatedInventory.length > 0 && selectedIds.length >= paginatedInventory.length} /></th>}
                                <th className="p-5">Lote / Importação / Região</th>
                                <th className="p-5 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('serial')}>
                                    <div className="flex items-center">Número de Serial <SortIndicator field="serial" /></div>
                                </th>
                                <th className="p-5 cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => handleSort('status')}>
                                    <div className="flex items-center">Status <SortIndicator field="status" /></div>
                                </th>
                                <th className="p-5">Atribuído em</th>
                                {showBaixadas && <th className="p-5">Baixado em</th>}
                                <th className="p-5 cursor-pointer hover:bg-slate-200 transition-colors group" onClick={() => handleSort('responsavel')}>
                                    <div className="flex items-center">
                                        Responsável / Operação
                                        <SortIndicator field="responsavel" />
                                    </div>
                                </th>
                                {!showBaixadas && <th className="p-5 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginatedInventory.map(m => {
                                const pedido = pedidos.find(p => p.id === m.pedido_id);
                                const regiaoEfetiva = m.regiao || pedido?.regiao;
                                return (
                                    <tr key={`${m.id}-${m.status_estoque}`} className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedIds.includes(m.id) ? 'bg-blue-50/50' : ''}`} onClick={() => toggleSelect(m.id)}>
                                        {!isSupervisor && <td className="p-5 text-center"><input type="checkbox" checked={selectedIds.includes(m.id)} readOnly className="w-5 h-5 accent-blue-700" /></td>}
                                        <td className="p-5">
                                            <p className={`font-black uppercase text-xs ${pedido ? 'text-blue-800' : 'text-red-600'}`}>
                                                {pedido?.codigo_pedido || 'SEM LOTE'}
                                            </p>
                                            <p className="text-[10px] font-black text-slate-500 uppercase mt-1">{new Date(m.criado_em).toLocaleDateString()}</p>
                                            {regiaoEfetiva && (
                                                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[8px] font-black uppercase border ${regiaoEfetiva === 'SERGIPE' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{regiaoEfetiva}</span>
                                            )}
                                        </td>
                                        <td className="p-5 font-mono font-black text-slate-900 text-base">{m.serial}</td>
                                        <td className="p-5"><span className={`px-3 py-1 rounded-lg font-black text-[9px] border-2 uppercase ${m.status_estoque === 'DISPONIVEL' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : m.status_estoque === 'ATRIBUIDA' ? 'bg-indigo-100 text-indigo-950 border-indigo-300' : 'bg-red-100 text-red-950 border-red-300'}`}>{m.status_estoque}</span></td>
                                        <td className="p-5 text-xs font-black text-slate-700">{m.atribuido_em ? new Date(m.atribuido_em).toLocaleDateString() : '-'}</td>
                                        {showBaixadas && <td className="p-5 text-xs font-black text-slate-700">{m.baixado_em ? new Date(m.baixado_em).toLocaleDateString() : '-'}</td>}
                                        <td className="p-5">
                                            <p className="font-black text-slate-900 text-xs uppercase">{m.consultor_nome || 'N/A'}</p>
                                            <p className="text-[9px] font-black text-slate-500 uppercase">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                        </td>
                                        {!showBaixadas && (
                                            <td className="p-5">
                                                <button onClick={e => openEditModal(e, m)} className="p-2 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-all"><EditIcon className="w-4 h-4" /></button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                     <div className="p-6 border-t-2 border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-100/50">
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{filteredInventory.length} REGISTROS TOTAIS</span>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                                disabled={currentPage === 1} 
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            
                            <div className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-xl border-2 border-slate-200 shadow-sm">
                                <span className="text-[12px] font-black text-slate-950">{currentPage}</span>
                                <span className="text-slate-300 font-bold text-xs">/</span>
                                <span className="text-[12px] font-black text-slate-400">{totalPages}</span>
                            </div>

                            <button 
                                onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                                disabled={currentPage === totalPages} 
                                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Próxima
                            </button>
                        </div>
                     </div>
                )}
            </div>
            
            <Modal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} title="Importar Novo Lote"><ImportWizard onSuccess={() => setImportModalOpen(false)} /></Modal>
            <Modal isOpen={isManualModalOpen} onClose={() => setManualModalOpen(false)} title="Novo Registro Manual">
                <div className="space-y-4">
                    <input type="text" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black uppercase" placeholder="SERIAL" value={manualData.serial} onChange={e => setManualData({...manualData, serial: e.target.value.toUpperCase()})} />
                    <input type="text" list="manual-lotes-list" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black uppercase" placeholder="LOTE" value={manualData.loteCode} onChange={e => setManualData({...manualData, loteCode: e.target.value.toUpperCase()})} />
                    <datalist id="manual-lotes-list">{listaPedidos.map(code => <option key={code} value={code} />)}</datalist>
                    <button onClick={handleManualSubmit} className="w-full bg-slate-950 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl">Salvar</button>
                </div>
            </Modal>

            <Modal isOpen={!!batchAction} onClose={() => setBatchAction(null)} title={batchAction === 'atribuir' ? "Atribuição em Lote" : batchAction === 'baixar' ? "Baixa em Lote" : batchAction === 'regiao' ? "Mudar Região em Lote" : "Disponibilizar em Lote"}>
                <div className="space-y-4">
                    <p className="text-sm font-black text-slate-950 uppercase">{selectedIds.length} selecionadas.</p>
                    {batchAction === 'atribuir' ? (
                        <>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.supervisor} onChange={e => setBatchData({...batchData, supervisor: e.target.value})}>
                                <option value="">SELECIONE A OPERAÇÃO *</option>
                                {SUPERVISORES.filter(s => {
                                    if (!hasFixedRegiao) return true;
                                    if (currentUser.regiao === 'SERGIPE') return s.nome.startsWith('SE');
                                    if (currentUser.regiao === 'ALAGOAS') return s.nome.startsWith('AL');
                                    return true;
                                }).map(s => <option key={s.id} value={String(s.id)}>{s.nome}</option>)}
                            </select>
                            <input type="text" list="batch-consultor-list" placeholder="CONSULTOR" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" value={batchData.consultor} onChange={e => setBatchData({...batchData, consultor: e.target.value.toUpperCase()})} />
                            <datalist id="batch-consultor-list">{listaConsultores.map(nome => <option key={nome} value={nome} />)}</datalist>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.dataAtribuicao} onChange={e => setBatchData({...batchData, dataAtribuicao: e.target.value})} />
                        </>
                    ) : batchAction === 'baixar' ? (
                        <>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.motivo} onChange={e => setBatchData({...batchData, motivo: e.target.value as MotivoBaixa})}>
                                <option value="VENDA">VENDA</option><option value="POS_VENDA">PÓS-VENDA</option><option value="DEVOLUCAO">DEVOLUÇÃO</option><option value="ERRO_OPERACIONAL">ERRO OPERACIONAL</option><option value="OUTRO">OUTRO</option>
                            </select>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.dataBaixa} onChange={e => setBatchData({...batchData, dataBaixa: e.target.value})} />
                            <textarea placeholder="OBSERVAÇÕES" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 h-24" value={batchData.obs} onChange={e => setBatchData({...batchData, obs: e.target.value})} />
                        </>
                    ) : batchAction === 'regiao' ? (
                        <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={batchData.novaRegiao} onChange={e => setBatchData({...batchData, novaRegiao: e.target.value as Regiao})}>
                            <option value="">SELECIONE REGIÃO...</option>
                            <option value="SERGIPE">SERGIPE</option>
                            <option value="ALAGOAS">ALAGOAS</option>
                        </select>
                    ) : null}
                    <button onClick={handleConfirmAction} className="w-full bg-slate-950 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl">Confirmar</button>
                </div>
            </Modal>

            <Modal isOpen={!!editingMachine} onClose={() => setEditingMachine(null)} title="Editar Ativo">
                 <div className="space-y-4">
                    <p className="font-mono font-black text-slate-900">{editingMachine?.serial}</p>
                    <select disabled={hasFixedRegiao} className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50" value={editData.regiao} onChange={e => setEditData({...editData, regiao: e.target.value as Regiao})}>
                        <option value="SERGIPE">SERGIPE</option><option value="ALAGOAS">ALAGOAS</option>
                    </select>
                    <select className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50" value={editData.supervisor} onChange={e => setEditData({...editData, supervisor: e.target.value})}>
                        <option value="">OPERAÇÃO *</option>
                        {SUPERVISORES.map(s => <option key={s.id} value={String(s.id)}>{s.nome}</option>)}
                    </select>
                    <input type="text" list="edit-consultor-list" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 uppercase" value={editData.consultor} onChange={e => setEditData({...editData, consultor: e.target.value.toUpperCase()})} />
                    <button onClick={handleSaveEdit} className="w-full bg-blue-700 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl">Salvar</button>
                    <button onClick={handleMakeAvailable} className="w-full bg-slate-900 text-white py-2 rounded-xl font-black uppercase text-[10px]">Tornar Disponível</button>
                 </div>
            </Modal>
        </div>
    );
};

export default Cadastros;
