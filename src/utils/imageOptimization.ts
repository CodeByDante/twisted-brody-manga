export interface OptimizedImage {
  thumbnail: string;
  original: string;
  webpDisplay: string;
  webpCover: string;
  originalFormat: string;
  originalBase64: string;
  originalUnmodified: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const QUALITY = 0.8;
const WEBP_QUALITY = 0.85;
const THUMBNAIL_WIDTH = 400;
const DISPLAY_WIDTH = 1200;

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let width = img.width;
        let height = img.height;

        if (width > DISPLAY_WIDTH) {
          height = (height * DISPLAY_WIDTH) / width;
          width = DISPLAY_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' :
                        file.type === 'image/jpeg' || file.type === 'image/jpg' ? 'image/jpeg' :
                        file.type === 'image/gif' ? 'image/gif' :
                        file.type === 'image/webp' ? 'image/webp' : 'image/png';

        let quality = QUALITY;
        let compressed = canvas.toDataURL(mimeType, quality);

        while (compressed.length > MAX_FILE_SIZE && quality > 0.4) {
          quality -= 0.05;
          compressed = canvas.toDataURL(mimeType, quality);
        }

        resolve(compressed);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function generateThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: false });

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let width = img.width;
        let height = img.height;

        if (width > THUMBNAIL_WIDTH) {
          height = (height * THUMBNAIL_WIDTH) / width;
          width = THUMBNAIL_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' ? 'image/png' :
                        file.type === 'image/jpeg' || file.type === 'image/jpg' ? 'image/jpeg' :
                        file.type === 'image/gif' ? 'image/gif' :
                        file.type === 'image/webp' ? 'image/webp' : 'image/png';

        const thumbnail = canvas.toDataURL(mimeType, 0.85);

        resolve(thumbnail);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function getOriginalBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function getFileExtension(file: File): string {
  const mimeType = file.type;
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  return 'jpg';
}

export async function generateWebPDisplay(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let width = img.width;
        let height = img.height;

        if (width > DISPLAY_WIDTH) {
          height = (height * DISPLAY_WIDTH) / width;
          width = DISPLAY_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const webp = canvas.toDataURL('image/webp', 0.90);
        resolve(webp);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function generateWebPCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let width = img.width;
        let height = img.height;
        const MAX_COVER_SIZE = 2000;

        if (width > MAX_COVER_SIZE || height > MAX_COVER_SIZE) {
          if (width > height) {
            height = (height * MAX_COVER_SIZE) / width;
            width = MAX_COVER_SIZE;
          } else {
            width = (width * MAX_COVER_SIZE) / height;
            height = MAX_COVER_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const webp = canvas.toDataURL('image/webp', 0.95);
        resolve(webp);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function processImage(file: File): Promise<OptimizedImage> {
  const [thumbnail, original, webpDisplay, webpCover, originalBase64] = await Promise.all([
    generateThumbnail(file),
    compressImage(file),
    generateWebPDisplay(file),
    generateWebPCover(file),
    getOriginalBase64(file),
  ]);

  const originalFormat = getFileExtension(file);
  const originalUnmodified = originalBase64;

  return { thumbnail, original, webpDisplay, webpCover, originalFormat, originalBase64, originalUnmodified };
}

export async function convertImageToFormat(
  imageUrl: string,
  format: 'png' | 'jpg' | 'webp',
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0);

      const mimeType = format === 'png' ? 'image/png' :
                      format === 'jpg' ? 'image/jpeg' :
                      'image/webp';

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

export function createImageElement(src: string, alt: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  return img;
}

export async function detectImageOrientation(imageUrl: string): Promise<'portrait' | 'landscape' | 'square'> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const aspectRatio = img.width / img.height;
      if (aspectRatio < 0.9) {
        resolve('portrait');
      } else if (aspectRatio > 1.1) {
        resolve('landscape');
      } else {
        resolve('square');
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for orientation detection'));
    img.src = imageUrl;
  });
}
