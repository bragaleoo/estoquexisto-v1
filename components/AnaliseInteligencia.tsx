import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';

interface InteligenciaInputs {
  totalDiasUteis: number;
  diasUteisDecorridos: number;
  headcount: number;
  faturamentoReal: number;
  quantidadeVendas: number;
  valorParcelado: number;
  quantidadeCNPJs: number;
}

const AnaliseInteligencia: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registro' | 'relatorios'>('registro');
  const [supervisores, setSupervisores] = useState<{id: string, nome: string}[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
  
  const [inputs, setInputs] = useState<Record<string, InteligenciaInputs>>({});
  const [isSaving, setIsSaving] = useState(false);
  const defaultInputs: InteligenciaInputs = {
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
    const { data } = await supabase.from('supervisores').select('id, nome');
    if(data) setSupervisores(data.sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const fetchDataForSupervisor = async (supervisorId: string) => {
    const { data } = await supabase.from('inteligencia_dados').select('*').eq('supervisor_id', supervisorId).single();
    if (data) {
        setInputs(prev => ({
            ...prev,
            [supervisorId]: {
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

  const updateInput = (key: keyof InteligenciaInputs, value: number) => {
    setInputs(prev => ({
        ...prev,
        [selectedSupervisor]: {
            ...(prev[selectedSupervisor] || defaultInputs),
            [key]: value
        }
    }));
  };

  const labels: Record<keyof InteligenciaInputs, string> = {
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
        <button onClick={() => setActiveTab('relatorios')} className={`px-6 py-3 text-sm font-bold border-b-2 ${activeTab === 'relatorios' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Relatório Consolidado</button>
      </div>

      {activeTab === 'registro' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <select 
                value={selectedSupervisor} 
                onChange={(e) => setSelectedSupervisor(e.target.value)} 
                className="w-full p-3 mb-6 bg-white border border-slate-300 rounded-lg text-sm font-semibold shadow-sm focus:ring-2 focus:ring-blue-500"
            >
                 <option value="">Selecione uma equipe/supervisão</option>
                 {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            {selectedSupervisor && (
                <>
                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Parâmetros de Entrada</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(Object.keys(defaultInputs) as (keyof InteligenciaInputs)[]).map((key) => (
                        <div key={key}>
                        <label className="block text-xs font-semibold text-slate-700">{labels[key]}</label>
                        <input
                            type="number"
                            value={currentInputs[key]}
                            onChange={(e) => updateInput(key, Number(e.target.value))}
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
                <div className="mt-8 pt-6 border-t border-slate-200">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Relatório de Desempenho</h2>
                
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Métrica</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Real</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Projetado/Meta</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                    <tr>
                        <td className="px-6 py-4 text-xs">Faturamento</td>
                        <td className="px-6 py-4 text-xs text-right">{currentInputs.faturamentoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td className="px-6 py-4 text-xs text-right font-bold">{resultados.projFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                    <tr>
                        <td className="px-6 py-4 text-xs">Vendas (Meta 0.40)</td>
                        <td className="px-6 py-4 text-xs text-right">{currentInputs.quantidadeVendas}</td>
                        <td className="px-6 py-4 text-xs text-right font-bold">{Math.round(resultados.metaVendas040)}</td>
                    </tr>
                    </tbody>
                </table>

                <div className="p-4 mt-6 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p className="text-sm text-indigo-900 font-medium">
                    Produtividade Atual: <span className="font-bold">{resultados.produtividadeAtual.toFixed(2)}</span>
                    </p>
                    {resultados.produtividadeAtual < 0.33 && (
                    <p className="text-sm text-red-600 font-bold mt-2">ALERTA: Produtividade abaixo de 0.33!</p>
                    )}
                    <p className="text-sm text-indigo-800 mt-2">
                    Para atingir a meta de 0.40, a equipe precisa realizar <span className="font-bold">{resultados.necessidadeDiaria040.toFixed(1)}</span> vendas/dia.
                    </p>
                </div>
                </div>
            )}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Consolidado de Equipes</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Equipe</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Faturamento (Real)</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Vendas</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Produtividade</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {supervisores.map(s => {
                            const data = inputs[s.id];
                            const res = data ? calcularResultados(data) : null;
                            return (
                                <tr key={s.id}>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.nome}</td>
                                    <td className="px-6 py-4 text-sm text-right text-slate-600">{data ? data.faturamentoReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right text-slate-600">{data ? data.quantidadeVendas : '-'}</td>
                                    <td className="px-6 py-4 text-sm text-right text-slate-900 font-bold">{res ? res.produtividadeAtual.toFixed(2) : '-'}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};

export default AnaliseInteligencia;
