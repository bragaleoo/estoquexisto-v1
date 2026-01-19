
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../../App';
import Modal from '../ui/Modal';
import { RefreshCwIcon, FileTextIcon } from '../ui/Icons';
import { SUPERVISORES } from '../../constants';
import { Devolucao } from '../../types';

const Devolucoes: React.FC = () => {
    const context = useContext(AppContext);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    const [selectedDevolucao, setSelectedDevolucao] = useState<Devolucao | null>(null);

    const [filterSerial, setFilterSerial] = useState('');
    const [filterSupervisor, setFilterSupervisor] = useState('');
    const [filterConsultor, setFilterConsultor] = useState('');
    const [filterData, setFilterData] = useState('');
    const [filterRegiao, setFilterRegiao] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    const [formData, setFormData] = useState({
        serial: '',
        supervisor: '',
        consultor: '',
        dataEntrega: '',
        observacaoInicial: ''
    });

    const [shippingData, setShippingData] = useState({
        dataEnvioCorreios: '',
        codigoRastreio: '',
        observacaoEnvio: ''
    });

    if (!context) return null;
    const { devolucoes, registrarDevolucao, atualizarEnvioDevolucao, currentUser } = context;
    const isSupervisor = currentUser?.perfil === 'Supervisor';

    useEffect(() => {
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
            const matchData = filterData ? d.data_entrega === filterData : true;
            let matchRegiao = true;
            if (filterRegiao) {
                const sup = SUPERVISORES.find(s => s.id === d.supervisor_id);
                if (!sup) matchRegiao = false;
                else {
                    const nome = sup.nome.toUpperCase();
                    if (filterRegiao === 'SERGIPE') matchRegiao = nome.startsWith('AJU') || nome.startsWith('SE');
                    else if (filterRegiao === 'ALAGOAS') matchRegiao = nome.startsWith('MAC');
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

    const handleCreateSubmit = () => {
        if (!formData.serial || !formData.supervisor || !formData.dataEntrega) {
            alert('Preencha os campos obrigatórios: Serial, Operação e Data da Entrega.');
            return;
        }
        registrarDevolucao({
            serial: formData.serial.toUpperCase(),
            supervisor_id: parseInt(formData.supervisor),
            consultor_nome: formData.consultor.toUpperCase(),
            data_entrega: formData.dataEntrega,
            observacao_inicial: formData.observacaoInicial
        });
        setIsCreateModalOpen(false);
        setFormData(prev => ({ ...prev, serial: '', consultor: '', observacaoInicial: '', dataEntrega: '' }));
    };

    const openShippingModal = (dev: Devolucao) => {
        setSelectedDevolucao(dev);
        setShippingData({
            dataEnvioCorreios: dev.data_envio_correios || '',
            codigoRastreio: dev.codigo_rastreio || '',
            observacaoEnvio: dev.observacao_envio || ''
        });
        setIsShippingModalOpen(true);
    };

    const handleShippingSubmit = () => {
        if (!selectedDevolucao) return;
        if (!shippingData.dataEnvioCorreios || !shippingData.codigoRastreio) {
            alert('Preencha a data de envio e o código de rastreio.');
            return;
        }
        atualizarEnvioDevolucao(selectedDevolucao.id, {
            data_envio_correios: shippingData.dataEnvioCorreios,
            codigo_rastreio: shippingData.codigoRastreio.toUpperCase(),
            observacao_envio: shippingData.observacaoEnvio
        });
        setIsShippingModalOpen(false);
        setSelectedDevolucao(null);
    };

    const handleExportExcel = () => {
        if (filteredItems.length === 0) return alert("Não há dados para exportar.");
        const dataToExport = filteredItems.map(d => {
            const supervisor = SUPERVISORES.find(s => s.id === d.supervisor_id);
            return {
                'SERIAL': d.serial,
                'OPERAÇÃO': supervisor?.nome || 'N/A',
                'CONSULTOR': d.consultor_nome || 'N/A',
                'DATA_ENTREGA': d.data_entrega ? new Date(d.data_entrega + 'T12:00:00').toLocaleDateString() : '-',
                'OBS_INICIAL': d.observacao_inicial || '-',
                'DATA_ENVIO_CORREIOS': d.data_envio_correios ? new Date(d.data_envio_correios + 'T12:00:00').toLocaleDateString() : '-',
                'RASTREIO': d.codigo_rastreio || '-',
                'OBS_ENVIO': d.observacao_envio || '-'
            };
        });
        const worksheet = (window as any).XLSX.utils.json_to_sheet(dataToExport);
        const workbook = (window as any).XLSX.utils.book_new();
        (window as any).XLSX.utils.book_append_sheet(workbook, worksheet, "Devolucoes");
        (window as any).XLSX.writeFile(workbook, `Devolucoes_Xisto_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestão de Devoluções</h1>
                    <p className="text-slate-900 font-black uppercase text-[10px] tracking-widest">Controle de recebimento e envio de ativos defeituosos.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={handleExportExcel} className="bg-emerald-700 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-emerald-800 transition flex items-center gap-2 font-black uppercase text-xs">Exportar Excel</button>
                    <button onClick={() => setIsCreateModalOpen(true)} className="bg-red-700 text-white px-6 py-3 rounded-xl shadow-lg hover:bg-red-800 transition flex items-center gap-2 font-black uppercase text-xs"><RefreshCwIcon className="w-5 h-5" /> Nova Devolução</button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50 border-b-2 border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Serial</label><input type="text" placeholder="SERIAL..." className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600" value={filterSerial} onChange={e => setFilterSerial(e.target.value)} /></div>
                    <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Região</label><select className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600" value={filterRegiao} onChange={e => setFilterRegiao(e.target.value)}><option value="">TODAS</option><option value="SERGIPE">SERGIPE</option><option value="ALAGOAS">ALAGOAS</option></select></div>
                    <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Operação</label><select disabled={isSupervisor} className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600 disabled:opacity-50" value={filterSupervisor} onChange={e => setFilterSupervisor(e.target.value)}><option value="">TODAS</option>{SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
                    <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Consultor</label><input type="text" placeholder="NOME..." className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black uppercase outline-none focus:border-red-600" value={filterConsultor} onChange={e => setFilterConsultor(e.target.value)} /></div>
                    <div><label className="block text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Data Entrega</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white text-slate-950 text-xs font-black outline-none" value={filterData} onChange={e => setFilterData(e.target.value)} style={{ colorScheme: 'light' }} /></div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-950 font-black border-b-2 border-slate-200 uppercase text-[10px]">
                            <tr>
                                <th className="p-5">Serial</th>
                                <th className="p-5">Consultor / Operação</th>
                                <th className="p-5">Entrega</th>
                                <th className="p-5">Status Envio</th>
                                <th className="p-5">Rastreio</th>
                                <th className="p-5 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {paginatedItems.map(d => (
                                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-5 font-mono font-black text-slate-900 text-base">{d.serial}</td>
                                    <td className="p-5">
                                        <p className="font-black text-slate-900 text-xs">{d.consultor_nome}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase">{SUPERVISORES.find(s => s.id === d.supervisor_id)?.nome}</p>
                                    </td>
                                    <td className="p-5 font-black text-xs text-slate-700 uppercase">{new Date(d.data_entrega + 'T12:00:00').toLocaleDateString()}</td>
                                    <td className="p-5">
                                        {d.data_envio_correios ? (
                                            <div className="flex flex-col"><span className="text-emerald-700 font-black text-[9px] uppercase">Enviado em:</span><span className="text-slate-950 font-black text-xs">{new Date(d.data_envio_correios + 'T12:00:00').toLocaleDateString()}</span></div>
                                        ) : (
                                            <span className="px-3 py-1 bg-amber-100 text-amber-900 border-2 border-amber-200 rounded-lg text-[9px] font-black uppercase">Pendente Envio</span>
                                        )}
                                    </td>
                                    <td className="p-5 font-black text-xs text-blue-800 uppercase">{d.codigo_rastreio || '-'}</td>
                                    <td className="p-5"><button onClick={() => openShippingModal(d)} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-black text-[9px] uppercase hover:bg-black transition whitespace-nowrap">Devolução</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-6 border-t-2 border-slate-200 flex justify-between items-center bg-slate-50">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{paginatedItems.length} de {filteredItems.length} registros</span>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase disabled:opacity-50">Anterior</button>
                            <div className="px-4 py-2 bg-slate-200 rounded-xl font-black text-[10px] flex items-center">{currentPage} / {totalPages}</div>
                            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-black text-[10px] uppercase disabled:opacity-50">Próxima</button>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Novo Registro de Entrega">
                <div className="space-y-4">
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Serial da Máquina *</label><input type="text" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" placeholder="DIGITE O SERIAL" value={formData.serial} onChange={e => setFormData({ ...formData, serial: e.target.value })} /></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Operação *</label><select disabled={isSupervisor} className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 disabled:opacity-50" value={formData.supervisor} onChange={e => setFormData({ ...formData, supervisor: e.target.value })}><option value="">SELECIONE...</option>{SUPERVISORES.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Consultor</label><input type="text" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" placeholder="NOME DO CONSULTOR" value={formData.consultor} onChange={e => setFormData({ ...formData, consultor: e.target.value })} /></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Data da Entrega *</label><input type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={formData.dataEntrega} onChange={e => setFormData({ ...formData, dataEntrega: e.target.value })} style={{ colorScheme: 'light' }} /></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Observações</label><textarea className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 h-24 uppercase" placeholder="DETALHES DO DEFEITO..." value={formData.observacaoInicial} onChange={e => setFormData({ ...formData, observacaoInicial: e.target.value })} /></div>
                    <button onClick={handleCreateSubmit} className="w-full bg-slate-950 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl mt-2 hover:bg-black transition">Registrar Entrada</button>
                </div>
            </Modal>

            <Modal isOpen={isShippingModalOpen} onClose={() => setIsShippingModalOpen(false)} title="Informar Envio aos Correios">
                <div className="space-y-4">
                    <div className="p-4 bg-slate-100 rounded-xl"><p className="text-[10px] font-black text-slate-500 uppercase">Máquina</p><p className="text-base font-black text-slate-900">{selectedDevolucao?.serial}</p></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Data do Envio *</label><input type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950" value={shippingData.dataEnvioCorreios} onChange={e => setShippingData({ ...shippingData, dataEnvioCorreios: e.target.value })} style={{ colorScheme: 'light' }} /></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Código de Rastreio *</label><input type="text" className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 uppercase" placeholder="EX: AA123456789BR" value={shippingData.codigoRastreio} onChange={e => setShippingData({ ...shippingData, codigoRastreio: e.target.value })} /></div>
                    <div><label className="block text-[10px] font-black text-slate-950 uppercase mb-2">Observações do Envio</label><textarea className="w-full p-4 border-2 border-slate-200 rounded-xl font-black bg-slate-50 text-slate-950 h-24 uppercase" placeholder="DETALHES ADICIONAIS..." value={shippingData.observacaoEnvio} onChange={e => setShippingData({ ...shippingData, observacaoEnvio: e.target.value })} /></div>
                    <button onClick={handleShippingSubmit} className="w-full bg-blue-700 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl mt-2 hover:bg-blue-800 transition">Confirmar Envio</button>
                </div>
            </Modal>
        </div>
    );
};

export default Devolucoes;
