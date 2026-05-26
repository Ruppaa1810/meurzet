import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-minorista',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`
})
export class Minorista { } // <--- EL NOMBRE AQUÍ DEBE SER EXACTAMENTE "Minorista"