<div align="center">

<img src="https://img.shields.io/badge/Connect_with_Care-디지털_피로_관리-6DB54C?style=for-the-badge&logoColor=white" alt="title" />

<br/>
<br/>

# 👁️ Digital Fatigue Manager

### 눈 건강을 지키는 스마트한 헬스케어 PWA

<br/>

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-FF9900?style=flat-square&logo=awslambda&logoColor=white)](https://aws.amazon.com/lambda)
[![Amazon Bedrock](https://img.shields.io/badge/Amazon-Bedrock-232F3E?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/bedrock)
[![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps)
[![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)

<br/>

<img src="https://img.shields.io/badge/배포-AWS_CloudFront-FF9900?style=flat-square&logo=amazon-aws" />
<img src="https://img.shields.io/badge/인증-Amazon_Cognito-DD344C?style=flat-square&logo=amazon-aws" />
<img src="https://img.shields.io/badge/AI-RAG_챗봇-6DB54C?style=flat-square" />

</div>

---

## 📌 프로젝트 소개

스마트폰과 모니터 장시간 사용으로 증가하는 **디지털 피로**를 체계적으로 관리하는 헬스케어 앱입니다.

> 20-20-20 눈 운동 알림부터 AI 맞춤 영양제 추천까지 — 눈 건강을 지키는 스마트한 습관을 만들어드립니다.

<br/>

## ✨ 주요 기능

<table>
  <tr>
    <td align="center" width="25%">
      <h3>👁️</h3>
      <b>20-20-20 알림</b><br/>
      <sub>20분 사용 후 자동 푸시 알림<br/>PWA Service Worker 기반<br/>알림 클릭 시 증상기록 이동</sub>
    </td>
    <td align="center" width="25%">
      <h3>📋</h3>
      <b>증상 기록</b><br/>
      <sub>눈 피로·두통·전신 피로<br/>1~5점 척도 직접 입력<br/>시간별 이력 관리</sub>
    </td>
    <td align="center" width="25%">
      <h3>📊</h3>
      <b>주간 분석 & 랭킹</b><br/>
      <sub>개인 주간 건강 점수<br/>전체 사용자 순위 TOP 10<br/>EventBridge 자동 집계</sub>
    </td>
    <td align="center" width="25%">
      <h3>🤖</h3>
      <b>AI 헬스 챗봇</b><br/>
      <sub>Amazon Bedrock + RAG<br/>영양제 문서 Knowledge Base<br/>출처 표시로 신뢰도 확보</sub>
    </td>
  </tr>
</table>

<br/>

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (PWA)                       │
│          React + Vite + vite-plugin-pwa                  │
│          CloudFront CDN ← S3 Static Hosting              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│               API Gateway (REST)                         │
│         CognitoAuthorizer  ·  8 Endpoints               │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
 Auth      Symptom   Analysis   Ranking    Chat
Lambda     Lambda     Lambda     Lambda    Lambda
   │          │          │          │          │
   └──────────┴──────────┴──────────┘          │
                    │                           │
         ┌──────────▼──────────┐    ┌──────────▼──────────┐
         │      DynamoDB       │    │   Amazon Bedrock     │
         │  · Users            │    │   · Knowledge Base   │
         │  · SymptomLogs      │    │   · Claude Sonnet    │
         │  · ScreenTime       │    │   · RAG Pipeline     │
         │  · WeeklyAnalysis   │    └─────────────────────┘
         │  · Rankings         │
         └─────────────────────┘
                    ▲
         ┌──────────┴──────────┐
         │  EventBridge Timer  │
         │  매주 월요일 자동 집계  │
         └─────────────────────┘
```

<br/>

## 🛠️ 기술 스택

### Frontend
| 기술 | 설명 |
|------|------|
| ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black) | UI 컴포넌트 |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) | 빌드 툴 |
| ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) | 스타일링 |
| ![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white) | Service Worker, Web Push |

### Backend (AWS Serverless)
| 서비스 | 역할 |
|--------|------|
| ![Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=flat-square&logo=awslambda&logoColor=white) | 8개 독립 함수 (Node.js 18) |
| ![API Gateway](https://img.shields.io/badge/API_Gateway-FF4F8B?style=flat-square&logo=amazon-aws&logoColor=white) | REST API + Cognito 인증 |
| ![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white) | 5개 테이블 설계 |
| ![Cognito](https://img.shields.io/badge/Cognito-DD344C?style=flat-square&logo=amazon-aws&logoColor=white) | 사용자 인증 |
| ![S3](https://img.shields.io/badge/S3-569A31?style=flat-square&logo=amazons3&logoColor=white) | 정적 자산 + 영양제 데이터 |
| ![CloudFront](https://img.shields.io/badge/CloudFront-FF9900?style=flat-square&logo=amazon-aws&logoColor=white) | CDN 배포 |
| ![EventBridge](https://img.shields.io/badge/EventBridge-FF4F8B?style=flat-square&logo=amazon-aws&logoColor=white) | 주간 자동 집계 스케줄러 |

### AI / ML
| 서비스 | 역할 |
|--------|------|
| ![Bedrock](https://img.shields.io/badge/Amazon_Bedrock-232F3E?style=flat-square&logo=amazon-aws&logoColor=white) | Claude Sonnet 모델 |
| ![Knowledge Base](https://img.shields.io/badge/Knowledge_Base_RAG-6DB54C?style=flat-square) | 영양제 문서 벡터 인덱싱 |
| ![OpenSearch](https://img.shields.io/badge/OpenSearch_Serverless-005EB8?style=flat-square&logo=opensearch&logoColor=white) | 벡터 스토어 |

<br/>

## 📁 프로젝트 구조

```
digital-fatigue-app/
├── frontend/
│   ├── src/
│   │   ├── pages/          # Home, Symptoms, Analysis, Chat
│   │   ├── components/     # 공통 컴포넌트
│   │   ├── api/            # API 엔드포인트
│   │   └── context/        # AuthContext
│   └── public/
│       └── sw.js           # Service Worker (20-20-20 알림)
├── src/
│   └── handlers/           # Lambda 핸들러
│       ├── auth.js
│       ├── symptom.js
│       ├── analysis.js
│       ├── ranking.js
│       ├── chat.js
│       └── weeklySchedule.js
├── template.yaml            # SAM 인프라 정의
└── samconfig.toml
```

<br/>

## 🚀 로컬 실행

### 사전 요구사항

```bash
node >= 18
AWS CLI 설정 완료
SAM CLI >= 1.0
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
# http://localhost:5174
```

### 백엔드 배포

```bash
# 빌드
sam build

# 첫 배포 (가이드 모드)
sam deploy --guided
# Stack Name: digital-fatigue-app
# Region: us-east-1
```

<br/>

## 🔑 API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/api/auth/signup` | 회원가입 |
| `POST` | `/api/auth/login` | 로그인 |
| `POST` | `/api/symptoms` | 증상 기록 |
| `GET` | `/api/symptoms` | 증상 이력 조회 |
| `GET` | `/api/analysis/weekly` | 주간 건강 점수 |
| `GET` | `/api/analysis/ranking` | 전체 순위 |
| `POST` | `/api/chat` | AI 챗봇 메시지 |
| `GET` | `/api/chat/history` | 채팅 이력 |

<br/>

## 💡 설계 의사결정

<details>
<summary><b>왜 Lambda 온디맨드인가?</b></summary>
<br/>
헬스케어 앱 특성상 사용 패턴이 불규칙합니다. EC2 상시 운영보다 Lambda 온디맨드 방식이 비용 효율적이며, 트래픽 급증 시 자동 스케일링이 가능합니다.
</details>

<details>
<summary><b>왜 Amazon Cognito인가?</b></summary>
<br/>
건강 데이터는 민감 정보입니다. 직접 인증 시스템을 구현하는 것보다 AWS Cognito로 보안을 위임하는 것이 안전하고 개발 시간도 절약됩니다.
</details>

<details>
<summary><b>왜 Bedrock + RAG인가?</b></summary>
<br/>
공신력 있는 영양제 문서를 S3에 저장하고 Knowledge Base로 벡터 인덱싱합니다. 단순 LLM 응답이 아닌 출처 기반 답변으로 신뢰도를 높입니다.
</details>

<details>
<summary><b>왜 PWA인가?</b></summary>
<br/>
별도 앱 스토어 배포 없이 모바일 알림, 오프라인 지원, 홈화면 아이콘을 제공합니다. Android Chrome에서 Web Push Notification으로 20-20-20 알림을 구현했습니다.
</details>

<br/>

## 👥 팀

<div align="center">

| 역할 | 담당 |
|------|------|
| 프론트엔드 + 백엔드 인프라 | [@HyoGyungKim](https://github.com) |
| AI / Bedrock RAG | [@HyoGyungKim], [@chglee76] |

</div>

<br/>

---

<div align="center">

<sub>Built with ❤️ using AWS Serverless · Amazon Bedrock · React PWA</sub>

<br/>

![AWS](https://img.shields.io/badge/Powered_by-AWS-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)

</div>
