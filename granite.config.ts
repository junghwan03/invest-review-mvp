import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'invest-review-mvp',

  brand: {
    displayName: 'AI 투자 복기 & 매매 규칙 체크',
    primaryColor: '#3182F6',
    icon: 'https://static.toss.im/appsintoss/13747/99d4287b-6725-4658-8f67-a0fa454b86f8.png',
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'next dev -p 3000',
      build: 'next build',
    },
  },
  permissions: [],
  
  // ⚠️ 기존 'out'에서 '.next'로 수정하세요!
  outdir: '.next', 
});