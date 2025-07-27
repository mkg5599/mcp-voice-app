export interface Product {
  id: number;
  name: string;
  description?: string;
  colors: string[];
  tags?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  specs?: Record<string, any>;
  price: number;
  city: string;
  similarity_score?: number;
  updated_at?: string;
}

export interface ProductSearch {
  colors?: string[];
  city?: string;
  min_price?: number;
  max_price?: number;
}

export interface SemanticSearch {
  query: string;
  top_k?: number;
}