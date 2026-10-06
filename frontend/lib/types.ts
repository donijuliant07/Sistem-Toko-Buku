export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  description: string | null;
  price: string | number;
  stock: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BookPage = {
  items: Book[];
  total: number;
  page: number;
  page_size: number;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  role: string;
};

export type BookInput = {
  title: string;
  author: string;
  isbn: string;
  description?: string | null;
  price: number;
  stock: number;
  cover_url?: string | null;
};

export type BookUpdate = Partial<BookInput>;

export type SpoilerLevel = "no_spoiler" | "low" | "medium" | "heavy";

export type AIReviewRequest = {
  spoiler_level: SpoilerLevel;
};

export type AIReviewResponse = {
  book_id: string;
  title: string;
  author: string;
  spoiler_level: SpoilerLevel;
  overview: string;
  writing_style: string;
  characters: string;
  strengths: string[];
  weaknesses: string[];
  who_should_read: string;
  verdict: string;
  plot_analysis?: string | null;
  character_development?: string | null;
  ending_analysis?: string | null;
  cached?: boolean;
};
