
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';
import { RefreshCwIcon } from './ui/Icons';
import { SUPERVISORES } from '../constants';

const Devolucoes: React.FC = () => {
    const context = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [filterSerial, setFilterSerial] = useState('');
    const [filterSupervisor, setFilterSupervisor] = useState('');
    const [filterConsultor, setFilterConsultor] = useState('');
    const [filterData, setFilterData] = useState('');
    const [filterRegiao, setFilterRegiao] = useState(''); // Novo filtro

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [formData, setFormData] = useState({
        serial: '',
        supervisor: '',
        consultor: '',
        dataEnvio: '',
        observacao: ''
    });

    if (!context) return null;
    const { devolucoes, registrarDevolucao, currentUser } = context;
    const isSupervisor = currentUser?.perfil === 'Supervisor';

    useEffect(() => {
        // Se for supervisor, já fixa o formulário com o ID dele
        if (isSupervisor && currentUser.supervisorId) {
            setFormData(prev => ({ ...prev, supervisor: currentUser.supervisorId?.toString() || '' }));
            setFilterSupervisor(currentUser.supervisorId?.toString() || '');
        }
    }, [currentUser, isSupervisor]);

    useEffect(() => { setCurrentPage(1); }, [filterSerial, filterSupervisor, filterConsultor, filterData, filterRegiao]);

    const filteredItems = useMemo(() => {
        let list = devolucoes;

        if (isSupervisor) {
            list = list.filter(d => d.supervisor_id === currentUser?.supervisorId);
        }

        return list.filter(d => {
            const matchSerial = filterSerial ? d.serial.toUpperCase().includes(filterSerial.trim().toUpperCase()) : true;
            const matchSupervisor = filterSupervisor ? d.supervisor_id === parseInt(filterSupervisor) : true;
            const matchConsultor = filterConsultor ? d.consultor_nome.toUpperCase().includes(filterConsultor.trim().toUpperCase()) : true;
            const matchData = filterData ? d.data_envio === filterData : true;

             // Filtro de Região
             let matchRegiao = true;
             if (filterRegiao) {
                 const sup = SUPERVISORES.find(s => s.id === d.supervisor_id);
                 if (!sup) {
                     matchRegiao = false;
                 } else {
                     const nome = sup.nome.toUpperCase();
                     if (filterRegiao === 'SERGIPE') {
                         matchRegiao = nome.startsWith('AJU') || nome.startsWith('SE');
                     } else if (filterRegiao === 'ALAGOAS') {
                         matchRegiao = nome.startsWith('MAC');
                     }
                 }
             }

            return matchSerial && matchSupervisor && matchConsultor && matchData && matchRegiao;
        });
    }, [devolucoes, isSupervisor, currentUser, filterSerial, filterSupervisor, filterConsultor, filterData, filterRegiao]);

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredItems.slice(start, start + itemsPerPage);
    }, [filteredItems, currentPage]);

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const handleSubmit = () => {
        if (!formData.serial || !formData.supervisor || !formData.dataEnvio) {
            alert('Preencha os campos obrigatórios: Serial, Operação e Data de Envio.');
            return;
        }

        registrarDevolucao({
            serial: formData.serial.toUpperCase(),
            supervisor_id: parseInt(formData.supervisor),
            consultor_nome: formData.consultor.toUpperCase(),
            data_envio: formData.dataEnvio,
            observacao: formData.observacao
        });

        setIsModalOpen(false);
        setFormData(prev => ({ ...prev, serial: '', consultor: '', observacao: '', dataEnvio: '' }));
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Devoluções</h1>
                    <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">
                        Registro independente de máquinas defeituosas.
                    </p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-red-700 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-red-800 transition flex items-center gap-2 font-black uppercase text-xs">
                    <RefreshCwIcon className="w-5 h-5" /> Nova Devolução
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                {/* Filtros */}
                <div className="p-6 bg-slate-50 border-b-2 border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Serial</label>
                        <input 
                            type="text" 
                            placeholder="SERIAL..." 
                            className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600"
                            value={filterSerial}
                            onChange={e => setFilterSerial(e.target.value)}
                        />
                    </div>
                     <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Região</label>
                        <select 
                            className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600"
                            value={filterRegiao}
                            onChange={e => setFilterRegiao(e.target.value)}
                        >
                            <option value="">TODAS</option>
                            <option value="SERGIPE">SERGIPE (AJU/SE)</option>
                            <option value="ALAGOAS">ALAGOAS (MAC)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Operação</label>
                        <select 
                            disabled={isSupervisor}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600 disabled:opacity-50"
                            value={filterSupervisor}
                            onChange={e => setFilterSupervisor(e.target.value)}
                        >
                            <option value="">TODAS</option>
                            {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Consultor</label>
                        <input 
                            type="text" 
                            placeholder="NOME..." 
                            className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600"
                            value={filterConsultor}
                            onChange={e => setFilterConsultor(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Data Envio</label>
                        <input 
                            type="date" 
                            className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600"
                            value={filterData}
                            onChange={e => setFilterData(e.target.value)}
                            style={{ colorScheme: 'light' }}
                        />
                    </div>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-950 font-black border-b-2 border-slate-200 uppercase text-[10px]">
                            <tr>
                                <th className="p-5">Serial</th>
                                <th className="p-5">Operação / Consultor</th>
                                <th className="p-5">Envio</th>
                                <th className="p-5">Observação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginatedItems.map(d => (
                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-5 font-mono font-black text-slate-900 text-base">{d.serial}</td>
                                    <td className="p-5">
                                        <p className="font-black text-slate-900 text-xs">{SUPERVISORES.find(s => s.id === d.supervisor_id)?.nome}</p>
                                        <p className="text-[9px] font-black text-slate-600 uppercase">{d.consultor_nome}</p>
                                    </td>
                                    <td className="p-5 font-black text-xs text-slate-700 uppercase">
                                        {new Date(d.data_envio + 'T12:00:00').toLocaleDateString()}
                                    </td>
                                    <td className="p-5 text-xs text-slate-600 uppercase font-medium max-w-xs truncate" title={d.observacao}>
                                        {d.observacao || '-'}
                                    </td>
                                </tr>
                            ))}
                            {paginatedItems.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-10 text-center font-black text-slate-400 uppercase text-xs tracking-widest italic">
                                        Nenhum registro de devolução encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                     <div className="p-6 border-t-2 border-slate-200 flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {paginatedItems.length} de {filteredItems.length} registros
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase text-slate-700 disabled:opacity-50 hover:border-red-600 transition"
                            >
                                Anterior
                            </button>
                            <div className="px-4 py-2 bg-slate-200 rounded-xl font-black text-[10px] text-slate-900 flex items-center">
                                {currentPage} / {totalPages}
                            </div>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase text-slate-700 disabled:opacity-50 hover:border-red-600 transition"
                            >
                                Próxima
                            </button>
                        </div>
                     </div>
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nova Devolução">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Serial da Máquina *</label>
                        <input 
                            type="text" 
                            className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase"
                            placeholder="DIGITE O SERIAL"
                            value={formData.serial}
                            onChange={e => setFormData({...formData, serial: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Operação *</label>
                        <select 
                            disabled={isSupervisor}
                            className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 disabled:opacity-50" 
                            value={formData.supervisor} 
                            onChange={e => setFormData({...formData, supervisor: e.target.value})}
                        >
                            <option value="">SELECIONE...</option>
                            {SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Consultor</label>
                        <input 
                            type="text" 
                            className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase"
                            placeholder="NOME DO CONSULTOR"
                            value={formData.consultor}
                            onChange={e => setFormData({...formData, consultor: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Data do Envio *</label>
                        <input 
                            type="date" 
                            className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase"
                            value={formData.dataEnvio}
                            onChange={e => setFormData({...formData, dataEnvio: e.target.value})}
                            style={{ colorScheme: 'light' }}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Observações</label>
                        <textarea 
                            className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 h-24 uppercase"
                            placeholder="DETALHES DO DEFEITO..."
                            value={formData.observacao}
                            onChange={e => setFormData({...formData, observacao: e.target.value})}
                        />
                    </div>
                    <button onClick={handleSubmit} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl mt-2 hover:bg-black transition">
                        Registrar Devolução
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Devolucoes;
