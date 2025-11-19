import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { Manga, Category, Chapter } from '../types/manga';

function cleanUndefinedDeep(obj: any): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    const cleaned = obj
      .map(item => cleanUndefinedDeep(item))
      .filter(item => item !== undefined && item !== null && item !== '');
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (typeof obj === 'object' && !(obj instanceof Timestamp)) {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = cleanUndefinedDeep(obj[key]);
        if (value !== undefined && value !== null && value !== '') {
          cleaned[key] = value;
        }
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  if (obj === '') {
    return undefined;
  }

  return obj;
}

export async function getAllMangas(): Promise<Manga[]> {
  const q = query(collection(db, 'mangas'), orderBy('created_at', 'desc'));
  const querySnapshot = await getDocs(q);

  const mangas = await Promise.all(
    querySnapshot.docs.map(async (mangaDoc) => {
      const mangaData = mangaDoc.data();

      const chaptersQuery = query(
        collection(db, 'chapters'),
        where('manga_id', '==', mangaDoc.id)
      );
      const chaptersSnapshot = await getDocs(chaptersQuery);
      const chapters = chaptersSnapshot.docs
        .map(chapterDoc => {
          const chapterData = chapterDoc.data();
          return {
            id: chapterDoc.id,
            manga_id: chapterData.manga_id,
            number: chapterData.number,
            title: chapterData.title,
            pages: chapterData.pages || [],
            page_formats: chapterData.page_formats || [],
            original_pages: chapterData.original_pages || [],
            created_at: (chapterData.created_at as Timestamp).toDate().toISOString(),
            updated_at: (chapterData.updated_at as Timestamp).toDate().toISOString(),
          } as Chapter;
        })
        .sort((a, b) => a.number - b.number);

      return {
        id: mangaDoc.id,
        ...mangaData,
        created_at: (mangaData.created_at as Timestamp).toDate().toISOString(),
        updated_at: mangaData.updated_at ? (mangaData.updated_at as Timestamp).toDate().toISOString() : (mangaData.created_at as Timestamp).toDate().toISOString(),
        categories: mangaData.categories || [],
        chapters,
      } as Manga;
    })
  );

  return mangas;
}

