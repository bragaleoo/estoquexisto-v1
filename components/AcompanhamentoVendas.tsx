import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';

interface Performance {
  id?: string;
  consultor_id: string;
  supervisor_id: string;
  data: string;
  vendas: number;
  visitas: number;
}

const AcompanhamentoVendas: React.FC = () => {
    const context = useContext(AppContext);
    const currentUser = context?.currentUser;
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [performance, setPerformance] = useState<Performance[]>([]);
    const [consultors, setConsultors] = useState<{id: string, nome: string}[]>([]); // Need to fetch consultors
    const [activeWeek, setActiveWeek] = useState(1);

    useEffect(() => {
        setConsultors([{ id: '1', nome: 'Consultor Teste' }]);
        fetchData();
    }, [month]);

    const fetchData = async () => {
        if (!currentUser) return;
        const { data } = await supabase
            .from('daily_performance')
            .select('*')
            .gte('data', `${month}-01`)
            .lte('data', `${month}-31`);
        if (data) setPerformance(data);
    };

    const handleUpdate = async (consultor_id: string, data: string, field: 'vendas' | 'visitas', value: number) => {
        const { error } = await supabase
            .from('daily_performance')
            .upsert({
                consultor_id,
                supervisor_id: currentUser?.id || '0',
                data,
                [field]: value
            }, { onConflict: 'consultor_id,data' });
        
        if (!error) fetchData();
    };

    const getWeeks = (monthStr: string) => {
        const [year, m] = monthStr.split('-').map(Number);
        const days = new Date(year, m, 0).getDate();
        const weeks = [];
        let week = [];
        for (let i = 1; i <= days; i++) {
            week.push(`${monthStr}-${String(i).padStart(2, '0')}`);
            if (week.length === 7 || i === days) {
                weeks.push(week);
                week = [];
            }
        }
        return weeks;
    };

    const weeks = getWeeks(month);
    const days = weeks[activeWeek - 1] || [];

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <header className="mb-8">
                <h1 className="text-2xl font-black text-slate-900">Acompanhamento de Vendas</h1>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gerencie a performance diária de consultores</p>
                <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setActiveWeek(1); }} className="mt-4 p-2.5 border border-slate-200 rounded-xl text-sm font-bold shadow-sm" />
            </header>

            <div className="flex gap-2 mb-6">
                {weeks.map((_, i) => (
                    <button key={i} onClick={() => setActiveWeek(i + 1)} className={`px-4 py-2 text-xs font-black rounded-lg transition-all ${activeWeek === i + 1 ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 hover:bg-slate-100'}`}>
                        Semana {i + 1}
                    </button>
                ))}
            </div>
            
            <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
                <table className="w-full divide-y divide-slate-100">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 sticky left-0 bg-slate-50 z-10 w-48">Consultor</th>
                            {days.map(d => (
                                <th colSpan={2} key={d} className="px-1 py-4 text-[9px] font-black text-slate-500 uppercase text-center border-b border-r">
                                    {parseInt(d.split('-')[2])}
                                    <div className="flex justify-between gap-1 mt-1 text-[8px] text-slate-400"><span>V</span><span>Vi</span></div>
                                </th>
                            ))}
                            <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase text-center">Resumo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {consultors.map(c => {
                            const weeklyVendas = days.reduce((acc, d) => acc + (performance.find(p => p.consultor_id === c.id && p.data === d)?.vendas || 0), 0);
                            const resumoColor = weeklyVendas >= 3 ? 'bg-green-500' : weeklyVendas === 2 ? 'bg-yellow-500' : 'bg-red-500';
                            
                            return (
                                <tr key={c.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-black text-sm text-slate-900 sticky left-0 bg-white z-10 border-r">{c.nome}</td>
                                    {days.map(d => {
                                        const p = performance.find(p => p.consultor_id === c.id && p.data === d) || { vendas: 0, visitas: 0 };
                                        const getBg = (v: number) => v >= 15 ? 'bg-green-50' : v >= 10 ? 'bg-yellow-50' : v < 10 ? 'bg-red-50' : 'bg-white';
                                        
                                        return (
                                        <td key={d} className={`px-1 py-2 ${getBg(p.visitas)} border-r`}>
                                                <div className="flex flex-col gap-0.5 w-14">
                                                    <input type="number" min="0" title="Vendas" value={p.vendas || ''} onChange={(e) => handleUpdate(c.id, d, 'vendas', parseInt(e.target.value))} className="w-full text-center text-[10px] font-bold bg-white/60 border border-slate-200 rounded px-0.5 py-0.5 focus:ring-1 focus:ring-slate-900 outline-none" />
                                                    <input type="number" min="0" title="Visitas" value={p.visitas || ''} onChange={(e) => handleUpdate(c.id, d, 'visitas', parseInt(e.target.value))} className="w-full text-center text-[10px] font-bold bg-white/60 border border-slate-200 rounded px-0.5 py-0.5 focus:ring-1 focus:ring-slate-900 outline-none" />
                                                </div>
                                            </td>
                                        )
                                    })}
                                    <td className="px-6 py-4 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black text-white ${resumoColor}`}>
                                            {weeklyVendas} Vendas
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AcompanhamentoVendas;
