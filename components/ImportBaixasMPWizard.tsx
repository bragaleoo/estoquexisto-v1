import React, { useState, useContext } from 'react';
import { AppContext } from '../App';
import { SUPERVISORES } from '../constants';
import { ItemBaixaMP, MotivoBaixa, Regiao } from '../types';

interface ImportBaixasMPWizardProps {
  onSuccess: () => void;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12'
};

const parseDataVenda = (raw: any): string => {
  if (!raw) return new Date().toISOString().split('T')[0];
  const str = String(raw).trim();
  
  // Ex: "1 jul 2026" ou "15 jul 2026"
  const matchPt = str.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (matchPt) {
    const day = matchPt[1].padStart(2, '0');
    const month = MONTH_MAP[matchPt[2].toLowerCase()] || '01';
    const year = matchPt[3];
    return `${year}-${month}-${day}`;
  }

  // Ex: "2026-07-01"
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0];
  }

  // Ex: "01/07/2026"
  const matchBr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchBr) {
    const day = matchBr[1].padStart(2, '0');
    const month = matchBr[2].padStart(2, '0');
    const year = matchBr[3];
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
};

const matchSupervisorFromHub = (hubRaw: any): { supervisorId?: number; regiao?: Regiao } => {
  if (!hubRaw) return {};
  const hub = String(hubRaw).trim().toUpperCase();

  for (const sup of SUPERVISORES) {
    const nameNoSpace = sup.nome.replace(/\s+/g, '');
    if (hub.startsWith(nameNoSpace)) {
      const regiao: Regiao = sup.nome.startsWith('SE') ? 'SERGIPE' : 'ALAGOAS';
      return { supervisorId: sup.id, regiao };
    }
  }

  if (hub.startsWith('SE')) return { regiao: 'SERGIPE' };
  if (hub.startsWith('AL')) return { regiao: 'ALAGOAS' };
  return {};
};

const normalizeSerial = (val: any) => {
  if (val === undefined || val === null) return '';
  return val.toString().trim().toUpperCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
};

const validateSerial = (val: string) => {
  return /^[A-Z0-9-]+$/.test(val) && val.length >= 6;
};

