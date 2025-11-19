import { useState, useEffect } from 'react';

interface ImageLoaderProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain';
  className?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  showPlaceholder?: boolean;
}

const imageCache = new Map<string, boolean>();

export function ImageLoader({
  src,
  alt,
  aspectRatio = '2/3',
  objectFit = 'cover',
  className = '',
  loading = 'lazy',
  onLoad,
  showPlaceholder = true,
}: ImageLoaderProps) {
  const [imageLoaded, setImageLoaded] = useState(() => imageCache.has(src));

  useEffect(() => {
    if (imageCache.has(src)) {
      setImageLoaded(true);
      return;
    }

    const img = new Image();
    img.src = src;
    img.decoding = 'async';

    if (img.complete && img.naturalHeight !== 0) {
      imageCache.set(src, true);
      setImageLoaded(true);
      onLoad?.();
    }
  }, [src, onLoad]);

  const handleImageLoad = () => {
    imageCache.set(src, true);
    setImageLoaded(true);
    onLoad?.();
  };

  return (
    <div className={`relative overflow-hidden bg-black ${className}`} style={{ aspectRatio }}>
      {showPlaceholder && !imageLoaded && (
        <div className="absolute inset-0 bg-black flex items-center justify-center animate-pulse">
          <div
            className="rounded-full animate-spin"
            style={{
              width: '30px',
              height: '30px',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'rgba(187, 134, 252, 0.2)',
              borderTopColor: '#bb86fc',
              animation: 'spin 0.6s linear infinite',
            }}
          />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchpriority={loading === 'eager' ? 'high' : 'auto'}
        onLoad={handleImageLoad}
        className="w-full h-full object-cover object-center transform-gpu group-hover:scale-105 transition-all duration-1000 ease-out opacity-100 scale-100"
        style={{
          contentVisibility: 'auto',
        }}
      />
    </div>
  );
}
