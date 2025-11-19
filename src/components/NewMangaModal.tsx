import { BookOpen, Plus, X, Image as ImageIcon, Trash2, GripVertical, Settings2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { processImage, OptimizedImage } from '../utils/imageOptimization';
import { uploadToImgBB, uploadMultipleToImgBB } from '../services/imgbb';
import { createManga, updateManga, getAllCategories, createCategory, createChapter } from '../services/manga';
import { Category, Manga } from '../types/manga';
import { LoadingSpinner } from './LoadingSpinner';
import { ImageLoader } from './ImageLoader';
import { db } from '../lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getBatchSize, saveBatchSize } from '../utils/batchSizeManager';

interface NewMangaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMangaCreated: (mangaId?: string) => void;
  editingManga?: Manga | null;
}

export function NewMangaModal({ isOpen, onClose, onMangaCreated, editingManga }: NewMangaModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    name: '',
    description: '',
    selectedCategories: [] as string[],
  });

  const [optimizedImage, setOptimizedImage] = useState<OptimizedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [chapterPages, setChapterPages] = useState<OptimizedImage[]>([]);
  const [isProcessingPages, setIsProcessingPages] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [currentUploadingImage, setCurrentUploadingImage] = useState(0);
  const [totalImagesToUpload, setTotalImagesToUpload] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentProcessingImage, setCurrentProcessingImage] = useState(0);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [showCoverSelector, setShowCoverSelector] = useState(false);
  const [selectedCoverPageIndex, setSelectedCoverPageIndex] = useState<number | null>(null);
  const [coverFromExistingPage, setCoverFromExistingPage] = useState<{ thumbnail: string; original: string } | null>(null);
  const [showBatchSizeModal, setShowBatchSizeModal] = useState(false);
  const [batchSize, setBatchSize] = useState(getBatchSize());

  const isEditMode = !!editingManga;

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      if (editingManga) {
        setFormData({
          title: editingManga.title,
          name: editingManga.author,
          description: editingManga.description || '',
          selectedCategories: editingManga.categories?.map(c => c.id) || [],
        });
        if (editingManga.thumbnail_url) {
          setPreviewUrl(editingManga.thumbnail_url);
        }

        const firstChapter = editingManga.chapters?.[0];
        if (firstChapter?.pages && firstChapter.pages.length > 0) {
          const pageUrls = firstChapter.pages;
          const originalPageUrls = firstChapter.original_pages || [];
          const optimizedPages: OptimizedImage[] = pageUrls.map((url, idx) => ({
            thumbnail: url,
            original: originalPageUrls[idx] || url,
            webpDisplay: url,
            webpCover: url,
            originalFormat: firstChapter.page_formats?.[idx] || 'jpg',
            originalBase64: '',
            originalUnmodified: '',
          }));
          setChapterPages(optimizedPages);
        }
      }
    }
  }, [isOpen, editingManga]);

  async function loadCategories() {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if ((name === 'title' || name === 'name') && value.trim()) {
      const words = value.trim().split(/\s+/).filter(word => word.length > 0);
      const autoCategories: string[] = [];

      for (const word of words) {
        const existingCategory = categories.find(
          cat => cat.name.toLowerCase() === word.toLowerCase()
        );

        if (existingCategory) {
          if (!autoCategories.includes(existingCategory.id)) {
            autoCategories.push(existingCategory.id);
          }
        }
      }

      setFormData(prev => ({
        ...prev,
        selectedCategories: [
          ...prev.selectedCategories.filter(id => !autoCategories.includes(id)),
          ...autoCategories,
        ],
      }));
    }
  };

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value;
    if (categoryId && !formData.selectedCategories.includes(categoryId)) {
      setFormData(prev => ({
        ...prev,
        selectedCategories: [...prev.selectedCategories, categoryId],
      }));
    }
  };

  const handleRemoveCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.filter(id => id !== categoryId),
    }));
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const words = newCategoryName.trim().split(/\s+/).filter(word => word.length > 0);

      const createdCategories: Category[] = [];

      for (const word of words) {
        const existingCategory = categories.find(
          cat => cat.name.toLowerCase() === word.toLowerCase()
        );

        if (existingCategory) {
          if (!formData.selectedCategories.includes(existingCategory.id)) {
            createdCategories.push(existingCategory);
          }
        } else {
          const newCategory = await createCategory(word);
          createdCategories.push(newCategory);
          setCategories(prev => [...prev, newCategory]);
        }
      }

      setFormData(prev => ({
        ...prev,
        selectedCategories: [
          ...prev.selectedCategories,
          ...createdCategories.map(cat => cat.id),
        ],
      }));
      setNewCategoryName('');
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Error al crear las categorías');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setPreviewLoaded(false);
    try {
      const processed = await processImage(file);
      setOptimizedImage(processed);
      setPreviewUrl(processed.originalUnmodified);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error al procesar la imagen. Intenta con otro archivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChapterPagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPages(true);
    setProcessingProgress(0);
    setCurrentProcessingImage(0);

    try {
      const processedPages: OptimizedImage[] = [];

      for (let i = 0; i < files.length; i++) {
        setCurrentProcessingImage(i + 1);
        const processed = await processImage(files[i]);
        processedPages.push(processed);
        setProcessingProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setChapterPages(prev => [...prev, ...processedPages]);
    } catch (error) {
      console.error('Error processing pages:', error);
      alert('Error al procesar algunas imágenes.');
    } finally {
      setIsProcessingPages(false);
      setProcessingProgress(0);
      setCurrentProcessingImage(0);
    }
  };

  const handleRemovePage = (index: number) => {
    setChapterPages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPages = [...chapterPages];
    const draggedPage = newPages[draggedIndex];

    newPages.splice(draggedIndex, 1);
    newPages.splice(index, 0, draggedPage);

    setChapterPages(newPages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleCreateManga = async () => {
    if (!formData.title || !formData.title.trim()) {
      alert('El título es requerido');
      return;
    }

    setIsCreating(true);

    try {
      let categoriesToAdd = [...formData.selectedCategories];

      const titleWords = formData.title.trim().split(/\s+/).filter(word => word.length > 0);
      for (const word of titleWords) {
        const existingCategory = categories.find(
          cat => cat.name.toLowerCase() === word.toLowerCase()
        );

        if (existingCategory) {
          if (!categoriesToAdd.includes(existingCategory.id)) {
            categoriesToAdd.push(existingCategory.id);
          }
        } else {
          const newCategory = await createCategory(word);
          categoriesToAdd.push(newCategory.id);
          setCategories(prev => [...prev, newCategory]);
        }
      }

      if (formData.name.trim()) {
        const authorWords = formData.name.trim().split(/\s+/).filter(word => word.length > 0);
        for (const word of authorWords) {
          const existingCategory = categories.find(
            cat => cat.name.toLowerCase() === word.toLowerCase()
          );

          if (existingCategory) {
            if (!categoriesToAdd.includes(existingCategory.id)) {
              categoriesToAdd.push(existingCategory.id);
            }
          } else {
            const newCategory = await createCategory(word);
            categoriesToAdd.push(newCategory.id);
            setCategories(prev => [...prev, newCategory]);
          }
        }
      }

      let thumbnailUrl: string | undefined = editingManga?.thumbnail_url;
      let coverUrl: string | undefined = editingManga?.cover_url;

      if (coverFromExistingPage) {
        thumbnailUrl = coverFromExistingPage.thumbnail;
        coverUrl = coverFromExistingPage.original;
      } else if (optimizedImage) {
        try {
          setUploadingImages(true);
          setTotalImagesToUpload(2);
          setCurrentUploadingImage(1);
          setUploadProgress(0);

          const thumbnailResponse = await uploadToImgBB(optimizedImage.thumbnail, `${formData.title}_thumb`);
          setUploadProgress(50);
          setCurrentUploadingImage(2);

          const coverResponse = await uploadToImgBB(optimizedImage.originalUnmodified, `${formData.title}_cover`);
          setUploadProgress(100);

          thumbnailUrl = thumbnailResponse.data.url;
          coverUrl = coverResponse.data.url;
        } catch (error: any) {
          console.error('Error uploading cover images:', error);
          if (error.message === 'API_BURNED') {
            alert('⚠️ API QUEMADA: La API de ImgBB ha alcanzado su límite. Por favor, usa otra API o intenta más tarde.');
          } else if (error.message === 'API_INVALID_KEY') {
            alert('❌ Clave API inválida: La clave API que estás usando no es válida.');
          } else {
            alert('Error al subir la portada. Continuar sin portada.');
          }
        } finally {
          setUploadingImages(false);
          setUploadProgress(0);
        }
      }

      if (isEditMode && editingManga) {
        const updateData: any = {
          title: formData.title.trim(),
          author: formData.name?.trim() || 'Anónimo',
          description: formData.description?.trim() || '',
          categoryIds: categoriesToAdd,
        };

        if (thumbnailUrl) {
          updateData.thumbnail_url = thumbnailUrl;
        }

        if (coverUrl) {
          updateData.cover_url = coverUrl;
        }

        await updateManga(editingManga.id, updateData);

        if (chapterPages.length > 0) {
          const hasNewPages = chapterPages.some(page => page.originalBase64 !== '');

          if (hasNewPages) {
            try {
              setUploadingImages(true);
              const newPages = chapterPages.filter(page => page.originalBase64 !== '');
              setTotalImagesToUpload(newPages.length * 2);
              setCurrentUploadingImage(0);
              setUploadProgress(0);

              const webpImages = newPages.map(page => page.webpDisplay);
              const originalImages = newPages.map(page => page.originalUnmodified);
              const pageFormats = newPages.map(page => page.originalFormat);

              const webpResponses = await uploadMultipleToImgBB(
                webpImages,
                `${formData.title}_updated_webp`,
                (current, total) => {
                  setCurrentUploadingImage(current);
                  setUploadProgress(Math.round((current / (newPages.length * 2)) * 100));
                }
              );

              const originalResponses = await uploadMultipleToImgBB(
                originalImages,
                `${formData.title}_updated_original`,
                (current, total) => {
                  setCurrentUploadingImage(newPages.length + current);
                  setUploadProgress(Math.round(((newPages.length + current) / (newPages.length * 2)) * 100));
                }
              );

              const newPageUrls = webpResponses.map(res => res.data.url);
              const newOriginalPageUrls = originalResponses.map(res => res.data.url);

              const existingPages = chapterPages.filter(page => page.originalBase64 === '');
              const existingPageUrls = existingPages.map(page => page.webpDisplay);
              const existingOriginalPageUrls = existingPages.map(page => page.original);
              const existingFormats = existingPages.map(page => page.originalFormat);

              const allPageUrls = [...existingPageUrls, ...newPageUrls];
              const allOriginalPageUrls = [...existingOriginalPageUrls, ...newOriginalPageUrls];
              const allFormats = [...existingFormats, ...pageFormats];

              setUploadingImages(false);
              setUploadProgress(0);

              const firstChapter = editingManga.chapters?.[0];
              if (firstChapter) {
                await updateDoc(doc(db, 'chapters', firstChapter.id), {
                  pages: allPageUrls,
                  page_formats: allFormats,
                  original_pages: allOriginalPageUrls,
                  updated_at: Timestamp.now(),
                });
              } else {
                await createChapter({
                  manga_id: editingManga.id,
                  number: 1,
                  title: 'Páginas',
                  pages: allPageUrls,
                  page_formats: allFormats,
                  original_pages: allOriginalPageUrls,
                });
              }
            } catch (error: any) {
              console.error('Error updating chapter:', error);
              if (error.message === 'API_BURNED') {
                alert('⚠️ API QUEMADA: La API de ImgBB ha alcanzado su límite. Por favor, usa otra API o intenta más tarde.');
              } else if (error.message === 'API_INVALID_KEY') {
                alert('❌ Clave API inválida: La clave API que estás usando no es válida.');
              } else {
                alert('Error al actualizar las páginas.');
              }
            }
          }
        }

        onMangaCreated(editingManga.id);
      } else {
        const mangaPayload: any = {
          title: formData.title.trim(),
          author: formData.name?.trim() || 'Anónimo',
          categoryIds: categoriesToAdd,
        };

        if (formData.description?.trim()) {
          mangaPayload.description = formData.description.trim();
        }

        if (thumbnailUrl) {
          mangaPayload.thumbnail_url = thumbnailUrl;
        }

        if (coverUrl) {
          mangaPayload.cover_url = coverUrl;
        }

        const manga = await createManga(mangaPayload);

        if (!manga.id) {
          throw new Error('No se pudo obtener el ID del manga creado');
        }

        const mangaId = manga.id;

        if (chapterPages.length > 0) {
          try {
            setUploadingImages(true);
            setTotalImagesToUpload(chapterPages.length * 2);
            setCurrentUploadingImage(0);
            setUploadProgress(0);

            const webpImages = chapterPages.map(page => page.webpDisplay);
            const originalImages = chapterPages.map(page => page.originalUnmodified);
            const pageFormats = chapterPages.map(page => page.originalFormat);

            const webpResponses = await uploadMultipleToImgBB(
              webpImages,
              `${formData.title}_ch1_webp`,
              (current, total) => {
                setCurrentUploadingImage(current);
                setUploadProgress(Math.round((current / (chapterPages.length * 2)) * 100));
              }
            );

            const originalResponses = await uploadMultipleToImgBB(
              originalImages,
              `${formData.title}_ch1_original`,
              (current, total) => {
                setCurrentUploadingImage(chapterPages.length + current);
                setUploadProgress(Math.round(((chapterPages.length + current) / (chapterPages.length * 2)) * 100));
              }
            );

            const pageUrls = webpResponses.map(res => res.data.url);
            const originalPageUrls = originalResponses.map(res => res.data.url);

            setUploadingImages(false);
            setUploadProgress(0);

            await createChapter({
              manga_id: mangaId,
              number: 1,
              title: 'Páginas',
              pages: pageUrls,
              page_formats: pageFormats,
              original_pages: originalPageUrls,
            });
          } catch (error: any) {
            console.error('Error creating chapter:', error);
            if (error.message === 'API_BURNED') {
              alert('⚠️ API QUEMADA: La API de ImgBB ha alcanzado su límite. Por favor, usa otra API o intenta más tarde.');
            } else if (error.message === 'API_INVALID_KEY') {
              alert('❌ Clave API inválida: La clave API que estás usando no es válida.');
            } else {
              alert('Error al crear el capítulo. Por favor intenta de nuevo.');
            }
          }
        }

        onMangaCreated(mangaId);
      }

      handleClose();
    } catch (error: any) {
      console.error('Error creating/updating manga:', error);

      let errorMessage = 'Error al guardar el manga. ';

      if (error.message) {
        errorMessage += error.message;
      } else if (error.code) {
        switch (error.code) {
          case 'permission-denied':
            errorMessage += 'No tienes permisos para realizar esta operación.';
            break;
          case 'unavailable':
            errorMessage += 'El servicio no está disponible. Verifica tu conexión.';
            break;
          case 'invalid-argument':
            errorMessage += 'Algunos datos no son válidos. Revisa el formulario.';
            break;
          default:
            errorMessage += `Código de error: ${error.code}`;
        }
      } else {
        errorMessage += 'Por favor intenta de nuevo.';
      }

      alert(errorMessage);
    } finally {
      setIsCreating(false);
      setUploadingImages(false);
      setUploadProgress(0);
    }
  };

  const handleSetCoverFromPage = (index: number) => {
    const page = chapterPages[index];
    const isExistingPage = !page.originalBase64;

    if (isExistingPage) {
      setCoverFromExistingPage({
        thumbnail: page.thumbnail,
        original: page.original,
      });
      setOptimizedImage(null);
    } else {
      const coverImage: OptimizedImage = {
        thumbnail: page.thumbnail,
        original: page.originalUnmodified,
        webpDisplay: page.originalUnmodified,
        webpCover: page.originalUnmodified,
        originalFormat: page.originalFormat,
        originalBase64: page.originalBase64,
        originalUnmodified: page.originalUnmodified,
      };
      setOptimizedImage(coverImage);
      setCoverFromExistingPage(null);
    }
    setPreviewUrl(page.thumbnail);
    setPreviewLoaded(true);
    setSelectedCoverPageIndex(index);
    setShowCoverSelector(false);
  };

  const handleClose = () => {
    setFormData({
      title: '',
      name: '',
      description: '',
      selectedCategories: [],
    });
    setOptimizedImage(null);
    setCoverFromExistingPage(null);
    setPreviewUrl(null);
    setNewCategoryName('');
    setChapterPages([]);
    setUploadProgress(0);
    setUploadingImages(false);
    setCurrentUploadingImage(0);
    setTotalImagesToUpload(0);
    setProcessingProgress(0);
    setCurrentProcessingImage(0);
    setShowCoverSelector(false);
    setSelectedCoverPageIndex(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-[#1f1f1f] to-[#121212] rounded-2xl border border-gray-700/40 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-b from-[#2a2a2a]/80 to-[#1f1f1f]/80 border-b border-gray-700/30 px-8 py-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#bb86fc] to-[#9966dd] rounded-lg shadow-lg shadow-[#bb86fc]/30">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              {isEditMode ? 'Editar Manga' : 'Crear Manga'}
            </h2>
            <p className="text-sm text-gray-400 mt-1.5">
              {isEditMode ? 'Actualiza los detalles de tu obra' : 'Comparte tu historia con el mundo'}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white hover:bg-white/10 transition-all p-2 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-5">
          <div className="bg-gradient-to-br from-[#242424] to-[#1a1a1a] rounded-xl p-6 border border-gray-700/40 shadow-lg hover:border-gray-700/60 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-5 bg-gradient-to-b from-[#bb86fc] to-[#7744cc] rounded-full"></div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Información Principal</h3>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-2">
                  Título del Manga <span className="text-red-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="El nombre de tu obra maestra"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all shadow-md hover:border-gray-600/70"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-2">
                  Autor <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Tu nombre o seudónimo"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all shadow-md hover:border-gray-600/70"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-200 mb-2">
                  Sinopsis <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <textarea
                  name="description"
                  placeholder="Cuéntanos de qué trata tu manga, qué lo hace especial..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all shadow-md hover:border-gray-600/70 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#242424] to-[#1a1a1a] rounded-xl p-6 border border-gray-700/40 shadow-lg hover:border-gray-700/60 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-5 bg-gradient-to-b from-[#bb86fc] to-[#7744cc] rounded-full"></div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Categorías</h3>
              <span className="text-xs text-gray-500 ml-auto">Opcional</span>
            </div>
            <div className="space-y-3">
              <select
                onChange={handleCategorySelect}
                value=""
                className="w-full bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all shadow-md hover:border-gray-600/70"
              >
                <option value="">Selecciona una categoría...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {formData.selectedCategories.length > 0 && (
                <div className="flex gap-2 flex-wrap pt-2">
                  {formData.selectedCategories.map(catId => {
                    const category = categories.find(c => c.id === catId);
                    return category ? (
                      <span
                        key={catId}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#bb86fc]/25 to-[#9966dd]/25 text-[#bb86fc] text-xs font-medium rounded-full border border-[#bb86fc]/50 flex items-center gap-2 hover:border-[#bb86fc] transition-all"
                      >
                        {category.name}
                        <button
                          onClick={() => handleRemoveCategory(catId)}
                          className="hover:text-white transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Nueva categoría..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateCategory()}
                  className="flex-1 bg-[#1a1a1a] border border-gray-600/50 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#bb86fc] focus:ring-2 focus:ring-[#bb86fc]/30 transition-all shadow-md hover:border-gray-600/70"
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim()}
                  className="bg-gradient-to-r from-[#bb86fc] to-[#9966dd] hover:from-[#9966dd] hover:to-[#7744cc] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-all font-medium shadow-lg shadow-[#bb86fc]/30"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#242424] to-[#1a1a1a] rounded-xl p-6 border border-gray-700/40 shadow-lg hover:border-gray-700/60 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-5 bg-gradient-to-b from-[#bb86fc] to-[#7744cc] rounded-full"></div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Portada</h3>
              <span className="text-xs text-gray-500 ml-auto">Opcional</span>
            </div>

            {isProcessing && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#bb86fc]">Procesando portada...</span>
                </div>
                <div className="w-full bg-gray-700/40 rounded-full h-2 overflow-hidden border border-[#bb86fc]/30">
                  <div className="bg-gradient-to-r from-[#bb86fc] to-[#9966dd] h-full transition-all duration-300 ease-out animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}

            {previewUrl && !isProcessing && (
              <div className="mb-4 relative group max-w-xs mx-auto">
                <ImageLoader
                  src={previewUrl}
                  alt="Preview"
                  aspectRatio="3/4"
                  objectFit="cover"
                  loading="eager"
                  className="rounded-xl border border-gray-600 shadow-2xl shadow-[#bb86fc]/20"
                />
                <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setOptimizedImage(null);
                      setPreviewUrl(null);
                      setPreviewLoaded(false);
                      setSelectedCoverPageIndex(null);
                    }}
                    className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-lg transition-all shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {selectedCoverPageIndex !== null && (
                  <div className="absolute bottom-2 left-2 bg-green-600/90 text-white text-xs px-2.5 py-1 rounded-lg font-semibold">
                    Página {selectedCoverPageIndex + 1}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mb-4">
              <label className="flex-1 border-2 border-dashed border-gray-600/50 rounded-xl p-6 cursor-pointer hover:border-[#bb86fc]/50 hover:bg-[#bb86fc]/5 transition-all block group">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#bb86fc] to-[#9966dd] rounded-xl flex items-center justify-center shadow-lg shadow-[#bb86fc]/40 group-hover:scale-110 group-hover:shadow-[#bb86fc]/60 transition-all">
                    {isProcessing ? (
                      <LoadingSpinner size={24} borderWidth={2} />
                    ) : (
                      <Plus className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white mb-0.5">
                      {isProcessing ? 'Procesando...' : 'Subir portada'}
                    </p>
                    <p className="text-xs text-gray-400">Archivo</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>

              {chapterPages.length > 0 && (
                <button
                  onClick={() => setShowCoverSelector(!showCoverSelector)}
                  className="flex-1 border-2 border-dashed border-gray-600/50 rounded-xl p-6 hover:border-[#bb86fc]/50 hover:bg-[#bb86fc]/5 transition-all group flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-[#9966dd] to-[#bb86fc] rounded-xl flex items-center justify-center shadow-lg shadow-[#bb86fc]/40 group-hover:scale-110 group-hover:shadow-[#bb86fc]/60 transition-all">
                    <ImageIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-white mb-0.5">
                      Elegir página
                    </p>
                    <p className="text-xs text-gray-400">{chapterPages.length} disponibles</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#242424] to-[#1a1a1a] rounded-xl p-6 border border-gray-700/40 shadow-lg hover:border-gray-700/60 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-5 bg-gradient-to-b from-[#bb86fc] to-[#7744cc] rounded-full"></div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Páginas del Capítulo</h3>
              <span className="text-xs text-gray-500 ml-auto">Opcional</span>
              <button
                onClick={() => setShowBatchSizeModal(true)}
                className="bg-[#1a1a1a] hover:bg-[#242424] border border-gray-600/50 hover:border-[#bb86fc]/50 text-gray-300 hover:text-[#bb86fc] p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium"
                title="Configurar tamaño de lote de subida"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Subida: {batchSize === 0 ? 'Sin límite' : `${batchSize} por lote`}</span>
              </button>
            </div>

            {isProcessingPages && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#bb86fc]">
                    Procesando imagen {currentProcessingImage}...
                  </span>
                  <span className="text-xs font-bold text-[#bb86fc]">{processingProgress}%</span>
                </div>
                <div className="w-full bg-gray-700/40 rounded-full h-2 overflow-hidden border border-[#bb86fc]/30">
                  <div
                    className="bg-gradient-to-r from-[#bb86fc] to-[#9966dd] h-full transition-all duration-300 ease-out"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {chapterPages.length > 0 && !isProcessingPages && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="w-3.5 h-3.5 text-gray-500" />
                  <p className="text-xs text-gray-400">
                    {chapterPages.length} página{chapterPages.length !== 1 ? 's' : ''} • Arrastra para reordenar
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {chapterPages.map((page, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      style={{
                        animationDelay: `${index * 40}ms`,
                      }}
                      className={`relative group cursor-move opacity-0 animate-[fadeIn_0.7s_ease-out_forwards] ${
                        draggedIndex === index ? 'opacity-50 scale-95' : 'hover:scale-105'
                      } transition-all duration-200`}
                    >
                      <div className="relative overflow-hidden w-full aspect-[3/4] rounded-lg border border-gray-600/50 shadow-md">
                        <img
                          src={page.thumbnail}
                          alt={`Página ${index + 1}`}
                          className="w-full h-full object-cover transition-transform duration-700 ease-in-out transform-gpu group-hover:scale-[1.08] group-hover:shadow-[#bb86fc]/30"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <GripVertical className="w-4 h-4 text-white/70" />
                        <button
                          onClick={() => handleRemovePage(index)}
                          className="bg-red-600/80 hover:bg-red-600 text-white p-1.5 rounded-lg transition-all shadow-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="absolute top-1.5 left-1.5 bg-black/80 text-white text-xs px-2 py-0.5 rounded-md font-semibold">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="border-2 border-dashed border-gray-600/50 rounded-xl p-8 text-center cursor-pointer hover:border-[#bb86fc]/50 hover:bg-[#bb86fc]/5 transition-all block group">
              <div className="w-14 h-14 bg-gradient-to-br from-[#bb86fc] to-[#9966dd] rounded-xl flex items-center justify-center mx-auto mb-2.5 shadow-lg shadow-[#bb86fc]/40 group-hover:scale-110 group-hover:shadow-[#bb86fc]/60 transition-all">
                {isProcessingPages ? (
                  <LoadingSpinner size={24} borderWidth={2} />
                ) : (
                  <ImageIcon className="w-7 h-7 text-white" />
                )}
              </div>
              <p className="text-sm font-semibold text-white mb-1">
                {isProcessingPages ? `Procesando ${currentProcessingImage}...` : chapterPages.length > 0 ? 'Agregar más páginas' : 'Sube tus páginas'}
              </p>
              <p className="text-xs text-gray-400 mb-2">Arrastra o selecciona múltiples imágenes</p>
              <p className="text-xs text-gray-500">Se optimizan automáticamente para mejor rendimiento</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleChapterPagesChange}
                disabled={isProcessingPages}
                className="hidden"
              />
            </label>
          </div>

          {uploadingImages && (
            <div className="mb-6 bg-gradient-to-br from-[#242424] to-[#1a1a1a] rounded-xl p-5 border border-[#bb86fc]/30 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LoadingSpinner size={16} borderWidth={2} />
                  <span className="text-sm font-semibold text-white">
                    Subiendo imagen {currentUploadingImage} de {totalImagesToUpload}
                  </span>
                </div>
                <span className="text-sm font-bold text-[#bb86fc]">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-700/40 rounded-full h-3 overflow-hidden border border-[#bb86fc]/40 shadow-inner">
                <div
                  className="bg-gradient-to-r from-[#bb86fc] via-[#9966dd] to-[#bb86fc] h-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${uploadProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Por favor no cierres esta ventana...
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t border-gray-700/50">
            <button
              onClick={handleClose}
              disabled={isCreating || uploadingImages}
              className="flex-1 bg-[#1a1a1a] border border-gray-600/50 hover:border-gray-500 hover:bg-[#242424] text-white px-5 py-3 rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateManga}
              className="flex-1 bg-gradient-to-r from-[#bb86fc] to-[#9966dd] hover:from-[#9966dd] hover:to-[#7744cc] text-white px-5 py-3 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-[#bb86fc]/40 hover:shadow-[#bb86fc]/60 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              disabled={isProcessing || isCreating || uploadingImages || !formData.title.trim()}
            >
              {uploadingImages ? 'Subiendo imágenes...' : isCreating ? (isEditMode ? 'Actualizando...' : 'Creando...') : (isEditMode ? 'Guardar Cambios' : 'Crear Manga')}
            </button>
          </div>
        </div>
      </div>

      {showCoverSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1f1f1f] to-[#121212] rounded-2xl border border-gray-700/40 w-full max-w-2xl max-h-[80vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-b from-[#2a2a2a]/80 to-[#1f1f1f]/80 border-b border-gray-700/30 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white">Selecciona portada</h2>
                <p className="text-xs text-gray-400 mt-1">Elige una página para usar como portada del manga</p>
              </div>
              <button
                onClick={() => setShowCoverSelector(false)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {chapterPages.map((page, index) => (
                  <button
                    key={index}
                    onClick={() => handleSetCoverFromPage(index)}
                    className={`group relative aspect-[3/4] rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 border-2 ${
                      selectedCoverPageIndex === index
                        ? 'border-green-500 shadow-lg shadow-green-500/40'
                        : 'border-gray-600/50 hover:border-[#bb86fc]/50'
                    }`}
                  >
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={page.thumbnail}
                        alt={`Página ${index + 1}`}
                        className="w-full h-full object-cover transition-transform duration-700 ease-in-out transform-gpu group-hover:scale-[1.10]"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-[#bb86fc]/90 text-white px-3 py-1.5 rounded-lg font-semibold text-sm">
                        Seleccionar
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs px-2 py-1 rounded-md font-semibold">
                      {index + 1}
                    </div>
                    {selectedCoverPageIndex === index && (
                      <div className="absolute top-2 right-2 bg-green-600/90 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold text-xs">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                        Seleccionado
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-b from-[#1f1f1f]/80 to-[#1a1a1a]/80 border-t border-gray-700/30 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setShowCoverSelector(false)}
                className="bg-[#1a1a1a] border border-gray-600/50 hover:border-gray-500 hover:bg-[#242424] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowCoverSelector(false)}
                className="bg-gradient-to-r from-[#bb86fc] to-[#9966dd] hover:from-[#9966dd] hover:to-[#7744cc] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-[#bb86fc]/40 hover:shadow-[#bb86fc]/60"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchSizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-[#1f1f1f] to-[#121212] rounded-2xl border border-gray-700/40 w-full max-w-md shadow-2xl">
            <div className="bg-gradient-to-b from-[#2a2a2a]/80 to-[#1f1f1f]/80 border-b border-gray-700/30 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#bb86fc] to-[#9966dd] rounded-lg shadow-lg shadow-[#bb86fc]/30">
                  <Settings2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Configurar Subida</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Tamaño de lote de imágenes</p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchSizeModal(false)}
                className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#1a1a1a] border border-gray-700/40 rounded-lg p-4 mb-4">
                <h3 className="text-xs font-semibold text-gray-300 mb-2">Opciones disponibles:</h3>
                <ul className="text-xs text-gray-400 space-y-1.5">
                  <li>• 1 por lote: Más lento pero más estable</li>
                  <li>• 10 por lote: Balance entre velocidad y estabilidad (predeterminado)</li>
                  <li>• 50 por lote: Más rápido para muchas imágenes</li>
                  <li>• Sin límite: Sube todas las imágenes simultáneamente</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setBatchSize(1);
                    saveBatchSize(1);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    batchSize === 1
                      ? 'border-[#bb86fc] bg-[#bb86fc]/10 shadow-lg shadow-[#bb86fc]/30'
                      : 'border-gray-600/50 hover:border-gray-600 bg-[#1a1a1a]'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">1</div>
                    <div className="text-xs text-gray-400">Por lote</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setBatchSize(10);
                    saveBatchSize(10);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    batchSize === 10
                      ? 'border-[#bb86fc] bg-[#bb86fc]/10 shadow-lg shadow-[#bb86fc]/30'
                      : 'border-gray-600/50 hover:border-gray-600 bg-[#1a1a1a]'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">10</div>
                    <div className="text-xs text-gray-400">Por lote</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setBatchSize(50);
                    saveBatchSize(50);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    batchSize === 50
                      ? 'border-[#bb86fc] bg-[#bb86fc]/10 shadow-lg shadow-[#bb86fc]/30'
                      : 'border-gray-600/50 hover:border-gray-600 bg-[#1a1a1a]'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">50</div>
                    <div className="text-xs text-gray-400">Por lote</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setBatchSize(0);
                    saveBatchSize(999999);
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    batchSize === 0 || batchSize >= 999999
                      ? 'border-[#bb86fc] bg-[#bb86fc]/10 shadow-lg shadow-[#bb86fc]/30'
                      : 'border-gray-600/50 hover:border-gray-600 bg-[#1a1a1a]'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">∞</div>
                    <div className="text-xs text-gray-400">Sin límite</div>
                  </div>
                </button>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-green-400 text-xs font-semibold">
                  Configuración guardada: {batchSize === 0 || batchSize >= 999999 ? 'Sin límite' : `${batchSize} imagen${batchSize !== 1 ? 'es' : ''} por lote`}
                </p>
              </div>

              <button
                onClick={() => setShowBatchSizeModal(false)}
                className="w-full bg-gradient-to-r from-[#bb86fc] to-[#9966dd] hover:from-[#9966dd] hover:to-[#7744cc] text-white px-4 py-3 rounded-lg font-semibold text-sm transition-all shadow-lg shadow-[#bb86fc]/40 hover:shadow-[#bb86fc]/60"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
