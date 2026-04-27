
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import { AppContext } from '../App';
import { Plus, User, CheckCircle, XCircle, Save } from 'lucide-react';

interface Consultor {
    id: string;
    nome: string;
    status: 'ativo' | 'inativo';
    supervisor_id: string;
}

interface Supervisor {
    id: string;
    nome: string;
}

const GerirConsultores: React.FC = () => {
    const context = useContext(AppContext);
    const currentUser = context?.currentUser;
    const [consultores, setConsultores] = useState<Consultor[]>([]);
    const [novoNome, setNovoNome] = useState('');
    const [loading, setLoading] = useState(false);
    const [supervisores, setSupervisores] = useState<Supervisor[]>([]);
    const [supervisorSelecionado, setSupervisorSelecionado] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'create'>('list');

    useEffect(() => {
        if (currentUser?.perfil === 'Administrador') {
            fetchSupervisores();
        } else if (currentUser?.supervisorId) {
            setSupervisorSelecionado(String(currentUser.supervisorId));
        }
    }, [currentUser]);

    useEffect(() => {
        if (supervisorSelecionado !== null) {
            fetchConsultores(supervisorSelecionado);
        } else {
            setConsultores([]);
        }
    }, [supervisorSelecionado]);

    const fetchSupervisores = async () => {
        const { data } = await supabase.from('supervisores').select('*');
        if (data) setSupervisores(data);
    };

    const fetchConsultores = async (supervisorId: string) => {
        const { data } = await supabase
            .from('consultores')
            .select('*')
            .eq('supervisor_id', supervisorId);
        
        if (data) setConsultores(data);
    };

    const handleAdicionar = async () => {
        console.log("Adicionando consultor:", { novoNome, supervisorSelecionado });
        if (!novoNome || supervisorSelecionado === null) {
            console.log("Campos inválidos");
            return;
        }
        setLoading(true);
        const { data, error } = await supabase
            .from('consultores')
            .insert([{ nome: novoNome, supervisor_id: supervisorSelecionado }])
            .select();
        
        console.log("Resultado Supabase:", { data, error });
        if (!error) {
            setNovoNome('');
            fetchConsultores(supervisorSelecionado);
            setView('list');
        } else {
            alert("Erro ao adicionar: " + error.message);
        }
        setLoading(false);
    };

    const toggleStatus = async (consultor: Consultor) => {
        const newStatus = consultor.status === 'ativo' ? 'inativo' : 'ativo';
        await supabase
            .from('consultores')
            .update({ status: newStatus })
            .eq('id', consultor.id);
        if (supervisorSelecionado !== null) fetchConsultores(supervisorSelecionado);
    };

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <h1 className="text-2xl font-black mb-6">Equipe de Consultores</h1>
            
            {view === 'create' ? (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-6">Novo Consultor</h2>
                    {currentUser?.perfil === 'Administrador' && (
                        <select 
                            className="w-full p-3 border rounded-lg mb-4"
                            value={supervisorSelecionado || ''}
                            onChange={(e) => setSupervisorSelecionado(e.target.value)}
                        >
                            <option value="">Selecione um supervisor</option>
                            {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    )}
                    <input 
                        type="text" 
                        placeholder="Nome do novo consultor"
                        className="w-full p-3 border rounded-lg mb-6"
                        value={novoNome}
                        onChange={(e) => setNovoNome(e.target.value)}
                    />
                    <div className="flex gap-3">
                        <button onClick={() => setView('list')} className="px-6 py-3 rounded-lg font-bold border border-slate-300">Cancelar</button>
                        <button onClick={handleAdicionar} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2">
                             Adicionar
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex-1">
                             {currentUser?.perfil === 'Administrador' && (
                                <select 
                                    className="p-3 border rounded-lg w-full max-w-sm"
                                    value={supervisorSelecionado || ''}
                                    onChange={(e) => setSupervisorSelecionado(e.target.value)}
                                >
                                    <option value="">Selecione um supervisor</option>
                                    {supervisores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                </select>
                            )}
                        </div>
                        <button onClick={() => setView('create')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2">
                            <Plus className="w-5 h-5"/> Novo Consultor
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4">Nome</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consultores.map(c => (
                                    <tr key={c.id} className="border-t">
                                        <td className="px-6 py-4 font-semibold">{c.nome}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${(c.status || 'inativo') === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {(c.status || 'inativo').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button onClick={() => toggleStatus(c)} className="text-slate-500 hover:text-blue-600 inline-flex">
                                                {c.status === 'ativo' ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default GerirConsultores;
