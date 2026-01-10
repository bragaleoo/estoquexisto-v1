
import React from 'react';
import { UserProfile, Perfil } from '../types';
import { SUPERVISORES } from '../constants';
import { CreditCardIcon } from './ui/Icons';

interface LoginScreenProps {
  onLogin: (perfil: UserProfile) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const handleLogin = (perfil: Perfil, supervisorId?: number, nome?: string) => {
    onLogin({ perfil, supervisorId, nome: nome || perfil });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-8">
        <div className="text-center">
            <CreditCardIcon className="w-16 h-16 mx-auto text-blue-600"/>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Gestão de Estoque
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Selecione um perfil para acessar o sistema.
          </p>
        </div>
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => handleLogin('Administrador')}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-95"
          >
            Entrar como Administrador
          </button>

          <button
            onClick={() => handleLogin('Estoquista')}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95"
          >
            Entrar como Estoquista
          </button>

          <button
            onClick={() => handleLogin('Consultor')}
            className="w-full flex justify-center py-3 px-4 border-2 border-emerald-600 rounded-lg shadow-sm text-sm font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all active:scale-95"
          >
            Entrar como Consultor (Simulador)
          </button>
          
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300"></span></div>
            <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-white px-2 text-gray-500">Supervisores</span></div>
          </div>

          {SUPERVISORES.map(supervisor => (
            <button
              key={supervisor.id}
              onClick={() => handleLogin('Supervisor', supervisor.id, supervisor.nome)}
              className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-all active:scale-95"
            >
              {supervisor.nome}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
