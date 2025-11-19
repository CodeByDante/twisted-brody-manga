import { Search, X, ArrowUpDown, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

type SortType = 'random' | 'name' | 'date' | 'pages';
type SortDirection = 'asc' | 'desc';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sortType?: SortType;
  onSortTypeChange?: (sortType: SortType) => void;
  sortDirection?: SortDirection;
  onSortDirectionChange?: (direction: SortDirection) => void;
}

const SORT_LABELS: Record<SortType, string> = {
  random: 'Aleatorio',
  name: 'Nombre',
  date: 'Fecha',
  pages: 'Páginas',
};

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar manga...",
  sortType = 'random',
  onSortTypeChange,
  sortDirection = 'asc',
  onSortDirectionChange,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    onChange('');
  };

  const handleCycleSortType = () => {
    const sortTypes: SortType[] = ['name', 'date', 'pages', 'random'];
    const currentIndex = sortTypes.indexOf(sortType);
    const nextIndex = (currentIndex + 1) % sortTypes.length;
    onSortTypeChange?.(sortTypes[nextIndex]);
  };

  const handleToggleSortDirection = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    onSortDirectionChange?.(newDirection);
  };

  return (
    <div className="w-full flex gap-2 items-center">
      <div className={`relative transition-all duration-300 flex-1 ${
        isFocused
          ? 'ring-2 ring-purple-500/50 ring-offset-2 ring-offset-[#121212] scale-105'
          : value
          ? 'ring-1 ring-purple-500/30'
          : ''
      }`}>
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-300 ${
          isFocused ? 'text-purple-400 scale-110' : 'text-gray-400'
        }`} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-[#1a1a1a] text-white rounded-lg pl-10 pr-10 py-2.5 text-sm placeholder-gray-400 border border-gray-700/50 focus:border-purple-500 focus:outline-none transition-all duration-300 shadow-lg shadow-purple-500/0 focus:shadow-lg focus:shadow-purple-500/20"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-all p-1 hover:scale-125 hover:rotate-90 duration-300"
            title="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <button
        onClick={handleCycleSortType}
        className="bg-gradient-to-r from-gray-700/40 to-gray-600/40 hover:from-gray-700/60 hover:to-gray-600/60 border border-gray-600/50 hover:border-purple-500/50 text-white px-2.5 py-2.5 rounded-lg flex items-center justify-center gap-1.5 font-medium text-xs transition-all duration-300 active:scale-95 whitespace-nowrap hover:scale-110 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500"
        title="Cambiar tipo de ordenamiento"
      >
        <ChevronsUpDown className="w-3.5 h-3.5 transition-transform duration-300 hover:rotate-180" />
        <span className="hidden sm:inline">{SORT_LABELS[sortType]}</span>
      </button>

      <button
        onClick={handleToggleSortDirection}
        className="bg-gradient-to-r from-gray-700/40 to-gray-600/40 hover:from-gray-700/60 hover:to-gray-600/60 border border-gray-600/50 hover:border-purple-500/50 text-white px-2.5 py-2.5 rounded-lg flex items-center justify-center gap-1.5 font-medium text-xs transition-all duration-300 active:scale-95 whitespace-nowrap hover:scale-110 hover:shadow-lg hover:shadow-purple-500/20 hover:border-purple-500"
        title={sortDirection === 'asc' ? 'Cambiar a descendente' : 'Cambiar a ascendente'}
      >
        <ArrowUpDown className={`w-3.5 h-3.5 transition-all duration-500 ${sortDirection === 'desc' ? 'rotate-180' : ''} hover:scale-125`} />
        <span className="hidden sm:inline text-[10px]">{sortDirection === 'asc' ? 'ASC' : 'DESC'}</span>
      </button>
    </div>
  );
}
