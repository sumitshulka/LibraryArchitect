export interface TransferCatalogCount {
  bookId: number;
  quantity: number;
  status?: string;
}

export interface TransferCatalogSource extends TransferCatalogCount {
  libraryId: number;
  libraryName: string;
}

export function buildTransferCatalogResults<T extends { id: number }>(
  books: T[],
  ownCounts: TransferCatalogCount[],
  sources: TransferCatalogSource[],
) {
  return books.map(book => {
    const localRows = ownCounts.filter(row => row.bookId === book.id);
    return {
      ...book,
      sources: sources.filter(row => row.bookId === book.id),
      localInventory: {
        total: localRows.reduce((sum, row) => sum + row.quantity, 0),
        byStatus: Object.fromEntries(localRows.map(row => [row.status || "UNKNOWN", row.quantity])),
      },
    };
  });
}
