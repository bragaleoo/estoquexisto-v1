import React, { useState, useMemo } from 'react';

const AnaliseInteligencia: React.FC = () => {
  const [inputs, setInputs] = useState({
    totalDU: 22,
    duPassados: 10,
    hc: 5,
    fatReal: 0,
    qtdVendas: 0,
    valorParcelado: 0,
    qtdCNPJs: 0,
  });

  const resultados = useMemo(() => {
    const { totalDU, duPassados, hc, fatReal, qtdVendas } = inputs;

    if (duPassados === 0) return null;

    const projFaturamento = (fatReal / duPassados) * totalDU;
    const produtividadeAtual = (qtdVendas / duPassados) / hc;

    // Metas
    const metaVendas040 = 0.40 * totalDU * hc;
    const metaVendas033 = 0.33 * totalDU * hc;

    // Dias restantes
    const diasRestantes = Math.max(1, totalDU - duPassados);

    // Necessidade diária para atingir 0.33 a 0.40
    const vendasFaltantes033 = Math.floor(Math.max(0, metaVendas033 - qtdVendas));
    const vendasFaltantes040 = Math.floor(Math.max(0, metaVendas040 - qtdVendas));
    
    const necessidadeDiaria033 = (vendasFaltantes033 / diasRestantes);
    const necessidadeDiaria040 = (vendasFaltantes040 / diasRestantes);

    return {
      projFaturamento,
      produtividadeAtual,
      metaVendas040,
      metaVendas033,
      necessidadeDiaria033,
      necessidadeDiaria040
    };
  }, [inputs]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Analista de Inteligência de Negócios</h1>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Parâmetros de Entrada</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(inputs).map((key) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
              <input
                type="number"
                value={inputs[key as keyof typeof inputs]}
                onChange={(e) => setInputs(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Legenda</h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
            <li><strong>Total D U:</strong> Total de dias úteis do mês.</li>
            <li><strong>Du Passados:</strong> Dias úteis decorridos até hoje.</li>
            <li><strong>Hc:</strong> Headcount (Qtd. de consultores).</li>
            <li><strong>Fat Real:</strong> Faturamento real acumulado (R$).</li>
            <li><strong>Qtd Vendas:</strong> Vendas totais acumuladas.</li>
            <li><strong>Valor Parcelado/Qtd CNPJs:</strong> Dados para registro/exibição.</li>
          </ul>
        </div>
      </div>

      {resultados && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
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
                <td className="px-6 py-4 text-xs text-right">{inputs.fatReal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td className="px-6 py-4 text-xs text-right font-bold">{resultados.projFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
              <tr>
                <td className="px-6 py-4 text-xs">Vendas (Meta 0.40)</td>
                <td className="px-6 py-4 text-xs text-right">{inputs.qtdVendas}</td>
                <td className="px-6 py-4 text-xs text-right font-bold">{Math.round(resultados.metaVendas040)}</td>
              </tr>
            </tbody>
          </table>

          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
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
  );
};

export default AnaliseInteligencia;
