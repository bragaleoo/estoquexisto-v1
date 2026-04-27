
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';
import { LayoutGrid, Filter, Search, TrendingUp, Users, Target } from 'lucide-react';

interface Credenciamento {
  id: string;
  consultor_id: string;
  consultores: { nome: string }; // Join
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
  const [data, setData] = useState<Credenciamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, [semana]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Query: buscar credenciamentos e join com consultores
      let query = supabase
        .from('credenciamentos')
        .select(`
            id,
            consultor_id,
            data,
            cpf_count,
            cnpj_count,
            visitas,
            consultores:consultor_id (nome, supervisor_id)
        `);

      // Se não for administrador, filtrar credenciamentos de consultores do supervisor
      if (currentUser?.perfil !== 'Administrador' && currentUser?.supervisorId) {
        query = query.eq('consultores.supervisor_id', currentUser.supervisorId);
      }
      
      // TODO: Filtrar por semana (precisa saber como a semana é definida na coluna 'data')
      // Por enquanto, apenas fetch de tudo e filtraremos se necessário
      
      const { data: creds, error } = await query;
      if (error) throw error;
      
      // Filtro manual se necessário (ajuste conforme regra de negócio)
      setData(creds as unknown as Credenciamento[]);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(d => 
        d.consultores.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

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
        </div>
        <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                    <th className="px-6 py-4">Consultor</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4 text-center">CPFs</th>
                    <th className="px-6 py-4 text-center">CNPJs</th>
                    <th className="px-6 py-4 text-center">Visitas</th>
                </tr>
            </thead>
            <tbody>
                {filteredData.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4 font-semibold text-slate-900">{d.consultores.nome}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(d.data).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-center font-medium">{d.cpf_count}</td>
                        <td className="px-6 py-4 text-center font-medium">{d.cnpj_count}</td>
                        <td className="px-6 py-4 text-center font-medium">{d.visitas}</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConsultorCredenciamento;
