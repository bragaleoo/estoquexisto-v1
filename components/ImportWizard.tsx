
import React, { useState, useContext } from 'react';
import { AppContext } from '../App';

interface ProcessedRow {
    linha: number;
    original: string;
    normalizado: string;
    status: 'INSERIDO' | 'DUPLICADO_ARQUIVO' | 'DUPLICADO_SISTEMA' | 'INVALIDO';
    motivo?: string;
}

const ImportWizard: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const context = useContext(AppContext);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ 
        codigoPedido: '', 
        qtdEsperada: '',
        dataPedido: new Date().toISOString().split('T')[0] // Data atual como padrão
    });
    const [fileData, setFileData] = useState<{ name: string, rows: ProcessedRow[] } | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    if (!context) return null;
    const { executarImportacao, maquinas } = context;

    const normalize = (val: any) => {
        if (val === undefined || val === null) return '';
        return val.toString().trim().toUpperCase().replace(/[\u200B-\u200D\uFEFF]/g, '');
    };

    const validate = (val: string) => {
        return /^NCC[A-Z0-9]+$/.test(val);
    };

    const processFile = (file: File) => {
        if (!file) return;
        
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        const isCsv = file.name.endsWith('.csv');

        if (!isExcel && !isCsv) {
            alert('Formato de arquivo não suportado. Use .xlsx ou .csv');
            return;
        }

        setIsProcessing(true);
        const reader = new FileReader();
        
        reader.onload = (evt) => {
            try {
                const dataArray = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = (window as any).XLSX.read(dataArray, { type: 'array' });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const data = (window as any).XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                let serialColIndex = -1;
                if (data.length > 0) {
                    const header = data[0];
                    serialColIndex = header.findIndex(h => h && h.toString().toLowerCase().includes('serial'));
                    
                    if (serialColIndex === -1) {
                        for(let r=0; r < Math.min(data.length, 10); r++) {
                            const row = data[r];
                            const idx = row.findIndex(c => c && c.toString().toUpperCase().startsWith('NCC'));
                            if (idx !== -1) { serialColIndex = idx; break; }
                        }
                    }
                }
                if (serialColIndex === -1) serialColIndex = 0;

                const results: ProcessedRow[] = [];
                const seenInFile = new Set<string>();
                const systemSerials = new Set(maquinas.map(m => m.serial));

                data.forEach((row, index) => {
                    const rawVal = row[serialColIndex];
                    if (rawVal === undefined || rawVal === null) return;
                    
                    const strVal = rawVal.toString().trim();
                    if (strVal === '' || (index === 0 && strVal.toLowerCase().includes('serial'))) return;

                    const norm = normalize(strVal);
                    let status: ProcessedRow['status'] = 'INSERIDO';
                    let motivo = '';

                    if (!validate(norm)) {
                        status = 'INVALIDO';
                        motivo = 'Formato inválido (prefixo NCC)';
                    } else if (seenInFile.has(norm)) {
                        status = 'DUPLICADO_ARQUIVO';
                        motivo = 'Duplicado no arquivo';
                    } else if (systemSerials.has(norm)) {
                        status = 'DUPLICADO_SISTEMA';
                        motivo = 'Já cadastrado no sistema';
                    }

                    results.push({
                        linha: index + 1,
                        original: strVal,
                        normalizado: norm,
                        status,
                        motivo
                    });

                    if (status === 'INSERIDO') seenInFile.add(norm);
                });

                if (results.length === 0) {
                    alert('Nenhum serial válido encontrado.');
                    setIsProcessing(false);
                    return;
                }

                setFileData({ name: file.name, rows: results });
                setStep(3);
            } catch (error) {
                console.error(error);
                alert('Erro ao ler arquivo.');
            } finally {
                setIsProcessing(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const confirmImport = () => {
        if (!fileData) return;
        executarImportacao(
            formData.codigoPedido.toUpperCase(),
            formData.qtdEsperada ? parseInt(formData.qtdEsperada) : undefined,
            fileData.name,
            fileData.rows,
            formData.dataPedido // Passa a data selecionada
        );
        setStep(4);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-8 px-4">
                {[1, 2, 3, 4].map(s => (
                    <React.Fragment key={s}>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-800'}`}>
                                {step > s ? '✓' : s}
                            </div>
                        </div>
                        {s < 4 && <div className={`flex-1 h-1 mx-2 rounded ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {step === 1 && (
                <div className="space-y-5">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-900 font-bold">
                        Passo 1: Identificação do Lote
                    </div>
                    <div>
                        <label className="block text-sm font-black text-gray-900">Código do Pedido *</label>
                        <input 
                            type="text" 
                            placeholder="Ex: CSG1323..." 
                            className="mt-2 w-full p-4 border-2 border-gray-200 rounded-xl bg-white uppercase focus:border-blue-600 outline-none font-bold text-gray-900" 
                            value={formData.codigoPedido}
                            onChange={e => setFormData({...formData, codigoPedido: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-black text-gray-900">Data do Pedido (Lote)</label>
                        <input 
                            type="date" 
                            className="mt-2 w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:border-blue-600 outline-none font-bold text-gray-900" 
                            value={formData.dataPedido}
                            onChange={e => setFormData({...formData, dataPedido: e.target.value})}
                            style={{ colorScheme: 'light' }}
                        />
                        <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wider">Se não preenchido, será considerada a data de hoje.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-black text-gray-900">Quantidade Esperada (opcional)</label>
                        <input 
                            type="number" 
                            placeholder="Ex: 300" 
                            className="mt-2 w-full p-4 border-2 border-gray-200 rounded-xl bg-white focus:border-blue-600 outline-none font-bold text-gray-900" 
                            value={formData.qtdEsperada}
                            onChange={e => setFormData({...formData, qtdEsperada: e.target.value})}
                        />
                    </div>
                    <button 
                        disabled={!formData.codigoPedido}
                        onClick={() => setStep(2)}
                        className="w-full bg-blue-600 text-white py-4 rounded-xl font-black disabled:opacity-50 hover:bg-blue-700 transition shadow-lg"
                    >
                        Prosseguir para Upload
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-5">
                    <div 
                        onDragOver={(e) => {e.preventDefault(); setIsDragging(true);}}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) processFile(f);}}
                        className={`border-4 border-dashed rounded-3xl p-14 text-center transition-all cursor-pointer ${
                            isDragging 
                            ? 'border-blue-600 bg-blue-100 scale-[1.03]' 
                            : 'border-gray-300 bg-gray-50 hover:border-blue-500'
                        }`}
                    >
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" id="file-up" onChange={handleFileInputChange} />
                        <label htmlFor="file-up" className="cursor-pointer">
                            {isProcessing ? (
                                <div className="flex flex-col items-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
                                    <span className="text-blue-700 font-black uppercase tracking-widest">Processando...</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 shadow-sm'}`}>
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-xl font-black text-gray-900">Solte o arquivo Excel aqui</p>
                                        <p className="text-sm text-gray-700 font-bold mt-2">Formatos aceitos: .xlsx, .csv</p>
                                    </div>
                                </div>
                            )}
                        </label>
                    </div>
                    <button onClick={() => setStep(1)} className="w-full text-gray-800 font-black text-sm uppercase tracking-wider hover:underline">Voltar</button>
                </div>
            )}

            {step === 3 && fileData && (
                <div className="space-y-6">
                    <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-gray-100 border-b-2 border-gray-200 flex justify-between items-center">
                            <span className="text-sm font-black text-gray-900 truncate uppercase tracking-tight">{fileData.name}</span>
                            <span className="text-xs font-black bg-blue-700 text-white px-3 py-1 rounded-full">{fileData.rows.length} un.</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-2 divide-gray-200">
                            <div className="p-4 text-center">
                                <p className="text-[10px] text-gray-900 font-black uppercase tracking-widest mb-1">Inéditas</p>
                                <p className="text-2xl font-black text-emerald-700">{fileData.rows.filter(r => r.status === 'INSERIDO').length}</p>
                            </div>
                            <div className="p-4 text-center">
                                <p className="text-[10px] text-gray-900 font-black uppercase tracking-widest mb-1">Inválidas</p>
                                <p className="text-2xl font-black text-red-700">{fileData.rows.filter(r => r.status === 'INVALIDO').length}</p>
                            </div>
                            <div className="p-4 text-center">
                                <p className="text-[10px] text-gray-900 font-black uppercase tracking-widest mb-1">Dup. Arq</p>
                                <p className="text-2xl font-black text-amber-700">{fileData.rows.filter(r => r.status === 'DUPLICADO_ARQUIVO').length}</p>
                            </div>
                            <div className="p-4 text-center">
                                <p className="text-[10px] text-gray-900 font-black uppercase tracking-widest mb-1">Dup. Sist</p>
                                <p className="text-2xl font-black text-orange-700">{fileData.rows.filter(r => r.status === 'DUPLICADO_SISTEMA').length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto border-2 border-gray-200 rounded-2xl bg-white shadow-inner">
                         <table className="w-full text-left text-xs">
                            <thead className="bg-gray-100 sticky top-0 border-b-2 border-gray-200">
                                <tr>
                                    <th className="p-4 text-gray-900 font-black uppercase tracking-tighter">Serial Original</th>
                                    <th className="p-4 text-right text-gray-900 font-black uppercase tracking-tighter">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {fileData.rows.map((r, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono font-black text-gray-800 text-base">{r.original}</td>
                                        <td className="p-4 text-right">
                                            <span className={`px-2 py-1 rounded font-black text-[10px] tracking-widest border uppercase ${
                                                r.status === 'INSERIDO' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                                r.status === 'INVALIDO' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                                            }`}>
                                                {r.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button onClick={confirmImport} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-xl hover:bg-blue-700 transition">
                            Processar Lote Agora
                        </button>
                        <button onClick={() => setStep(2)} className="w-full text-gray-800 font-black text-sm uppercase tracking-wider hover:underline">Trocar arquivo</button>
                    </div>
                </div>
            )}

            {step === 4 && (
                <div className="text-center py-10 space-y-6">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner border-4 border-emerald-50">
                        <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" /></svg>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Lote Concluído!</h2>
                        <p className="text-gray-800 font-bold mt-4 text-lg">
                            Pedido <span className="font-mono text-blue-700">{formData.codigoPedido}</span> atualizado.
                        </p>
                    </div>
                    <button onClick={onSuccess} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition shadow-2xl">Finalizar e Voltar</button>
                </div>
            )}
        </div>
    );
};

export default ImportWizard;
