import { BookOpen, Plus, Search, Key } from 'lucide-react';
import { useState, useEffect } from 'react';
import { NewMangaModal } from './components/NewMangaModal';
import { ApiConfigModal } from './components/ApiConfigModal';
import { MangaGrid } from './components/MangaGrid';
import { ComicDetail } from './components/ComicDetail';
import { ChapterReader } from './components/ChapterReader';
import { LoadingSpinner } from './components/LoadingSpinner';
import { getAllMangas, deleteManga } from './services/manga';
import { Manga, Chapter } from './types/manga';

function App() {
  const [showModal, setShowModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [editingManga, setEditingManga] = useState<Manga | null>(null);
  const [selectedComicId, setSelectedComicId] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<{ manga: Manga; chapter: Chapter } | null>(null);
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadMangas();
  }, []);

  async function loadMangas() {
    try {
      setLoading(true);
      const data = await getAllMangas();
      setMangas(data);
    } catch (error) {
      console.error('Error loading mangas:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredMangas = mangas.filter(manga =>
    manga.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    manga.author.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditManga = (manga: Manga) => {
    setEditingManga(manga);
    setShowModal(true);
  };

  const handleDeleteManga = async (mangaId: string) => {
    try {
      await deleteManga(mangaId);
      await loadMangas();
    } catch (error) {
      console.error('Error deleting manga:', error);
      alert('Error al eliminar el manga. Por favor intenta de nuevo.');
    }
  };

  const mangaItems = filteredMangas.map(manga => {
    const chapterCount = manga.chapters?.length || 0;
    const totalPages = manga.chapters?.reduce((sum, ch) => sum + (ch.pages?.length || 0), 0) || 0;
    return {
      id: manga.id,
      title: manga.title,
      author: manga.author,
      chapterCount,
      pageCount: totalPages,
      thumbnail: manga.cover_url || manga.thumbnail_url || undefined,
      manga: manga,
    };
  });

  if (selectedChapter) {
    return (
      <ChapterReader
        manga={selectedChapter.manga}
        chapter={selectedChapter.chapter}
        onBack={() => setSelectedChapter(null)}
      />
    );
  }

  if (selectedComicId !== null) {
    let currentManga = mangas.find(m => m.id === selectedComicId);
    return (
      <ComicDetail
        id={selectedComicId}
        onBack={() => setSelectedComicId(null)}
        onReadChapter={(chapter) => {
          if (currentManga) {
            setSelectedChapter({ manga: currentManga, chapter });
          }
        }}
        onMangaLoaded={(loadedManga) => {
          if (!currentManga) {
            currentManga = loadedManga;
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <header className="border-b border-gray-800/50 px-3 sm:px-6 md:px-12 py-4 sm:py-6 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <BookOpen className="w-6 h-6 sm:w-9 sm:h-9 text-purple-400" />
            <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white">Biblioteca de Manga</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => setShowApiModal(true)}
              className="bg-gray-800 hover:bg-gray-700 active:scale-95 text-white px-2 py-2 sm:px-4 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 font-semibold transition-all duration-200 border border-gray-700/50 hover:border-gray-600 text-xs sm:text-sm"
              title="Configurar tu API de ImgBB"
            >
              <Key className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Configurar API</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-2 py-2 sm:px-4 sm:py-2.5 rounded-lg flex items-center gap-1.5 sm:gap-2 font-semibold transition-all duration-200 shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Nuevo Manga</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 md:px-12 py-8">
        <div className="max-w-[1800px] mx-auto flex items-center justify-center bg-[#1e1e1e] rounded-lg px-4 py-3 shadow-md mb-8 flex-shrink-0">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar manga…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#2a2a2a] text-white rounded-md pl-9 pr-3 py-2 text-sm placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="max-w-[1800px] mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <LoadingSpinner size={40} borderWidth={2} />
              <div className="text-gray-400 text-sm">Cargando mangas...</div>
            </div>
          ) : mangaItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <BookOpen className="w-16 h-16 text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg mb-2">No hay mangas disponibles</p>
              <p className="text-gray-500 text-sm">Crea tu primer manga usando el botón "Nuevo"</p>
            </div>
          ) : (
            <MangaGrid
              items={mangaItems}
              onSelectComic={setSelectedComicId}
              onEditManga={handleEditManga}
              onDeleteManga={handleDeleteManga}
            />
          )}
        </div>
      </main>

      <NewMangaModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingManga(null);
        }}
        editingManga={editingManga}
        onMangaCreated={(mangaId) => {
          loadMangas();
          setEditingManga(null);
          if (mangaId && !editingManga) {
            setTimeout(() => {
              setSelectedComicId(mangaId);
            }, 500);
          }
        }}
      />

      <ApiConfigModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
      />
    </div>
  );
}

export default App;
