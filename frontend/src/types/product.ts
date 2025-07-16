export interface Product {
  id: number;
  name: string;
  colors: string[];
  price: number;
  city: string;
}

export interface ProductSearch {
  colors?: string[];
  city?: string;
  min_price?: number;
  max_price?: number;
}