export async function getMangaById(id: string): Promise<Manga | null> {
  const docRef = doc(db, 'mangas', id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data();

  const chaptersQuery = query(collection(db, 'chapters'), where('manga_id', '==', id));
  const chaptersSnapshot = await getDocs(chaptersQuery);
  const chapters = chaptersSnapshot.docs
    .map(doc => {
      const chapterData = doc.data();
      return {
        id: doc.id,
        manga_id: chapterData.manga_id,
        number: chapterData.number,
        title: chapterData.title,
        pages: chapterData.pages || [],
        page_formats: chapterData.page_formats || [],
        original_pages: chapterData.original_pages || [],
        created_at: (chapterData.created_at as Timestamp).toDate().toISOString(),
        updated_at: (chapterData.updated_at as Timestamp).toDate().toISOString(),
      } as Chapter;
    })
    .sort((a, b) => a.number - b.number);

  const categoryIds = data.categories || [];
  const categories: Category[] = [];

  for (const categoryId of categoryIds) {
    const catDocRef = doc(db, 'categories', categoryId);
    const catDocSnap = await getDoc(catDocRef);
    if (catDocSnap.exists()) {
      categories.push({
        id: catDocSnap.id,
        ...catDocSnap.data(),
        created_at: catDocSnap.data().created_at?.toDate?.().toISOString() || new Date().toISOString(),
      } as Category);
    }
  }

  return {
    id: docSnap.id,
    ...data,
    created_at: (data.created_at as Timestamp).toDate().toISOString(),
    categories,
    chapters,
    updated_at: data.updated_at ? (data.updated_at as Timestamp).toDate().toISOString() : (data.created_at as Timestamp).toDate().toISOString(),
  } as Manga;
}

export async function createManga(manga: {
  title: string;
  author: string;
  description?: string;
  thumbnail_url?: string;
  cover_url?: string;
  status?: string;
  categoryIds?: string[];
}): Promise<Manga> {
  const now = Timestamp.now();

  const mangaData: any = {
    title: manga.title,
    author: manga.author,
    description: manga.description || '',
    status: manga.status || 'En curso',
    categories: manga.categoryIds || [],
    views: 0,
    rating: 0,
    created_at: now,
    updated_at: now,
  };

  if (manga.thumbnail_url) {
    mangaData.thumbnail_url = manga.thumbnail_url;
  }

  if (manga.cover_url) {
    mangaData.cover_url = manga.cover_url;
  }

  const docRef = await addDoc(collection(db, 'mangas'), mangaData);

  const nowISO = new Date().toISOString();
  const data: any = {
    id: docRef.id,
    title: manga.title,
    author: manga.author,
    description: manga.description || '',
    status: manga.status || 'En curso',
    categories: manga.categoryIds || [],
    chapters: [],
    views: 0,
    rating: 0,
    created_at: nowISO,
    updated_at: nowISO,
  };

  if (manga.thumbnail_url) {
    data.thumbnail_url = manga.thumbnail_url;
  }

  if (manga.cover_url) {
    data.cover_url = manga.cover_url;
  }

  return data as Manga;
}

export async function getAllCategories(): Promise<Category[]> {
  const querySnapshot = await getDocs(collection(db, 'categories'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Category));
}

export async function createCategory(name: string): Promise<Category> {
  const docRef = await addDoc(collection(db, 'categories'), { name });
  const docSnap = await getDoc(docRef);

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Category;
}

export async function createChapter(chapter: {
  manga_id: string;
  number: number;
  title: string;
  pages: string[];
  page_formats?: string[];
  original_pages?: string[];
}): Promise<Chapter> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, 'chapters'), {
    manga_id: chapter.manga_id,
    number: chapter.number,
    title: chapter.title,
    pages: chapter.pages,
    page_formats: chapter.page_formats || [],
    original_pages: chapter.original_pages || [],
    created_at: now,
    updated_at: now,
  });

  const docSnap = await getDoc(docRef);
  const data = docSnap.data();

  return {
    id: docSnap.id,
    manga_id: data!.manga_id,
    number: data!.number,
    title: data!.title,
    pages: data!.pages || [],
    page_formats: data!.page_formats || [],
    original_pages: data!.original_pages || [],
    created_at: (data!.created_at as Timestamp).toDate().toISOString(),
    updated_at: (data!.updated_at as Timestamp).toDate().toISOString(),
  } as Chapter;
}

export async function incrementMangaViews(mangaId: string): Promise<void> {
  const docRef = doc(db, 'mangas', mangaId);
  await updateDoc(docRef, {
    views: increment(1),
  });
}

