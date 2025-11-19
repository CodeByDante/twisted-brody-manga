import { useState } from 'react';
import { BookOpen, Edit2, Trash2 } from 'lucide-react';
import { Manga } from '../types/manga';
import { ImageLoader } from './ImageLoader';

interface MangaCardProps {
  id: string;
  title: string;
  author: string;
  pageCount: number;
  thumbnail?: string;
  manga?: Manga;
  onSelect?: (id: string) => void;
  onEdit?: (manga: Manga) => void;
  onDelete?: (id: string) => void;
}

export function MangaCard({ id, title, author, pageCount, thumbnail, manga, onSelect, onEdit, onDelete }: MangaCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
    setShowDeleteConfirm(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (manga) {
      onEdit?.(manga);
    }
  };

  return (
    <div className="group cursor-pointer flex flex-col w-full max-w-xs">
      <div
        onClick={() => onSelect?.(id)}
        className="relative bg-black rounded-lg shadow-lg overflow-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-purple-500/20 aspect-[2/3]"
      >
        {thumbnail ? (
          <>
            <ImageLoader
              src={thumbnail}
              alt={title}
              aspectRatio="2/3"
              objectFit="cover"
              loading="lazy"
              showPlaceholder={true}
            />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out pointer-events-none"></div>
          </>
        ) : (
          <div className="w-full aspect-[2/3] flex items-center justify-center text-white/40 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg transition-all duration-300 group-hover:text-white/60">
            <BookOpen className="w-12 h-12 transition-transform duration-300 group-hover:scale-110" />
          </div>
        )}

        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out transform translate-y-2 group-hover:translate-y-0">
          {pageCount} paginas
        </div>

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out flex gap-1 transform -translate-y-2 group-hover:translate-y-0">
          {manga && onEdit && (
            <button
              onClick={handleEditClick}
              className="bg-black/60 hover:bg-purple-600 text-white p-1.5 rounded-full transition-all duration-200 backdrop-blur-sm transform hover:scale-110 active:scale-95"
              title="Editar manga"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-full transition-all duration-200 backdrop-blur-sm transform hover:scale-110 active:scale-95"
              title="Eliminar manga"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-lg z-20 animate-in fade-in duration-200">
            <p className="text-white text-sm font-semibold text-center px-3">Eliminar manga?</p>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-1 sm:mt-2 flex flex-col gap-0.5 text-center mb-2">
        <h3
          onClick={() => onSelect?.(id)}
          className="font-semibold text-xs sm:text-sm text-white line-clamp-2 cursor-pointer text-center group-hover:text-purple-400 transition-colors duration-300 ease-out"
        >
          {title}
        </h3>
        {author && author.trim() !== '' && (
          <p className="text-xs text-gray-400 text-center group-hover:text-gray-300 transition-colors duration-300 ease-out">
            {author}
          </p>
        )}
      </div>
    </div>
  );
}
