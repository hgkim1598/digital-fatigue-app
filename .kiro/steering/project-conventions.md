---
inclusion: always
---

# 디지털 피로 관리 앱 - 프로젝트 컨벤션

## Lambda 규칙
- 모든 Lambda는 Node.js 18 런타임, async/await 패턴 사용
- 모든 Lambda에 try/catch 에러 핸들링 필수
- API 응답 형식: `{ statusCode, body: JSON.stringify({}) }`
- 환경변수로 리소스 참조: KB_ID, USER_POOL_ID, USER_POOL_CLIENT_ID, 테이블명
- 리전: us-east-1

## DynamoDB 규칙
- 기능별 분리 테이블 (단일 테이블 설계 아님)
- PK 형식: `USER#<email>`, `WEEK#<YYYY-Www>`
- SK 형식: `LOG#<timestamp>`, `SESSION#<timestamp>`, `CHAT#<timestamp>` 등
- BillingMode: PAY_PER_REQUEST

## API 규칙
- CORS 설정 필수 (AllowOrigin, AllowMethods, AllowHeaders)
- 인증 필요 엔드포인트는 Cognito Authorizer 적용
- /api/auth/signup, /api/auth/login은 인증 없이 접근 허용

## 프론트엔드 규칙
- React + Vite + Tailwind CSS
- 모바일 우선 UI (max-width: 390px)
- vite-plugin-pwa로 Service Worker 등록

## 보안 규칙
- 로그에 민감 데이터(이메일, 건강 데이터) 마스킹 처리
- Lambda IAM 역할은 최소 권한 원칙 적용
- JWT 토큰에서 추출한 사용자 이메일로 PK 기반 데이터 격리
