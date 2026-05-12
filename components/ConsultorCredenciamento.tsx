import React, { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';
import { SUPERVISORES } from '../constants';
import { Save, RefreshCw, FileDown, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface CredenciamentoData {
    id?: string;
    consultor_id: string;
    data: string;
    cpf_count: number;
    cnpj_count: number;
    visitas: number;
}

const ConsultorCredenciamento: React.FC = () => {
    const context = useContext(AppContext);
    const { currentUser, maquinas } = context || {};
    
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>(
        currentUser?.perfil === 'Supervisor' ? (currentUser.supervisorId?.toString() || '') : ''
    );
    const [weekStart, setWeekStart] = useState<string>(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para segunda-feira
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    });

    const [consultores, setConsultores] = useState<{id: string, nome: string}[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Objeto para armazenar as edições locais
    // { [consultorId]: { [dataStr]: { cpf, cnpj, visitas } } }
    const [dailyData, setDailyData] = useState<Record<string, Record<string, any>>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Permissão de edição
    const canEdit = currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Supervisor';

    const weekDays = useMemo(() => {
        const days = [];
        const start = new Date(weekStart + 'T12:00:00');
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push({
                dateStr: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
            });
        }
        return days;
    }, [weekStart]);

    useEffect(() => {
        if (selectedSupervisor) {
            fetchData();
        }
    }, [selectedSupervisor, weekStart]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Buscar consultores da operação
            const { data: consultoresData } = await supabase
                .from('consultores')
                .select('id, nome')
                .eq('supervisor_id', selectedSupervisor)
                .order('nome');

            if (consultoresData) {
                setConsultores(consultoresData);
                
                // 2. Buscar dados de credenciamento já existentes para esta semana
                const { data: credData } = await supabase
                    .from('credenciamentos')
                    .select('*')
                    .in('consultor_id', consultoresData.map(c => c.id))
                    .gte('data', weekDays[0].dateStr)
                    .lte('data', weekDays[6].dateStr);

                const initialData: Record<string, Record<string, any>> = {};
                credData?.forEach(row => {
                    if (!initialData[row.consultor_id]) initialData[row.consultor_id] = {};
                    initialData[row.consultor_id][row.data] = {
                        id: row.id,
                        cpf: row.cpf_count,
                        cnpj: row.cnpj_count,
                        visitas: row.visitas
                    };
                });
                setDailyData(initialData);
            }
        } catch (err) {
            console.error("Erro ao carregar dados:", err);
        }
        setLoading(false);
    };

    const handleInputChange = (consultorId: string, date: string, field: string, value: string) => {
        setDailyData(prev => ({
            ...prev,
            [consultorId]: {
                ...prev[consultorId],
                [date]: {
                    ...(prev[consultorId]?.[date] || {}),
                    [field]: value
                }
            }
        }));
    };

    const handleSaveRow = async (consultorId: string) => {
        setIsSaving(true);
        try {
            const consultorEntries = dailyData[consultorId];
            if (!consultorEntries) return;

            // Buscamos novamente os IDs atuais do banco para garantir consistência
            const dateStrings = weekDays.map(d => d.dateStr);
            const { data: existingRecords } = await supabase
                .from('credenciamentos')
                .select('id, data')
                .eq('consultor_id', consultorId)
                .in('data', dateStrings);

            const allPayload: any[] = [];
            
            for (const day of weekDays) {
                const dateStr = day.dateStr;
                const values = consultorEntries[dateStr];
                if (!values) continue;

                const existing = existingRecords?.find(r => r.data === dateStr);
                const payloadItem: any = {
                    consultor_id: consultorId,
                    data: dateStr,
                    cpf_count: Number(values.cpf) || 0,
                    cnpj_count: Number(values.cnpj) || 0,
                    visitas: Number(values.visitas) || 0
                };

                if (existing) {
                    payloadItem.id = existing.id;
                    allPayload.push(payloadItem);
                } else if (payloadItem.cpf_count !== 0 || payloadItem.cnpj_count !== 0 || payloadItem.visitas !== 0) {
                    allPayload.push(payloadItem);
                }
            }

            if (allPayload.length > 0) {
                const { error: upsertError } = await supabase
                    .from('credenciamentos')
                    .upsert(allPayload);

                if (upsertError) throw upsertError;
            }

            alert('Dados do consultor salvos com sucesso!');
            fetchData();
        } catch (err: any) {
            alert(`Erro ao salvar: ${err.message || 'Erro desconhecido'}`);
        }
        setIsSaving(false);
    };

    const handleSaveAll = async () => {
        if (!confirm('Deseja salvar as alterações de TODOS os consultores desta operação?')) return;
        setIsSaving(true);
        try {
            const dateStrings = weekDays.map(d => d.dateStr);
            const consultorIds = consultores.map(c => c.id);
            
            // Processar em lotes (chunks) de consultores para evitar erros de URL/414
            const chunkSize = 20;
            for (let i = 0; i < consultorIds.length; i += chunkSize) {
                const chunkIds = consultorIds.slice(i, i + chunkSize);
                
                // Buscar registros existentes do chunk atual
                const { data: existingRecords } = await supabase
                    .from('credenciamentos')
                    .select('id, consultor_id, data')
                    .in('consultor_id', chunkIds)
                    .in('data', dateStrings);

                const chunkPayload: any[] = [];
                
                for (const consultantId of chunkIds) {
                    const consultorEntries = dailyData[consultantId];
                    if (!consultorEntries) continue;

                    for (const day of weekDays) {
                        const dateStr = day.dateStr;
                        const values = consultorEntries[dateStr];
                        if (!values) continue;

                        const existing = existingRecords?.find(r => r.consultor_id === consultantId && r.data === dateStr);
                        const payloadItem: any = {
                            consultor_id: consultantId,
                            data: dateStr,
                            cpf_count: Number(values.cpf) || 0,
                            cnpj_count: Number(values.cnpj) || 0,
                            visitas: Number(values.visitas) || 0
                        };

                        if (existing) {
                            payloadItem.id = existing.id;
                            chunkPayload.push(payloadItem);
                        } else if (payloadItem.cpf_count !== 0 || payloadItem.cnpj_count !== 0 || payloadItem.visitas !== 0) {
                            chunkPayload.push(payloadItem);
                        }
                    }
                }

                if (chunkPayload.length > 0) {
                    const { error: upsertError } = await supabase
                        .from('credenciamentos')
                        .upsert(chunkPayload);

                    if (upsertError) throw upsertError;
                }
            }

            alert('Todos os dados da semana foram salvos com sucesso!');
            fetchData();
        } catch (err: any) {
            alert(`Erro ao salvar dados globais: ${err.message || 'Erro desconhecido'}. Verifique se o banco de dados aceita os campos cpf_count, cnpj_count e visitas.`);
        }
        setIsSaving(false);
    };

    const changeWeek = (direction: number) => {
        const d = new Date(weekStart + 'T12:00:00');
        d.setDate(d.getDate() + (direction * 7));
        setWeekStart(d.toISOString().split('T')[0]);
    };

    const filteredConsultores = useMemo(() => {
        return consultores.filter(c => c.nome.toUpperCase().includes(searchTerm.toUpperCase()));
    }, [consultores, searchTerm]);

    const getConsultorWeeklyTotals = (consultorId: string) => {
        const data = dailyData[consultorId];
        if (!data) return { cpf: 0, cnpj: 0, visitas: 0 };
        return Object.values(data).reduce((acc, curr) => ({
            cpf: acc.cpf + (Number(curr.cpf) || 0),
            cnpj: acc.cnpj + (Number(curr.cnpj) || 0),
            visitas: acc.visitas + (Number(curr.visitas) || 0),
        }), { cpf: 0, cnpj: 0, visitas: 0 });
    };

    return (
        <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
            {/* Header com Filtros */}
            <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Registro de Credenciamentos</h1>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Lançamento diário de performance por consultor</p>
                    </div>
                    <div className="flex gap-2">
                        {canEdit && (
                            <button 
                                onClick={handleSaveAll}
                                disabled={isSaving || !selectedSupervisor}
                                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:bg-slate-300 transition-all flex items-center gap-2"
                            >
                                <Save size={16} /> Salvar Tudo
                            </button>
                        )}
                        <button onClick={fetchData} className="bg-slate-100 text-slate-600 p-3 rounded-2xl hover:bg-slate-200 transition-colors">
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Operação / Supervisor</label>
                        <select 
                            disabled={currentUser?.perfil === 'Supervisor'}
                            className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all"
                            value={selectedSupervisor}
                            onChange={(e) => setSelectedSupervisor(e.target.value)}
                        >
                            <option value="">Selecione...</option>
                            {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Semana de Referência</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => changeWeek(-1)} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><ChevronLeft size={18} /></button>
                            <div className="flex-1 p-3 bg-indigo-50 text-indigo-700 text-center rounded-xl font-black text-xs">
                                {new Date(weekDays[0].dateStr + 'T12:00:00').toLocaleDateString()} - {new Date(weekDays[6].dateStr + 'T12:00:00').toLocaleDateString()}
                            </div>
                            <button onClick={() => changeWeek(1)} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100"><ChevronRight size={18} /></button>
                        </div>
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Filtrar Consultor</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="NOME DO CONSULTOR..."
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-all uppercase"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela de Lançamentos */}
            <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b-2 border-slate-100">
                            <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase sticky left-0 bg-slate-50 z-10 w-64">Consultor</th>
                            {weekDays.map(day => (
                                <th key={day.dateStr} className="p-4 text-center border-l border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{day.label.split(' ')[0]}</p>
                                    <p className="text-xs font-black text-slate-900">{day.label.split(' ')[1]}</p>
                                </th>
                            ))}
                            <th className="p-4 text-center border-l-2 border-slate-200 bg-indigo-50/30 w-32">Total Semanal</th>
                            <th className="p-4 text-center border-l border-slate-100 w-24">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredConsultores.length > 0 ? (
                            filteredConsultores.map(c => {
                                const totals = getConsultorWeeklyTotals(c.id);
                                return (
                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">
                                            <p className="font-black text-slate-900 text-xs uppercase">{c.nome}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">ID: {c.id.slice(0, 8)}</p>
                                        </td>
                                        
                                        {weekDays.map(day => {
                                            const values = dailyData[c.id]?.[day.dateStr] || { cpf: '', cnpj: '', visitas: '' };
                                            const isToday = day.dateStr === new Date().toISOString().split('T')[0];
                                            
                                            return (
                                                <td key={day.dateStr} className={`p-2 border-l border-slate-100 ${isToday ? 'bg-indigo-50/20' : ''}`}>
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-slate-300 w-6 uppercase">CPF</span>
                                                            <input 
                                                                type="text" 
                                                                placeholder="0"
                                                                readOnly={!canEdit}
                                                                className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all disabled:opacity-50"
                                                                value={values.cpf ?? ''}
                                                                onChange={(e) => handleInputChange(c.id, day.dateStr, 'cpf', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-slate-300 w-6 uppercase">CNPJ</span>
                                                            <input 
                                                                type="text" 
                                                                placeholder="0"
                                                                readOnly={!canEdit}
                                                                className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all disabled:opacity-50"
                                                                value={values.cnpj ?? ''}
                                                                onChange={(e) => handleInputChange(c.id, day.dateStr, 'cnpj', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[8px] font-black text-slate-300 w-6 uppercase">VISIT</span>
                                                            <input 
                                                                type="text" 
                                                                placeholder="0"
                                                                readOnly={!canEdit}
                                                                className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-center text-xs font-black text-emerald-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all disabled:opacity-50"
                                                                value={values.visitas ?? ''}
                                                                onChange={(e) => handleInputChange(c.id, day.dateStr, 'visitas', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        <td className="p-4 border-l-2 border-slate-200 bg-slate-50/50">
                                            <div className="space-y-1 text-center">
                                                <p className="text-[10px] font-black text-slate-400">CPF: <span className="text-slate-900">{totals.cpf}</span></p>
                                                <p className="text-[10px] font-black text-indigo-400">CNPJ: <span className="text-indigo-700">{totals.cnpj}</span></p>
                                                <p className="text-[10px] font-black text-emerald-400">VIS: <span className="text-emerald-700">{totals.visitas}</span></p>
                                            </div>
                                        </td>

                                        <td className="p-4 border-l border-slate-100 text-center">
                                            {canEdit && (
                                                <button 
                                                    onClick={() => handleSaveRow(c.id)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                    title="Salvar apenas este consultor"
                                                >
                                                    <Save size={20} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={10} className="p-20 text-center">
                                    <Filter className="mx-auto text-slate-200 mb-4" size={48} />
                                    <p className="text-slate-400 font-black uppercase text-sm">Nenhum consultor encontrado para esta operação</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {isSaving && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        <p className="font-black text-slate-900 uppercase text-xs tracking-widest">Gravando no Banco de Dados...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsultorCredenciamento;
