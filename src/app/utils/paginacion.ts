export class Paginacion {
  currentPage = 1;
  totalItems = 0;
  readonly itemsPerPage: number;

  constructor(itemsPerPage: number) {
    this.itemsPerPage = itemsPerPage;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.itemsPerPage));
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  irAPagina(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPaginated<T>(items: T[]): T[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return items.slice(start, start + this.itemsPerPage);
  }
}
