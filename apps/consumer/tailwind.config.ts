export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        accent: 'var(--color-accent)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
    },
  },
};