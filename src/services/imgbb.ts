const IMGBB_API_KEY = 'deb1cc5cb06346eb739c51f29b8f6069';
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

export async function uploadToImgBB(base64Image: string, name?: string): Promise<ImgBBResponse> {
  const base64Data = base64Image.includes(',')
    ? base64Image.split(',')[1]
    : base64Image;

  const url = `${IMGBB_UPLOAD_URL}?key=${IMGBB_API_KEY}`;

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
    throw new Error(`Error al subir imagen a ImgBB: ${errorText}`);
  }

  return response.json();
}

export async function uploadMultipleToImgBB(
  base64Images: string[],
  namePrefix?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ImgBBResponse[]> {
  const BATCH_SIZE = 10;
  const results: ImgBBResponse[] = [];

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

  return results;
}
