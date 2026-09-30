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
