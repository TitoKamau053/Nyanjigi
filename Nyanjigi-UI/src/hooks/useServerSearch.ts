import { useEffect, useState, useRef } from 'react';

type Fetcher = (params: Record<string, any>) => Promise<any>;

export default function useServerSearch<T>(
  fetcher: Fetcher,
  options?: {
    initialPage?: number;
    initialLimit?: number;
    initialParams?: Record<string, any>;
    debounceMs?: number;
    extract?: (res: any) => { items: T[]; pagination?: any };
  }
) {
  const { initialPage = 1, initialLimit = 10, initialParams = {}, debounceMs = 300, extract } = options || {};

  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const paramsRef = useRef(initialParams);
  paramsRef.current = initialParams;

  // Debounce search term
  const searchTimeout = useRef<any>(null);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(searchTerm), debounceMs);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchTerm, debounceMs]);

  const fetchPage = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, limit, search: debouncedSearch, ...paramsRef.current };
      const res = await fetcher(params);
      const payload = res?.data?.data ?? res?.data ?? res;

      let items: T[] = [];
      let pagination: any = payload?.pagination ?? payload?.meta ?? null;

      if (extract) {
        const ext = extract(res);
        items = ext.items || [];
        pagination = ext.pagination || pagination;
      } else {
        if (Array.isArray(payload)) {
          items = payload as T[];
        } else {
          // find first array in payload
          const arr = Object.values(payload).find((v) => Array.isArray(v));
          if (arr) items = arr as T[];
        }
      }

      setData(items || []);
    const tot = pagination?.total_items ?? pagination?.total ?? pagination?.totalRecords ?? items.length;
      const tp = pagination?.total_pages ?? (tot ? Math.max(1, Math.ceil(tot / limit)) : 1);
      setTotalItems(Number(tot || 0));
      setTotalPages(Number(tp || 1));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, JSON.stringify(paramsRef.current)]);

  return {
    data,
    totalItems,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    currentPage: page,
    itemsPerPage: limit,
    searchTerm,
    setSearchTerm: (v: string) => { setSearchTerm(v); setPage(1); },
    setCurrentPage: setPage,
    setItemsPerPage: (n: number) => { setLimit(Math.max(1, n)); setPage(1); },
    loading,
    error,
    refresh: fetchPage,
  };
}
