
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

    // Lista única de consultores para o buscador
    const listaConsultores = useMemo(() => {
        const nomes = maquinas
            .map(m => m.consultor_nome)
            .filter((nome): nome is string => !!nome && nome.trim() !== '');
        return Array.from(new Set(nomes)).sort();
    }, [maquinas]);

    useEffect(() => {
        if (currentUser?.perfil === 'Supervisor' && currentUser.supervisorId) {
            setFilters(prev => ({ ...prev, supervisor: currentUser.supervisorId?.toString() || '' }));
        }
    }, [currentUser]);

    useEffect(() => { setCurrentPage(1); }, [filters]);

    const maquinasFiltradas = useMemo(() => {
        let result = maquinas;
        if (currentUser?.perfil === 'Supervisor') {
            result = result.filter(m => m.supervisor_id === currentUser.supervisorId);
        }
        return result.filter(m => {
            const pedidoRelacionado = pedidos.find(p => p.id === m.pedido_id);
            const regiaoEfetiva = m.regiao || pedidoRelacionado?.regiao;

            const matchPedido = filters.pedido ? m.pedido_id === filters.pedido : true;
            const matchStatus = filters.status ? m.status_estoque === filters.status : true;
            const matchSupervisor = filters.supervisor ? m.supervisor_id === parseInt(filters.supervisor) : true;
            const matchConsultor = filters.consultor ? (m.consultor_nome || '').toUpperCase().includes(filters.consultor.trim().toUpperCase()) : true;
            const matchDataImportacao = filters.dataImportacao ? m.criado_em.startsWith(filters.dataImportacao) : true;
            const matchDataAtribuicao = filters.dataAtribuicao ? (m.atribuido_em && m.atribuido_em.startsWith(filters.dataAtribuicao)) : true;
            const matchDataBaixa = filters.dataBaixa ? (m.baixado_em && m.baixado_em.startsWith(filters.dataBaixa)) : true;
            const matchRegiao = filters.regiao ? regiaoEfetiva === filters.regiao : true;

            return matchPedido && matchStatus && matchSupervisor && matchConsultor && 
                   matchDataImportacao && matchDataAtribuicao && matchDataBaixa && matchRegiao;
        });
    }, [maquinas, filters, currentUser, pedidos]);

    const handleExportExcel = () => {
        if (maquinasFiltradas.length === 0) return alert("Não há dados para exportar com os filtros atuais.");
        const dataToExport = maquinasFiltradas.map(m => {
            const pedido = pedidos.find(p => p.id === m.pedido_id);
            const supervisor = SUPERVISORES.find(s => s.id === m.supervisor_id);
            return {
                'SERIAL': m.serial,
                'LOTE_PEDIDO': pedido?.codigo_pedido || 'N/A',
                'REGIAO_EFETIVA': m.regiao || pedido?.regiao || 'N/A',
                'STATUS': m.status_estoque,
                'OPERACAO_SUPERVISOR': supervisor?.nome || 'ESTOQUE CENTRAL',
                'CONSULTOR': m.consultor_nome || 'N/A',
                'DATA_IMPORTACAO': m.criado_em ? new Date(m.criado_em).toLocaleDateString() : '-',
                'DATA_ATRIBUICAO': m.atribuido_em ? new Date(m.atribuido_em).toLocaleDateString() : '-',
                'DATA_BAIXA': m.baixado_em ? new Date(m.baixado_em).toLocaleDateString() : '-'
            };
        });
        const worksheet = (window as any).XLSX.utils.json_to_sheet(dataToExport);
        const workbook = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoria_Xisto");
        (window as any).XLSX.writeFile(workbook, `Relatorio_Auditoria_Xisto_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen print:bg-white print:p-0">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border-2 border-slate-200 space-y-8 print:hidden">
                <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
                    <div>
                        <h1 className="text-4xl font-black text-slate-950 tracking-tighter uppercase">Auditoria de Inventário</h1>
                        <p className="text-slate-900 font-bold text-[10px] uppercase tracking-[0.3em] mt-1">Logs detalhados de operação e rastreabilidade por região</p>
                    </div>
                    <button onClick={handleExportExcel} className="bg-slate-950 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 hover:bg-black transition-all shadow-xl border-2 border-slate-900 active:scale-95 group">
                        <FileTextIcon className="w-5 h-5 group-hover:rotate-12 transition-transform" /> Exportar Relatório (Excel)
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Lote de Pedido</label>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={filters.pedido} onChange={e => setFilters({...filters, pedido: e.target.value})}>
                                <option value="">TODOS OS LOTES</option>
                                {pedidos.map(p => <option key={p.id} value={p.id}>{p.codigo_pedido}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Status da Máquina</label>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
                                <option value="">TODOS OS STATUS</option>
                                <option value="DISPONIVEL">DISPONÍVEL</option>
                                <option value="ATRIBUIDA">ATRIBUÍDA</option>
                                <option value="BAIXADA">BAIXADA</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Região Atual</label>
                            <select className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={filters.regiao} onChange={e => setFilters({...filters, regiao: e.target.value})}><option value="">TODAS AS REGIÕES</option><option value="SERGIPE">SERGIPE</option><option value="ALAGOAS">ALAGOAS</option></select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Supervisor Resp.</label>
                            <select disabled={currentUser?.perfil === 'Supervisor'} className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700 disabled:opacity-50" value={filters.supervisor} onChange={e => setFilters({...filters, supervisor: e.target.value})}><option value="">TODOS SUPERVISORES</option>{SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Consultor de Vendas</label>
                            <input 
                                type="text" 
                                list="relatorios-consultor-list"
                                placeholder="BUSCAR OU ESCREVER..."
                                className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700 uppercase" 
                                value={filters.consultor} 
                                onChange={e => setFilters({...filters, consultor: e.target.value})} 
                            />
                            <datalist id="relatorios-consultor-list">
                                {listaConsultores.map(nome => <option key={nome} value={nome} />)}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Data Importação</label>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={filters.dataImportacao} onChange={e => setFilters({...filters, dataImportacao: e.target.value})} style={{ colorScheme: 'light' }} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Data Atribuição</label>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={filters.dataAtribuicao} onChange={e => setFilters({...filters, dataAtribuicao: e.target.value})} style={{ colorScheme: 'light' }} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-950 uppercase mb-3 tracking-widest">Data Baixa</label>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={filters.dataBaixa} onChange={e => setFilters({...filters, dataBaixa: e.target.value})} style={{ colorScheme: 'light' }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4">
                <Card title="Total Filtrado" value={stats.total} icon={<CreditCardIcon className="w-6 h-6 text-white" />} color="bg-slate-900" />
                <Card title="Disponíveis" value={stats.disp} icon={<CheckCircleIcon className="w-6 h-6 text-white" />} color="bg-emerald-700" />
                <Card title="Atribuídas" value={stats.atrib} icon={<ListIcon className="w-6 h-6 text-white" />} color="bg-indigo-800" />
                <Card title="Baixadas" value={stats.baix} icon={<ExitIcon className="w-6 h-6 text-white" />} color="bg-red-700" />
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-slate-200 overflow-hidden">
                <div className="p-8 bg-slate-100 border-b-2 border-slate-200 flex justify-between items-center">
                    <h2 className="text-lg font-black text-slate-950 uppercase tracking-tighter">Listagem Consolidada</h2>
                    <span className="text-[10px] font-black text-white bg-slate-900 px-5 py-2 rounded-full uppercase tracking-widest">{maquinasFiltradas.length} Máquinas</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-200 text-slate-950 font-black border-b-2 border-slate-300 uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="p-6">Serial</th>
                                <th className="p-6">Lote/Pedido / Região</th>
                                <th className="p-6">Status</th>
                                <th className="p-6">Responsáveis</th>
                                <th className="p-6">Linha do Tempo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-slate-100">
                            {paginatedItems.map(m => {
                                const pedido = pedidos.find(p => p.id === m.pedido_id);
                                const regiaoEfetiva = m.regiao || pedido?.regiao;
                                return (
                                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-6 font-mono font-black text-slate-950 text-lg tracking-tighter">{m.serial}</td>
                                        <td className="p-6">
                                            <p className="font-black text-blue-800 uppercase text-xs">{pedido?.codigo_pedido}</p>
                                            {regiaoEfetiva && (
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                                    regiaoEfetiva === 'SERGIPE' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }`}>
                                                    {regiaoEfetiva}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase border-2 tracking-widest ${
                                                m.status_estoque === 'DISPONIVEL' ? 'text-emerald-950 border-emerald-300 bg-emerald-100' : 
                                                m.status_estoque === 'ATRIBUIDA' ? 'text-indigo-950 border-indigo-300 bg-indigo-100' : 
                                                'text-red-950 border-red-300 bg-red-100'
                                            }`}>{m.status_estoque}</span>
                                        </td>
                                        <td className="p-6">
                                            <p className="font-black text-slate-950 text-sm leading-tight">{m.consultor_nome || 'LIVRE'}</p>
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight mt-0.5">{SUPERVISORES.find(s => s.id === m.supervisor_id)?.nome || '-'}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="space-y-1.5 text-[9px] font-black uppercase text-slate-900 max-w-[140px]">
                                                <div className="flex justify-between border-b border-slate-200 pb-0.5">
                                                    <span className="text-slate-500">Importado:</span>
                                                    <span className="text-slate-950">{m.criado_em ? new Date(m.criado_em).toLocaleDateString() : '-'}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-200 pb-0.5">
                                                    <span className="text-indigo-600">Atribuído:</span>
                                                    <span className="text-slate-950">{m.atribuido_em ? new Date(m.atribuido_em).toLocaleDateString() : '-'}</span>
                                                </div>
                                                {m.status_estoque === 'BAIXADA' && (
                                                    <div className="flex justify-between">
                                                        <span className="text-red-600">Baixado:</span>
                                                        <span className="text-slate-950">{m.baixado_em ? new Date(m.baixado_em).toLocaleDateString() : '-'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                {totalPages > 1 && (
                     <div className="p-6 border-t-2 border-slate-200 flex justify-between items-center bg-slate-50 print:hidden">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Página {currentPage} de {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase disabled:opacity-50">Anterior</button>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase disabled:opacity-50">Próxima</button>
                        </div>
                     </div>
                )}
            </div>
        </div>
    );
};

export default Relatorios;