export async function updateManga(mangaId: string, manga: {
  title: string;
  author: string;
  description?: string;
  thumbnail_url?: string;
  cover_url?: string;
  status?: string;
  categoryIds?: string[];
}): Promise<Manga> {
  const docRef = doc(db, 'mangas', mangaId);
  const now = Timestamp.now();

  const updateData: any = {
    title: manga.title,
    author: manga.author,
    categories: manga.categoryIds || [],
    updated_at: now,
  };

  if (manga.status) {
    updateData.status = manga.status;
  }

  if (manga.description !== undefined && manga.description !== null) {
    updateData.description = manga.description;
  }

  if (manga.thumbnail_url) {
    updateData.thumbnail_url = manga.thumbnail_url;
  }

  if (manga.cover_url) {
    updateData.cover_url = manga.cover_url;
  }

  const cleanData = cleanUndefinedDeep(updateData);
  await updateDoc(docRef, cleanData);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error('Manga no encontrado');
  }

  const data = docSnap.data();
  const chaptersQuery = query(collection(db, 'chapters'), where('manga_id', '==', mangaId));
  const chaptersSnapshot = await getDocs(chaptersQuery);
  const chapters = chaptersSnapshot.docs
    .map(chapterDoc => {
      const chapterData = chapterDoc.data();
      return {
        id: chapterDoc.id,
        manga_id: chapterData.manga_id,
        number: chapterData.number,
        title: chapterData.title,
        pages: chapterData.pages || [],
        page_formats: chapterData.page_formats || [],
        original_pages: chapterData.original_pages || [],
        created_at: (chapterData.created_at as Timestamp).toDate().toISOString(),
        updated_at: (chapterData.updated_at as Timestamp).toDate().toISOString(),
      } as Chapter;
    })
    .sort((a, b) => a.number - b.number);

  const categoryIds = data.categories || [];
  const categories: Category[] = [];

  for (const categoryId of categoryIds) {
    const catDocRef = doc(db, 'categories', categoryId);
    const catDocSnap = await getDoc(catDocRef);
    if (catDocSnap.exists()) {
      categories.push({
        id: catDocSnap.id,
        ...catDocSnap.data(),
        created_at: catDocSnap.data().created_at?.toDate?.().toISOString() || new Date().toISOString(),
      } as Category);
    }
  }

  return {
    id: docSnap.id,
    ...data,
    created_at: (data.created_at as Timestamp).toDate().toISOString(),
    categories,
    chapters,
    updated_at: (data.updated_at as Timestamp).toDate().toISOString(),
  } as Manga;
}

export async function deleteManga(mangaId: string): Promise<void> {
  const mangaRef = doc(db, 'mangas', mangaId);

  const chaptersQuery = query(collection(db, 'chapters'), where('manga_id', '==', mangaId));
  const chaptersSnapshot = await getDocs(chaptersQuery);

  for (const chapterDoc of chaptersSnapshot.docs) {
    await deleteDoc(chapterDoc.ref);
  }

  await deleteDoc(mangaRef);
}

export async function addExternalLink(mangaId: string, link: { name: string; url: string }): Promise<void> {
  const docRef = doc(db, 'mangas', mangaId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Manga no encontrado');
  }

  const currentLinks = docSnap.data().external_links || [];
  const updateData = {
    external_links: [...currentLinks, link],
  };
  const cleanData = cleanUndefinedDeep(updateData);
  await updateDoc(docRef, cleanData);
}

export async function removeExternalLink(mangaId: string, index: number): Promise<void> {
  const docRef = doc(db, 'mangas', mangaId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Manga no encontrado');
  }

  const currentLinks = docSnap.data().external_links || [];
  const updateData = {
    external_links: currentLinks.filter((_: any, i: number) => i !== index),
  };
  const cleanData = cleanUndefinedDeep(updateData);
  await updateDoc(docRef, cleanData);
}

export async function getRecommendations(currentMangaId: string, categoryIds: string[], title: string, limit?: number): Promise<Manga[]> {
  const allMangas = await getAllMangas();

  const recommendations = allMangas
    .filter(manga => manga.id !== currentMangaId)
    .map(manga => {
      let score = 0;

      const mangaCategoryIds = manga.categories?.map(cat => cat.id) || [];
      const sharedCategories = categoryIds.filter(catId => mangaCategoryIds.includes(catId));
      score += sharedCategories.length * 10;

      const currentTitleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const mangaTitleWords = manga.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const sharedWords = currentTitleWords.filter(word => mangaTitleWords.includes(word));
      score += sharedWords.length * 5;

      const currentAuthorWords = manga.author?.toLowerCase().split(/\s+/).filter(w => w.length > 2) || [];
      const sharedAuthorWords = currentTitleWords.filter(word => currentAuthorWords.includes(word));
      score += sharedAuthorWords.length * 3;

      return { manga, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => {
      const titleA = a.manga.title.toLowerCase();
      const titleB = b.manga.title.toLowerCase();
      return titleA.localeCompare(titleB);
    })
    .map(item => item.manga);

  return limit ? recommendations.slice(0, limit) : recommendations;
}
