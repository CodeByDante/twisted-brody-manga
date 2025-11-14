import { useState } from 'react';

interface ImageLoaderProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain';
  className?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
}

export function ImageLoader({
  src,
  alt,
  aspectRatio = '2/3',
  objectFit = 'cover',
  className = '',
  loading = 'lazy',
  onLoad,
}: ImageLoaderProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio }}>
      <div
        className={`absolute inset-0 flex items-center justify-center z-10 pointer-events-none transition-opacity duration-700 ease-in-out ${
          imageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="w-8 h-8 rounded-full border-2 border-[#bb86fc] border-t-transparent animate-spin" />
      </div>

      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={handleImageLoad}
        className={`w-full h-full object-${objectFit} object-center transition-all duration-700 ease-in-out transform-gpu group-hover:scale-105 ${
          imageLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-[1.02]'
        }`}
      />
    </div>
  );
}
