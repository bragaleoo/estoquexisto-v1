
import React, { useState, useContext, useEffect } from 'react';
import Dashboard from './Dashboard';
import Cadastros from './Cadastros';
import Relatorios from './Relatorios';
import GerirConsultores from './GerirConsultores';
import Devolucoes from './Devolucoes';
import ConsultorCredenciamento from './ConsultorCredenciamento';
/* Remoção de AcompanhamentoVendas */
import AnaliseInteligencia from './AnaliseInteligencia';
import LimpezaDados from './LimpezaDados';
import { Page } from '../types';
import { AppContext } from '../App';
import { DashboardIcon, ListIcon, FileTextIcon, LogoutIcon, XistoLogo, XIcon, HistoryIcon, RefreshCwIcon, BarChartIcon, BrainIcon } from './ui/Icons';
import { Users } from 'lucide-react';

const LAST_PAGE_KEY = 'xisto_last_page';

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-3.5 py-2.5 text-left transition-all duration-200 ${
      isActive
        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 rounded-xl font-semibold'
        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl font-medium'
    }`}
  >
    <span className={isActive ? 'text-white' : 'text-slate-500'}>{icon}</span>
    <span className="ml-3 text-xs tracking-wide">{label}</span>
  </button>
);

const Layout: React.FC = () => {
  const context = useContext(AppContext);
  const currentUser = context?.currentUser;

  const navItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: <DashboardIcon className="w-5 h-5" />, roles: ['Administrador', 'Estoquista'] },
    { id: 'cadastros' as Page, label: currentUser?.perfil === 'Supervisor' ? 'Meu Estoque' : 'Estoque / Cadastros', icon: <ListIcon className="w-5 h-5" />, roles: ['Administrador', 'Estoquista', 'Supervisor'] },
    { id: 'relatorios' as Page, label: 'Auditoria e Logs', icon: <FileTextIcon className="w-5 h-5" />, roles: ['Administrador', 'Supervisor', 'Estoquista'] },
    { id: 'devolucoes' as Page, label: 'Devoluções', icon: <RefreshCwIcon className="w-5 h-5" />, roles: ['Administrador', 'Estoquista'] },
    { id: 'credenciamentos' as Page, label: 'Credenciamentos', icon: <BarChartIcon className="w-5 h-5" />, roles: ['Administrador', 'Supervisor'] },
    { id: 'analise-inteligencia' as Page, label: 'Inteligência de Negócios', icon: <BrainIcon className="w-5 h-5" />, roles: ['Administrador', 'Supervisor'] },
    { id: 'limpeza-dados' as Page, label: 'Limpeza de Dados', icon: <Users className="w-5 h-5" />, roles: ['Administrador', 'Estoquista'] },
    { id: 'gerir-consultores' as Page, label: 'Gerir Equipe', icon: <Users className="w-5 h-5" />, roles: ['Administrador', 'Supervisor', 'Estoquista'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentUser?.perfil || ''));
  
  const [page, setPage] = useState<Page>(() => {
    const savedPage = localStorage.getItem(LAST_PAGE_KEY) as Page;
    const role = currentUser?.perfil;

    if (savedPage) {
        const canAccess = navItems.find(n => n.id === savedPage && n.roles.includes(role || ''));
        if (canAccess) return savedPage;
    }

    if (role === 'Consultor') return 'calculadora';
    if (role === 'Supervisor') return 'cadastros';
    return 'dashboard';
  });
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(LAST_PAGE_KEY, page);
  }, [page]);

  if (!context) return null;
  const { logout, loading, isSyncing } = context;

  const renderPage = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
           <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
           <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Iniciando Sistema...</p>
        </div>
      );
    }

    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'cadastros':
        return <Cadastros />;
      case 'relatorios':
        return <Relatorios />;
      case 'devolucoes':
        return <Devolucoes />;
      case 'credenciamentos':
        return <ConsultorCredenciamento />;
      case 'analise-inteligencia':
        return <AnaliseInteligencia />;
      case 'limpeza-dados':
        return <LimpezaDados />;
      case 'gerir-consultores':
        return <GerirConsultores />;
      default:
        return <Dashboard />;
    }
  };

  const sidebarContent = (
     <div className="h-full flex flex-col bg-white text-slate-800 border-r border-slate-200/80">
        {/* Superior Esquerdo - Logo Xisto e Informação */}
        <div className="flex items-center justify-between py-5 px-5 border-b border-slate-100 bg-white">
          <XistoLogo variant="full" />
        </div>

        <div className="p-3.5">
          <div className="bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-800">
            <p className="text-xs font-bold text-white tracking-tight truncate">{currentUser?.nome}</p>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{currentUser?.perfil}</p>
          </div>
        </div>

        <nav className="flex-grow px-3 space-y-1 overflow-y-auto">
            {filteredNavItems.map(item => (
                <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    isActive={page === item.id}
                    onClick={() => {
                        setPage(item.id);
                        setSidebarOpen(false);
                    }}
                />
            ))}
        </nav>

        <div className="p-3.5 mt-auto border-t border-slate-100">
          {isSyncing && (
             <div className="flex items-center justify-center gap-2 mb-3 px-2 py-1.5 bg-blue-50 text-blue-700 rounded-xl animate-pulse">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <span className="text-[10px] font-semibold tracking-wide">Sincronizando...</span>
             </div>
          )}
          <button onClick={logout} className="flex items-center w-full px-3.5 py-2.5 text-left text-slate-600 font-semibold text-xs tracking-wide hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors duration-200">
            <LogoutIcon className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
            <span className="ml-3">Sair da conta</span>
          </button>
        </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className="hidden md:block md:w-64 flex-shrink-0">
        {sidebarContent}
      </aside>

      <div className={`fixed inset-0 z-30 transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`}>
         <div className="relative w-64 h-full">
            {sidebarContent}
         </div>
         <div className="absolute top-4 right-4">
             <button onClick={() => setSidebarOpen(false)} className="bg-slate-900 p-2 rounded-full text-white">
                <XIcon className="w-5 h-5" />
             </button>
         </div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex justify-between items-center bg-white px-4 py-3 border-b border-slate-200/80 shadow-sm">
            <XistoLogo variant="full" />
          <button onClick={() => setSidebarOpen(true)} className="text-slate-800 p-2 rounded-lg hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default Layout;
