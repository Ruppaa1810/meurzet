import { Component } from '@angular/core';

@Component({
  selector: 'app-seleccion',
  imports: [],
  templateUrl: './seleccion.html',
  styleUrl: './seleccion.css',
})
export class Seleccion {
   ngAfterViewInit() {
    const menuBtn = document.querySelector('.menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    menuBtn?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
      overlay?.classList.toggle('show');
    });

    overlay?.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('show');
    });
  }
}

