
import React, { useState } from 'react';
import { UserProfile, Perfil } from '../types';
import { SUPERVISORES } from '../constants';
import { XistoBrandLogo, EyeIcon, EyeOffIcon } from './ui/Icons';

interface LoginScreenProps {
  onLogin: (perfil: UserProfile) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = username.trim().toLowerCase();
    const pass = password.trim();

    // Acesso Administrativo e Logística
    if (user === 'admxisto' && pass === '794613@') {
      onLogin({ perfil: 'Administrador', nome: 'Administrador Xisto' });
      return;
    } 
    if (user === 'estoquexisto' && pass === '316497@') {
      onLogin({ perfil: 'Estoquista', nome: 'Logística Xisto' });
      return;
    } 

    // Mapeamento de Supervisores (Operação)
    const supervisorCreds: Record<string, { pass: string, id: number }> = {
        'aju01': { pass: '134679@', id: 1 },
        'aju02': { pass: '123654@', id: 2 },
        'aju03': { pass: '789456@', id: 3 },
        'se04':  { pass: '654321@', id: 4 },
        'se05':  { pass: '987654@', id: 5 },
        'mac01': { pass: '654987@', id: 6 },
        'mac02': { pass: '123789@', id: 7 },
    };

    if (supervisorCreds[user]) {
        const cred = supervisorCreds[user];
        if (pass === cred.pass) {
            const supervisorData = SUPERVISORES.find(s => s.id === cred.id);
            if (supervisorData) {
                onLogin({ perfil: 'Supervisor', supervisorId: supervisorData.id, nome: supervisorData.nome });
                return;
            }
        }
    }

    setError('ACESSO NEGADO: VERIFIQUE SUAS CREDENCIAIS.');
  };

  const loginAsConsultor = () => {
    onLogin({ perfil: 'Consultor', nome: 'Consultor (Simulador)' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d2a2d] p-4 font-sans selection:bg-blue-100 overflow-hidden relative">
      {/* Camada de Gradiente Suave para Profundidade */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-transparent to-black/60 pointer-events-none"></div>

      <div className="max-w-md w-full flex flex-col items-center space-y-12 relative z-10">
        
        {/* Logo Xisto Fiel à Imagem */}
        <XistoBrandLogo />

        {/* Card de Login - Foco Total em Legibilidade */}
        <div className="w-full bg-white rounded-[2.5rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.6)] border-2 border-white/10 p-10 space-y-8 animate-fadeIn">
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] ml-1">Identificação</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Nome de usuário"
                        className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-slate-950 outline-none focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-300 text-lg"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div className="space-y-2 relative">
                    <label className="block text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] ml-1">Senha de Segurança</label>
                    <div className="relative group">
                        <input 
                            type={showPassword ? 'text' : 'password'} 
                            required
                            placeholder="Sua senha"
                            className="w-full p-5 pr-14 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-slate-950 outline-none focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-300 text-lg"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-900 transition-colors"
                        >
                            {showPassword ? <EyeOffIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-2 border-red-200 p-4 rounded-xl text-center animate-shake">
                        <p className="text-[10px] font-black text-red-700 uppercase tracking-widest leading-relaxed">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-[0.97] mt-4 flex items-center justify-center gap-3 group"
                >
                    Entrar no Portal
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>
                </button>
            </form>

            <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t-2 border-slate-100"></span></div>
                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-[0.4em]"><span className="bg-white px-6 text-slate-400">Ou use o</span></div>
            </div>

            <button
                type="button"
                onClick={loginAsConsultor}
                className="w-full bg-slate-50 text-slate-900 border-2 border-slate-200 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-[0.97] flex items-center justify-center gap-3"
            >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 13h.01M12 13h.01M12 7h.01M15 7h.01M15 13h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>
                Simulador de Ganhos
            </button>
        </div>

        {/* Rodapé */}
        <div className="text-center">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em]">Xisto Enterprise Platform • v2.5</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
      `}} />
    </div>
  );
};

export default LoginScreen;
