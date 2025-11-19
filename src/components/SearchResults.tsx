import { BookOpen } from 'lucide-react';
import { MangaCard } from './MangaCard';
import { Manga } from '../types/manga';

interface SearchResult {
  id: string;
  title: string;
  author: string;
  chapterCount: number;
  pageCount: number;
  thumbnail?: string;
  manga?: Manga;
}

interface SearchResultsProps {
  items: SearchResult[];
  searchTerm: string;
  isSearching: boolean;
  onSelectComic: (id: string) => void;
  onEditManga: (manga: Manga) => void;
  onDeleteManga: (id: string) => void;
}

export function SearchResults({
  items,
  searchTerm,
  isSearching,
  onSelectComic,
  onEditManga,
  onDeleteManga,
}: SearchResultsProps) {
  if (isSearching && searchTerm) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
        <div className="text-gray-400 text-sm animate-pulse">Buscando "{searchTerm}"...</div>
      </div>
    );
  }

  if (searchTerm && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-300">
        <BookOpen className="w-16 h-16 text-gray-600 mb-4 animate-bounce" />
        <p className="text-gray-400 text-lg mb-2">No se encontraron resultados</p>
        <p className="text-gray-500 text-sm">Intenta con otros términos de búsqueda</p>
      </div>
    );
  }

  if (!searchTerm && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
        <BookOpen className="w-16 h-16 text-gray-600 mb-4 animate-bounce" />
        <p className="text-gray-400 text-lg mb-2">No hay mangas disponibles</p>
        <p className="text-gray-500 text-sm">Crea tu primer manga usando el botón "Nuevo"</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6 animate-in fade-in duration-300">
      {items.map((item, index) => (
        <div key={item.id} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms` }}>
          <MangaCard
            id={item.id}
            title={item.title}
            author={item.author}
            pageCount={item.pageCount}
            thumbnail={item.thumbnail}
            manga={item.manga}
            onSelect={() => onSelectComic(item.id)}
            onEdit={onEditManga}
            onDelete={() => onDeleteManga(item.id)}
          />
        </div>
      ))}
    </div>
  );
}
