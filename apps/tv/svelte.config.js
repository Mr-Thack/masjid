import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      fallback: '404.html',
      pages: 'build',
      assets: 'build',
    }),
  },
};