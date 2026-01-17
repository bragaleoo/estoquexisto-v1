
import React, { useContext, useMemo } from 'react';
import { AppContext } from '../App';
import Card from './ui/Card';
import { CreditCardIcon, CheckCircleIcon, ListIcon } from './ui/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SUPERVISORES } from '../constants';

const Dashboard: React.FC = () => {
  const context = useContext(AppContext);

  if (!context) return null;
  const { maquinas, pedidos } = context;

  // Cálculo de Estoque por Região com nova lógica: Atribuídas + Disponíveis
  const regionalStats = useMemo(() => {
    let sergipe = 0;
    let alagoas = 0;
    let central = 0;

    maquinas.forEach(m => {
        // Ignora baixadas (vendas/devoluções finalizadas)
        if (m.status_estoque === 'BAIXADA') return;

        const pedido = pedidos.find(p => p.id === m.pedido_id);
        const regiao = pedido?.regiao;

        // Lógica de Região Baseada no Pedido (Lote)
        if (regiao === 'SERGIPE') {
            sergipe++;
        } else if (regiao === 'ALAGOAS') {
            alagoas++;
        }

        // Lógica de Estoque Central (Tudo que está disponível, independente de região)
        if (m.status_estoque === 'DISPONIVEL') {
            central++;
        }
    });

    return { sergipe, alagoas, central };
  }, [maquinas, pedidos]);

  const dadosGrafico = useMemo(() => [
    { name: 'Sergipe', quantidade: regionalStats.sergipe, color: '#1d4ed8' },
    { name: 'Alagoas', quantidade: regionalStats.alagoas, color: '#047857' },
    { name: 'Central', quantidade: regionalStats.central, color: '#64748b' },
  ], [regionalStats]);

  return (
    <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col">
        <h1 className="text-4xl font-black text-slate-950 tracking-tighter">Painel de Controle</h1>
        <p className="text-slate-900 font-bold uppercase text-[10px] tracking-[0.3em] mt-1">Status Operacional do Inventário em Tempo Real</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Distribuição Regional Atualizada */}
        <Card 
          title="Disponível Sergipe"
          value={regionalStats.sergipe}
          icon={<CreditCardIcon className="w-8 h-8 text-white" />}
          color="bg-blue-700 shadow-xl shadow-blue-200"
        />
        <Card 
          title="Disponível Alagoas"
          value={regionalStats.alagoas}
          icon={<CreditCardIcon className="w-8 h-8 text-white" />}
          color="bg-emerald-700 shadow-xl shadow-emerald-200"
        />
        <Card 
          title="Estoque Central"
          value={regionalStats.central}
          icon={<CreditCardIcon className="w-8 h-8 text-white" />}
          color="bg-slate-500 shadow-xl shadow-slate-200"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico Regional */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-200">
          <h2 className="text-[10px] font-black text-slate-950 mb-10 uppercase tracking-[0.3em] flex items-center gap-3">
              <span className="w-2 h-6 bg-blue-700 rounded-full"></span>
              Distribuição de Ativos por Região
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 11, fontWeight: '900', fill: '#0f172a' }} 
                        axisLine={false} 
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis 
                        tick={{ fontSize: 10, fontWeight: '900', fill: '#64748b' }} 
                        axisLine={false} 
                        tickLine={false}
                    />
                    <Tooltip 
                        cursor={{ fill: '#f8fafc' }} 
                        contentStyle={{ borderRadius: '16px', border: 'none', fontWeight: '900', color: '#0f172a', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Bar dataKey="quantidade" radius={[10, 10, 0, 0]} barSize={60}>
                        {dadosGrafico.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Atividades Recentes */}
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
