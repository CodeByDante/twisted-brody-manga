import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Chapter, Manga } from '../types/manga';
import { LoadingSpinner } from './LoadingSpinner';

interface ChapterReaderProps {
  manga: Manga;
  chapter: Chapter;
  onBack: () => void;
}

export function ChapterReader({ manga, chapter, onBack }: ChapterReaderProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  if (!chapter.pages || chapter.pages.length === 0) {
    return (
      <div className="h-screen bg-[#121212] flex flex-col items-center justify-center">
        <button
          onClick={onBack}
          className="absolute top-6 left-6 p-2 hover:bg-[#333] rounded-lg transition-colors text-gray-300 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-gray-400 text-lg">No hay páginas disponibles</div>
      </div>
    );
  }

  const handlePrevPage = () => {
    if (currentPageIndex > 0) setCurrentPageIndex(currentPageIndex - 1);
  };

  const handleNextPage = () => {
    if (currentPageIndex < chapter.pages.length - 1) setCurrentPageIndex(currentPageIndex + 1);
  };

  const handleImageLoad = (index: number) => {
    setLoadedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(index);
      return newSet;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-[#121212] overflow-hidden">
      <header className="border-b border-gray-700/60 bg-gradient-to-r from-[#2a2a2a] to-[#252525] px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-[#333] rounded-lg transition-colors text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{manga.title}</h1>
              <p className="text-sm text-gray-400">{chapter.title}</p>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {currentPageIndex + 1} / {chapter.pages.length}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-[#121212]">
        <div className="flex flex-col items-center gap-4 w-full py-8">
          {chapter.pages.map((page, index) => (
            <div key={index} className="relative w-full flex justify-center">
              {!loadedImages.has(index) && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#121212] z-10 min-h-[400px]">
                  <LoadingSpinner size={40} borderWidth={2} />
                </div>
              )}
              <img
                src={page}
                alt={`Página ${index + 1}`}
                onLoad={() => handleImageLoad(index)}
                className={`max-w-full h-auto object-contain shadow-2xl ${loadedImages.has(index) ? 'animate-smooth-fade-in' : 'opacity-0'}`}
                loading={index > 2 ? "lazy" : "eager"}
              />
            </div>
          ))}
        </div>
      </main>

      <div className="border-t border-gray-700/60 bg-gradient-to-r from-[#2a2a2a] to-[#252525] px-6 py-6 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={handlePrevPage}
            disabled={currentPageIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            Anterior
          </button>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max={chapter.pages.length - 1}
              value={currentPageIndex}
              onChange={(e) => setCurrentPageIndex(parseInt(e.target.value))}
              className="w-64 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#bb86fc]"
            />
            <span className="text-sm text-gray-400 w-12 text-right">
              {currentPageIndex + 1}/{chapter.pages.length}
            </span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPageIndex === chapter.pages.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all"
          >
            Siguiente
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
