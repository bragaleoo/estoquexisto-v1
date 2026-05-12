import React, { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';
import { LayoutGrid, Filter, Search, TrendingUp, Users, Target, Edit2, Plus, Save } from 'lucide-react';
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
    
    // Fill all days of the month
    while (date.getMonth() === mes - 1) {
        allDays.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    
    const weeksMap = new Map();
    
    allDays.forEach(d => {
        const tempDate = new Date(d);
        // Get the Sunday of this day's week
        const day = tempDate.getDay();
        const diff = tempDate.getDate() - day;
        const sunday = new Date(tempDate.setDate(diff));
        
        // Key based on Sunday of the week
        const key = `${sunday.getFullYear()}-${sunday.getMonth()}-${sunday.getDate()}`;
        
        if (!weeksMap.has(key)) weeksMap.set(key, []);
        weeksMap.get(key).push(d);
    });
    
    // Convert map values to array
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
  
  // Use supervisorUuid as default if profile is Supervisor
  const [supervisorFiltro, setSupervisorFiltro] = useState<string>(
      currentUser?.perfil === 'Supervisor' ? (currentUser.supervisorUuid || '') : ''
  );
  
  const [data, setData] = useState<Credenciamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [consultores, setConsultores] = useState<{id: string, nome: string, supervisor_id: string}[]>([]);
  const [dailyData, setDailyData] = useState<Record<string, Record<number, { cpf: number, cnpj: number, visitas: number }>>>({});
  const [newEntry, setNewEntry] = useState({ consultor_id: '', data: new Date().toISOString().split('T')[0], cpf: 0, cnpj: 0, visitas: 0 });
  const [kpiPeriod, setKpiPeriod] = useState<'mensal' | 'semanal'>('semanal');
  
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

  const handleInputChange = (consultorId: string, day: number, field: 'cpf' | 'cnpj' | 'visitas', value: number) => {
    setDailyData(prev => ({
        ...prev,
        [consultorId]: {
            ...prev[consultorId],
            [day]: {
                ...(prev[consultorId]?.[day] || { cpf: 0, cnpj: 0, visitas: 0 }),
                [field]: value
            }
        }
    }));
  };

  const handleSaveAll = async () => {
    const datesToSave = weeks[semana - 1]?.days;
    if (!datesToSave) return;
    
    setLoading(true);
    try {
        const allPayload = [];
        
        // Use filteredConsultores to save only visible/selected group
        for (const c of filteredConsultores) {
            for (const dateObj of datesToSave) {
                const day = dateObj.getDate();
                const values = dailyData[c.id]?.[day] || { cpf: 0, cnpj: 0, visitas: 0 };
                
                // Formatar data consistentemente
                const date = dateObj.getFullYear() + '-' + 
                             String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                             String(dateObj.getDate()).padStart(2, '0');

                // Só envia se houver algum valor
                if (values.cpf > 0 || values.cnpj > 0 || values.visitas > 0) {
                    allPayload.push({
                        consultor_id: c.id,
                        data: date,
                        cpf_count: Number(values.cpf) || 0,
                        cnpj_count: Number(values.cnpj) || 0,
                        visitas: Number(values.visitas) || 0
                    });
                }
            }
        }

        if (allPayload.length === 0) {
            alert('Nenhum dado para salvar.');
            setLoading(false);
            return;
        }

        // 1. Buscar registros existentes para pegar os IDs (para evitar erro de RLS/onConflict)
        const { data: existingRecords } = await supabase
            .from('credenciamentos')
            .select('id, consultor_id, data');

        const existingMap = new Map();
        existingRecords?.forEach(r => {
            existingMap.set(`${r.consultor_id}_${r.data}`, r.id);
        });

        // 2. Mapear IDs para o payload
        const finalPayload = allPayload.map(p => {
            const key = `${p.consultor_id}_${p.data}`;
            if (existingMap.has(key)) {
                return { ...p, id: existingMap.get(key) };
            }
            return p;
        });

        // 3. Salvar em pedaços (chunks) para evitar erro de URL/Timeout
        const chunkSize = 50;
        for (let i = 0; i < finalPayload.length; i += chunkSize) {
            const chunk = finalPayload.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('credenciamentos')
                .upsert(chunk);
            
            if (error) throw error;
        }

        alert('Todos os dados da semana salvos com sucesso!');
        await fetchData();
    } catch (err: any) {
        console.error('Erro ao salvar tudo:', err);
        alert(`Erro ao salvar dados: ${err.message || 'Verifique sua conexão'}`);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveRow = async (consultorId: string, week: number) => {
    const datesToSave = weeks[week - 1]?.days;
    if (!datesToSave) return;
    
    setLoading(true);
    try {
        const rowPayload = [];
        for (const dateObj of datesToSave) {
            const day = dateObj.getDate();
            const values = dailyData[consultorId]?.[day] || { cpf: 0, cnpj: 0, visitas: 0 };
            const date = dateObj.getFullYear() + '-' + 
                         String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(dateObj.getDate()).padStart(2, '0');

            if (values.cpf > 0 || values.cnpj > 0 || values.visitas > 0) {
                rowPayload.push({
                    consultor_id: consultorId,
                    data: date,
                    cpf_count: Number(values.cpf) || 0,
                    cnpj_count: Number(values.cnpj) || 0,
                    visitas: Number(values.visitas) || 0
                });
            }
        }

        if (rowPayload.length === 0) {
            alert('Nenhum dado para este consultor.');
            setLoading(false);
            return;
        }

        // Buscar IDs existentes para esta linha
        const { data: existing } = await supabase
            .from('credenciamentos')
            .select('id, data')
            .eq('consultor_id', consultorId);

        const existingMap = new Map();
        existing?.forEach(r => existingMap.set(r.data, r.id));

        const finalRowPayload = rowPayload.map(p => {
            if (existingMap.has(p.data)) {
                return { ...p, id: existingMap.get(p.data) };
            }
            return p;
        });

        const { error } = await supabase.from('credenciamentos').upsert(finalRowPayload);
        if (error) throw error;

        alert('Dados do consultor salvos!');
        await fetchData();
    } catch (err: any) {
        alert('Erro ao salvar consultor: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchConsultores();
  }, [semana, supervisorFiltro]);

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

  const handleCreate = async () => {
      const { error } = await supabase.from('credenciamentos').insert({
          consultor_id: newEntry.consultor_id,
          data: newEntry.data,
          cpf_count: newEntry.cpf,
          cnpj_count: newEntry.cnpj,
          visitas: newEntry.visitas
      });
      if(error) { console.error(error); alert("Erro ao criar cadastro"); }
      else {
          setShowModal(false);
          fetchData();
      }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('credenciamentos')
        .select(`
          id,
          consultor_id,
          data,
          cpf_count,
          cnpj_count,
          visitas,
          consultores (
            nome,
            supervisor_id
          )
        `);

      if (supervisorFiltro) {
          query = query.eq('consultores.supervisor_id', supervisorFiltro);
      } else if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorUuid) {
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
      return matchesSearch;
    });
  }, [data, searchTerm]);

  const filteredConsultores = useMemo(() => {
      return consultores.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [consultores, searchTerm]);

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
      const dateStrings = selectedWeekDates.map(d => {
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      });
      
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

  if(loading && data.length === 0) return <div className="p-10 text-center">Carregando painel de credenciamentos...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Credenciamentos</h1>
            <p className="text-slate-500 mt-1">Acompanhamento de performance operacional</p>
        </div>
          <div className="flex items-center space-x-4">
             <button 
                onClick={handleSaveAll}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
             >
                <Save className="w-4 h-4" />
                Salvar Tudo
             </button>
             <select value={`${mes}-${ano}`} onChange={(e) => {
                 const [m, a] = e.target.value.split('-').map(Number);
                 setMes(m);
                 setAno(a);
             }} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                 {Array.from({length: 12}).map((_, i) => {
                     const m = i + 1;
                     const a = new Date().getFullYear();
                     return <option key={i} value={`${m}-${a}`}>{new Date(a, i).toLocaleString('pt-BR', { month: 'long' })}/{a}</option>
                 })}
             </select>
            <select value={semana} onChange={(e) => setSemana(Number(e.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                {weeks.map(w => <option key={w.id} value={w.id}>Semana {w.id}</option>)}
            </select>
             {currentUser?.perfil === 'Administrador' ? (
                <select value={supervisorFiltro} onChange={(e) => setSupervisorFiltro(e.target.value)} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                    <option value="">Todas Supervisões</option>
                    {SUPERVISORES.map(s => <option key={s.uuid} value={s.uuid}>{s.nome}</option>)}
                </select>
             ) : (
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
                    {SUPERVISORES.find(s => s.uuid === supervisorFiltro)?.nome || 'Minha Supervisão'}
                </div>
             )}
          </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button className={`px-6 py-2 font-semibold text-sm ${activeTab === 'acompanhamento' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setActiveTab('acompanhamento')}>Acompanhamento</button>
        <button className={`px-6 py-2 font-semibold text-sm ${activeTab === 'relatorios' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`} onClick={() => setActiveTab('relatorios')}>Relatórios</button>
      </div>

      {activeTab === 'relatorios' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[
                { label: 'Resumo do Mês', stats: monthStats },
                { label: 'Resumo da Semana', stats: weekStats },
            ].map(block => (
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

          {/* Table Section */}
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
                      const validDays = kpiPeriod === 'semanal' 
                          ? (weeks[semana - 1]?.days.map(d => d.getDate()) || []) 
                          : Object.keys(consultantDaily).map(Number);
                      
                      const totalCPFs = validDays.reduce((sum, day) => sum + (consultantDaily[day]?.cpf || 0), 0);
                      const totalCNPJs = validDays.reduce((sum, day) => sum + (consultantDaily[day]?.cnpj || 0), 0);
                      const totalVisitas = validDays.reduce((sum, day) => sum + (consultantDaily[day]?.visitas || 0), 0);
                      
                      const totalCred = totalCPFs + totalCNPJs;
                      const percPJ = totalCred > 0 ? ((totalCNPJs / totalCred) * 100).toFixed(1) : '0';
                     
                     const status = totalCred === 0 ? '0' : totalCred === 1 ? '1' : totalCred === 2 ? '2' : '>=3';
                     const color = status === '0' ? 'bg-red-500' : status === '1' ? 'bg-emerald-100' : status === '2' ? 'bg-emerald-500' : 'bg-emerald-900';
                     return (
                         <div key={c.id} className="border p-4 rounded-lg">
                             <div className="flex items-center gap-3 mb-2">
                                 <div className={`w-3 h-3 rounded-full ${color}`}></div>
                                 <p className="text-sm font-semibold">{c.nome}</p>
                             </div>
                             <div className="grid grid-cols-3 gap-2 text-center">
                                 <div className="text-xs">
                                     <p className="font-bold text-indigo-600">{totalCred}</p>
                                     <p className="text-[10px] text-slate-500">Total Cred</p>
                                 </div>
                                 <div className="text-xs">
                                     <p className="font-bold text-indigo-600">{percPJ}%</p>
                                     <p className="text-[10px] text-slate-500">% PJ</p>
                                 </div>
                                 <div className="text-xs">
                                     <p className="font-bold text-emerald-600">{totalVisitas}</p>
                                     <p className="text-[10px] text-slate-500">Visitas</p>
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
                      type="text" 
                      placeholder="Buscar consultor..." 
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
        </div>

        <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                    <th className="px-6 py-4">Consultor</th>
                    {weeks[semana - 1]?.days.map((date, i) => (
                        <th key={i} className="px-2 py-4 text-center text-xs">
                            {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ({date.toLocaleDateString('pt-BR', { weekday: 'short' })})
                            <div className="flex justify-around text-[10px] text-slate-400 mt-1">
                                <span>PF</span><span>PJ</span><span>Vis</span>
                            </div>
                        </th>
                    ))}
                    <th className="px-6 py-4 text-right">Ação</th>
                </tr>
            </thead>
            <tbody>
                        {filteredConsultores.length === 0 ? (
                            <tr>
                                <td colSpan={weeks[semana - 1]?.days.length + 2} className="px-6 py-10 text-center text-slate-500">
                                    Nenhum consultor encontrado para esta supervisão.
                                </td>
                            </tr>
                        ) : (
                            filteredConsultores.map(c => (
                                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                                    <td className="px-6 py-4 font-semibold text-slate-900">{c.nome}</td>
                                    {weeks[semana - 1]?.days.map((date, i) => {
                                        const day = date.getDate();
                                        return (
                                            <td key={i} className="px-1 py-4 text-center">
                                                <div className="flex gap-0.5 justify-center">
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        className="w-10 p-1 border rounded text-center text-xs" 
                                                        placeholder="PF" 
                                                        value={dailyData[c.id]?.[day]?.cpf || ''} 
                                                        onChange={e => handleInputChange(c.id, day, 'cpf', Number(e.target.value))} 
                                                    />
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        className="w-10 p-1 border rounded text-center text-xs" 
                                                        placeholder="PJ" 
                                                        value={dailyData[c.id]?.[day]?.cnpj || ''} 
                                                        onChange={e => handleInputChange(c.id, day, 'cnpj', Number(e.target.value))} 
                                                    />
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        className="w-10 p-1 border rounded text-center text-xs" 
                                                        placeholder="Vis" 
                                                        value={dailyData[c.id]?.[day]?.visitas || ''} 
                                                        onChange={e => handleInputChange(c.id, day, 'visitas', Number(e.target.value))} 
                                                    />
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleSaveRow(c.id, semana)} className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">Salvar</button>
                                    </td>
                                </tr>
                            ))
                        )}
            </tbody>
        </table>
      </div>
      )}

       {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-2xl">
                 <h2 className="text-xl font-bold mb-4">Novo Registro</h2>
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Consultor</label>
                 <select className="w-full p-2 border rounded mb-3" value={newEntry.consultor_id} onChange={e => setNewEntry({...newEntry, consultor_id: e.target.value})}>
                     <option value="">Selecione o consultor</option>
                     {consultores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                 </select>
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                 <input type="date" className="w-full p-2 border rounded mb-3" value={newEntry.data} onChange={e => setNewEntry({...newEntry, data: e.target.value})} />
                 
                 <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">PF</label>
                        <input type="number" min="0" className="w-full p-2 border rounded mb-3" value={newEntry.cpf} onChange={e => setNewEntry({...newEntry, cpf: Math.max(0, Number(e.target.value))})} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">PJ</label>
                        <input type="number" min="0" className="w-full p-2 border rounded mb-3" value={newEntry.cnpj} onChange={e => setNewEntry({...newEntry, cnpj: Math.max(0, Number(e.target.value))})} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Visitas</label>
                        <input type="number" min="0" className="w-full p-2 border rounded mb-3" value={newEntry.visitas} onChange={e => setNewEntry({...newEntry, visitas: Math.max(0, Number(e.target.value))})} />
                    </div>
                 </div>
                 
                 <div className="flex gap-2 mt-4">
                     <button onClick={() => setShowModal(false)} className="flex-1 p-2 border rounded text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                     <button onClick={handleCreate} className="flex-1 p-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition-colors">Salvar</button>
                 </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default ConsultorCredenciamento;
