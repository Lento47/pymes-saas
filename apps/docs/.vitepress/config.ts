import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PymeHub Docs',
  description: 'Documentación oficial de PymeHub — La plataforma operativa todo-en-uno para PyMEs',
  lang: 'es',
  base: '/',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'PymeHub Docs' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'PymeHub',

    nav: [
      { text: 'Guía', link: '/guide/introduction' },
      { text: 'Funcionalidades', link: '/features/inbox' },
      { text: 'API', link: '/api/authentication' },
      { text: 'Planes', link: '/planes/pricing' },
      {
        text: 'pymeshub.lat',
        link: 'https://pymeshub.lat',
      },
    ],

    sidebar: [
      {
        text: 'Empezando',
        items: [
          { text: '¿Qué es PymeHub?', link: '/guide/introduction' },
          { text: 'Inicio rápido', link: '/guide/getting-started' },
          { text: 'Conceptos clave', link: '/guide/concepts' },
        ],
      },
      {
        text: 'Funcionalidades',
        items: [
          { text: 'Inbox unificado', link: '/features/inbox' },
          { text: 'CRM de Contactos', link: '/features/contacts' },
          { text: 'Gestión de Tareas', link: '/features/tasks' },
          { text: 'Documentos y OCR', link: '/features/documents' },
          { text: 'Automatizaciones', link: '/features/automations' },
          { text: 'Insights con IA', link: '/features/insights' },
          { text: 'Facturación', link: '/features/invoices' },
          { text: 'Pipeline de Ventas', link: '/features/pipeline' },
        ],
      },
      {
        text: 'Canales',
        items: [
          { text: 'Email', link: '/canales/email' },
          { text: 'WhatsApp', link: '/canales/whatsapp' },
        ],
      },
      {
        text: 'API & Webhooks',
        items: [
          { text: 'Autenticación', link: '/api/authentication' },
          { text: 'Referencia de Endpoints', link: '/api/endpoints' },
          { text: 'Webhooks', link: '/api/webhooks' },
        ],
      },
      {
        text: 'Integraciones',
        items: [
          { text: 'Hacienda Costa Rica', link: '/integraciones/hacienda' },
          { text: 'Inteligencia Artificial', link: '/integraciones/ia' },
        ],
      },
      {
        text: 'Planes & Precios',
        items: [{ text: 'Comparar planes', link: '/planes/pricing' }],
      },
      {
        text: 'Recursos',
        items: [
          { text: 'Prompts para más contenido', link: '/prompts/generar-contenido' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/lento47/pymes-saas' },
    ],

    footer: {
      message: 'Documentación de PymeHub',
      copyright: '© 2025 PymeHub. Todos los derechos reservados.',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/lento47/pymes-saas/edit/main/apps/docs/:path',
      text: 'Editar esta página',
    },
  },
})
