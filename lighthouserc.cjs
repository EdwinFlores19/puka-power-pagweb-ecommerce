module.exports = {
  ci: {
    collect: {
      startServerCommand: 'bun run preview',
      startServerReadyPattern: 'Local',
      url: [
        'http://localhost:4321/',
        'http://localhost:4321/tienda',
      ],
      numberOfRuns: 1,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      preset: 'lighthouse:no-pound',
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['error', { minScore: 0.90 }],
        'categories:seo': ['error', { minScore: 0.90 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
