
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import Card from './ui/Card';
import { CreditCardIcon, CheckCircleIcon, ListIcon, FileTextIcon, ExitIcon } from './ui/Icons';
import { SUPERVISORES } from '../constants';

const Relatorios: React.FC = () => {
    const context = useContext(AppContext);
    
    const [filters, setFilters] = useState({
        pedido: '',
        status: '',
        supervisor: '',
        consultor: '',
        dataImportacao: '',
        dataAtribuicao: '',
        dataBaixa: '',
        regiao: ''
    });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    if (!context) return null;
    const { maquinas, pedidos, currentUser } = context;
    const hasFixedRegiao = !!currentUser?.regiao;

    const listaConsultores = useMemo(() => {
        const nomes = maquinas
            .filter(m => {
                if (!hasFixedRegiao) return true;
                const pedido = pedidos.find(p => p.id === m.pedido_id);
                const regE = m.regiao || pedido?.regiao;
                return regE === currentUser.regiao;
            })
            .map(m => m.consultor_nome)
            .filter((nome): nome is string => !!nome && nome.trim() !== '');
        return Array.from(new Set(nomes)).sort((a: string, b: string) => a.localeCompare(b));
    }, [maquinas, pedidos, currentUser, hasFixedRegiao]);

    useEffect(() => {
        if (currentUser?.perfil === 'Supervisor' && currentUser.supervisorId) {
            setFilters(prev => ({ ...prev, supervisor: currentUser.supervisorId?.toString() || '' }));
        }
        if (hasFixedRegiao) {
            setFilters(prev => ({ ...prev, regiao: currentUser.regiao as string }));
        }
    }, [currentUser, hasFixedRegiao]);

    useEffect(() => { setCurrentPage(1); }, [filters]);

    const maquinasFiltradas = useMemo(() => {
        let result = maquinas;
        if (currentUser?.perfil === 'Supervisor') {
            result = result.filter(m => m.supervisor_id === currentUser.supervisorId);
        }
        if (hasFixedRegiao) {
            result = result.filter(m => {
                const pedidoRel = pedidos.find(p => p.id === m.pedido_id);
                const regE = m.regiao || pedidoRel?.regiao;
                return regE === currentUser.regiao;
            });
        }

        return result.filter(m => {
            const pedidoRel = pedidos.find(p => p.id === m.pedido_id);
            const regE = m.regiao || pedidoRel?.regiao;

            const matchPedido = filters.pedido ? m.pedido_id === filters.pedido : true;
            const matchStatus = filters.status ? m.status_estoque === filters.status : true;
            const matchSupervisor = filters.supervisor ? m.supervisor_id === parseInt(filters.supervisor) : true;
            const matchConsultor = filters.consultor ? (m.consultor_nome || '').toUpperCase().includes(filters.consultor.trim().toUpperCase()) : true;
            const matchDataImportacao = filters.dataImportacao ? m.criado_em.startsWith(filters.dataImportacao) : true;
            const matchDataAtribuicao = filters.dataAtribuicao ? (m.atribuido_em && m.atribuido_em.startsWith(filters.dataAtribuicao)) : true;
            const matchDataBaixa = filters.dataBaixa ? (m.baixado_em && m.baixado_em.startsWith(filters.dataBaixa)) : true;
            const matchRegiao = filters.regiao ? regE === filters.regiao : true;

            return matchPedido && matchStatus && matchSupervisor && matchConsultor && 
                   matchDataImportacao && matchDataAtribuicao && matchDataBaixa && matchRegiao;
        });
    }, [maquinas, filters, currentUser, pedidos, hasFixedRegiao]);

    const handleExportExcel = () => {
        if (maquinasFiltradas.length === 0) return alert("Não há dados.");
        const dataToExport = maquinasFiltradas.map(m => {
            const pedido = pedidos.find(p => p.id === m.pedido_id);
            const supervisor = SUPERVISORES.find(s => s.id === m.supervisor_id);
            return {
                'SERIAL': m.serial,
                'LOTE': pedido?.codigo_pedido || 'SEM LOTE',
                'REGIAO': m.regiao || pedido?.regiao || 'N/A',
                'STATUS': m.status_estoque,
                'OPERACAO': supervisor?.nome || '-',
                'CONSULTOR': m.consultor_nome || '-',
                'DATA_IMP': m.criado_em ? new Date(m.criado_em).toLocaleDateString() : '-'
            };
        });
        const worksheet = (window as any).XLSX.utils.json_to_sheet(dataToExport);
        const workbook = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoria");
        (window as any).XLSX.writeFile(workbook, `Auditoria_Xisto_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return maquinasFiltradas.slice(start, start + itemsPerPage);
    }, [maquinasFiltradas, currentPage]);

    const stats = useMemo(() => {
        const total = maquinasFiltradas.length;
        const disp = maquinasFiltradas.filter(m => m.status_estoque === 'DISPONIVEL').length;
        const atrib = maquinasFiltradas.filter(m => m.status_estoque === 'ATRIBUIDA').length;
        const baix = maquinasFiltradas.filter(m => m.status_estoque === 'BAIXADA').length;
        return { total, disp, atrib, baix };
    }, [maquinasFiltradas]);

    const totalPages = Math.ceil(maquinasFiltradas.length / itemsPerPage);

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-slate-200 space-y-8">
                <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-950 tracking-tighter uppercase">Auditoria</h1>
                        <p className="text-slate-900 font-bold text-[10px] uppercase tracking-[0.3em] mt-1">Total: {maquinasFiltradas.length} registros</p>
                    </div>
                    <button onClick={handleExportExcel} className="bg-slate-950 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center gap-3">
                        <FileTextIcon className="w-5 h-5" /> Exportar
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div><label className="block text-[10px] font-black uppercase mb-3">Lote</label><select className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.pedido} onChange={e => setFilters({...filters, pedido: e.target.value})}><option value="">TODOS</option>{pedidos.map(p => <option key={p.id} value={p.id}>{p.codigo_pedido}</option>)}</select></div>
                    <div><label className="block text-[10px] font-black uppercase mb-3">Status</label><select className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}><option value="">TODOS</option><option value="DISPONIVEL">DISPONÍVEL</option><option value="ATRIBUIDA">ATRIBUÍDA</option><option value="BAIXADA">BAIXADA</option></select></div>
                    <div><label className="block text-[10px] font-black uppercase mb-3">Região</label><select disabled={hasFixedRegiao} className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.regiao} onChange={e => setFilters({...filters, regiao: e.target.value})}><option value="">TODAS</option><option value="SERGIPE">SERGIPE</option><option value="ALAGOAS">ALAGOAS</option></select></div>
                    <div><label className="block text-[10px] font-black uppercase mb-3">Supervisor</label><select disabled={currentUser?.perfil === 'Supervisor'} className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.supervisor} onChange={e => setFilters({...filters, supervisor: e.target.value})}><option value="">TODOS</option>{SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-4">
                    <div><label className="block text-[10px] font-black uppercase mb-3">Consultor</label><input type="text" list="audit-consultor" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 uppercase" value={filters.consultor} onChange={e => setFilters({...filters, consultor: e.target.value.toUpperCase()})} /><datalist id="audit-consultor">{listaConsultores.map(n => <option key={n} value={n} />)}</datalist></div>
                    <div><label className="block text-[10px] font-black uppercase mb-3">Data Imp.</label><input type="date" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.dataImportacao} onChange={e => setFilters({...filters, dataImportacao: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-black uppercase mb-3">Data Atrib.</label><input type="date" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.dataAtribuicao} onChange={e => setFilters({...filters, dataAtribuicao: e.target.value})} /></div>
                    <div><label className="block text-[10px] font-black uppercase mb-3">Data Baixa</label><input type="date" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50" value={filters.dataBaixa} onChange={e => setFilters({...filters, dataBaixa: e.target.value})} /></div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <Card title="Total" value={stats.total} icon={<CreditCardIcon className="w-6 h-6 text-white" />} color="bg-slate-900" />
                <Card title="Disponíveis" value={stats.disp} icon={<CheckCircleIcon className="w-6 h-6 text-white" />} color="bg-emerald-700" />
                <Card title="Atribuídas" value={stats.atrib} icon={<ListIcon className="w-6 h-6 text-white" />} color="bg-indigo-800" />
                <Card title="Baixadas" value={stats.baix} icon={<ExitIcon className="w-6 h-6 text-white" />} color="bg-red-700" />
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-200 text-slate-950 font-black border-b-2 border-slate-300 uppercase text-[10px]">
                            <tr>
                                <th className="p-6">Serial</th>
                                <th className="p-6">Lote / Região</th>
                                <th className="p-6">Status</th>
                                <th className="p-6">Responsáveis</th>
                                <th className="p-6">Linha do Tempo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100">
                            {paginatedItems.map(m => {
                                const pedido = pedidos.find(p => p.id === m.pedido_id);
                                const regE = m.regiao || pedido?.regiao;
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-6 font-mono font-black text-slate-950 text-lg">{m.serial}</td>
                                        <td className="p-6">
                                            <p className="font-black text-blue-800 uppercase text-xs">{pedido?.codigo_pedido || 'SEM LOTE'}</p>
                                            <span className="text-[9px] font-black uppercase text-slate-500">{regE || '-'}</span>
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase border-2 ${
                                                m.status_estoque === 'DISPONIVEL' ? 'text-emerald-950 border-emerald-300 bg-emerald-100' : 
                                                m.status_estoque === 'ATRIBUIDA' ? 'text-indigo-950 border-indigo-300 bg-indigo-100' : 
                                                'text-red-950 border-red-300 bg-red-100'
                                            }`}>{m.status_estoque}</span>
                                        </td>
                                        <td className="p-6">
                                            <p className="font-black text-slate-950 text-sm leading-tight">{m.consultor_nome || 'LIVRE'}</p>
                                            <p className="text-[10px] font-black text-slate-500 uppercase">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="text-[9px] font-black uppercase space-y-1">
                                                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span className="text-slate-500">Imp:</span><span>{m.criado_em ? new Date(m.criado_em).toLocaleDateString() : '-'}</span></div>
                                                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span className="text-indigo-600">Atr:</span><span>{m.atribuido_em ? new Date(m.atribuido_em).toLocaleDateString() : '-'}</span></div>
                                                {m.baixado_em && <div className="flex justify-between"><span className="text-red-600">Bai:</span><span>{new Date(m.baixado_em).toLocaleDateString()}</span></div>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="p-6 border-t-2 border-slate-200 flex justify-center gap-4">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-lg disabled:opacity-30" disabled={currentPage === 1}>Anterior</button>
                        <span className="font-black text-sm self-center">{currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs uppercase shadow-lg disabled:opacity-30" disabled={currentPage === totalPages}>Próxima</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Relatorios;