const ImportBaixasMPWizard: React.FC<ImportBaixasMPWizardProps> = ({ onSuccess }) => {
  const context = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'NOVA' | 'HISTORICO'>('NOVA');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ItemBaixaMP[]>([]);
  const [cadastrarNaoEncontradas, setCadastrarNaoEncontradas] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');

  if (!context) return null;
  const { maquinas, importacoes, executarBaixaMercadoPago, cancelarLoteBaixaMP } = context;

  // Filtrar histórico de importações de baixas MP
  const historicoMP = importacoes.filter(imp => 
    imp.arquivo_nome.toLowerCase().includes('mercado') ||
    imp.arquivo_nome.toLowerCase().includes('mp') ||
    imp.arquivo_nome.toLowerCase().includes('tabla') ||
    imp.pedido_id === 'LOTE_MERCADOPAGO_AUTO'
  );

  const processFile = (inputFile: File) => {
    if (!inputFile) return;

    const isExcel = inputFile.name.endsWith('.xlsx') || inputFile.name.endsWith('.xls');
    const isCsv = inputFile.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      alert('Formato de arquivo não suportado. Por favor, envie uma planilha .xlsx ou .csv');
      return;
    }

    setFile(inputFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataArray = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = (window as any).XLSX.read(dataArray, { type: 'array', cellDates: true });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const rawJson = (window as any).XLSX.utils.sheet_to_json(ws) as Record<string, any>[];

        if (!rawJson || rawJson.length === 0) {
          alert('Nenhum dado encontrado na planilha.');
          setIsProcessing(false);
          return;
        }

        const maquinasMapExact = new Map<string, typeof maquinas[0]>();
        maquinas.forEach(m => maquinasMapExact.set(m.serial, m));

        const parsedItems: ItemBaixaMP[] = [];

        rawJson.forEach((row, idx) => {
          const rawSerial = row['SN Device'] || row['Serial'] || row['SERIAL'] || row['serial'] || row['SN'] || row['sn_device'];
          if (!rawSerial) return;

          const serialNorm = normalizeSerial(rawSerial);
          const rawConsultor = row['vendedor/consultor'] || row['Vendedor'] || row['Consultor'] || row['vendedor'] || '';
          const consultorNome = String(rawConsultor).trim().toUpperCase();

          const hub = row['HUB'] || row['Hub'] || row['polo'] || '';
          const { supervisorId, regiao } = matchSupervisorFromHub(hub);

          const dataBaixa = parseDataVenda(row['Data Venda'] || row['Data'] || row['data_venda']);
          
          const tipoVisita = String(row['TBVISITA_TIPO_VISITA'] || row['Tipo Visita'] || '').toLowerCase();
          const motivoBaixa: MotivoBaixa = tipoVisita.includes('pós-venda') || tipoVisita.includes('pos-venda') ? 'POS_VENDA' : 'VENDA';

          const seller = row['Seller'] ? String(row['Seller']).trim() : '';
          const tipoEstab = row['Tipo de Estabelecimento'] ? String(row['Tipo de Estabelecimento']).trim() : '';
          const observacaoBaixa = `Baixa MP - Seller: ${seller || 'N/A'}${tipoEstab && tipoEstab !== 'null' ? ` (${tipoEstab})` : ''}`;

          let statusProcessamento: ItemBaixaMP['statusProcessamento'] = 'PRONTA';
          let erroMotivo: string | undefined;
          let maquinaIdExistente: string | undefined;
          let matchedSerial = serialNorm;

          if (!validateSerial(serialNorm)) {
            statusProcessamento = 'INVALIDA';
            erroMotivo = 'Serial inválido ou incorreto';
          } else {
            let existingMachine = maquinasMapExact.get(serialNorm);

            if (!existingMachine) {
              const stripped = serialNorm.replace(/^(N950|N920|PAX|SMART|MP)/i, '');
              if (stripped && stripped.length >= 6) {
                existingMachine = maquinasMapExact.get(stripped);
                if (existingMachine) matchedSerial = stripped;
              }
            }

            if (!existingMachine) {
              const found = maquinas.find(m => serialNorm.endsWith(m.serial) || m.serial.endsWith(serialNorm));
              if (found) {
                existingMachine = found;
                matchedSerial = found.serial;
              }
            }

            if (!existingMachine) {
              statusProcessamento = 'NAO_ENCONTRADA';
              erroMotivo = 'Não encontrada no estoque atual';
            } else if (existingMachine.status_estoque === 'BAIXADA') {
              statusProcessamento = 'JA_BAIXADA';
              erroMotivo = 'Máquina já consta como BAIXADA no sistema';
              maquinaIdExistente = existingMachine.id;
            } else {
              statusProcessamento = 'PRONTA';
              maquinaIdExistente = existingMachine.id;
            }
          }

          parsedItems.push({
            linha: idx + 2,
            serialOriginal: String(rawSerial).trim(),
            serialNormalizado: matchedSerial,
            consultorNome,
            supervisorId,
            dataBaixa,
            motivoBaixa,
            observacaoBaixa,
            regiao,
            statusProcessamento,
            erroMotivo,
            maquinaIdExistente
          });
        });

        if (parsedItems.length === 0) {
          alert('Nenhum serial de máquina válido encontrado nas colunas da planilha.');
          setIsProcessing(false);
          return;
        }

        setItems(parsedItems);
        setStep(2);
      } catch (err) {
        console.error('Erro ao ler planilha MP:', err);
        alert('Ocorreu um erro ao processar o arquivo. Verifique o formato e tente novamente.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(inputFile);
  };

  const handleConfirmImport = async () => {
    setIsUploading(true);
    try {
      await executarBaixaMercadoPago(items, cadastrarNaoEncontradas, file?.name);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar baixas no banco de dados.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelarLote = async (impId: string, nomeArquivo: string, qtd: number) => {
    if (!window.confirm(`ATENÇÃO: Deseja realmente cancelar o lote de baixa "${nomeArquivo}" com ${qtd} máquinas?\n\nAs máquinas retornarão ao estado de Disponível ou Atribuída no estoque.`)) {
      return;
    }

    setCancelingId(impId);
    try {
      await cancelarLoteBaixaMP(impId);
      alert('Lote cancelado com sucesso! As baixas foram revertidas.');
    } catch (err) {
      console.error(err);
      alert('Ocorreu um erro ao cancelar o lote de baixas.');
    } finally {
      setCancelingId(null);
    }
  };

  const totalLidos = items.length;
  const totalProntas = items.filter(i => i.statusProcessamento === 'PRONTA').length;
  const totalJaBaixadas = items.filter(i => i.statusProcessamento === 'JA_BAIXADA').length;
  const totalNaoEncontradas = items.filter(i => i.statusProcessamento === 'NAO_ENCONTRADA').length;
  const totalInvalidas = items.filter(i => i.statusProcessamento === 'INVALIDA').length;

  const totalAProcessar = totalProntas + (cadastrarNaoEncontradas ? totalNaoEncontradas : 0);

  const filteredItems = items.filter(item => {
    const matchesText = filterText === '' ||
      item.serialNormalizado.includes(filterText.toUpperCase()) ||
      (item.consultorNome && item.consultorNome.includes(filterText.toUpperCase()));
    
    const matchesStatus = filterStatus === 'TODOS' || item.statusProcessamento === filterStatus;
    return matchesText && matchesStatus;
  });

  const getSupervisorNome = (supId?: number) => {
    if (!supId) return '-';
    return SUPERVISORES.find(s => s.id === supId)?.nome || `Sup #${supId}`;
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('NOVA')}
          className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'NOVA' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
        >
          📊 Nova Importação MP
        </button>
        <button
          onClick={() => setActiveTab('HISTORICO')}
          className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${activeTab === 'HISTORICO' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
        >
          📜 Histórico de Baixas ({historicoMP.length})
        </button>
      </div>

      {/* ABA 1: NOVA IMPORTAÇÃO */}
      {activeTab === 'NOVA' && (
        <>
          {/* Header com passos */}
          <div className="flex justify-between items-center px-4 mb-2">
            <div className={`flex items-center space-x-2 ${step === 1 ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-semibold'}`}>
              <span className="w-8 h-8 rounded-full border-2 border-indigo-600 flex items-center justify-center text-sm font-bold bg-indigo-50">1</span>
              <span className="text-sm">Upload da Planilha</span>
            </div>
            <div className="flex-1 h-0.5 bg-slate-200 mx-4" />
            <div className={`flex items-center space-x-2 ${step === 2 ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-semibold'}`}>
              <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${step === 2 ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-300'}`}>2</span>
              <span className="text-sm">Conferência de Baixas</span>
            </div>
            <div className="flex-1 h-0.5 bg-slate-200 mx-4" />
            <div className={`flex items-center space-x-2 ${step === 3 ? 'text-emerald-600 font-extrabold' : 'text-slate-400 font-semibold'}`}>
              <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${step === 3 ? 'border-emerald-600 bg-emerald-50 text-emerald-600' : 'border-slate-300'}`}>3</span>
              <span className="text-sm">Concluído</span>
            </div>
          </div>

          {/* Passo 1: Upload */}
          {step === 1 && (
            <div className="p-10 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-sm">
                📊
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Carregar Planilha de Vendas Mercado Pago</h3>
                <p className="text-sm text-slate-500 max-w-lg mx-auto mt-2 leading-relaxed">
                  Selecione o arquivo Excel exportado do Mercado Pago (ex: <code className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-semibold">MP_IC_Hunting...xlsx</code>).
                </p>
              </div>
              
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                id="mp-file-input"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0];
                  if (selected) processFile(selected);
                }}
              />

              <div className="pt-2">
                <label
                  htmlFor="mp-file-input"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm cursor-pointer hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  {isProcessing ? 'Lendo planilha...' : 'Selecionar Arquivo Excel'}
                </label>
              </div>
            </div>
          )}

          {/* Passo 2: Prévia e Conferência */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Total Lidos</span>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 mt-1">{totalLidos}</p>
                </div>
                
                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Prontas p/ Baixa</span>
                  <p className="text-2xl md:text-3xl font-black text-emerald-800 mt-1">{totalProntas}</p>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">Já Baixadas</span>
                  <p className="text-2xl md:text-3xl font-black text-amber-800 mt-1">{totalJaBaixadas}</p>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider">Não Cadastráveis</span>
                  <p className="text-2xl md:text-3xl font-black text-blue-800 mt-1">{totalNaoEncontradas}</p>
                </div>
                
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-[11px] font-black text-rose-700 uppercase tracking-wider">Inválidas</span>
                  <p className="text-2xl md:text-3xl font-black text-rose-800 mt-1">{totalInvalidas}</p>
                </div>
              </div>

              {totalNaoEncontradas > 0 && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-900 shadow-sm">
                  <input
                    type="checkbox"
                    id="check-cadastrar"
                    checked={cadastrarNaoEncontradas}
                    onChange={(e) => setCadastrarNaoEncontradas(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="check-cadastrar" className="cursor-pointer font-bold select-none">
                    Cadastrar e dar baixa automaticamente nas {totalNaoEncontradas} máquinas que não constavam no estoque ativo
                  </label>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <input
                  type="text"
                  placeholder="🔍 Buscar por serial ou consultor..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full sm:w-80 px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TODOS">Todos ({items.length})</option>
                    <option value="PRONTA">Prontas ({totalProntas})</option>
                    <option value="JA_BAIXADA">Já Baixadas ({totalJaBaixadas})</option>
                    <option value="NAO_ENCONTRADA">Não Cadastradas ({totalNaoEncontradas})</option>
                    <option value="INVALIDA">Inválidas ({totalInvalidas})</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-black sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="px-4 py-3 w-16">Linha</th>
                      <th className="px-4 py-3">Serial</th>
                      <th className="px-4 py-3">Consultor</th>
                      <th className="px-4 py-3">Supervisor (HUB)</th>
                      <th className="px-4 py-3">Data Venda</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3 text-center">Status Processamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredItems.map((item, index) => (
                      <tr key={index} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-400 font-bold">{item.linha}</td>
                        <td className="px-4 py-3 font-mono font-black text-slate-900 tracking-wider">{item.serialNormalizado}</td>
                        <td className="px-4 py-3 text-slate-800 font-semibold">{item.consultorNome || '-'}</td>
                        <td className="px-4 py-3 text-slate-700 font-semibold">{getSupervisorNome(item.supervisorId)}</td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{item.dataBaixa}</td>
                        <td className="px-4 py-3 text-slate-700 font-semibold">{item.motivoBaixa}</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {item.statusProcessamento === 'PRONTA' && (
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1 border border-emerald-300 shadow-sm">
                              ✓ Pronta p/ Baixa
                            </span>
                          )}
                          {item.statusProcessamento === 'JA_BAIXADA' && (
                            <span className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1 border border-amber-300 shadow-sm">
                              ⚠ Já Baixada
                            </span>
                          )}
                          {item.statusProcessamento === 'NAO_ENCONTRADA' && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1 border border-blue-300 shadow-sm">
                              ℹ Não Cadastrada
                            </span>
                          )}
                          {item.statusProcessamento === 'INVALIDA' && (
                            <span className="px-3 py-1 bg-rose-100 text-rose-800 font-bold rounded-full text-[11px] inline-flex items-center gap-1 border border-rose-300 shadow-sm">
                              ✕ Inválida
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setStep(1)}
                  className="w-full sm:w-auto px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                >
                  Voltar / Trocar Planilha
                </button>
                
                <button
                  onClick={handleConfirmImport}
                  disabled={isUploading || totalAProcessar === 0}
                  className="w-full sm:w-auto px-8 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                  {isUploading ? 'Processando Baixas...' : `Confirmar e Baixar ${totalAProcessar} Máquinas`}
                </button>
              </div>
            </div>
          )}

          {/* Passo 3: Sucesso */}
          {step === 3 && (
            <div className="p-10 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-4xl shadow-sm">
                ✓
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">Baixas Processadas com Sucesso!</h3>
                <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                  As máquinas foram atualizadas com o status <strong>BAIXADA</strong> e vinculadas aos respectivos consultores, supervisores e datas de venda no sistema.
                </p>
              </div>
              <div className="pt-4">
                <button
                  onClick={onSuccess}
                  className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                >
                  Fechar e Atualizar Estoque
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ABA 2: HISTÓRICO E CANCELAMENTO DE BATCH */}
      {activeTab === 'HISTORICO' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Histórico das importações de baixas Mercado Pago realizadas. Você pode visualizar e cancelar qualquer lote de baixa, revertendo o status das máquinas para o estado anterior.
          </p>

          {historicoMP.length === 0 ? (
            <div className="p-8 border border-slate-200 rounded-2xl text-center text-slate-400 text-sm bg-slate-50">
              Nenhuma baixa por planilha Mercado Pago registrada até o momento.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white max-h-[420px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase font-black sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Arquivo</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3 text-center">Máquinas Baixadas</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {historicoMP.map(imp => (
                    <tr key={imp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 font-mono">
                        {new Date(imp.importado_em).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {imp.arquivo_nome}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {imp.importado_por}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-indigo-700">
                        {imp.seriais_validos || imp.maquinas_inseridas || 0}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {imp.status === 'CANCELADA' ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-bold rounded-full text-[10px] border border-slate-300">
                            CANCELADA / REVERTIDA
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] border border-emerald-300">
                            PROCESSADA
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {imp.status !== 'CANCELADA' && (
                          <button
                            onClick={() => handleCancelarLote(imp.id, imp.arquivo_nome, imp.seriais_validos || imp.maquinas_inseridas || 0)}
                            disabled={cancelingId === imp.id}
                            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                          >
                            {cancelingId === imp.id ? 'Cancelando...' : 'Cancelar / Reverter Lote'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportBaixasMPWizard;
