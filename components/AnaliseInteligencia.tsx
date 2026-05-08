import { supabase } from '../supabase';
import { AppContext } from '../App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Target, Activity, Calendar } from 'lucide-react';
import { useContext } from 'react';

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
  
  const [inputs, setInputs] = useState<Record<string, InteligenciaInputs>>({});
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    fetchSupervisores();
  }, []);

  useEffect(() => {
    if (selectedSupervisor) {
      fetchDataForSupervisor(selectedSupervisor);
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

  const fetchDataForSupervisor = async (supervisorId: string) => {
    const { data } = await supabase.from('inteligencia_dados').select('*').eq('supervisor_id', supervisorId).single();
    if (data) {
        setInputs(prev => ({
            ...prev,
            [supervisorId]: {
                referencia: data.referencia,
                totalDiasUteis: data.total_dias_uteis,
                diasUteisDecorridos: data.dias_uteis_decorridos,
                headcount: data.headcount,
                faturamentoReal: data.faturamento_real,
                quantidadeVendas: data.quantidade_vendas,
                valorParcelado: data.valor_parcelado,
                quantidadeCNPJs: data.quantidade_cnpjs,
            }
        }));
    }
  };

  const saveAnaliseData = async () => {
    if (!selectedSupervisor) return;
    setIsSaving(true);
    const data = currentInputs;
    const { error } = await supabase.from('inteligencia_dados').upsert({ 
        supervisor_id: selectedSupervisor,
        referencia: data.referencia,
        total_dias_uteis: data.totalDiasUteis,
        dias_uteis_decorridos: data.diasUteisDecorridos,
        headcount: data.headcount,
        faturamento_real: data.faturamentoReal,
        quantidade_vendas: data.quantidadeVendas,
        valor_parcelado: data.valorParcelado,
        quantidade_cnpjs: data.quantidadeCNPJs,
    });
    setIsSaving(false);
    if (error) {
        alert("Erro ao salvar: " + error.message);
    } else {
        alert("Dados salvos com sucesso!");
    }
  };

  const currentInputs = useMemo(() => {
    return inputs[selectedSupervisor] || defaultInputs;
  }, [inputs, selectedSupervisor]);


  const calcularResultados = (inputData: InteligenciaInputs) => {
    const { totalDiasUteis, diasUteisDecorridos, headcount, faturamentoReal, quantidadeVendas } = inputData;
    if (diasUteisDecorridos === 0) return null;
    
    const projFaturamento = (faturamentoReal / diasUteisDecorridos) * totalDiasUteis;
    const produtividadeAtual = (quantidadeVendas / diasUteisDecorridos) / headcount;
    const metaVendas040 = 0.40 * totalDiasUteis * headcount;
    const diasRestantes = Math.max(1, totalDiasUteis - diasUteisDecorridos);
    const vendasFaltantes040 = Math.floor(Math.max(0, metaVendas040 - quantidadeVendas));
    const necessidadeDiaria040 = (vendasFaltantes040 / diasRestantes);

    return { projFaturamento, produtividadeAtual, metaVendas040, necessidadeDiaria040 };
  };

  const resultados = useMemo(() => {
    return calcularResultados(currentInputs);
  }, [currentInputs]);

  const updateInput = (key: keyof InteligenciaInputs, value: string | number) => {
    setInputs(prev => ({
        ...prev,
        [selectedSupervisor]: {
            ...(prev[selectedSupervisor] || defaultInputs),
            [key]: value
        }
    }));
  };

  const labels: Record<keyof InteligenciaInputs, string> = {
      referencia: 'Mês de Referência (YYYY-MM)',
      totalDiasUteis: 'Total de Dias Úteis',
      diasUteisDecorridos: 'Dias Úteis Decorridos',
      headcount: 'Headcount (Qtd. de consultores)',
      faturamentoReal: 'Faturamento Real Cumulado (R$)',
      quantidadeVendas: 'Quantidade de Vendas',
      valorParcelado: 'Valor Parcelado',
      quantidadeCNPJs: 'Quantidade de CNPJs',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Analista de Inteligência de Negócios</h1>
      
      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('registro')} className={`px-6 py-3 text-sm font-bold border-b-2 ${activeTab === 'registro' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Registro</button>
        {currentUser?.perfil === 'Administrador' && (
            <button onClick={() => setActiveTab('relatorios')} className={`px-6 py-3 text-sm font-bold border-b-2 ${activeTab === 'relatorios' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Relatório Consolidado</button>
        )}
      </div>

      {activeTab === 'registro' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            {currentUser?.perfil === 'Administrador' ? (
                <select 
                    value={selectedSupervisor} 
                    onChange={(e) => setSelectedSupervisor(e.target.value)} 
                    className="w-full p-3 mb-6 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Selecione uma equipe/supervisão</option>
                    {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
            ) : (
                <div className="w-full p-3 mb-6 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
                    Equipe: {supervisores.find(s => s.id === selectedSupervisor)?.nome || 'Minha Supervisão'}
                </div>
            )}
            {selectedSupervisor && (
                <>
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Parâmetros de Entrada</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(Object.keys(defaultInputs) as (keyof InteligenciaInputs)[]).map((key) => (
                        <div key={key}>
                        <label className="block text-xs font-semibold text-slate-700">{labels[key]}</label>
                        <input
                            type={key === 'referencia' ? 'text' : 'number'}
                            value={currentInputs[key]}
                            onChange={(e) => updateInput(key, key === 'referencia' ? e.target.value as any : Number(e.target.value))}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                        </div>
                    ))}
                    </div>
                <div className="mt-6">
                    <button 
                        onClick={saveAnaliseData}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:bg-slate-400"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Dados'}
                    </button>
                </div>
                </>
            )}
            {selectedSupervisor && resultados && (
                <div className="mt-10 pt-8 border-t border-slate-200">
                  <h2 className="text-xl font-black text-slate-800 tracking-tight mb-6">Dashboard de Desempenho</h2>
                  
                  {/* KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {/* Faturamento */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-bold text-slate-500 uppercase">Faturamento Real</p>
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                  <DollarSign size={16} strokeWidth={3} />
                              </div>
                          </div>
                          <div>
                              <p className="text-2xl font-black text-slate-900">{currentInputs.faturamentoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                              <p className="text-xs text-slate-500 mt-1">Projeção: {resultados.projFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                          </div>
                      </div>

                      {/* Vendas */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-bold text-slate-500 uppercase">Vendas Realizadas</p>
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                  <Target size={16} strokeWidth={3} />
                              </div>
                          </div>
                          <div>
                              <p className="text-2xl font-black text-slate-900">{currentInputs.quantidadeVendas}</p>
                              <p className="text-xs text-slate-500 mt-1">Meta Mínima (0.40): {Math.round(resultados.metaVendas040)}</p>
                          </div>
                      </div>

                      {/* Produtividade */}
                      <div className={`p-5 rounded-2xl border flex flex-col justify-between ${resultados.produtividadeAtual >= 0.40 ? 'bg-emerald-50 border-emerald-100' : resultados.produtividadeAtual >= 0.33 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                          <div className="flex items-center justify-between mb-4">
                              <p className={`text-sm font-bold uppercase ${resultados.produtividadeAtual >= 0.40 ? 'text-emerald-700' : resultados.produtividadeAtual >= 0.33 ? 'text-amber-700' : 'text-red-700'}`}>Produtividade</p>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${resultados.produtividadeAtual >= 0.40 ? 'bg-emerald-200 text-emerald-800' : resultados.produtividadeAtual >= 0.33 ? 'bg-amber-200 text-amber-800' : 'bg-red-200 text-red-800'}`}>
                                  <Activity size={16} strokeWidth={3} />
                              </div>
                          </div>
                          <div>
                              <p className={`text-2xl font-black ${resultados.produtividadeAtual >= 0.40 ? 'text-emerald-900' : resultados.produtividadeAtual >= 0.33 ? 'text-amber-900' : 'text-red-900'}`}>{resultados.produtividadeAtual.toFixed(2)}</p>
                              <p className={`text-xs mt-1 font-semibold ${resultados.produtividadeAtual >= 0.40 ? 'text-emerald-600' : resultados.produtividadeAtual >= 0.33 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {resultados.produtividadeAtual >= 0.40 ? 'Meta atingida!' : resultados.produtividadeAtual >= 0.33 ? 'Atenção: Próximo da zona de risco.' : 'ALERTA: Abaixo da meta!'}
                              </p>
                          </div>
                      </div>

                      {/* Ritmo / Necessidade Diária */}
                      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col justify-between text-white">
                          <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-bold text-slate-400 uppercase">Necessidade Diária</p>
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                                  <Calendar size={16} strokeWidth={3} />
                              </div>
                          </div>
                          <div>
                              <p className="text-2xl font-black">{resultados.necessidadeDiaria040.toFixed(1)} <span className="text-base font-medium text-slate-400">/dia</span></p>
                              <p className="text-xs text-slate-400 mt-1">Para bater a meta 0.40</p>
                          </div>
                      </div>
                  </div>

                  {/* Gráficos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                          <h3 className="text-sm font-bold text-slate-500 uppercase mb-6">Comparativo de Vendas</h3>
                          <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={[{ name: 'Vendas', Realizado: currentInputs.quantidadeVendas, Meta: Math.round(resultados.metaVendas040) }]}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                      <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                                      <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                                      <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                      <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                                      <Bar dataKey="Realizado" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                      <Bar dataKey="Meta" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                          <h3 className="text-sm font-bold text-slate-500 uppercase mb-6">Projeção de Faturamento</h3>
                          <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={[{ name: 'Faturamento', Realizado: currentInputs.faturamentoReal, Projetado: resultados.projFaturamento }]}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                      <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                                      <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`} />
                                      <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                                      <Legend iconType="circle" wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
                                      <Bar dataKey="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                      <Bar dataKey="Projetado" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  </div>
                </div>
            )}
        </div>
      ) : (
        (() => {
            const chartData = supervisores.map(s => {
                const data = inputs[s.id];
                const res = data ? calcularResultados(data) : null;
                return {
                    id: s.id,
                    name: s.nome,
                    Faturamento: data ? data.faturamentoReal : 0,
                    Vendas: data ? data.quantidadeVendas : 0,
                    Produtividade: res ? Number(res.produtividadeAtual.toFixed(2)) : 0
                };
            });

            const faturamentoTotal = chartData.reduce((acc, curr) => acc + curr.Faturamento, 0);
            const vendasTotais = chartData.reduce((acc, curr) => acc + curr.Vendas, 0);
            
            const timesPreenchidos = chartData.filter(c => c.Faturamento > 0 || c.Vendas > 0).length;
            const sumProd = chartData.reduce((acc, curr) => acc + curr.Produtividade, 0);
            const produtividadeMedia = timesPreenchidos > 0 ? sumProd / timesPreenchidos : 0;

            return (
                <div className="space-y-6">
                    {/* Resumo Global */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                            <p className="text-sm font-bold text-emerald-700 uppercase mb-1">Faturamento Total</p>
                            <p className="text-3xl font-black text-emerald-900">{faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 shadow-sm">
                            <p className="text-sm font-bold text-blue-700 uppercase mb-1">Vendas Totais</p>
                            <p className="text-3xl font-black text-blue-900">{vendasTotais}</p>
                        </div>
                        <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                            <p className="text-sm font-bold text-indigo-700 uppercase mb-1">Média de Produtividade</p>
                            <p className="text-3xl font-black text-indigo-900">{produtividadeMedia.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Gráficos de Ranking */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-6">Ranking: Produtividade</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                        <XAxis type="number" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                                        <YAxis dataKey="name" type="category" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                        <Bar dataKey="Produtividade" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-500 uppercase mb-6">Ranking: Faturamento</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                        <XAxis type="number" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
                                        <YAxis dataKey="name" type="category" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} width={80} />
                                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                                        <Bar dataKey="Faturamento" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Tabela Detalhada */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Tabela Detalhada</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Equipe</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Faturamento (Real)</th>
                                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Vendas</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Produtividade</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {chartData.map(c => (
                                        <tr key={c.id}>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{c.name}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{c.Faturamento > 0 ? c.Faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                            <td className="px-6 py-4 text-sm text-right text-slate-600">{c.Vendas > 0 ? c.Vendas : '-'}</td>
                                            <td className="px-6 py-4 text-center">
                                                {c.Produtividade > 0 ? (
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${c.Produtividade >= 0.40 ? 'bg-emerald-100 text-emerald-800' : c.Produtividade >= 0.33 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                                        {c.Produtividade.toFixed(2)}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        })()
      )}
    </div>
  );
};

export default AnaliseInteligencia;
