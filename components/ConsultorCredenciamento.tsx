
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

const WEEKS = [1, 2, 3, 4, 5];

const ConsultorCredenciamento: React.FC = () => {
  const context = useContext(AppContext);
  const currentUser = context?.currentUser;
  
  const [semana, setSemana] = useState(1);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [supervisorFiltro, setSupervisorFiltro] = useState('');
  const [data, setData] = useState<Credenciamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [consultores, setConsultores] = useState<{id: string, nome: string}[]>([]);
  const [newEntry, setNewEntry] = useState({ consultor_id: '', data: new Date().toISOString().split('T')[0], cpf: 0, cnpj: 0, visitas: 0 });
  
  // State for editing
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ cpf: 0, cnpj: 0, visitas: 0 });

  useEffect(() => {
    fetchData();
    fetchConsultores();
  }, [semana]);

  const fetchConsultores = async () => {
    let query = supabase.from('consultores').select('id, nome').eq('status', 'ativo');
    if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorId) {
        query = query.eq('supervisor_id', currentUser.supervisorId);
    }
    const { data } = await query;
    if(data) setConsultores(data);
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
        const matchData = dataFiltro ? d.data === dataFiltro : true;
        return matchName && matchSupervisor && matchData;
    });
  }, [data, searchTerm, supervisorFiltro, dataFiltro]);

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
           <input type="text" placeholder="ID Sup." value={supervisorFiltro} onChange={(e) => setSupervisorFiltro(e.target.value)} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500 w-24" />
           <input type="date" value={dataFiltro} onChange={(e) => setDataFiltro(e.target.value)} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500" />
           <select className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
               <option value="4">Abril/2026</option>
           </select>
           <select value={semana} onChange={(e) => setSemana(Number(e.target.value))} className="p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500">
               {WEEKS.map(w => <option key={w} value={w}>Semana {w}</option>)}
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
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
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                <Plus className="w-4 h-4"/> Novo Registro
            </button>
        </div>
        <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                    <th className="px-6 py-4">Consultor</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4 text-center">CPFs</th>
                    <th className="px-6 py-4 text-center">CNPJs</th>
                    <th className="px-6 py-4 text-center">Visitas</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                </tr>
            </thead>
            <tbody>
                {filteredData.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{d.consultores.nome}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(d.data).toLocaleDateString()}</td>
                        {editingCredId === d.id ? (
                            <>
                                <td className="px-6 py-4"><input type="number" className="p-1 w-16 border rounded" value={editValues.cpf} onChange={e => setEditValues({...editValues, cpf: Number(e.target.value)})} /></td>
                                <td className="px-6 py-4"><input type="number" className="p-1 w-16 border rounded" value={editValues.cnpj} onChange={e => setEditValues({...editValues, cnpj: Number(e.target.value)})} /></td>
                                <td className="px-6 py-4"><input type="number" className="p-1 w-16 border rounded" value={editValues.visitas} onChange={e => setEditValues({...editValues, visitas: Number(e.target.value)})} /></td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleUpdate(d.id)} className="text-emerald-600 font-bold">Salvar</button>
                                </td>
                            </>
                        ) : (
                            <>
                                <td className="px-6 py-4 text-center font-medium">{d.cpf_count}</td>
                                <td className="px-6 py-4 text-center font-medium">{d.cnpj_count}</td>
                                <td className="px-6 py-4 text-center font-medium">{d.visitas}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => { setEditingCredId(d.id); setEditValues({ cpf: d.cpf_count, cnpj: d.cnpj_count, visitas: d.visitas }); }} className="text-slate-500 hover:text-blue-600">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </>
                        )}
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
