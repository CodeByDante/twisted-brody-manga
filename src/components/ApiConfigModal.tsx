import { X, Key, Trash2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getUserApiKey, saveUserApiKey, deleteUserApiKey } from '../utils/apiKeyManager';

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiConfigModal({ isOpen, onClose }: ApiConfigModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [hasUserApiKey, setHasUserApiKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const userKey = getUserApiKey();
      if (userKey) {
        setApiKey(userKey);
        setHasUserApiKey(true);
      } else {
        setApiKey('');
        setHasUserApiKey(false);
      }
    }
  }, [isOpen]);

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      alert('Por favor ingresa una API válida');
      return;
    }

    saveUserApiKey(apiKey.trim());
    setHasUserApiKey(true);
    alert('API guardada exitosamente. Ahora todas las subidas usarán tu API personal.');
    onClose();
  };

  const handleDeleteApiKey = () => {
    const confirmDelete = window.confirm(
      '¿Seguro que deseas eliminar tu API personal? Las subidas volverán a usar la API por defecto del sistema.'
    );

    if (confirmDelete) {
      deleteUserApiKey();
      setApiKey('');
      setHasUserApiKey(false);
      alert('API eliminada. Ahora usarás la API por defecto del sistema.');
    }
  };

  const handleClose = () => {
    setApiKey('');
    setHasUserApiKey(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-[#1f1f1f] to-[#121212] rounded-2xl border border-gray-700/40 w-full max-w-md shadow-2xl">
        <div className="bg-gradient-to-b from-[#2a2a2a]/80 to-[#1f1f1f]/80 border-b border-gray-700/30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#bb86fc] to-[#9966dd] rounded-lg shadow-lg shadow-[#bb86fc]/30">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurar API</h2>
              <p className="text-xs text-gray-400 mt-0.5">ImgBB API Key Personal</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {hasUserApiKey && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
              <p className="text-green-400 text-xs font-semibold">
                Tienes una API personal configurada. Todas las subidas usan tu API.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-200 mb-2">
              Tu API Key de ImgBB
            </label>
            <input
              type="text"
              placeholder="Pega aquí tu API key de ImgBB"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all font-mono"
            />
            <p className="text-xs text-gray-500 mt-2">
              Obtén tu API gratis en{' '}
              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#bb86fc] hover:underline"
              >
                api.imgbb.com
              </a>
            </p>
          </div>

          <div className="bg-[#1a1a1a] border border-gray-700/40 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-gray-300 mb-2">Cómo funciona:</h3>
            <ul className="text-xs text-gray-400 space-y-1.5">
              <li>• Si guardas tu API, todas tus subidas la usarán</li>
              <li>• Tu API solo se guarda en tu navegador (localStorage)</li>
              <li>• Otros usuarios no verán ni usarán tu API</li>
              <li>• Si borras tu API, usarás la del sistema automáticamente</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            {hasUserApiKey && (
              <button
                onClick={handleDeleteApiKey}
                className="flex-1 bg-red-600/20 border border-red-600/50 hover:border-red-600 hover:bg-red-600/30 text-red-400 px-4 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar mi API
              </button>
            )}
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim()}
              className="flex-1 bg-gradient-to-r from-[#bb86fc] to-[#9966dd] hover:from-[#9966dd] hover:to-[#7744cc] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-[#bb86fc]/40 hover:shadow-[#bb86fc]/60 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar API
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
