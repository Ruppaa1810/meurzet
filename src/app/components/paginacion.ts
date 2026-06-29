import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-paginacion',
  standalone: true,
  template: `
    @if (totalPages > 1) {
    <div class="flex items-center justify-center gap-2 pt-2 pb-1">
      <span class="text-xs text-slate-400 font-medium mr-1">
        Página {{ currentPage }} de {{ totalPages }}
      </span>
      <button (click)="cambiar(currentPage - 1)" [disabled]="currentPage === 1"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed border-[#af4f35]/30 text-[#384752] bg-white hover:bg-[#1aa7c4] hover:text-white hover:border-[#1aa7c4] cursor-pointer">
        Anterior
      </button>
      @for (page of pages; track page) {
      <button (click)="cambiar(page)"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all duration-200 cursor-pointer"
        [class]="currentPage === page ? 'bg-[#1aa7c4] text-white border-[#1aa7c4]' : 'border-[#af4f35]/30 text-[#384752] bg-white hover:bg-[#1aa7c4] hover:text-white hover:border-[#1aa7c4]'">
        {{ page }}
      </button>
      }
      <button (click)="cambiar(currentPage + 1)" [disabled]="currentPage === totalPages"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed border-[#af4f35]/30 text-[#384752] bg-white hover:bg-[#1aa7c4] hover:text-white hover:border-[#1aa7c4] cursor-pointer">
        Siguiente
      </button>
    </div>
    }
  `,
})
export class PaginacionComponent {
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Output() pageChange = new EventEmitter<number>();

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  cambiar(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }
}
