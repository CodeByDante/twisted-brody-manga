import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isAnimating]);


  const handlePrevious = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleNext = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStartX;
    setDragOffset(diff);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    const diff = e.clientX - dragStartX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handlePrevious();
      } else {
        handleNext();
      }
    }
    setDragOffset(0);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 opacity-0 transition-opacity duration-300 ease-out"
      style={{ opacity: 1 }}
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDragging) {
          setIsDragging(false);
          setDragOffset(0);
        }
      }}
      ref={containerRef}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200 z-50"
        aria-label="Cerrar"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="relative w-full h-full flex items-center justify-center px-4 sm:px-8">
        <div
          className="max-w-6xl max-h-full flex items-center justify-center"
          style={{
            transform: `translateX(${dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none transition-opacity duration-400 ease-in-out opacity-100">
              <div className="w-8 h-8 rounded-full border-2 border-[#bb86fc] border-t-transparent animate-spin" />
            </div>
            <img
              src={images[currentIndex]}
              alt={`Página ${currentIndex + 1}`}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl opacity-0 transition-opacity duration-600 ease-in-out hover:scale-110 hover:transition-transform hover:duration-700"
              onLoad={(e) => {
                e.currentTarget.classList.remove('opacity-0');
                e.currentTarget.classList.add('opacity-100');
                const spinner = e.currentTarget.previousElementSibling;
                if (spinner) spinner.classList.add('opacity-0');
              }}
              draggable={false}
              loading="eager"
            />
          </div>
        </div>

        <button
          onClick={handlePrevious}
          disabled={isAnimating}
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-lg text-white opacity-40 hover:opacity-100 transition-opacity duration-200 disabled:opacity-40 z-40 group"
          aria-label="Imagen anterior"
        >
          <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>

        <button
          onClick={handleNext}
          disabled={isAnimating}
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-lg text-white opacity-40 hover:opacity-100 transition-opacity duration-200 disabled:opacity-40 z-40 group"
          aria-label="Imagen siguiente"
        >
          <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
}
