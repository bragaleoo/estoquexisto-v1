
import React, { useState, useContext } from 'react';
import Dashboard from './Dashboard';
import Cadastros from './Cadastros';
import Relatorios from './Relatorios';
import CalculadoraGanhos from './CalculadoraGanhos';
import { Page, UserProfile } from '../types';
import { AppContext } from '../App';
import { DashboardIcon, ListIcon, FileTextIcon, LogoutIcon, XistoLogo, XIcon, HistoryIcon } from './ui/Icons';

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 text-left transition-colors duration-200 font-medium ${
      isActive
        ? 'bg-slate-900 text-white shadow-lg shadow-slate-200 rounded-lg'
        : 'text-gray-700 hover:bg-gray-200 rounded-lg'
    }`}
  >
    {icon}
    <span className="ml-3 font-black text-[11px] uppercase tracking-wider">{label}</span>
  </button>
);

const Layout: React.FC = () => {
  const context = useContext(AppContext);
  
  // Define a página inicial baseada no perfil: Consultores vão direto para calculadora
  const [page, setPage] = useState<Page>(() => {
    return context?.currentUser?.perfil === 'Consultor' ? 'calculadora' : 'dashboard';
  });
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  if (!context) return null;
  const { currentUser, logout } = context;

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'cadastros':
        return <Cadastros />;
      case 'relatorios':
        return <Relatorios />;
      case 'calculadora':
        return <CalculadoraGanhos />;
      default:
        return currentUser?.perfil === 'Consultor' ? <CalculadoraGanhos /> : <Dashboard />;
    }
  };

  const navItems = [
    // Consultor removido do Dashboard
    { id: 'dashboard' as Page, label: 'Dashboard', icon: <DashboardIcon className="w-5 h-5" />, roles: ['Administrador', 'Estoquista', 'Supervisor'] },
    { id: 'cadastros' as Page, label: currentUser?.perfil === 'Supervisor' ? 'Meu Estoque' : 'Estoque / Cadastros', icon: <ListIcon className="w-5 h-5" />, roles: ['Administrador', 'Estoquista', 'Supervisor'] },
    { id: 'relatorios' as Page, label: 'Auditoria e Logs', icon: <FileTextIcon className="w-5 h-5" />, roles: ['Administrador', 'Supervisor'] },
    { id: 'calculadora' as Page, label: 'Calculadora de Ganhos', icon: <HistoryIcon className="w-5 h-5" />, roles: ['Administrador', 'Supervisor', 'Consultor'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentUser?.perfil || ''));
  
  const sidebarContent = (
     <div className="h-full flex flex-col bg-white text-gray-800 border-r-2 border-gray-100">
        <div className="flex flex-col items-center justify-center py-10 px-6 border-b-2 border-gray-50 bg-slate-50/30">
          <XistoLogo variant="full" className="scale-110" />
        </div>
        <div className="p-4">
          <div className="bg-slate-950 p-5 rounded-2xl shadow-xl shadow-slate-200 border border-slate-800">
            <p className="text-xs font-black text-white uppercase tracking-tight truncate">{currentUser?.nome}</p>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">{currentUser?.perfil}</p>
          </div>
        </div>
        <nav className="flex-grow px-2 space-y-1">
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
        <div className="p-4 mt-auto border-t-2 border-gray-50">
          <button onClick={logout} className="flex items-center w-full px-4 py-3 text-left text-gray-700 font-black text-[11px] uppercase tracking-widest hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors duration-200">
            <LogoutIcon className="w-5 h-5" />
            <span className="ml-3">Sair da conta</span>
          </button>
        </div>
      </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <aside className="hidden md:block md:w-64 flex-shrink-0">
        {sidebarContent}
      </aside>

      <div className={`fixed inset-0 z-30 transition-transform transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`}>
         <div className="relative w-64 h-full">
            {sidebarContent}
         </div>
         <div className="absolute top-4 right-4">
             <button onClick={() => setSidebarOpen(false)} className="bg-slate-900 p-2 rounded-full text-white">
                <XIcon className="w-6 h-6" />
             </button>
         </div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex justify-between items-center bg-white p-4 border-b-2 border-gray-100 shadow-sm">
            <XistoLogo variant="full" />
          <button onClick={() => setSidebarOpen(true)} className="text-gray-800 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16m-7 6h7" />
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
