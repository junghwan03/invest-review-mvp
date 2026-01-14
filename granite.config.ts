import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // ⚠️ appName은 영어 ID 그대로 둡니다 (수정 X)
  appName: 'invest-review-mvp',

  brand: {
    // ✅ [핵심 수정 1] 문의 답변 요구사항: 한글 이름으로 변경!
    // 기존 'invest-review-mvp' -> 'AI 투자 복기 & 매매 규칙 체크'
    displayName: 'AI 투자 복기 & 매매 규칙 체크',
    
    primaryColor: '#3182F6',
    
    // ✅ [핵심 수정 2] 아이콘: 방금 주신 그 이미지 주소 적용!
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
  outdir: 'out',
});