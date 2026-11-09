import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Category } from "../types";

let cache: Category[] | null = null;

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api.categories().then((c) => {
      cache = c;
      setCategories(c);
    });
  }, []);
  return categories;
}
