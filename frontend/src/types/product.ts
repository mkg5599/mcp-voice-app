export interface Product {
  id: number;
  name: string;
  description?: string;
  colors: string[];
  tags?: string[];
  specs?: Record<string, unknown>;
  price: number;
  city: string;
  similarity_score?: number | null;
  updated_at?: string;
}

export interface ProductResults {
  count: number;
  products: Product[];
  method: "catalog" | "filter" | "semantic" | "keyword_fallback";
}
