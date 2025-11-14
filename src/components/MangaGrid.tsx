import { MangaCard } from './MangaCard';
import { Manga } from '../types/manga';

interface MangaItem {
  id: string;
  title: string;
  author: string;
  chapterCount: number;
  pageCount: number;
  thumbnail?: string;
  manga?: Manga;
}

interface MangaGridProps {
  items: MangaItem[];
  onSelectComic?: (id: string) => void;
  onEditManga?: (manga: Manga) => void;
  onDeleteManga?: (id: string) => void;
}

export function MangaGrid({ items, onSelectComic, onEditManga, onDeleteManga }: MangaGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 w-full justify-center items-start">
      {items.map((item, index) => (
        <div
          key={item.id}
          style={{
            animationDelay: `${index * 50}ms`,
          }}
          className="opacity-0 animate-[fadeIn_0.7s_ease-out_forwards]"
        >
          <MangaCard
            id={item.id}
            title={item.title}
            author={item.author}
            pageCount={item.pageCount}
            thumbnail={item.thumbnail}
            manga={item.manga}
            onSelect={onSelectComic}
            onEdit={onEditManga}
            onDelete={onDeleteManga}
          />
        </div>
      ))}
    </div>
  );
}
