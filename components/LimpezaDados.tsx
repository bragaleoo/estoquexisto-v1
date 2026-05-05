
import React, { useState, useEffect, useContext } from 'react';
import { AppContext } from '../App';
import { supabase } from '../supabase';

const LimpezaDados: React.FC = () => {
    const { maquinas } = useContext(AppContext)!;
    const [nomes, setNomes] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string[]>([]);
    const [masterName, setMasterName] = useState('');

    useEffect(() => {
        // Obter nomes únicos de máquias e devoluções (se tiver acesso, mas focando em máquinas aqui)
        const uniqueNames = Array.from(new Set(maquinas.map(m => m.consultor_nome).filter(Boolean) as string[]));
        setNomes(uniqueNames.sort());
    }, [maquinas]);

    const handleMerge = async () => {
        if (!masterName || selectedGroup.length === 0) return;
        
        // Atualizar máquinas
        const { error: errorMaquinas } = await supabase
            .from('maquinas')
            .update({ consultor_nome: masterName })
            .in('consultor_nome', selectedGroup);
        
        // Atualizar devoluções
        const { error: errorDevolucoes } = await supabase
            .from('devolucoes')
            .update({ consultor_nome: masterName })
            .in('consultor_nome', selectedGroup);

        if (errorMaquinas || errorDevolucoes) {
            console.error('Erro ao mesclar:', errorMaquinas || errorDevolucoes);
            alert('Erro ao mesclar dados.');
            return;
        }

        alert(`Mesclagem concluída! ${selectedGroup.length} registros atualizados para "${masterName}".`);
        setSelectedGroup([]);
        setMasterName('');
        // Poderia chamar triggerRefresh() aqui se acessível via contexto
    };

    return (
        <div className="p-10">
            <h1 className="text-2xl font-black mb-6">Limpeza de Nomes de Consultores</h1>
            <div className="grid grid-cols-2 gap-10">
                <div className="bg-white p-6 rounded-xl shadow">
                    <h2 className="font-bold mb-4">Consultores Identificados ({nomes.length})</h2>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {nomes.map(n => (
                            <div key={n} className="flex items-center gap-2">
                                <input type="checkbox" onChange={(e) => {
                                    if (e.target.checked) setSelectedGroup([...selectedGroup, n]);
                                    else setSelectedGroup(selectedGroup.filter(s => s !== n));
                                }} />
                                <span>{n}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow">
                    <h2 className="font-bold mb-4">Mesclagem</h2>
                    <p className="text-sm mb-4">Selecione nomes à esquerda e escolha o nome oficial:</p>
                    <select className="w-full p-2 border rounded mb-4" onChange={e => setMasterName(e.target.value)}>
                        <option value="">Selecione o nome oficial...</option>
                        {selectedGroup.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button 
                        onClick={handleMerge}
                        disabled={!masterName || selectedGroup.length === 0}
                        className="w-full p-3 bg-blue-700 text-white rounded font-bold disabled:bg-slate-300"
                    >
                        Mesclar {selectedGroup.length} nomes para "{masterName}"
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LimpezaDados;
