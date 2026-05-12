import { supabase } from '../supabase';
import { AppContext } from '../App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, Target, Activity, Calendar, History, TrendingUp, ChevronRight, Save, Trash2 } from 'lucide-react';
import React, { useContext, useState, useEffect, useMemo } from 'react';

interface InteligenciaInputs {
  referencia: string;
  totalDiasUteis: number;
  diasUteisDecorridos: number;
  headcount: number;
  faturamentoReal: number;
  quantidadeVendas: number;
  valorParcelado: number;
  quantidadeCNPJs: number;
}

const AnaliseInteligencia: React.FC = () => {
  const context = useContext(AppContext);
  const currentUser = context?.currentUser;
  const [activeTab, setActiveTab] = useState<'registro' | 'relatorios'>('registro');
  const [supervisores, setSupervisores] = useState<{id: string, nome: string}[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  
  // Lista de todos os registros para o supervisor selecionado
  const [historicoSupervisor, setHistoricoSupervisor] = useState<InteligenciaInputs[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const defaultInputs: InteligenciaInputs = {
    referencia: new Date().toISOString().slice(0, 7), // YYYY-MM
    totalDiasUteis: 22,
    diasUteisDecorridos: 10,
    headcount: 5,
    faturamentoReal: 0,
    quantidadeVendas: 0,
    valorParcelado: 0,
    quantidadeCNPJs: 0,
  };

  const [formInputs, setFormInputs] = useState<InteligenciaInputs>(defaultInputs);

  useEffect(() => {
    fetchSupervisores();
  }, []);

  useEffect(() => {
    if (selectedSupervisor) {
      fetchHistorico(selectedSupervisor);
    }
  }, [selectedSupervisor]);

  const fetchSupervisores = async () => {
    let query = supabase.from('supervisores').select('id, nome');
    if (currentUser?.perfil === 'Supervisor' && currentUser?.supervisorUuid) {
        query = query.eq('id', currentUser.supervisorUuid);
    }
    const { data } = await query;
    if (data) {
        const formattedData = data.map(s => ({
            id: s.id,
            nome: s.nome.includes(' - ') ? s.nome.split(' - ')[1].trim() : s.nome
        }));
        setSupervisores(formattedData.sort((a, b) => a.nome.localeCompare(b.nome)));
        
        if (formattedData.length === 1 && !selectedSupervisor) {
            setSelectedSupervisor(formattedData[0].id);
        }
    }
  };

  const fetchHistorico = async (supervisorId: string) => {
    setIsLoading(true);
    const { data } = await supabase
        .from('inteligencia_dados')
        .select('*')
        .eq('supervisor_id', supervisorId)
        .order('referencia', { ascending: false });
    
    if (data) {
        const history = data.map(d => ({
            referencia: d.referencia,
            totalDiasUteis: d.total_dias_uteis,
            diasUteisDecorridos: d.dias_uteis_decorridos,
            headcount: d.headcount,
            faturamentoReal: d.faturamento_real,
            quantidadeVendas: d.quantidade_vendas,
            valorParcelado: d.valor_parcelado,
            quantidadeCNPJs: d.quantidade_cnpjs,
        }));
        setHistoricoSupervisor(history);
        
        // Se houver registro para o mês atual, carrega no form, senão usa default
        const mesAtual = new Date().toISOString().slice(0, 7);
        const registroMes = history.find(h => h.referencia === mesAtual);
        setFormInputs(registroMes || { ...defaultInputs, referencia: mesAtual });
    }
    setIsLoading(false);
  };

  const saveAnaliseData = async () => {
    if (!selectedSupervisor) return;
    setIsSaving(true);
    const { error } = await supabase.from('inteligencia_dados').upsert({ 
        supervisor_id: selectedSupervisor,
        referencia: formInputs.referencia,
        total_dias_uteis: formInputs.totalDiasUteis,
        dias_uteis_decorridos: formInputs.diasUteisDecorridos,
        headcount: formInputs.headcount,
        faturamento_real: formInputs.faturamentoReal,
        quantidade_vendas: formInputs.quantidadeVendas,
        valor_parcelado: formInputs.valorParcelado,
        quantidade_cnpjs: formInputs.quantidadeCNPJs,
    });
    
    if (!error) {
        await fetchHistorico(selectedSupervisor);
        alert("Dados salvos com sucesso!");
    } else {
        alert("Erro ao salvar: " + error.message);
    }
    setIsSaving(false);
  };

  const calcularResultados = (inputData: InteligenciaInputs) => {
    const { totalDiasUteis, diasUteisDecorridos, headcount, faturamentoReal, quantidadeVendas } = inputData;
    if (diasUteisDecorridos === 0 || headcount === 0) return null;
    
    const projFaturamento = (faturamentoReal / diasUteisDecorridos) * totalDiasUteis;
    const produtividadeAtual = (quantidadeVendas / diasUteisDecorridos) / headcount;
    const metaVendas040 = 0.40 * totalDiasUteis * headcount;
    const diasRestantes = Math.max(1, totalDiasUteis - diasUteisDecorridos);
    const vendasFaltantes040 = Math.floor(Math.max(0, metaVendas040 - quantidadeVendas));
    const necessidadeDiaria040 = (vendasFaltantes040 / diasRestantes);

    return { projFaturamento, produtividadeAtual, metaVendas040, necessidadeDiaria040 };
  };

  const resultados = useMemo(() => {
    return calcularResultados(formInputs);
  }, [formInputs]);

  const labels: Record<keyof InteligenciaInputs, string> = {
      referencia: 'Mês de Referência (YYYY-MM)',
      totalDiasUteis: 'Total de Dias Úteis',
      diasUteisDecorridos: 'Dias Úteis Decorridos',
      headcount: 'Headcount (Consultores)',
      faturamentoReal: 'Faturamento Real (R$)',
      quantidadeVendas: 'Qtd. Vendas',
      valorParcelado: 'Valor Parcelado',
      quantidadeCNPJs: 'Qtd. CNPJs',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <Activity className="text-indigo-600" size={32} />
                INTELIGÊNCIA DE NEGÓCIOS
            </h1>
            <p className="text-slate-500 font-medium mt-1">Análise de performance, projeções e metas por equipe.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button 
                onClick={() => setActiveTab('registro')} 
                className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'registro' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                Lançamentos
            </button>
            {currentUser?.perfil === 'Administrador' && (
                <button 
                    onClick={() => setActiveTab('relatorios')} 
                    className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'relatorios' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    Consolidado
                </button>
            )}
        </div>
      </div>

      {activeTab === 'registro' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Coluna de Registro (Esquerda) */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
                    <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                        <Calendar className="text-indigo-500" size={20} />
                        Parâmetros do Mês
                    </h2>

                    <div className="space-y-4">
                        {currentUser?.perfil === 'Administrador' && (
                            <div className="pb-4 border-b border-slate-100">
                                <label className="text-xs font-black text-slate-400 uppercase mb-2 block">Supervisor / Equipe</label>
                                <select 
                                    value={selectedSupervisor} 
                                    onChange={(e) => setSelectedSupervisor(e.target.value)} 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Selecione...</option>
                                    {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {Object.entries(labels).map(([key, label]) => (
                                <div key={key}>
                                    <label className="text-xs font-black text-slate-400 uppercase mb-1 block">{label}</label>
                                    <input
                                        type={key === 'referencia' ? 'text' : 'number'}
                                        value={formInputs[key as keyof InteligenciaInputs]}
                                        onChange={(e) => setFormInputs(prev => ({ ...prev, [key]: key === 'referencia' ? e.target.value : Number(e.target.value) }))}
                                        placeholder={key === 'referencia' ? 'YYYY-MM' : '0'}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none shadow-sm"
                                    />
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={saveAnaliseData}
                            disabled={isSaving || !selectedSupervisor}
                            className="w-full mt-4 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none"
                        >
                            {isSaving ? <Activity className="animate-spin" size={18} /> : <Save size={18} />}
                            {isSaving ? 'Gravando...' : 'Salvar Registro'}
                        </button>
                    </div>
                </div>

                {/* Histórico Simples */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <History size={16} />
                        Histórico Recente
                    </h3>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {historicoSupervisor.map((h, i) => (
                            <button 
                                key={i}
                                onClick={() => setFormInputs(h)}
                                className="w-full p-3 flex items-center justify-between bg-slate-50 hover:bg-indigo-50 rounded-xl transition-colors group"
                            >
                                <div className="text-left">
                                    <p className="text-sm font-bold text-slate-800">{h.referencia}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Faturamento: {h.faturamentoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                <ChevronRight className="text-slate-300 group-hover:text-indigo-500" size={16} />
                            </button>
                        ))}
                        {historicoSupervisor.length === 0 && (
                            <div className="py-8 text-center text-slate-400">
                                <p className="text-xs font-bold">Nenhum histórico encontrado.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Coluna de Visualização (Direita) */}
            <div className="lg:col-span-8 space-y-8">
                {selectedSupervisor && resultados ? (
                    <>
                        {/* KPI Cards Revisitados */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-indigo-200 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                        <DollarSign size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-slate-400 uppercase">Projeção Final</p>
                                        <p className="text-2xl font-black text-slate-900">{resultados.projFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                                        style={{ width: `${Math.min(100, (formInputs.faturamentoReal / resultados.projFaturamento) * 100)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase">Realizado: {formInputs.faturamentoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm group hover:border-indigo-200 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-2xl transition-all group-hover:text-white ${resultados.produtividadeAtual >= 0.40 ? 'bg-indigo-100 text-indigo-600 group-hover:bg-indigo-500' : 'bg-amber-100 text-amber-600 group-hover:bg-amber-500'}`}>
                                        <Activity size={24} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-slate-400 uppercase">Produtividade Atual</p>
                                        <p className="text-3xl font-black text-slate-900">{resultados.produtividadeAtual.toFixed(2)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${resultados.produtividadeAtual >= 0.40 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {resultados.produtividadeAtual >= 0.40 ? 'Meta Superada' : 'Abaixo da Meta (0.40)'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Cards Secundários */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="bg-slate-900 p-6 rounded-3xl shadow-xl text-white">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-white/10 rounded-2xl">
                                        <Target className="text-indigo-400" size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase">Meta de Vendas (Mín.)</p>
                                        <p className="text-2xl font-black">{Math.round(resultados.metaVendas040)} <span className="text-xs text-slate-500 font-bold uppercase ml-1">Para o mês</span></p>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-white/10">
                                    <p className="text-xs font-bold text-slate-400 uppercase flex items-center justify-between">
                                        Faltam: 
                                        <span className="text-indigo-400 text-sm">{Math.max(0, Math.round(resultados.metaVendas040) - formInputs.quantidadeVendas)} vendas</span>
                                    </p>
                                </div>
                            </div>

                            <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl text-white">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-3 bg-white/10 rounded-2xl">
                                        <TrendingUp className="text-white" size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-indigo-200 uppercase">Necessidade Diária</p>
                                        <p className="text-2xl font-black">{resultados.necessidadeDiaria040.toFixed(1)} <span className="text-sm font-medium opacity-50">/dia</span></p>
                                    </div>
                                </div>
                                <p className="text-[10px] font-bold text-indigo-100 uppercase mt-2">Ritmo necessário nos próximos {formInputs.totalDiasUteis - formInputs.diasUteisDecorridos} dias úteis.</p>
                            </div>
                        </div>

                        {/* Gráfico Principal */}
                        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">Evolução do Faturamento vs Projeção</h3>
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[{ name: formInputs.referencia, Real: formInputs.faturamentoReal, Proj: resultados.projFaturamento }]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} />
                                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 700}} tickFormatter={(val) => `R$ ${val/1000}k`} />
                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                                        <Bar dataKey="Real" fill="#4f46e5" radius={[12, 12, 12, 12]} maxBarSize={60} />
                                        <Bar dataKey="Proj" fill="#e2e8f0" radius={[12, 12, 12, 12]} maxBarSize={60} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <Activity className="text-slate-300" size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase">Aguardando Seleção</h3>
                        <p className="text-slate-400 font-medium max-w-xs mt-2">Selecione uma equipe ao lado para visualizar as métricas de inteligência e projeções.</p>
                    </div>
                )}
            </div>
        </div>
      ) : (
        /* ABA DE RELATÓRIO CONSOLIDADO */
        <RelatorioConsolidado 
            supervisores={supervisores} 
            calcularResultados={calcularResultados}
        />
      )}
    </div>
  );
};

/* Componente Interno para o Relatório Consolidado */
const RelatorioConsolidado: React.FC<{
    supervisores: {id: string, nome: string}[], 
    calcularResultados: (data: InteligenciaInputs) => any
}> = ({ supervisores, calcularResultados }) => {
    const [allData, setAllData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        fetchGlobalData();
    }, []);

    const fetchGlobalData = async () => {
        const { data } = await supabase.from('inteligencia_dados').select('*').order('referencia', { ascending: false });
        if (data) {
            setAllData(data);
        }
        setLoading(false);
    };

    const filteredRecords = useMemo(() => {
        return allData.filter(d => d.referencia === filtroMes);
    }, [allData, filtroMes]);

    const stats = useMemo(() => {
        const faturamento = filteredRecords.reduce((acc, curr) => acc + curr.faturamento_real, 0);
        const vendas = filteredRecords.reduce((acc, curr) => acc + curr.quantidade_vendas, 0);
        const prodMedia = filteredRecords.length > 0 
            ? filteredRecords.reduce((acc, curr) => acc + (curr.quantidade_vendas / (curr.dias_uteis_decorridos || 1) / (curr.headcount || 1)), 0) / filteredRecords.length 
            : 0;
        return { faturamento, vendas, prodMedia };
    }, [filteredRecords]);

    // Meses disponíveis no banco para o filtro
    const mesesDisponiveis = Array.from(new Set(allData.map(d => d.referencia))).sort((a, b) => (b as string).localeCompare(a as string));

    if (loading) return <div className="text-center py-20 font-black text-slate-400 animate-pulse">CARREGANDO DADOS...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filtros de topo */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-black text-slate-400 uppercase ml-2">Filtrar por Mês:</p>
                <select 
                    value={filtroMes} 
                    onChange={(e) => setFiltroMes(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none"
                >
                    {mesesDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                    {!mesesDisponiveis.includes(new Date().toISOString().slice(0, 7)) && (
                        <option value={new Date().toISOString().slice(0, 7)}>{new Date().toISOString().slice(0, 7)}</option>
                    )}
                </select>
            </div>

            {/* Resumo Global */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Faturamento Global</p>
                    <p className="text-3xl font-black text-emerald-600">{stats.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Vendas Totais</p>
                    <p className="text-3xl font-black text-indigo-600">{stats.vendas}</p>
                </div>
                <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Produtividade Média</p>
                    <p className="text-3xl font-black text-slate-900">{stats.prodMedia.toFixed(2)}</p>
                </div>
            </div>

            {/* Ranking Visual */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">Performance por Equipe ({filtroMes})</h3>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredRecords.map(d => ({ 
                            name: supervisores.find(s => s.id === d.supervisor_id)?.nome || 'Unknown', 
                            prod: (d.quantidade_vendas / (d.dias_uteis_decorridos || 1) / (d.headcount || 1)) 
                        })).sort((a, b) => b.prod - a.prod)}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} interval={0} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                            <Bar dataKey="prod" radius={[8, 8, 8, 8]}>
                                {filteredRecords.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={(entry.quantidade_vendas / (entry.dias_uteis_decorridos || 1) / (entry.headcount || 1)) >= 0.40 ? '#4f46e5' : '#fbbf24'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Tabela de Dados */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Equipe / Supervisor</th>
                            <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Referência</th>
                            <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Faturamento</th>
                            <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Vendas</th>
                            <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Produtividade</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRecords.map((d, i) => {
                            const prod = (d.quantidade_vendas / (d.dias_uteis_decorridos || 1) / (d.headcount || 1));
                            const supNome = supervisores.find(s => s.id === d.supervisor_id)?.nome || 'Unknown';
                            return (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-5 font-bold text-slate-900 text-sm">{supNome}</td>
                                    <td className="p-5 text-center text-slate-500 font-bold text-xs">{d.referencia}</td>
                                    <td className="p-5 text-right font-black text-slate-900 text-sm">{d.faturamento_real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    <td className="p-5 text-right font-black text-slate-900 text-sm">{d.quantidade_vendas}</td>
                                    <td className="p-5 text-center">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black ${prod >= 0.40 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {prod.toFixed(2)}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AnaliseInteligencia;
