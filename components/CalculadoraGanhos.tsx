
import React, { useState, useMemo } from 'react';
import { CreditCardIcon, FileTextIcon, HistoryIcon } from './ui/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

type Senioridade = 'Junior' | 'Pleno' | 'Senior';

const CalculadoraGanhos: React.FC = () => {
    const [config, setConfig] = useState({
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        senioridade: 'Junior' as Senioridade,
    });

    const [v1, setV1] = useState({ vendas_mes: 0 });
    const [v2, setV2] = useState({
        pf_18_29: 0,
        pf_30_plus: 0,
        pj_18_29: 0,
        pj_30_plus: 0,
    });

    // --- LÓGICA DE CÁLCULO DE INTEIROS ---
    const getBonusQuantidade = (qtd: number, senior: Senioridade): number => {
        if (qtd < 0) return 0;
        if (senior === 'Junior') {
            if (qtd < 6) return 0;
            if (qtd === 6) return 100;
            if (qtd === 7) return 120;
            if (qtd === 8) return 150;
            return getBonusQuantidade(qtd, 'Pleno'); // 9+ passa para pleno
        }
        if (senior === 'Pleno') {
            if (qtd < 9) return 0;
            if (qtd === 9) return 200;
            if (qtd === 10) return 220;
            if (qtd === 11) return 240;
            if (qtd === 12) return 260;
            if (qtd === 13) return 280;
            return 300; // 14+ mantém 300
        }
        if (senior === 'Senior') {
            if (qtd < 12) return 0;
            if (qtd === 12) return 350;
            if (qtd === 13) return 370;
            if (qtd === 14) return 390;
            if (qtd === 15) return 410;
            return 430; // 16+ mantém 430
        }
        return 0;
    };

    const results = useMemo(() => {
        const isSenior = config.senioridade === 'Senior';
        const prices = {
            pf_low: isSenior ? 80 : 50,
            pf_high: isSenior ? 150 : 100,
            pj_low: isSenior ? 250 : 200,
            pj_high: isSenior ? 400 : 300,
        };

        const bonusV1 = getBonusQuantidade(v1.vendas_mes, config.senioridade);
        const valPF18 = v2.pf_18_29 * prices.pf_low;
        const valPF30 = v2.pf_30_plus * prices.pf_high;
        const valPJ18 = v2.pj_18_29 * prices.pj_low;
        const valPJ30 = v2.pj_30_plus * prices.pj_high;

        return {
            bonusV1, valPF18, valPF30, valPJ18, valPJ30,
            bonusV2_Total: valPF18 + valPF30 + valPJ18 + valPJ30,
            totalGeral: bonusV1 + valPF18 + valPF30 + valPJ18 + valPJ30
        };
    }, [config.senioridade, v1, v2]);

    const chartData = useMemo(() => {
        return [
            { name: 'Vendas V1', value: results.bonusV1, count: v1.vendas_mes, color: '#1d4ed8' },
            { name: 'PF 18-29k', value: results.valPF18, count: v2.pf_18_29, color: '#059669' },
            { name: 'PF 30k+', value: results.valPF30, count: v2.pf_30_plus, color: '#047857' },
            { name: 'PJ 18-29k', value: results.valPJ18, count: v2.pj_18_29, color: '#4f46e5' },
            { name: 'PJ 30k+', value: results.valPJ30, count: v2.pj_30_plus, color: '#3730a3' },
        ].filter(d => d.value > 0 || d.count > 0);
    }, [results, v1, v2]);

    const updateInput = (setter: any, key: string, val: string) => {
        const intVal = Math.max(0, parseInt(val) || 0);
        setter((prev: any) => ({ ...prev, [key]: intVal }));
    };

    // Custom Tooltip para legibilidade máxima
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{data.name}</p>
                    <p className="text-white font-black text-xl mb-1">R$ {data.value}</p>
                    <p className="text-slate-400 font-black text-xs uppercase">{data.count} Máquinas</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-950 tracking-tighter">Calculadora de Ganhos</h1>
                    <p className="text-slate-900 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Simulação de Performance de Vendas</p>
                </div>
                <div className="flex gap-3">
                    <button className="bg-emerald-800 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg border-2 border-emerald-900 hover:bg-emerald-900 transition-all active:scale-95">EXCEL</button>
                    <button className="bg-slate-950 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg border-2 border-slate-900 hover:bg-black transition-all active:scale-95">PDF</button>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-950 uppercase tracking-widest">Mês de Referência</label>
                    <div className="flex gap-2">
                        <select className="w-full p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={config.mes} onChange={e => setConfig({...config, mes: parseInt(e.target.value)})}>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}</option>)}
                        </select>
                        <input type="number" className="w-28 p-4 border-2 border-slate-200 rounded-2xl font-black bg-slate-50 text-slate-950 outline-none focus:border-blue-700" value={config.ano} onChange={e => setConfig({...config, ano: parseInt(e.target.value)})} />
                    </div>
                </div>
                <div className="md:col-span-2 space-y-3">
                    <label className="block text-[10px] font-black text-slate-950 uppercase tracking-widest">Nível de Senioridade</label>
                    <div className="flex gap-3 p-2 bg-slate-100 rounded-2xl border-2 border-slate-200">
                        {(['Junior', 'Pleno', 'Senior'] as Senioridade[]).map(s => (
                            <button 
                                key={s} 
                                onClick={() => setConfig({...config, senioridade: s})}
                                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${config.senioridade === s ? 'bg-blue-700 text-white shadow-xl scale-[1.02]' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-950'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    {/* INPUTS V1 */}
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-200">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="w-4 h-8 bg-blue-700 rounded-full"></span>
                            <h2 className="text-[10px] font-black text-blue-900 uppercase tracking-[0.3em]">Volume Mensal (V1)</h2>
                        </div>
                        <div className="space-y-8">
                            <div>
                                <label className="block text-xs font-black text-slate-950 uppercase mb-4 tracking-tight">Quantidade Total de Máquinas Instaladas</label>
                                <input 
                                    type="number" 
                                    className="w-full p-8 border-2 border-slate-200 rounded-[2rem] font-black text-5xl bg-slate-50 text-blue-800 outline-none focus:border-blue-700 transition-all focus:ring-8 focus:ring-blue-50"
                                    value={v1.vendas_mes}
                                    onChange={e => updateInput(setV1, 'vendas_mes', e.target.value)}
                                />
                            </div>
                            <div className="p-8 bg-blue-50 rounded-[2rem] border-2 border-blue-200 flex justify-between items-center shadow-inner">
                                <span className="text-sm font-black text-blue-950 uppercase tracking-widest">Bônus V1 Calculado:</span>
                                <span className="text-4xl font-black text-blue-800 tracking-tighter">R$ {results.bonusV1}</span>
                            </div>
                        </div>
                    </div>

                    {/* INPUTS V2 */}
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border-2 border-slate-200">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="w-4 h-8 bg-emerald-700 rounded-full"></span>
                            <h2 className="text-[10px] font-black text-emerald-900 uppercase tracking-[0.3em]">Performance PF/PJ (V2)</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            {[
                                { id: 'pf_18_29', label: 'PF 18k - 29k', val: v2.pf_18_29, color: 'emerald' },
                                { id: 'pf_30_plus', label: 'PF 30k+', val: v2.pf_30_plus, color: 'emerald' },
                                { id: 'pj_18_29', label: 'PJ 18k - 29k', val: v2.pj_18_29, color: 'indigo' },
                                { id: 'pj_30_plus', label: 'PJ 30k+', val: v2.pj_30_plus, color: 'indigo' },
                            ].map(f => (
                                <div key={f.id} className="space-y-3">
                                    <label className="block text-[10px] font-black text-slate-950 uppercase tracking-widest">{f.label}</label>
                                    <input 
                                        type="number" 
                                        className={`w-full p-5 border-2 border-slate-200 rounded-2xl font-black text-2xl bg-slate-50 text-slate-900 outline-none focus:border-${f.color}-700 focus:ring-8 focus:ring-${f.color}-50 transition-all`}
                                        value={f.val} 
                                        onChange={e => updateInput(setV2, f.id, e.target.value)} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* RESULTADO FINAL */}
                    <div className="bg-slate-950 p-12 rounded-[3.5rem] shadow-2xl text-white border-4 border-slate-800 relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 mb-6">Projeção Total de Bônus</p>
                            <h3 className="text-8xl font-black tracking-tighter text-white">R$ {results.totalGeral}</h3>
                            <div className="mt-8 flex items-center gap-4">
                                <span className="bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full border border-blue-500/30 font-black text-[10px] uppercase tracking-widest">Nível: {config.senioridade}</span>
                                <span className="bg-slate-800 text-slate-400 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">{config.mes}/{config.ano}</span>
                            </div>
                        </div>
                        <HistoryIcon className="absolute -right-16 -bottom-16 w-80 h-80 opacity-5 rotate-12" />
                    </div>

                    {/* GRÁFICO DETALHADO */}
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border-2 border-slate-200">
                        <h2 className="text-[10px] font-black text-slate-950 mb-10 uppercase tracking-[0.3em] flex justify-between items-center">
                            Composição Analítica dos Ganhos
                            <span className="bg-slate-100 text-[8px] px-3 py-1 rounded-full text-slate-500 font-black tracking-tighter">Valores em Reais (R$)</span>
                        </h2>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="name" 
                                        tick={{fontSize: 9, fontWeight: '900', fill: '#0f172a'}} 
                                        axisLine={false} 
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis 
                                        tick={{fontSize: 9, fontWeight: '900', fill: '#64748b'}} 
                                        axisLine={false} 
                                        tickLine={false}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9', radius: 16}} />
                                    <Bar dataKey="value" radius={[14, 14, 0, 0]} barSize={44}>
                                        {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        <LabelList 
                                            dataKey="value" 
                                            position="top" 
                                            offset={12}
                                            style={{ fontSize: '10px', fontWeight: '900', fill: '#0f172a' }} 
                                            formatter={(v: number) => `R$ ${v}`} 
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-8 pt-8 border-t-2 border-slate-100 grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Subtotal Performance</p>
                                <p className="text-xl font-black text-emerald-700">R$ {results.bonusV2_Total}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Subtotal Quantidade</p>
                                <p className="text-xl font-black text-blue-700">R$ {results.bonusV1}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculadoraGanhos;
