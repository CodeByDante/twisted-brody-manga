import { getUserApiKey } from '../utils/apiKeyManager';
import { getBatchSize } from '../utils/batchSizeManager';

const IMGBB_API_KEY = '90ba8efe6890e9e76175089dc182a22a';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export interface ImgBBResponse {
  success: boolean;
  data: {
    url: string;
    display_url: string;
    thumb: {
      url: string;
    };
  };
}

function getActiveApiKey(): string {
  const userApiKey = getUserApiKey();
  return userApiKey || IMGBB_API_KEY;
}

export async function uploadToImgBB(base64Image: string, name?: string): Promise<ImgBBResponse> {
  const base64Data = base64Image.includes(',')
    ? base64Image.split(',')[1]
    : base64Image;

  const apiKey = getActiveApiKey();
  const url = `${IMGBB_UPLOAD_URL}?key=${apiKey}`;

  const formData = new FormData();
  formData.append('image', base64Data);

  if (name) {
    formData.append('name', name);
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 429 || errorText.includes('rate limit')) {
      throw new Error('API_BURNED');
    }

    if (response.status === 403 || response.status === 401) {
      throw new Error('API_INVALID_KEY');
    }

    throw new Error(`Error al subir imagen a ImgBB: ${errorText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error('API_BURNED');
  }

  return data;
}

export async function uploadMultipleToImgBB(
  base64Images: string[],
  namePrefix?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImgBBResponse[]> {
  const BATCH_SIZE = getBatchSize();
  const results: ImgBBResponse[] = [];

  if (BATCH_SIZE === 0 || BATCH_SIZE >= base64Images.length) {
    const uploadPromises = base64Images.map((image, index) => {
      const name = namePrefix ? `${namePrefix}_${index + 1}` : undefined;
      return uploadToImgBB(image, name);
    });

    const allResults = await Promise.all(uploadPromises);
    results.push(...allResults);

    if (onProgress) {
      onProgress(base64Images.length, base64Images.length);
    }
  } else {
    for (let i = 0; i < base64Images.length; i += BATCH_SIZE) {
      const batch = base64Images.slice(i, i + BATCH_SIZE);
      const uploadPromises = batch.map((image, batchIndex) => {
        const globalIndex = i + batchIndex;
        const name = namePrefix ? `${namePrefix}_${globalIndex + 1}` : undefined;
        return uploadToImgBB(image, name);
      });

      const batchResults = await Promise.all(uploadPromises);
      results.push(...batchResults);

      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, base64Images.length), base64Images.length);
      }
    }
  }

  return results;
}
