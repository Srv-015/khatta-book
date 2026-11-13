export default function manifest() {
  return {
    name: 'Khatta Book',
    short_name: 'Khatta',
    description: 'Personal udhar and credit tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f5f1',
    theme_color: '#1f6f5c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
