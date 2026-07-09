
import React, { useState } from 'react';
import { XistoBrandLogo, EyeIcon, EyeOffIcon } from './ui/Icons';
import { UserProfile } from '../types';

const LoginScreen: React.FC<{ onLogin: (user: UserProfile) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
        const u = username.toLowerCase().trim();
        const p = password.trim();

        // ACESSOS ADMINISTRATIVOS E ESTOQUE
        if (u === 'admxisto' && p === '794613@') {
            onLogin({ perfil: 'Administrador', nome: 'Administrador Xisto' });
        } else if (u === 'estoquexisto' && p === '316497@') {
            onLogin({ perfil: 'Estoquista', nome: 'Estoquista Central' });
        } else if (u === 'estoquealxisto' && p === '753951@') {
            onLogin({ perfil: 'Estoquista', nome: 'Estoquista Alagoas', regiao: 'ALAGOAS' });
        } else if (u === 'gerentexisto' && p === '852963@') {
            onLogin({ perfil: 'Administrador', nome: 'Gerente Xisto' });
        } else if (u === 'coordenadorxisto' && p === '741963@') {
            onLogin({ perfil: 'Administrador', nome: 'Coordenador Xisto' });
        } 
        // EQUIPES SERGIPE (SE)
        else if (u === 'aju01' && p === '134679@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor SE 01', supervisorId: 2, supervisorUuid: '5eb5db5e-97e3-4462-8b88-932d09ace387' });
        } else if (u === 'aju02' && p === '123654@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor SE 02', supervisorId: 1, supervisorUuid: '3bae7474-0190-4092-b5f4-e89740d04b21' });
        } else if (u === 'aju03' && p === '789456@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor SE 03', supervisorId: 3, supervisorUuid: 'bde38ba7-4dc4-491b-afa2-c383a1b7e9e0' });
        } else if (u === 'se04' && p === '654321@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor SE 04', supervisorId: 4, supervisorUuid: '0833ac65-cb60-4f53-a73c-e16e88e8f7ca' });
        } else if (u === 'se05' && p === '987654@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor SE 05', supervisorId: 5, supervisorUuid: '3a5edc2d-927c-4087-95c4-010ffa312980' });
        } else if ((u === 'se06' || u === 'aju06') && p === '369258@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor SE 06', supervisorId: 9, supervisorUuid: '59ebde36-a892-4630-9879-a30db18b8097' });
        } 
        // EQUIPES ALAGOAS (AL)
        else if (u === 'mac01' && p === '654987@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor AL 01', supervisorId: 6, supervisorUuid: 'b39c2fe4-d279-47d4-924e-398c20d3e533' });
        } else if (u === 'mac02' && p === '123789@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor AL 02', supervisorId: 7, supervisorUuid: 'f2ce0423-4ce0-47fb-9192-b0e7d4724849' });
        } else if (u === 'al03' && p === '159357@') {
            onLogin({ perfil: 'Supervisor', nome: 'Supervisor AL 03', supervisorId: 8, supervisorUuid: 'f6eff710-4782-432e-9d41-3e0b8e1b1dab' });
        } 
        // CONSULTOR
        else if (u === 'consultor' && p === 'xisto') {
            onLogin({ perfil: 'Consultor', nome: 'Consultor de Vendas' });
        } else {
            setError('USUÁRIO OU SENHA INCORRETOS.');
        }
        setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d2a2d] p-4 font-sans selection:bg-blue-100 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-transparent to-black/60 pointer-events-none"></div>

      <div className="max-w-md w-full flex flex-col items-center space-y-12 relative z-10">
        <XistoBrandLogo />

        <div className="w-full bg-white rounded-[2.5rem] shadow-[0_40px_100px_-15px_rgba(0,0,0,0.6)] border-2 border-white/10 p-10 space-y-8 animate-fadeIn">
            <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] ml-1">Usuário</label>
                    <input 
                        type="text" 
                        required
                        placeholder="Ex: aju01, se04, al03"
                        className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-slate-950 outline-none focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-300 text-lg"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>

                <div className="space-y-2 relative">
                    <label className="block text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] ml-1">Senha</label>
                    <div className="relative group">
                        <input 
                            type={showPassword ? 'text' : 'password'} 
                            required
                            placeholder="••••••••"
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
                    disabled={loading}
                    className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-[0.97] mt-4 flex items-center justify-center gap-3 group disabled:opacity-50"
                >
                    {loading ? 'AUTENTICANDO...' : 'Entrar no Portal'}
                    {!loading && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"/></svg>}
                </button>
            </form>

            <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acesso restrito a colaboradores autorizados.</p>
            </div>
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
