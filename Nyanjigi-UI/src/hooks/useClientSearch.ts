import { useEffect, useMemo, useState } from 'react';

type UseClientSearchResult<T> = {
  paginatedData: T[];
  totalItems: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  currentPage: number;
  itemsPerPage: number;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  setCurrentPage: (n: number) => void;
  setItemsPerPage: (n: number) => void;
};

export function useClientSearch<T>(
  data: T[],
  searchKeys: (keyof T)[],
  initialItemsPerPage = 10
): UseClientSearchResult<T> {
  const [searchTerm, setSearchTermState] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(Math.max(1, initialItemsPerPage));

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data;

    return data.filter((item) =>
      searchKeys.some((key) => {
        const val = item[key];
        if (val == null) return false;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
          return String(val).toLowerCase().includes(term);
        }
        return false;
      })
    );
  }, [data, searchKeys, searchTerm]);

  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / itemsPerPage));

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    if (totalItems === 0) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage, totalItems]);

  return {
    paginatedData,
    totalItems,
    totalPages,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    currentPage,
    itemsPerPage,
    searchTerm,
    setSearchTerm: (v: string) => {
      setSearchTermState(v);
      setCurrentPage(1);
    },
    setCurrentPage,
    setItemsPerPage: (n: number) => {
      setItemsPerPage(Math.max(1, n));
      setCurrentPage(1);
    },
  };
}

export default useClientSearch;
