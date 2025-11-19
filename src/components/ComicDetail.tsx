import { ArrowLeft, BookMarked, User, Download, ChevronDown, Link as LinkIcon, X, Plus, Rows, Grid2X2, Grid3X3, FileText, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getMangaById, incrementMangaViews, addExternalLink, removeExternalLink, getRecommendations, getAllMangas } from '../services/manga';
import { Manga } from '../types/manga';
import { downloadAllPagesAsZip } from '../utils/downloadHelpers';
import { generatePDFFromPages } from '../utils/pdfHelpers';
import { detectImageOrientation } from '../utils/imageOptimization';
import { LoadingSpinner } from './LoadingSpinner';
import { ImageLightbox } from './ImageLightbox';
import { ImageLoader } from './ImageLoader';
import { MangaCard } from './MangaCard';

interface ComicDetailProps {
  id: string;
  onBack: () => void;
  onReadChapter?: (chapter: any) => void;
  onMangaLoaded?: (manga: Manga) => void;
  onNavigateToManga?: (mangaId: string) => void;
}

export function ComicDetail({ id, onBack, onReadChapter, onMangaLoaded, onNavigateToManga }: ComicDetailProps) {
  const [manga, setManga] = useState<Manga | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [externalLinkForm, setExternalLinkForm] = useState({ name: '', url: '' });
  const [externalLinks, setExternalLinks] = useState<Array<{ name: string; url: string }>>([]);
  const [coverOrientation, setCoverOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  const [viewMode, setViewMode] = useState<'vertical' | 'gallery' | 'grid'>('vertical');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [recommendations, setRecommendations] = useState<Manga[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allMangas, setAllMangas] = useState<Manga[]>([]);
  const [loadingAllMangas, setLoadingAllMangas] = useState(false);

  useEffect(() => {
    loadManga();
    loadAllMangasForSearch();
    setSearchTerm('');
    const savedViewMode = localStorage.getItem('manga-view-mode');
    if (savedViewMode === 'vertical' || savedViewMode === 'gallery' || savedViewMode === 'grid') {
      setViewMode(savedViewMode);
    }
  }, [id]);

  async function loadAllMangasForSearch() {
    try {
      setLoadingAllMangas(true);
      const mangas = await getAllMangas();
      setAllMangas(mangas);
    } catch (error) {
      console.error('Error loading all mangas:', error);
    } finally {
      setLoadingAllMangas(false);
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (showDownloadMenu && !target.closest('.download-menu-container')) {
        setShowDownloadMenu(false);
      }
      if (showPdfMenu && !target.closest('.pdf-menu-container')) {
        setShowPdfMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadMenu, showPdfMenu]);

  const handleAddExternalLink = async () => {
    if (externalLinkForm.name.trim() && externalLinkForm.url.trim() && manga) {
      try {
        await addExternalLink(manga.id, externalLinkForm);
        setExternalLinks([...externalLinks, externalLinkForm]);
        setExternalLinkForm({ name: '', url: '' });
        setShowExternalLinkModal(false);
      } catch (error) {
        console.error('Error al guardar el enlace:', error);
        alert('Error al guardar el enlace');
      }
    }
  };

  const handleRemoveExternalLink = async (index: number) => {
    if (manga) {
      try {
        await removeExternalLink(manga.id, index);
        setExternalLinks(externalLinks.filter((_, i) => i !== index));
      } catch (error) {
        console.error('Error al eliminar el enlace:', error);
        alert('Error al eliminar el enlace');
      }
    }
  };

  const handleViewModeChange = (mode: 'vertical' | 'gallery' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('manga-view-mode', mode);
  };

  async function loadManga() {
    try {
      setLoading(true);
      const data = await getMangaById(id);
      setManga(data);
      if (data) {
        incrementMangaViews(id);
        onMangaLoaded?.(data);
        setExternalLinks(data.external_links || []);

        if (data.cover_url) {
          try {
            const orientation = await detectImageOrientation(data.cover_url);
            setCoverOrientation(orientation);
          } catch (error) {
            console.warn('Failed to detect image orientation:', error);
            setCoverOrientation('portrait');
          }
        }

        loadRecommendations(data);
      }
    } catch (error) {
      console.error('Error loading manga:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecommendations(currentManga: Manga) {
    try {
      setLoadingRecommendations(true);
      const categoryIds = currentManga.categories?.map(cat => cat.id) || [];
      const recs = await getRecommendations(currentManga.id, categoryIds, currentManga.title);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  }

  function detectImageFormat(blob: Blob, url: string, storedFormat?: string): string {
    if (storedFormat && storedFormat !== 'jpeg') {
      return storedFormat;
    }

    if (storedFormat === 'jpeg') {
      return 'jpg';
    }

    const mimeType = blob.type;
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/gif') return 'gif';
    if (mimeType === 'image/webp') return 'webp';

    const urlLower = url.toLowerCase();
    if (urlLower.includes('.png')) return 'png';
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'jpg';
    if (urlLower.includes('.gif')) return 'gif';
    if (urlLower.includes('.webp')) return 'webp';

    return 'jpg';
  }

  async function handleDownload(format: 'png' | 'jpg' | 'webp' | 'original') {
    if (!manga?.chapters?.[0]?.pages || manga.chapters[0].pages.length === 0) {
      alert('No hay páginas para descargar');
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    setShowDownloadMenu(false);

    try {
      const chapter = manga.chapters[0];
      const pages = format === 'original' && chapter.original_pages && chapter.original_pages.length > 0
        ? chapter.original_pages
        : chapter.pages;
      const formats = chapter.page_formats || [];

      await downloadAllPagesAsZip(pages, formats, manga.title, format, setDownloadProgress);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      alert('Error al crear el archivo ZIP. Por favor intenta de nuevo.');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  }

  async function handleDownloadPdf(format: 'png' | 'jpg' | 'webp' | 'original') {
    if (!manga?.chapters?.[0]?.pages || manga.chapters[0].pages.length === 0) {
      alert('No hay páginas para descargar');
      return;
    }

    setDownloadingPdf(true);
    setPdfProgress(0);
    setShowPdfMenu(false);

    try {
      const chapter = manga.chapters[0];
      const pages = format === 'original' && chapter.original_pages && chapter.original_pages.length > 0
        ? chapter.original_pages
        : chapter.pages;
      const formats = chapter.page_formats || [];

      await generatePDFFromPages(pages, formats, manga.title, format, setPdfProgress);
    } catch (error) {
      console.error('Error creating PDF:', error);
      alert('Error al crear el archivo PDF. Por favor intenta de nuevo.');
    } finally {
      setDownloadingPdf(false);
      setPdfProgress(0);
    }
  }

  if (loading) {
    return (
      <div className="h-screen bg-[#121212] flex flex-col items-center justify-center gap-4">
        <LoadingSpinner size={40} borderWidth={2} />
        <div className="text-gray-400 text-sm">Cargando...</div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-gray-400 text-lg">Manga no encontrado</div>
      </div>
    );
  }

  const filteredMangas = searchTerm.trim()
    ? allMangas.filter(m => {
        if (!m.id || !m.title || m.id === manga.id) return false;
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = m.title.toLowerCase().includes(searchLower);
        const authorMatch = m.author ? m.author.toLowerCase().includes(searchLower) : false;
        const categoryMatch = m.categories?.some(cat => cat?.name?.toLowerCase().includes(searchLower)) || false;
        return titleMatch || authorMatch || categoryMatch;
      })
    : [];

  return (
    <div className="h-screen flex flex-col bg-[#121212] overflow-hidden">
      <header className="border-b border-gray-800 z-40 bg-[#0a0a0a] flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#333] rounded-lg transition-colors text-gray-300 hover:text-white flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-bold text-white truncate flex-shrink-0">{manga.title}</h1>
          <div className="flex-1 max-w-md ml-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar comics…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1a1a] text-white rounded-lg pl-10 pr-3 py-2 text-sm placeholder-gray-400 focus:ring-2 focus:ring-[#bb86fc] focus:outline-none transition-all border border-gray-700/50 focus:border-[#bb86fc]"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-[#121212]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <div className="group w-56 sm:w-64">
                <div className="relative bg-black rounded-lg shadow-lg overflow-hidden cover-image">
                  {manga.cover_url ? (
                    <>
                      <ImageLoader
                        src={manga.cover_url}
                        alt={manga.title}
                        aspectRatio="2/3"
                        objectFit="cover"
                        loading="eager"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none"></div>
                    </>
                  ) : (
                    <div className="w-full aspect-[2/3] flex items-center justify-center text-white/40 bg-black">
                      <BookMarked className="w-16 h-16" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3 sm:mb-4">{manga.title}</h2>

              <div className="mb-4">
                <div className="flex items-center gap-2 text-gray-300">
                  <User className="w-4 h-4 text-[#bb86fc]" />
                  <span className="text-sm">{manga.author}</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Categorías</h3>
                <div className="flex gap-2 flex-wrap">
                  {manga.categories?.map((cat) => (
                    <span
                      key={cat.id}
                      className="px-3 py-1.5 bg-[#bb86fc]/20 text-[#bb86fc] text-xs rounded-full border border-[#bb86fc]/40"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:gap-4">
                {manga.chapters && manga.chapters.length > 0 && manga.chapters[0].pages && manga.chapters[0].pages.length > 0 && (
                  <>
                    {downloading && (
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs sm:text-sm font-semibold text-[#bb86fc]">Descargando ZIP</span>
                          <span className="text-xs sm:text-sm font-bold text-[#bb86fc]">{downloadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-700/40 rounded-full h-2 overflow-hidden border border-[#bb86fc]/30">
                          <div
                            className="bg-gradient-to-r from-[#bb86fc] to-[#9966dd] h-full transition-all duration-300 ease-out"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {downloadingPdf && (
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs sm:text-sm font-semibold text-[#bb86fc]">Generando PDF</span>
                          <span className="text-xs sm:text-sm font-bold text-[#bb86fc]">{pdfProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-700/40 rounded-full h-2 overflow-hidden border border-[#bb86fc]/30">
                          <div
                            className="bg-gradient-to-r from-[#bb86fc] to-[#9966dd] h-full transition-all duration-300 ease-out"
                            style={{ width: `${pdfProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 items-center">
                      <div className="relative download-menu-container">
                        <button
                          onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                          disabled={downloading}
                          className="bg-[#121212] hover:bg-[#1f1f1f] border border-[#bb86fc]/50 hover:border-[#bb86fc] text-[#bb86fc] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center gap-1 font-semibold text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="hidden sm:inline">{downloading ? `Descargando (${downloadProgress}%)` : 'ZIP'}</span>
                          <span className="sm:hidden">ZIP</span>
                        </button>

                        {showDownloadMenu && !downloading && (
                          <div className="absolute top-full mt-2 left-0 bg-[#1f1f1f] border border-gray-700/60 rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-50 min-w-[200px]">
                            <button
                              onClick={() => handleDownload('original')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2 border-b border-gray-700/40"
                            >
                              <Download className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">Original</div>
                                <div className="text-xs text-gray-400">Sin cambios</div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDownload('webp')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2 border-b border-gray-700/40"
                            >
                              <Download className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">WebP</div>
                                <div className="text-xs text-gray-400">Optimizado</div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDownload('png')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2 border-b border-gray-700/40"
                            >
                              <Download className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">PNG</div>
                                <div className="text-xs text-gray-400">Sin pérdida</div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDownload('jpg')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2"
                            >
                              <Download className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">JPG</div>
                                <div className="text-xs text-gray-400">Comprimido</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative pdf-menu-container">
                        <button
                          onClick={() => setShowPdfMenu(!showPdfMenu)}
                          disabled={downloadingPdf}
                          className="bg-[#121212] hover:bg-[#1f1f1f] border border-[#bb86fc]/50 hover:border-[#bb86fc] text-[#bb86fc] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center gap-1 font-semibold text-xs sm:text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="hidden sm:inline">{downloadingPdf ? `Generando (${pdfProgress}%)` : 'PDF'}</span>
                          <span className="sm:hidden">PDF</span>
                        </button>

                        {showPdfMenu && !downloadingPdf && (
                          <div className="absolute top-full mt-2 left-0 bg-[#1f1f1f] border border-gray-700/60 rounded-lg shadow-2xl shadow-black/50 overflow-hidden z-50 min-w-[200px]">
                            <button
                              onClick={() => handleDownloadPdf('original')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2 border-b border-gray-700/40"
                            >
                              <FileText className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">Original</div>
                                <div className="text-xs text-gray-400">Sin cambios</div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDownloadPdf('webp')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2 border-b border-gray-700/40"
                            >
                              <FileText className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">WebP</div>
                                <div className="text-xs text-gray-400">Optimizado</div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDownloadPdf('png')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2 border-b border-gray-700/40"
                            >
                              <FileText className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">PNG</div>
                                <div className="text-xs text-gray-400">Sin pérdida</div>
                              </div>
                            </button>
                            <button
                              onClick={() => handleDownloadPdf('jpg')}
                              className="w-full px-3 py-2 text-left text-xs sm:text-sm text-white hover:bg-[#bb86fc]/20 transition-colors flex items-center gap-2"
                            >
                              <FileText className="w-3 h-3 text-[#bb86fc]" />
                              <div>
                                <div className="font-semibold">JPG</div>
                                <div className="text-xs text-gray-400">Comprimido</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      {externalLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-[#121212] hover:bg-[#1f1f1f] border border-[#bb86fc]/50 hover:border-[#bb86fc] text-[#bb86fc] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center gap-1.5 font-semibold text-xs sm:text-sm transition-all duration-200 group"
                        >
                          <LinkIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate max-w-[150px]">{link.name}</span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveExternalLink(index);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all flex-shrink-0"
                          >
                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
                          </button>
                        </a>
                      ))}

                      <button
                        onClick={() => setShowExternalLinkModal(true)}
                        className="bg-[#121212] hover:bg-[#1f1f1f] border border-[#bb86fc]/50 hover:border-[#bb86fc] text-[#bb86fc] p-1.5 sm:p-2 rounded-lg transition-all duration-200 flex items-center justify-center"
                        title="Añadir enlace externo"
                      >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {searchTerm.trim() ? (
            <div className="mt-6 sm:mt-8 border-t border-gray-800 pt-6 sm:pt-8">
              <h3 className="text-lg font-semibold text-white mb-4">
                Resultados de búsqueda
                {filteredMangas.length > 0 && (
                  <span className="text-sm text-gray-400 ml-2">
                    ({filteredMangas.length} {filteredMangas.length === 1 ? 'resultado' : 'resultados'})
                  </span>
                )}
              </h3>
              {loadingAllMangas ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size={40} borderWidth={2} />
                </div>
              ) : filteredMangas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm">No se encontraron comics que coincidan con "{searchTerm}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {filteredMangas.map((m) => {
                    if (!m.id || !m.title) return null;
                    const chapterCount = m.chapters?.length || 0;
                    const totalPages = m.chapters?.reduce((sum, ch) => sum + (ch.pages?.length || 0), 0) || 0;
                    return (
                      <MangaCard
                        key={m.id}
                        id={m.id}
                        title={m.title}
                        author={m.author || 'Desconocido'}
                        pageCount={totalPages}
                        thumbnail={m.cover_url || m.thumbnail_url || undefined}
                        manga={m}
                        onSelect={(mangaId) => {
                          if (onNavigateToManga) {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            onNavigateToManga(mangaId);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : manga.chapters && manga.chapters.length > 0 && manga.chapters[0].pages && manga.chapters[0].pages.length > 0 && (
            <div className="mt-6 sm:mt-8 border-t border-gray-800 pt-6 sm:pt-8">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className="text-lg font-semibold text-white">
                  Páginas
                </h3>
                <div className="flex items-center gap-1 bg-[#0a0a0a] border border-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => handleViewModeChange('vertical')}
                    className={`px-3 py-2 rounded-md flex items-center gap-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                      viewMode === 'vertical'
                        ? 'bg-gradient-to-r from-[#bb86fc] to-[#9966dd] text-white shadow-lg shadow-[#bb86fc]/30'
                        : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                    }`}
                    title="Vista vertical"
                  >
                    <Rows className="w-4 h-4" />
                    <span className="hidden sm:inline">Vertical</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('gallery')}
                    className={`px-3 py-2 rounded-md flex items-center gap-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                      viewMode === 'gallery'
                        ? 'bg-gradient-to-r from-[#bb86fc] to-[#9966dd] text-white shadow-lg shadow-[#bb86fc]/30'
                        : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                    }`}
                    title="Vista galería"
                  >
                    <Grid2X2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Galería</span>
                  </button>
                  <button
                    onClick={() => handleViewModeChange('grid')}
                    className={`px-3 py-2 rounded-md flex items-center gap-2 text-xs sm:text-sm font-medium transition-all duration-200 ${
                      viewMode === 'grid'
                        ? 'bg-gradient-to-r from-[#bb86fc] to-[#9966dd] text-white shadow-lg shadow-[#bb86fc]/30'
                        : 'text-gray-400 hover:text-white hover:bg-[#242424]'
                    }`}
                    title="Vista cuadrícula"
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Cuadrícula</span>
                  </button>
                </div>
              </div>

              <div className={`bg-[#121212] rounded-lg p-2 sm:p-4 transition-all duration-150 ease-out ${
                viewMode === 'vertical'
                  ? 'flex flex-col items-center gap-4'
                  : viewMode === 'gallery'
                  ? 'masonry-container'
                  : 'grid grid-cols-3 md:grid-cols-5 gap-2'
              }`}>
                {viewMode === 'gallery' ? (
                  manga.chapters[0].pages
                    .map((pageUrl, index) => ({ pageUrl, index }))
                    .map(({ pageUrl, index }) => (
                      <div
                        key={index}
                        className="masonry-item group cursor-pointer"
                        onClick={() => {
                          setLightboxIndex(index);
                          setLightboxOpen(true);
                        }}
                      >
                        <ImageLoader
                          src={pageUrl}
                          alt={`Página ${index + 1}`}
                          aspectRatio="auto"
                          objectFit="contain"
                          loading={index > 2 ? "lazy" : "eager"}
                          className="rounded-lg shadow-lg"
                        />
                      </div>
                    ))
                ) : (
                  manga.chapters[0].pages
                    .map((pageUrl, index) => ({ pageUrl, index }))
                    .map(({ pageUrl, index }) => (
                      <div
                        key={index}
                        className={viewMode === 'vertical' ? 'w-full' : 'group cursor-pointer'}
                        onClick={() => {
                          if (viewMode === 'grid') {
                            setLightboxIndex(index);
                            setLightboxOpen(true);
                          }
                        }}
                      >
                        <ImageLoader
                          src={pageUrl}
                          alt={`Página ${index + 1}`}
                          aspectRatio={viewMode === 'vertical' ? 'auto' : '1/1'}
                          objectFit={viewMode === 'vertical' ? 'contain' : 'cover'}
                          loading={index > 2 ? "lazy" : "eager"}
                          className={viewMode === 'vertical' ? 'rounded-lg shadow-2xl' : 'rounded-lg shadow-md'}
                        />
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="mt-8 sm:mt-12 border-t border-gray-800 pt-8 sm:pt-12">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-6">Recomendaciones</h3>
              {loadingRecommendations ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size={32} borderWidth={2} />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {recommendations.map((rec, index) => (
                    <div
                      key={rec.id}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                      className="opacity-0 animate-[fadeIn_0.7s_ease-out_forwards]"
                    >
                      <div
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          if (onNavigateToManga) {
                            onNavigateToManga(rec.id);
                          }
                        }}
                        className="group cursor-pointer flex flex-col"
                      >
                        <div className="relative bg-black rounded-lg shadow-lg overflow-hidden">
                          {rec.cover_url || rec.thumbnail_url ? (
                            <>
                              <ImageLoader
                                src={rec.cover_url || rec.thumbnail_url || ''}
                                alt={rec.title}
                                aspectRatio="2/3"
                                objectFit="cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none"></div>
                            </>
                          ) : (
                            <div className="w-full aspect-[2/3] flex items-center justify-center text-white/40 bg-black">
                              <BookMarked className="w-8 h-8" />
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-col gap-0.5">
                          <h4 className="font-semibold text-xs text-white line-clamp-2 text-center group-hover:text-[#bb86fc] transition-colors duration-300">
                            {rec.title}
                          </h4>
                          {rec.categories && rec.categories.length > 0 && (
                            <p className="text-xs text-gray-500 text-center truncate">
                              {rec.categories[0].name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {lightboxOpen && manga.chapters[0]?.pages && (
        <ImageLightbox
          images={manga.chapters[0].pages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {showExternalLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1f1f1f] to-[#121212] rounded-2xl border border-gray-700/40 w-full max-w-md shadow-2xl">
            <div className="bg-gradient-to-b from-[#2a2a2a]/80 to-[#1f1f1f]/80 border-b border-gray-700/30 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Añadir Enlace Externo</h2>
              <button
                onClick={() => setShowExternalLinkModal(false)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Nombre del Enlace
                </label>
                <input
                  type="text"
                  placeholder="Ej: Servidor Alternativo"
                  value={externalLinkForm.name}
                  onChange={(e) => setExternalLinkForm({ ...externalLinkForm, name: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  URL del Enlace
                </label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/descarga"
                  value={externalLinkForm.url}
                  onChange={(e) => setExternalLinkForm({ ...externalLinkForm, url: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExternalLinkModal(false)}
                  className="flex-1 bg-[#1a1a1a] border border-gray-600/50 hover:border-gray-500 hover:bg-[#242424] text-white px-4 py-3 rounded-lg font-semibold text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddExternalLink}
                  disabled={!externalLinkForm.name.trim() || !externalLinkForm.url.trim()}
                  className="flex-1 bg-gradient-to-r from-[#bb86fc] to-[#9966dd] hover:from-[#9966dd] hover:to-[#7744cc] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-[#bb86fc]/40 hover:shadow-[#bb86fc]/60"
                >
                  Añadir Enlace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
