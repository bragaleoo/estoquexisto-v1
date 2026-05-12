import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';
import { LayoutGrid, Filter, Search, TrendingUp, Users, Target, Edit2, Plus, Save, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { SUPERVISORES } from '../constants';

interface Credenciamento {
  id: string;
  consultor_id: string;
  consultores: { nome: string; supervisor_id: string }; // Join
  data: string;
  cpf_count: number;
  cnpj_count: number;
  visitas: number;
}

const getWeeks = (ano: number, mes: number) => {
    let allDays = [];
    let date = new Date(ano, mes - 1, 1);
    
    while (date.getMonth() === mes - 1) {
        allDays.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    
    const weeksMap = new Map();
    allDays.forEach(d => {
        const tempDate = new Date(d);
        const day = tempDate.getDay();
        const diff = tempDate.getDate() - day;
        const sunday = new Date(tempDate.setDate(diff));
        const key = `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`;
        if (!weeksMap.has(key)) weeksMap.set(key, []);
        weeksMap.get(key).push(d);
    });
    return Array.from(weeksMap.values()).map((days, i) => ({ id: i + 1, days }));
};

const ConsultorCredenciamento: React.FC = () => {
  const [semana, setSemana] = useState(1);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'acompanhamento' | 'relatorios'>('acompanhamento');
  const weeks = useMemo(() => getWeeks(ano, mes), [ano, mes]);
  const context = useContext(AppContext);
  const currentUser = context?.currentUser;
  
  const [supervisorFiltro, setSupervisorFiltro] = useState<string>(
      currentUser?.perfil === 'Supervisor' ? (currentUser.supervisorUuid || '') : ''
  );
  
  const [data, setData] = useState<Credenciamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [consultores, setConsultores] = useState<{id: string, nome: string, supervisor_id: string}[]>([]);
  const [dailyData, setDailyData] = useState<Record<string, Record<number, { cpf: number, cnpj: number, visitas: number }>>>({});
  const [newEntry, setNewEntry] = useState({ consultor_id: '', data: new Date().toISOString().split('T')[0], cpf: 0, cnpj: 0, visitas: 0 });
  const [kpiPeriod, setKpiPeriod] = useState<'mensal' | 'semanal'>('semanal');
  
  // Controle de concorrência e fila
  const saveQueueRef = useRef<Set<string>>(new Set());
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [pendingSavesCount, setPendingSavesCount] = useState(0);

  // Efeito para avisar antes de fechar com salvamentos pendentes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (pendingSavesCount > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingSavesCount]);

  useEffect(() => {
    const newDailyData: Record<string, Record<number, { cpf: number, cnpj: number, visitas: number }>> = {};
    data.forEach(cred => {
      const [y, m, d] = cred.data.split('-').map(Number);
      if (m === mes && y === ano) {
        const dayOfMonth = d;
        if (!newDailyData[cred.consultor_id]) newDailyData[cred.consultor_id] = {};
        newDailyData[cred.consultor_id][dayOfMonth] = {
            cpf: cred.cpf_count,
            cnpj: cred.cnpj_count,
            visitas: cred.visitas
        };
      }
    });
    setDailyData(newDailyData);
  }, [data, mes, ano]);

  // Função Robusta de Auto-Salvamento com Retry
  const autoSaveCell = async (consultorId: string, day: number, values: { cpf: number, cnpj: number, visitas: number }, retries = 3) => {
    const cellKey = `${consultorId}_${day}`;
    saveQueueRef.current.add(cellKey);
    setPendingSavesCount(saveQueueRef.current.size);
    setIsSaving(true);
    setSaveError(null);

    try {
        const date = new Date(ano, mes - 1, day);
        const dateStr = date.getFullYear() + '-' + 
                        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(date.getDate()).padStart(2, '0');

        // Busca ID para evitar conflito de RLS
        const { data: existing } = await supabase
            .from('credenciamentos')
            .select('id')
            .eq('consultor_id', consultorId)
            .eq('data', dateStr)
            .maybeSingle();

        const payload = {
            consultor_id: consultorId,
            data: dateStr,
            cpf_count: Number(values.cpf) || 0,
            cnpj_count: Number(values.cnpj) || 0,
            visitas: Number(values.visitas) || 0
        };

        let result;
        if (existing) {
            result = await supabase.from('credenciamentos').update(payload).eq('id', existing.id);
        } else if (payload.cpf_count > 0 || payload.cnpj_count > 0 || payload.visitas > 0) {
            result = await supabase.from('credenciamentos').insert(payload);
        }

        if (result?.error) throw result.error;

        setLastSaved(new Date());
        saveQueueRef.current.delete(cellKey);
        setPendingSavesCount(saveQueueRef.current.size);
    } catch (err: any) {
        console.error(`Erro ao salvar ${cellKey} (tentativas restantes: ${retries}):`, err);
        if (retries > 0) {
            // Tenta novamente após 2 segundos
            setTimeout(() => autoSaveCell(consultorId, day, values, retries - 1), 2000);
        } else {
            setSaveError('Erro ao sincronizar alguns dados. Verifique sua internet.');
            // Mantém na fila para indicar que não salvou
        }
    } finally {
        if (saveQueueRef.current.size === 0) {
            setIsSaving(false);
        }
    }
  };

  const handleInputChange = (consultorId: string, day: number, field: 'cpf' | 'cnpj' | 'visitas', value: number) => {
    const newValues = {
        ...(dailyData[consultorId]?.[day] || { cpf: 0, cnpj: 0, visitas: 0 }),
        [field]: value
    };

    setDailyData(prev => ({
        ...prev,
        [consultorId]: {
            ...prev[consultorId],
            [day]: newValues
        }
    }));

    const cellKey = `${consultorId}_${day}`;
    if (saveTimeoutRef.current[cellKey]) clearTimeout(saveTimeoutRef.current[cellKey]);

    saveTimeoutRef.current[cellKey] = setTimeout(() => {
        autoSaveCell(consultorId, day, newValues);
        delete saveTimeoutRef.current[cellKey];
    }, 1000); // 1 segundo de debounce
  };

  useEffect(() => {
    fetchData();
    fetchConsultores();
  }, [semana, supervisorFiltro, mes, ano]);

  const fetchConsultores = async () => {
    let query = supabase.from('consultores').select('id, nome, supervisor_id').eq('status', 'ativo');
    if (supervisorFiltro) {
        query = query.eq('supervisor_id', supervisorFiltro);
    } else if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorUuid) {
        query = query.eq('supervisor_id', currentUser.supervisorUuid);
    }
    const { data } = await query;
    if(data) setConsultores(data as {id: string, nome: string, supervisor_id: string}[]);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('credenciamentos')
        .select(`id, consultor_id, data, cpf_count, cnpj_count, visitas, consultores (nome, supervisor_id)`);

      if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorUuid) {
          query = query.eq('consultores.supervisor_id', currentUser.supervisorUuid);
      }
      const { data: result, error } = await query;
      if (error) throw error;
      setData(result as any[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchesSearch = d.consultores?.nome.toLowerCase().includes(searchTerm.toLowerCase());
      if (currentUser?.perfil === 'Administrador' && supervisorFiltro) {
          return matchesSearch && d.consultores?.supervisor_id === supervisorFiltro;
      }
      return matchesSearch;
    });
  }, [data, searchTerm, supervisorFiltro, currentUser]);

  const filteredConsultores = useMemo(() => {
      return consultores.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [consultores, searchTerm]);

  const sortedSupervisores = useMemo(() => {
      return [...SUPERVISORES].sort((a, b) => a.nome.localeCompare(b.nome));
  }, []);

  const monthStats = useMemo(() => {
    const s = filteredData.reduce((acc, curr) => ({
      cpf: acc.cpf + (curr.cpf_count || 0),
      cnpj: acc.cnpj + (curr.cnpj_count || 0),
      visitas: acc.visitas + (curr.visitas || 0)
    }), { cpf: 0, cnpj: 0, visitas: 0 });
    const totalCred = s.cpf + s.cnpj;
    const percPJ = totalCred > 0 ? ((s.cnpj / totalCred) * 100).toFixed(1) : '0';
    return { totalCred, percPJ, visitas: s.visitas };
  }, [filteredData]);

  const weekStats = useMemo(() => {
      const selectedWeekDates = weeks[semana - 1]?.days || [];
      const dateStrings = selectedWeekDates.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      const filteredWeekData = filteredData.filter(d => dateStrings.includes(d.data));
      const s = filteredWeekData.reduce((acc, curr) => ({
          cpf: acc.cpf + (curr.cpf_count || 0),
          cnpj: acc.cnpj + (curr.cnpj_count || 0),
          visitas: acc.visitas + (curr.visitas || 0)
      }), { cpf: 0, cnpj: 0, visitas: 0 });
      const totalCred = s.cpf + s.cnpj;
      const percPJ = totalCred > 0 ? ((s.cnpj / totalCred) * 100).toFixed(1) : '0';
      return { totalCred, percPJ, visitas: s.visitas };
  }, [filteredData, weeks, semana]);

  const handleCreate = async () => {
    const { error } = await supabase.from('credenciamentos').insert({
        consultor_id: newEntry.consultor_id,
        data: newEntry.data,
        cpf_count: newEntry.cpf,
        cnpj_count: newEntry.cnpj,
        visitas: newEntry.visitas
    });
    if(error) { console.error(error); alert("Erro ao criar cadastro"); }
    else { setShowModal(false); fetchData(); }
  };

  if(loading && data.length === 0) return <div className="p-10 text-center text-slate-500">Carregando painel de credenciamentos...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Credenciamentos</h1>
            <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-500">Acompanhamento de performance operacional</p>
                {isSaving ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[11px] font-bold shadow-sm">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        SINCRONIZANDO {pendingSavesCount > 1 ? `(${pendingSavesCount} itens)` : ''}
                    </div>
                ) : saveError ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[11px] font-bold shadow-sm">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {saveError}
                        <button onClick={() => fetchData()} className="ml-1 underline flex items-center gap-1"><RefreshCw className="w-3 h-3"/> Tentar Recarregar</button>
                    </div>
                ) : lastSaved && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-bold shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        SINCRONIZADO {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>
        </div>
          <div className="flex items-center space-x-4">
             <select value={`${mes}-${ano}`} onChange={(e) => {
                 const [m, a] = e.target.value.split('-').map(Number);
                 setMes(m); setAno(a);
             }} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                 {Array.from({length: 12}).map((_, i) => {
                     const m = i + 1; const a = new Date().getFullYear();
                     return <option key={i} value={`${m}-${a}`}>{new Date(a, i).toLocaleString('pt-BR', { month: 'long' })}/{a}</option>
                 })}
             </select>
            <select value={semana} onChange={(e) => setSemana(Number(e.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                {weeks.map(w => <option key={w.id} value={w.id}>Semana {w.id}</option>)}
            </select>
             {currentUser?.perfil === 'Administrador' ? (
                <select value={supervisorFiltro} onChange={(e) => setSupervisorFiltro(e.target.value)} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas Supervisões</option>
                    {sortedSupervisores.map(s => <option key={s.uuid} value={s.uuid}>{s.nome}</option>)}
                </select>
             ) : (
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
                    {sortedSupervisores.find(s => s.uuid === supervisorFiltro)?.nome || 'Minha Supervisão'}
                </div>
             )}
          </div>
      </div>

      <div className="flex border-b border-slate-200 mb-6">
        <button className={`px-6 py-2 font-semibold text-sm ${activeTab === 'acompanhamento' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setActiveTab('acompanhamento')}>Acompanhamento</button>
        <button className={`px-6 py-2 font-semibold text-sm ${activeTab === 'relatorios' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setActiveTab('relatorios')}>Relatórios</button>
      </div>

      {activeTab === 'relatorios' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[ { label: 'Resumo do Mês', stats: monthStats }, { label: 'Resumo da Semana', stats: weekStats } ].map(block => (
                <div key={block.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-lg mb-4 text-slate-800">{block.label}</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs text-slate-500 font-medium">Creds</p>
                            <p className="text-xl font-bold text-indigo-600">{block.stats.totalCred}</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs text-slate-500 font-medium">% PJ</p>
                            <p className="text-xl font-bold text-indigo-600">{block.stats.percPJ}%</p>
                        </div>
                        <div className="text-center p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs text-slate-500 font-medium">Visitas</p>
                            <p className="text-xl font-bold text-emerald-600">{block.stats.visitas}</p>
                        </div>
                    </div>
                </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">Relatório de Performance (KPIs)</h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button className={`px-4 py-1 text-sm font-semibold rounded-md transition-all ${kpiPeriod === 'semanal' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setKpiPeriod('semanal')}>Semanal</button>
                    <button className={`px-4 py-1 text-sm font-semibold rounded-md transition-all ${kpiPeriod === 'mensal' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setKpiPeriod('mensal')}>Mensal</button>
                </div>
            </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filteredConsultores.map(c => {
                      const consultantDaily = dailyData[c.id] || {};
                      const validDays = kpiPeriod === 'semanal' ? (weeks[semana - 1]?.days.map(d => d.getDate()) || []) : Object.keys(consultantDaily).map(Number);
                      const totalCPFs = validDays.reduce((sum, day) => sum + (consultantDaily[day]?.cpf || 0), 0);
                      const totalCNPJs = validDays.reduce((sum, day) => sum + (consultantDaily[day]?.cnpj || 0), 0);
                      const totalVisitas = validDays.reduce((sum, day) => sum + (consultantDaily[day]?.visitas || 0), 0);
                      const totalCred = totalCPFs + totalCNPJs;
                      const percPJ = totalCred > 0 ? ((totalCNPJs / totalCred) * 100).toFixed(1) : '0';
                     const status = totalCred === 0 ? '0' : totalCred === 1 ? '1' : totalCred === 2 ? '2' : '>=3';
                     const color = status === '0' ? 'bg-red-500' : status === '1' ? 'bg-emerald-100' : status === '2' ? 'bg-emerald-500' : 'bg-emerald-900';
                     return (
                         <div key={c.id} className="border p-4 rounded-lg bg-white hover:border-blue-200 transition-colors">
                             <div className="flex items-center gap-3 mb-2">
                                 <div className={`w-3 h-3 rounded-full ${color}`}></div>
                                 <p className="text-sm font-semibold truncate">{c.nome}</p>
                             </div>
                             <div className="grid grid-cols-3 gap-2 text-center border-t pt-3 mt-1">
                                 <div className="text-xs">
                                     <p className="font-bold text-slate-900">{totalCred}</p>
                                     <p className="text-[10px] text-slate-500 uppercase">Cred</p>
                                 </div>
                                 <div className="text-xs">
                                     <p className="font-bold text-blue-600">{percPJ}%</p>
                                     <p className="text-[10px] text-slate-500 uppercase">% PJ</p>
                                 </div>
                                 <div className="text-xs">
                                     <p className="font-bold text-emerald-600">{totalVisitas}</p>
                                     <p className="text-[10px] text-slate-500 uppercase">Vis</p>
                                 </div>
                             </div>
                         </div>
                     );
                 })}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
               <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input 
                      type="text" placeholder="Buscar consultor..." 
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                    <tr>
                        <th className="px-6 py-4 sticky left-0 bg-slate-50 z-10 border-r min-w-[200px]">Consultor</th>
                        {weeks[semana - 1]?.days.map((date, i) => (
                            <th key={i} className="px-2 py-4 text-center text-xs border-r min-w-[140px]">
                                <span className="block text-slate-900 font-bold">{date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                <span className="text-[10px] text-slate-400">{date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}</span>
                                <div className="flex justify-around text-[9px] font-bold text-slate-400 mt-2 bg-slate-100 rounded-md py-0.5">
                                    <span>PF</span><span>PJ</span><span>VIS</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filteredConsultores.length === 0 ? (
                        <tr>
                            <td colSpan={weeks[semana - 1]?.days.length + 1} className="px-6 py-10 text-center text-slate-500">
                                Nenhum consultor encontrado.
                            </td>
                        </tr>
                    ) : (
                        filteredConsultores.map(c => (
                            <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-semibold text-slate-900 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{c.nome}</td>
                                {weeks[semana - 1]?.days.map((date, i) => {
                                    const day = date.getDate();
                                    const cellData = dailyData[c.id]?.[day] || { cpf: 0, cnpj: 0, visitas: 0 };
                                    const isPending = saveQueueRef.current.has(`${c.id}_${day}`);
                                    
                                    return (
                                        <td key={i} className={`px-1 py-4 text-center border-r ${isPending ? 'bg-blue-50/30' : ''} transition-colors`}>
                                            <div className="flex gap-1 justify-center px-1">
                                                <input 
                                                    type="number" min="0" 
                                                    className={`w-10 p-1.5 border rounded text-center text-xs outline-none transition-all ${cellData.cpf > 0 ? 'bg-white border-blue-200 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`} 
                                                    placeholder="0" value={cellData.cpf || ''} 
                                                    onChange={e => handleInputChange(c.id, day, 'cpf', Number(e.target.value))} 
                                                />
                                                <input 
                                                    type="number" min="0" 
                                                    className={`w-10 p-1.5 border rounded text-center text-xs outline-none transition-all ${cellData.cnpj > 0 ? 'bg-white border-blue-200 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`} 
                                                    placeholder="0" value={cellData.cnpj || ''} 
                                                    onChange={e => handleInputChange(c.id, day, 'cnpj', Number(e.target.value))} 
                                                />
                                                <input 
                                                    type="number" min="0" 
                                                    className={`w-10 p-1.5 border rounded text-center text-xs outline-none transition-all ${cellData.visitas > 0 ? 'bg-white border-emerald-200 text-emerald-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-400'}`} 
                                                    placeholder="0" value={cellData.visitas || ''} 
                                                    onChange={e => handleInputChange(c.id, day, 'visitas', Number(e.target.value))} 
                                                />
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
      )}

       {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl scale-in-center">
                 <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-blue-600"/> Novo Registro</h2>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Consultor</label>
                 <select className="w-full p-2.5 border rounded-lg mb-4 shadow-sm" value={newEntry.consultor_id} onChange={e => setNewEntry({...newEntry, consultor_id: e.target.value})}>
                     <option value="">Selecione o consultor</option>
                     {consultores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                 </select>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                 <input type="date" className="w-full p-2.5 border rounded-lg mb-4 shadow-sm" value={newEntry.data} onChange={e => setNewEntry({...newEntry, data: e.target.value})} />
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">PF</label>
                        <input type="number" min="0" className="w-full p-2.5 border rounded-lg shadow-sm" value={newEntry.cpf} onChange={e => setNewEntry({...newEntry, cpf: Math.max(0, Number(e.target.value))})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">PJ</label>
                        <input type="number" min="0" className="w-full p-2.5 border rounded-lg shadow-sm" value={newEntry.cnpj} onChange={e => setNewEntry({...newEntry, cnpj: Math.max(0, Number(e.target.value))})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Vis</label>
                        <input type="number" min="0" className="w-full p-2.5 border rounded-lg shadow-sm" value={newEntry.visitas} onChange={e => setNewEntry({...newEntry, visitas: Math.max(0, Number(e.target.value))})} />
                    </div>
                 </div>
                 <div className="flex gap-3 mt-8">
                     <button onClick={() => setShowModal(false)} className="flex-1 p-3 border rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-all">Cancelar</button>
                     <button onClick={handleCreate} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">Salvar Registro</button>
                 </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default ConsultorCredenciamento;
