/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        meurzet: {
          primary: '#384752',
          secondary: '#af4f35',
          accent: '#e4912e',
          light: '#f4f4f3',
          gray: '#969fa3',
          blue: '#1aa7c4',
          gold: '#eec997',
          brown: '#c9a08f',
        }
      }
    },
  },
  plugins: [
    plugin(function({ addComponents, theme }) {
      addComponents({
        // El contenedor general de la app
        '.app-layout': {
          display: 'flex',
          minHeight: '100vh',
          backgroundColor: theme('colors.meurzet.light'),
          fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
        // Estructura del Sidebar basada en tu diseño
        '.sidebar': {
          width: '16rem', // w-64
          backgroundColor: theme('colors.meurzet.primary'),
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'col',
          position: 'fixed',
          height: '100%',
          top: '0',
          left: '0',
          zIndex: '40',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        },
        '.logo-area': {
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        },
        '.logo-circle': {
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '9999px',
          backgroundColor: theme('colors.meurzet.secondary'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '1.125rem',
          color: '#ffffff',
        },
        // Botones de navegación del menú
        '.nav-item': {
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '0.75rem',
          color: theme('colors.meurzet.gray'),
          fontSize: '0.875rem',
          fontWeight: '500',
          transition: 'all 0.2s',
          marginBottom: '0.375rem',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#ffffff',
          },
          '&.active': {
            backgroundColor: theme('colors.meurzet.secondary'),
            color: '#ffffff',
            fontWeight: '600',
          }
        },
        // El contenedor de la derecha (Main Content)
        '.main-content': {
          flex: '1 1 0%',
          paddingLeft: '16rem', // El mismo ancho del sidebar para que no lo pise
          display: 'flex',
          flexDirection: 'col',
          minWidth: '0px',
        },
        // Tus tarjetas estilizadas de forma uniforme
        '.card': {
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          border: '1px solid #e5e7eb',
          padding: '1.25rem',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          transition: 'box-shadow 0.2s',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }
        },
        '.card-number': {
          fontSize: '2.25rem', // text-4xl
          fontWeight: '900',
          marginTop: '0.5rem',
          lineHeight: '1',
        },
        // Las etiquetas (Badges) de la tabla
        '.badge-pending': {
          inlineSize: 'max-content',
          padding: '0.25rem 0.625rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: '#fffbeb', // amber-50
          color: '#b45309', // amber-700
        },
        '.badge-confirmed': {
          inlineSize: 'max-content',
          padding: '0.25rem 0.625rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: '#ecfdf5', // emerald-50
          color: '#047857', // emerald-700
        },
        '.badge-rejected': {
          inlineSize: 'max-content',
          padding: '0.25rem 0.625rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: '600',
          backgroundColor: '#fff5f5', // rose-50
          color: '#b91c1c', // rose-700
        },
        // Tablas custom sanitizadas para que no se estiren feo
        'table': {
          width: '100%',
          textAlign: 'left',
          borderCollapse: 'collapse',
        },
        'th': {
          padding: '0.875rem 1.5rem',
          fontSize: '0.75rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          backgroundColor: theme('colors.meurzet.light'),
          color: theme('colors.meurzet.primary'),
          borderBottom: '1px solid #e5e7eb',
        },
        'td': {
          padding: '1rem 1.5rem',
          fontSize: '0.875rem',
          borderBottom: '1px solid #f3f4f6',
        }
      });
    }),
  ],
}