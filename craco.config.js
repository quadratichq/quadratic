const path = require('path');
module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
    ...(process.argv.includes('--fast')
      ? {
          watchOptions: {
            ignored: ['**/quadratic-core/**/!(quadratic_core_bg.wasm)', '**/quadratic-core/types.d.ts'],
          },
        }
      : {}),
  },
};
