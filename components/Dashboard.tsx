
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../App';
import Card from './ui/Card';
import { CreditCardIcon, CheckCircleIcon, ListIcon } from './ui/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const context = useContext(AppContext);

  if (!context) return null;
  const { maquinas, pedidos } = context;

  const stats = useMemo(() => {
    return {
      totalMaquinas: maquinas.length,
      totalPedidos: pedidos.length,
      pedidosCompletos: pedidos.filter(p => p.status_importacao === 'COMPLETA').length,
    };
  }, [maquinas, pedidos]);

  const progressoPedidos = useMemo(() => {
    return pedidos.slice(0, 5).map(p => ({
        name: p.codigo_pedido,
        Importado: p.qtd_importada,
        Restante: p.qtd_esperada ? Math.max(0, p.qtd_esperada - p.qtd_importada) : 0
    }));
  }, [pedidos]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col">
        <h1 className="text-4xl font-black text-slate-950 tracking-tighter">Painel de Controle</h1>
        <p className="text-slate-900 font-bold uppercase text-[10px] tracking-[0.3em] mt-1">Status Operacional do Inventário em Tempo Real</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card 
          title="Total de Máquinas"
          value={stats.totalMaquinas}
          icon={<CreditCardIcon className="w-8 h-8 text-white" />}
          color="bg-blue-700 shadow-xl shadow-blue-200"
        />
        <Card 
          title="Lotes Importados"
          value={stats.totalPedidos}
          icon={<ListIcon className="w-8 h-8 text-white" />}
          color="bg-indigo-800 shadow-xl shadow-indigo-200"
        />
        <Card 
          title="Lotes Finalizados"
          value={stats.pedidosCompletos}
          icon={<CheckCircleIcon className="w-8 h-8 text-white" />}
          color="bg-emerald-700 shadow-xl shadow-emerald-200"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-200">
          <h2 className="text-[10px] font-black text-slate-950 mb-10 uppercase tracking-[0.3em] flex items-center gap-3">
              <span className="w-2 h-6 bg-blue-700 rounded-full"></span>
              Progresso de Importação (Top 5)
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressoPedidos} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="4 4" horizontal={true} vertical={false} stroke="#e2e8f0" />
                <XAxis type="number" hide />
                <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100} 
                    tick={{ fontSize: 11, fontWeight: '900', fill: '#0f172a' }} 
                    axisLine={false} 
                    tickLine={false}
                />
                <Tooltip 
                    cursor={{ fill: '#f1f5f9' }} 
                    contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: '900', color: '#0f172a', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontWeight: '900', paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                <Bar dataKey="Importado" stackId="a" fill="#1d4ed8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Restante" stackId="a" fill="#e2e8f0" radius={[0, 8, 8, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-200">
          <h2 className="text-[10px] font-black text-slate-950 mb-10 uppercase tracking-[0.3em] flex items-center gap-3">
               <span className="w-2 h-6 bg-emerald-700 rounded-full"></span>
               Últimas Atividades de Lote
          </h2>
          <div className="space-y-6">
              {pedidos.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-blue-400 hover:bg-white transition-all group">
                      <div>
                          <p className="font-mono font-black text-blue-800 text-lg tracking-tighter leading-none">{p.codigo_pedido}</p>
                          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-2">{new Date(p.criado_em).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                          <p className="text-lg font-black text-slate-950 tracking-tight">{p.qtd_importada} un.</p>
                          <p className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border-2 mt-2 inline-block ${
                              p.status_importacao === 'COMPLETA' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : 'bg-amber-100 text-amber-950 border-amber-300'
                          }`}>
                            {p.status_importacao}
                          </p>
                      </div>
                  </div>
              ))}
              {pedidos.length === 0 && (
                  <div className="text-center py-20 font-black text-slate-400 italic uppercase text-xs tracking-widest">Inicie uma nova importação para ver dados aqui.</div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
