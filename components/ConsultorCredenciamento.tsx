
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';
import { LayoutGrid, Filter, Search, TrendingUp, Users, Target, Edit2, Plus } from 'lucide-react';

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
  const weeks = useMemo(() => getWeeks(ano, mes), [ano, mes]);
  const context = useContext(AppContext);
  const currentUser = context?.currentUser;
  const [supervisorFiltro, setSupervisorFiltro] = useState('');
  const [data, setData] = useState<Credenciamento[]>([]);
  const [supervisores, setSupervisores] = useState<{id: string, nome: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [consultores, setConsultores] = useState<{id: string, nome: string, supervisor_id: string}[]>([]);
  const [dailyData, setDailyData] = useState<Record<string, Record<number, { cpf: number, cnpj: number, visitas: number }>>>({});
  const [newEntry, setNewEntry] = useState({ consultor_id: '', data: new Date().toISOString().split('T')[0], cpf: 0, cnpj: 0, visitas: 0 });
  
  // State for editing
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ cpf: 0, cnpj: 0, visitas: 0 });

  useEffect(() => {
    const newDailyData: Record<string, Record<number, { cpf: number, cnpj: number, visitas: number }>> = {};
    data.forEach(cred => {
      const d = new Date(cred.data);
      if (d.getMonth() + 1 === mes && d.getFullYear() === ano) {
        const dayOfMonth = d.getDate();
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

  const handleSaveRow = async (consultorId: string, week: number) => {
    const datesToSave = weeks[week - 1]?.days;
    if (!datesToSave) return;
    
    for (const dateObj of datesToSave) {
        const day = dateObj.getDate();
        const values = dailyData[consultorId]?.[day];
        if (!values || (values.cpf === 0 && values.cnpj === 0 && values.visitas === 0)) continue;
        
        const date = dateObj.toISOString().split('T')[0];

        // Check if record exists
        const { data: existingData } = await supabase
            .from('credenciamentos')
            .select('id')
            .eq('consultor_id', consultorId)
            .eq('data', date);

        let error;
        if (existingData && existingData.length > 0) {
            // Update
            const res = await supabase.from('credenciamentos').update({
                cpf_count: values.cpf,
                cnpj_count: values.cnpj,
                visitas: values.visitas
            }).eq('id', existingData[0].id);
            error = res.error;
        } else {
            // Insert
            const res = await supabase.from('credenciamentos').insert({
                consultor_id: consultorId,
                data: date,
                cpf_count: values.cpf,
                cnpj_count: values.cnpj,
                visitas: values.visitas
            });
            error = res.error;
        }
        
        if (error) console.error('Erro ao salvar:', error);
    }
    alert('Salvo com sucesso!');
    fetchData(); // Refresh data to reflect changes
  };

  useEffect(() => {
    fetchData();
    fetchConsultores();
    fetchSupervisores();
  }, [semana]);

  const fetchSupervisores = async () => {
    const { data } = await supabase.from('supervisores').select('id, nome');
    if(data) setSupervisores(data);
  };

  const fetchConsultores = async () => {
    let query = supabase.from('consultores').select('id, nome, supervisor_id').eq('status', 'ativo');
    if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorId) {
        query = query.eq('supervisor_id', currentUser.supervisorId);
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
            consultores:consultor_id!inner (nome, supervisor_id, status)
        `);

      if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorId) {
        query = query.eq('consultores.supervisor_id', currentUser.supervisorId);
      }
      
      const { data: creds, error } = await query;
      if (error) throw error;
      
      // Filtragem manual para garantir apenas consultores ativos
      setData((creds as any[] || []).filter(c => c.consultores?.status === 'ativo'));
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
      const { error } = await supabase
        .from('credenciamentos')
        .update({
            cpf_count: editValues.cpf,
            cnpj_count: editValues.cnpj,
            visitas: editValues.visitas
        })
        .eq('id', id);
        
      if (error) {
          console.error('Erro ao atualizar:', error);
      } else {
          setEditingCredId(null);
          fetchData();
      }
  };

  const filteredData = useMemo(() => {
    return data.filter(d => {
        const matchName = d.consultores.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchSupervisor = supervisorFiltro ? d.consultores.supervisor_id === supervisorFiltro : true;
        const dDate = new Date(d.data);
        const matchMes = dDate.getMonth() + 1 === mes;
        const matchAno = dDate.getFullYear() === ano;
        return matchName && matchSupervisor && matchMes && matchAno;
    });
  }, [data, searchTerm, supervisorFiltro, mes, ano]);

  const filteredConsultores = useMemo(() => {
    return consultores.filter(c => {
        const matchName = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchSupervisor = supervisorFiltro ? c.supervisor_id === supervisorFiltro : true;
        return matchName && matchSupervisor;
    });
  }, [consultores, searchTerm, supervisorFiltro]);

  const stats = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
        cpf: acc.cpf + (curr.cpf_count || 0),
        cnpj: acc.cnpj + (curr.cnpj_count || 0),
        visitas: acc.visitas + (curr.visitas || 0)
    }), { cpf: 0, cnpj: 0, visitas: 0 });
  }, [filteredData]);

  if(loading) return <div className="p-10 text-center">Carregando painel de credenciamentos...</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Credenciamentos</h1>
            <p className="text-slate-500 mt-1">Acompanhamento de performance operacional</p>
        </div>
          <div className="flex items-center space-x-4">
             <button onClick={async () => {
                 if (confirm('Tem certeza que deseja zerar todos os dados?')) {
                     const { error } = await supabase.from('credenciamentos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                     if (error) alert('Erro ao zerar dados');                
                     else { alert('Dados zerados!'); fetchData(); }
                 }
             }} className="p-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-red-700">Zerar Dados</button>
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
          </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
            { label: 'Total CPFs', value: stats.cpf, icon: Users, color: 'text-blue-600' },
            { label: 'Total CNPJs', value: stats.cnpj, icon: Target, color: 'text-indigo-600' },
            { label: 'Total Visitas', value: stats.visitas, icon: TrendingUp, color: 'text-emerald-600' },
        ].map(stat => (
            <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl bg-slate-100 ${stat.color}`}>
                        <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Relatório de Performance (KPIs)</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             {filteredConsultores.map(c => {
                 const consultantDaily = dailyData[c.id] || {};
                 const totalCPFs = Object.values(consultantDaily).reduce((sum, day) => sum + day.cpf, 0);
                 const totalCNPJs = Object.values(consultantDaily).reduce((sum, day) => sum + day.cnpj, 0);
                 const totalVisitas = Object.values(consultantDaily).reduce((sum, day) => sum + day.visitas, 0);
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
                                 <p className="font-bold text-emerald-600">{totalVisitas}</p>
                                 <p className="text-[10px] text-slate-500">Visitas</p>
                             </div>
                             <div className="text-xs">
                                 <p className="font-bold text-indigo-600">{totalCred}</p>
                                 <p className="text-[10px] text-slate-500">Total Cred</p>
                             </div>
                             <div className="text-xs">
                                 <p className="font-bold text-indigo-600">{percPJ}%</p>
                                 <p className="text-[10px] text-slate-500">% PJ</p>
                             </div>
                         </div>
                     </div>
                 );
             })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <div className="flex gap-4 w-full">
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
              <select value={supervisorFiltro} onChange={(e) => setSupervisorFiltro(e.target.value)} className="p-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
                 <option value="">Todas Supervisões</option>
                 {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
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
                </tr>
            </thead>
            <tbody>
                        {/* Consultores */}
                        {filteredConsultores.map(c => (
                            <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-6 py-4 font-semibold text-slate-900">{c.nome}</td>
                                {weeks[semana - 1]?.days.map((date, i) => {
                                    const day = date.getDate();
                                    return (
                                        <td key={i} className="px-1 py-4 text-center">
                                            <div className="flex gap-0.5 justify-center">
                                                <input type="number" min="0" className="w-10 p-1 border rounded text-center text-xs" placeholder="PF" value={dailyData[c.id]?.[day]?.cpf || ''} onChange={e => handleInputChange(c.id, day, 'cpf', Number(e.target.value))} />
                                                <input type="number" min="0" className="w-10 p-1 border rounded text-center text-xs" placeholder="PJ" value={dailyData[c.id]?.[day]?.cnpj || ''} onChange={e => handleInputChange(c.id, day, 'cnpj', Number(e.target.value))} />
                                                <input type="number" min="0" className="w-10 p-1 border rounded text-center text-xs" placeholder="Vis" value={dailyData[c.id]?.[day]?.visitas || ''} onChange={e => handleInputChange(c.id, day, 'visitas', Number(e.target.value))} />
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="px-2 py-4">
                                    <button onClick={() => handleSaveRow(c.id, semana)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Salvar</button>
                                </td>
                            </tr>
                        ))}
            </tbody>
        </table>
      </div>

       {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl w-full max-w-md">
                 <h2 className="text-xl font-bold mb-4">Novo Registro</h2>
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Consultor</label>
                 <select className="w-full p-2 border rounded mb-3" value={newEntry.consultor_id} onChange={e => setNewEntry({...newEntry, consultor_id: e.target.value})}>
                     <option value="">Selecione o consultor</option>
                     {consultores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                 </select>
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Data</label>
                 <input type="date" className="w-full p-2 border rounded mb-3" value={newEntry.data} onChange={e => setNewEntry({...newEntry, data: e.target.value})} />
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Total CPFs</label>
                 <input type="number" min="0" placeholder="CPFs" className="w-full p-2 border rounded mb-3" value={newEntry.cpf} onChange={e => setNewEntry({...newEntry, cpf: Math.max(0, Number(e.target.value))})} />
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Total CNPJs</label>
                 <input type="number" min="0" placeholder="CNPJs" className="w-full p-2 border rounded mb-3" value={newEntry.cnpj} onChange={e => setNewEntry({...newEntry, cnpj: Math.max(0, Number(e.target.value))})} />
                 
                 <label className="block text-sm font-medium text-slate-700 mb-1">Total Visitas</label>
                 <input type="number" min="0" placeholder="Visitas" className="w-full p-2 border rounded mb-3" value={newEntry.visitas} onChange={e => setNewEntry({...newEntry, visitas: Math.max(0, Number(e.target.value))})} />
                 
                 <div className="flex gap-2 mt-4">
                     <button onClick={() => setShowModal(false)} className="flex-1 p-2 border rounded">Cancelar</button>
                     <button onClick={handleCreate} className="flex-1 p-2 bg-blue-600 text-white rounded font-bold">Salvar</button>
                 </div>
              </div>
          </div>
       )}
    </div>
  );
};

export default ConsultorCredenciamento;
