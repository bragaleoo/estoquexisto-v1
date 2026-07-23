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
    const nameNoSpace = sup.nome.replace(/\s+/g, ''); // SE01, AL02
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ItemBaixaMP[]>([]);
  const [cadastrarNaoEncontradas, setCadastrarNaoEncontradas] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');

  if (!context) return null;
  const { maquinas, executarBaixaMercadoPago } = context;

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

        const maquinasMap = new Map<string, typeof maquinas[0]>();
        maquinas.forEach(m => maquinasMap.set(m.serial, m));

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

          if (!validateSerial(serialNorm)) {
            statusProcessamento = 'INVALIDA';
            erroMotivo = 'Serial inválido ou incorreto';
          } else {
            const existingMachine = maquinasMap.get(serialNorm);
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
            serialNormalizado: serialNorm,
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
      await executarBaixaMercadoPago(items, cadastrarNaoEncontradas);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar baixas no banco de dados.');
    } finally {
      setIsUploading(false);
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
      <div className="flex justify-between items-center px-4 mb-4">
        <div className={`flex items-center space-x-2 ${step === 1 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
          <span className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm">1</span>
          <span>Upload da Planilha</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-200" />
        <div className={`flex items-center space-x-2 ${step === 2 ? 'text-indigo-600 font-bold' : 'text-gray-400'}`}>
          <span className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm">2</span>
          <span>Conferência de Baixas</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-200" />
        <div className={`flex items-center space-x-2 ${step === 3 ? 'text-emerald-600 font-bold' : 'text-gray-400'}`}>
          <span className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-semibold text-sm">3</span>
          <span>Concluído</span>
        </div>
      </div>

      {step === 1 && (
        <div className="p-8 border-2 border-dashed border-indigo-200 bg-indigo-50/40 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            📊
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Carregar Planilha de Vendas Mercado Pago</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
              Selecione o arquivo Excel exportado do Mercado Pago (ex: <code className="bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded">MP_IC_Hunting...xlsx</code>).
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

          <label
            htmlFor="mp-file-input"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium cursor-pointer hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
          >
            {isProcessing ? 'Lendo planilha...' : 'Selecionar Arquivo Excel'}
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Lidos</span>
              <p className="text-2xl font-bold text-slate-800">{totalLidos}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              <span className="text-xs font-semibold text-emerald-600 uppercase">Prontas p/ Baixa</span>
              <p className="text-2xl font-bold text-emerald-700">{totalProntas}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <span className="text-xs font-semibold text-amber-600 uppercase">Já Baixadas</span>
              <p className="text-2xl font-bold text-amber-700">{totalJaBaixadas}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
              <span className="text-xs font-semibold text-blue-600 uppercase">Não Cadastradas</span>
              <p className="text-2xl font-bold text-blue-700">{totalNaoEncontradas}</p>
            </div>
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
              <span className="text-xs font-semibold text-rose-600 uppercase">Inválidas</span>
              <p className="text-2xl font-bold text-rose-700">{totalInvalidas}</p>
            </div>
          </div>

          {totalNaoEncontradas > 0 && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <input
                type="checkbox"
                id="check-cadastrar"
                checked={cadastrarNaoEncontradas}
                onChange={(e) => setCadastrarNaoEncontradas(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="check-cadastrar" className="cursor-pointer font-medium">
                Cadastrar e dar baixa automaticamente nas {totalNaoEncontradas} máquinas que não constam no estoque atual
              </label>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
            <input
              type="text"
              placeholder="Buscar por serial ou consultor..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full md:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="TODOS">Todos ({items.length})</option>
                <option value="PRONTA">Prontas ({totalProntas})</option>
                <option value="JA_BAIXADA">Já Baixadas ({totalJaBaixadas})</option>
                <option value="NAO_ENCONTRADA">Não Cadastradas ({totalNaoEncontradas})</option>
                <option value="INVALIDA">Inválidas ({totalInvalidas})</option>
              </select>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-600 uppercase font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Serial</th>
                  <th className="px-3 py-2">Consultor</th>
                  <th className="px-3 py-2">Supervisor (HUB)</th>
                  <th className="px-3 py-2">Data Venda</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Status Processamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-400">{item.linha}</td>
                    <td className="px-3 py-2 font-mono font-bold text-gray-800">{item.serialNormalizado}</td>
                    <td className="px-3 py-2 text-gray-700">{item.consultorNome || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{getSupervisorNome(item.supervisorId)}</td>
                    <td className="px-3 py-2 text-gray-700">{item.dataBaixa}</td>
                    <td className="px-3 py-2 text-gray-700">{item.motivoBaixa}</td>
                    <td className="px-3 py-2">
                      {item.statusProcessamento === 'PRONTA' && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-[10px]">
                          Pronta p/ Baixa
                        </span>
                      )}
                      {item.statusProcessamento === 'JA_BAIXADA' && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded-full text-[10px]">
                          Já Baixada
                        </span>
                      )}
                      {item.statusProcessamento === 'NAO_ENCONTRADA' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-full text-[10px]">
                          Não Cadastrada
                        </span>
                      )}
                      {item.statusProcessamento === 'INVALIDA' && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-semibold rounded-full text-[10px]">
                          Inválida
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              Voltar / Trocar Planilha
            </button>
            
            <button
              onClick={handleConfirmImport}
              disabled={isUploading || totalAProcessar === 0}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-md shadow-emerald-200"
            >
              {isUploading ? 'Processando Baixas...' : `Confirmar e Baixar ${totalAProcessar} Máquinas`}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
            ✓
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Baixas Processadas com Sucesso!</h3>
            <p className="text-sm text-gray-500 mt-1">
              As máquinas foram atualizadas com o status <strong>BAIXADA</strong> e vinculadas aos respectivos consultores, supervisores e datas de venda.
            </p>
          </div>
          <button
            onClick={onSuccess}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md"
          >
            Fechar e Voltar ao Estoque
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportBaixasMPWizard;
