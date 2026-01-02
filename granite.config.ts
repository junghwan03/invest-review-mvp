import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'invest-review-mvp',
  brand: {
    displayName: 'invest-review-mvp',
    primaryColor: '#3182F6',
    // 아이콘 아직 없으면 '' 로 둬도 됨(공식 가이드)
    icon: '',
    // 또는 네가 쓰던 거:
    // icon: 'https://static.toss.im/assets/homepage/favicon.ico',
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
  outdir: 'out',
});
