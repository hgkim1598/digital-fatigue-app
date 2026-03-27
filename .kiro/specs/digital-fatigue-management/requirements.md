# Requirements Document

## Introduction

디지털 피로 관리 앱은 스마트폰 과사용으로 인한 눈 건강 및 디지털 피로를 측정·관리하는 모바일 웹앱(PWA)이다. 사용자는 증상을 기록하고, 스크린타임을 추적하며, 주간 건강 분석과 RAG 기반 영양제 추천을 받을 수 있다. 또한 RAG 기반 챗봇을 통해 자신의 불편한 증상을 자유 텍스트로 입력하면 맞춤형 해결책(눈 운동, 영양제, 생활 습관 조언 등)을 받을 수 있다. 기술 스택은 React + Vite + Tailwind CSS 프론트엔드, AWS SAM 기반 서버리스 백엔드(API Gateway, Lambda, DynamoDB, Cognito, Bedrock, EventBridge)로 구성된다.

## Glossary

- **App**: 디지털 피로 관리 모바일 웹앱 (PWA) 전체 시스템
- **Auth_Service**: Cognito UserPool 기반 회원가입/로그인을 처리하는 인증 서비스 (AuthFunction Lambda)
- **Symptom_Service**: 사용자의 증상 기록(눈피로, 두통, 전신피로)을 저장·조회하는 서비스 (SymptomFunction Lambda)
- **ScreenTime_Service**: 사용자의 스크린타임 세션을 기록·조회하는 서비스 (ScreenTimeFunction Lambda)
- **Analysis_Service**: 주간 건강 점수를 계산하는 서비스 (AnalysisFunction Lambda)
- **Ranking_Service**: 전체 사용자 순위를 조회하는 서비스 (RankingFunction Lambda)
- **Supplement_Service**: RAG 파이프라인을 통해 맞춤 영양제 추천을 생성하는 서비스 (SupplementInfoFunction Lambda)
- **Chat_Service**: 사용자의 자유 텍스트 증상 입력을 받아 RAG 기반 맞춤형 해결책(눈 운동, 영양제, 생활 습관 조언 등)을 챗봇 응답으로 생성하는 서비스 (ChatFunction Lambda)
- **Weekly_Scheduler**: EventBridge 타이머로 매주 월요일 자동 실행되어 주간 데이터를 집계하는 서비스 (WeeklyScheduleFunction Lambda)
- **API_Gateway**: REST API 엔드포인트를 제공하고 Cognito Authorizer로 요청을 검증하는 게이트웨이
- **Frontend**: React + Vite + Tailwind CSS 기반 PWA 프론트엔드 애플리케이션
- **Knowledge_Base**: Bedrock Knowledge Base, NIH 영양소 데이터 및 디지털 피로 해결책(눈 운동, 생활 습관 가이드 등) 문서를 Titan Embeddings로 벡터화하여 OpenSearch Serverless에 저장한 검색 기반
- **ChatHistoryTable**: 사용자별 챗봇 대화 이력(메시지, 응답, 타임스탬프)을 저장하는 DynamoDB 테이블
- **Symptom_Score**: 눈피로, 두통, 전신피로 각각 1~5점 척도로 측정한 증상 점수
- **Weekly_Health_Score**: 주간 증상 데이터와 스크린타임을 종합하여 산출한 건강 점수
- **Timer_Notification**: 20분 간격으로 휴식을 알려주는 Web Notification API 기반 알림

## Requirements

### Requirement 1: 회원가입

**User Story:** 사용자로서, 이메일, 비밀번호, 나이, 성별을 입력하여 회원가입을 하고 싶다. 그래야 개인 건강 데이터를 안전하게 관리하고 맞춤형 분석을 받을 수 있다.

#### Acceptance Criteria

1. WHEN 유효한 이메일, 비밀번호, 나이(양의 정수), 성별(male, female, other 중 하나)이 POST /api/auth/signup 요청으로 전달되면, THE Auth_Service SHALL Cognito UserPool에 사용자를 등록하고 UsersTable에 이메일, 나이, 성별을 포함한 사용자 정보를 저장한 뒤 성공 응답(statusCode 200)을 반환한다.
2. WHEN 이미 등록된 이메일로 회원가입 요청이 전달되면, THE Auth_Service SHALL 중복 이메일 오류 메시지와 함께 실패 응답(statusCode 409)을 반환한다.
3. IF 이메일 형식이 유효하지 않거나 비밀번호가 Cognito 정책을 충족하지 않으면, THEN THE Auth_Service SHALL 구체적인 검증 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.
4. IF 나이가 누락되거나 양의 정수가 아니면, THEN THE Auth_Service SHALL 나이 검증 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.
5. IF 성별이 누락되거나 허용된 값(male, female, other) 이외의 값이면, THEN THE Auth_Service SHALL 성별 검증 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.
6. THE Auth_Service SHALL 회원가입 요청에 대해 CognitoAuthorizer 인증 없이 접근을 허용한다.

### Requirement 2: 로그인

**User Story:** 등록된 사용자로서, 이메일과 비밀번호로 로그인하고 싶다. 그래야 인증된 상태로 앱 기능을 사용할 수 있다.

#### Acceptance Criteria

1. WHEN 유효한 이메일과 비밀번호가 POST /api/auth/login 요청으로 전달되면, THE Auth_Service SHALL Cognito SRP 인증을 수행하고 AccessToken, IdToken, RefreshToken을 포함한 성공 응답(statusCode 200)을 반환한다.
2. IF 이메일 또는 비밀번호가 일치하지 않으면, THEN THE Auth_Service SHALL 인증 실패 메시지와 함께 실패 응답(statusCode 401)을 반환한다.
3. THE Auth_Service SHALL 로그인 요청에 대해 CognitoAuthorizer 인증 없이 접근을 허용한다.

### Requirement 3: API 인증 검증

**User Story:** 시스템 관리자로서, 인증되지 않은 사용자의 API 접근을 차단하고 싶다. 그래야 사용자 건강 데이터를 보호할 수 있다.

#### Acceptance Criteria

1. THE API_Gateway SHALL 회원가입(/api/auth/signup)과 로그인(/api/auth/login)을 제외한 모든 API 엔드포인트에 CognitoAuthorizer를 적용한다.
2. WHEN 유효한 Authorization 헤더가 포함된 요청이 수신되면, THE API_Gateway SHALL 해당 요청을 대상 Lambda 함수로 전달한다.
3. IF Authorization 헤더가 누락되거나 유효하지 않은 토큰이 포함되면, THEN THE API_Gateway SHALL 인증 실패 응답(statusCode 401)을 반환한다.
4. THE API_Gateway SHALL 모든 API 응답에 CORS 헤더(Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers)를 포함한다.

### Requirement 4: 증상 기록 저장

**User Story:** 사용자로서, 오늘의 눈피로·두통·전신피로 증상을 기록하고 싶다. 그래야 시간에 따른 건강 변화를 추적할 수 있다.

#### Acceptance Criteria

1. WHEN 눈피로, 두통, 전신피로 점수(각 1~5 정수)가 POST /api/symptoms 요청으로 전달되면, THE Symptom_Service SHALL 해당 증상 데이터를 사용자 ID, 타임스탬프와 함께 SymptomLogsTable에 저장하고 성공 응답(statusCode 200)을 반환한다.
2. IF 증상 점수가 1~5 범위를 벗어나거나 정수가 아니면, THEN THE Symptom_Service SHALL 검증 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.
3. IF 필수 증상 항목(눈피로, 두통, 전신피로) 중 하나라도 누락되면, THEN THE Symptom_Service SHALL 누락된 항목을 명시한 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.

### Requirement 5: 증상 기록 조회

**User Story:** 사용자로서, 과거에 기록한 증상 데이터를 조회하고 싶다. 그래야 건강 추이를 확인할 수 있다.

#### Acceptance Criteria

1. WHEN GET /api/symptoms 요청이 수신되면, THE Symptom_Service SHALL 인증된 사용자의 증상 기록 목록을 SymptomLogsTable에서 조회하여 시간 역순으로 정렬된 결과를 반환한다.
2. WHEN 조회 결과가 없으면, THE Symptom_Service SHALL 빈 배열과 함께 성공 응답(statusCode 200)을 반환한다.

### Requirement 6: 스크린타임 기록

**User Story:** 사용자로서, 스크린타임 세션을 기록하고 싶다. 그래야 하루 동안의 화면 사용 시간을 파악할 수 있다.

#### Acceptance Criteria

1. WHEN 스크린타임 세션 데이터(시작 시간, 종료 시간)가 POST /api/screen-time 요청으로 전달되면, THE ScreenTime_Service SHALL 해당 세션을 사용자 ID와 함께 ScreenTimeTable에 저장하고 성공 응답(statusCode 200)을 반환한다.
2. IF 시작 시간이 종료 시간보다 늦으면, THEN THE ScreenTime_Service SHALL 시간 범위 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.
3. IF 필수 필드(시작 시간, 종료 시간)가 누락되면, THEN THE ScreenTime_Service SHALL 누락된 필드를 명시한 오류 메시지와 함께 실패 응답(statusCode 400)을 반환한다.

### Requirement 7: 스크린타임 조회

**User Story:** 사용자로서, 기록된 스크린타임 데이터를 조회하고 싶다. 그래야 화면 사용 패턴을 분석할 수 있다.

#### Acceptance Criteria

1. WHEN GET /api/screen-time 요청이 수신되면, THE ScreenTime_Service SHALL 인증된 사용자의 스크린타임 기록을 ScreenTimeTable에서 조회하여 시간 역순으로 정렬된 결과를 반환한다.
2. WHEN 조회 결과가 없으면, THE ScreenTime_Service SHALL 빈 배열과 함께 성공 응답(statusCode 200)을 반환한다.

### Requirement 8: 주간 건강 분석

**User Story:** 사용자로서, 주간 건강 점수를 확인하고 싶다. 그래야 지난 한 주간의 디지털 피로 상태를 종합적으로 파악할 수 있다.

#### Acceptance Criteria

1. WHEN GET /api/analysis/weekly 요청이 수신되면, THE Analysis_Service SHALL 인증된 사용자의 최근 주간 건강 점수를 WeeklyAnalysisTable에서 조회하여 반환한다.
2. WHEN 해당 사용자의 주간 분석 데이터가 존재하지 않으면, THE Analysis_Service SHALL 데이터 없음 메시지와 함께 성공 응답(statusCode 200)을 반환한다.
3. THE Analysis_Service SHALL Weekly_Health_Score 계산 시 해당 주간의 증상 기록(SymptomLogsTable)과 스크린타임 기록(ScreenTimeTable)을 모두 반영한다.

### Requirement 9: 사용자 순위 조회

**User Story:** 사용자로서, 전체 사용자 중 나의 건강 관리 순위를 확인하고 싶다. 그래야 동기부여를 받을 수 있다.

#### Acceptance Criteria

1. WHEN GET /api/analysis/ranking 요청이 수신되면, THE Ranking_Service SHALL RankingsTable에서 전체 사용자 순위 목록을 조회하여 순위 오름차순으로 정렬된 결과를 반환한다.
2. THE Ranking_Service SHALL 순위 목록에 더미 유저 50명의 데이터를 포함한다.
3. WHEN 인증된 사용자의 순위 데이터가 존재하면, THE Ranking_Service SHALL 해당 사용자의 순위 정보를 응답에 별도로 표시한다.

### Requirement 10: RAG 기반 영양제 추천

**User Story:** 사용자로서, 나의 건강 상태에 맞는 영양제 추천을 받고 싶다. 그래야 디지털 피로 개선에 도움이 되는 영양제를 선택할 수 있다.

#### Acceptance Criteria

1. WHEN GET /api/supplement-info 요청이 수신되면, THE Supplement_Service SHALL 인증된 사용자의 최근 Weekly_Health_Score를 WeeklyAnalysisTable에서 조회한다.
2. WHEN Weekly_Health_Score가 조회되면, THE Supplement_Service SHALL 해당 점수를 기반으로 Knowledge_Base에 벡터 검색(retrieve)을 수행하여 관련 NIH 영양소 문서 및 디지털 피로 해결책 문서를 가져온다.
3. WHEN 관련 문서가 검색되면, THE Supplement_Service SHALL 검색된 문서와 사용자 점수를 Claude Sonnet 모델에 전달하여 맞춤 영양제 추천 텍스트를 생성한다.
4. THE Supplement_Service SHALL 생성된 추천 텍스트를 성공 응답(statusCode 200)으로 반환한다.
5. IF 사용자의 Weekly_Health_Score가 존재하지 않으면, THEN THE Supplement_Service SHALL 주간 분석 데이터가 필요하다는 안내 메시지와 함께 응답(statusCode 404)을 반환한다.
6. IF Knowledge_Base 검색 또는 Claude 모델 호출이 실패하면, THEN THE Supplement_Service SHALL 서비스 오류 메시지와 함께 실패 응답(statusCode 500)을 반환한다.

### Requirement 11: Knowledge Base 데이터 구성

**User Story:** 시스템 관리자로서, NIH 공식 영양소 데이터와 디지털 피로 해결책 자료를 Knowledge Base에 구성하고 싶다. 그래야 RAG 파이프라인이 신뢰할 수 있는 데이터를 기반으로 영양제 추천 및 챗봇 응답을 생성할 수 있다.

#### Acceptance Criteria

1. THE Knowledge_Base SHALL SupplementDataBucket(S3)에 저장된 다음 카테고리의 텍스트 파일을 데이터 소스로 사용한다: NIH 영양소 문서(루테인, 오메가3, 비타민A, 비타민C, 아연 5종), 눈 운동 가이드 문서, 생활 습관 개선 가이드 문서.
2. THE Knowledge_Base SHALL Titan Embeddings 모델(amazon.titan-embed-text-v2:0)을 사용하여 모든 텍스트 파일을 벡터로 변환한다.
3. THE Knowledge_Base SHALL 변환된 벡터를 OpenSearch Serverless 컬렉션(supplement-vectors)에 인덱싱한다.
4. THE Knowledge_Base SHALL us-east-1 리전에서 운영된다.
5. THE Knowledge_Base SHALL Supplement_Service(영양제 자동 추천)와 Chat_Service(챗봇 응답 생성) 모두에서 공유 데이터 소스로 사용된다.

### Requirement 12: 주간 자동 집계

**User Story:** 시스템 관리자로서, 매주 자동으로 주간 데이터를 집계하고 싶다. 그래야 사용자가 별도 조작 없이 주간 분석 결과를 확인할 수 있다.

#### Acceptance Criteria

1. WHEN 매주 월요일 오전 9시(KST, UTC 0시)가 되면, THE Weekly_Scheduler SHALL EventBridge 스케줄에 의해 자동으로 실행된다.
2. WHEN Weekly_Scheduler가 실행되면, THE Weekly_Scheduler SHALL 전주(월~일) 기간의 모든 사용자 증상 기록을 SymptomLogsTable에서 집계한다.
3. WHEN Weekly_Scheduler가 실행되면, THE Weekly_Scheduler SHALL 전주(월~일) 기간의 모든 사용자 스크린타임 기록을 ScreenTimeTable에서 집계한다.
4. WHEN 증상 및 스크린타임 집계가 완료되면, THE Weekly_Scheduler SHALL 각 사용자의 Weekly_Health_Score를 계산하여 WeeklyAnalysisTable에 저장한다.
5. WHEN Weekly_Health_Score 계산이 완료되면, THE Weekly_Scheduler SHALL 전체 사용자 순위를 산출하여 RankingsTable을 갱신한다.

### Requirement 13: 프론트엔드 홈 화면

**User Story:** 사용자로서, 앱 홈 화면에서 휴식 타이머와 오늘의 스크린타임을 확인하고 싶다. 그래야 실시간으로 디지털 피로를 관리할 수 있다.

#### Acceptance Criteria

1. THE Frontend SHALL 홈 화면에 20분 간격 휴식 타이머를 표시한다.
2. WHEN 20분 타이머가 만료되면, THE Frontend SHALL Web Notification API를 사용하여 휴식 알림을 표시한다.
3. THE Frontend SHALL 홈 화면에 오늘의 총 스크린타임을 표시한다.
4. THE Frontend SHALL 모바일 우선 UI로 최대 너비 390px에 최적화된 레이아웃을 제공한다.

### Requirement 14: 증상 기록 화면

**User Story:** 사용자로서, 간편한 설문 화면에서 오늘의 증상을 기록하고 싶다. 그래야 빠르게 건강 상태를 입력할 수 있다.

#### Acceptance Criteria

1. THE Frontend SHALL 증상 기록 화면에 눈피로, 두통, 전신피로 3개 문항을 표시한다.
2. THE Frontend SHALL 각 문항에 대해 1~5점 척도 선택 UI를 제공한다.
3. WHEN 사용자가 3개 문항을 모두 선택하고 제출하면, THE Frontend SHALL POST /api/symptoms 요청을 전송한다.
4. WHEN 증상 기록이 성공하면, THE Frontend SHALL 성공 피드백을 사용자에게 표시한다.
5. IF 증상 기록이 실패하면, THEN THE Frontend SHALL 오류 메시지를 사용자에게 표시한다.

### Requirement 15: 분석 화면

**User Story:** 사용자로서, 주간 건강 분석 결과와 순위, 영양제 추천을 한 화면에서 확인하고 싶다. 그래야 종합적인 건강 관리 정보를 얻을 수 있다.

#### Acceptance Criteria

1. THE Frontend SHALL 분석 화면에 주간 건강 점수(Weekly_Health_Score)를 표시한다.
2. THE Frontend SHALL 분석 화면에 전체 사용자 순위를 표시한다.
3. THE Frontend SHALL 분석 화면에 RAG 기반 영양제 추천 텍스트를 표시한다.
4. WHEN 분석 화면이 로드되면, THE Frontend SHALL GET /api/analysis/weekly, GET /api/analysis/ranking, GET /api/supplement-info 요청을 병렬로 전송한다.
5. WHILE 데이터를 로딩 중일 때, THE Frontend SHALL 로딩 인디케이터를 표시한다.
6. IF 하나 이상의 API 요청이 실패하면, THEN THE Frontend SHALL 실패한 섹션에 오류 메시지를 표시하고 성공한 섹션은 정상 표시한다.

### Requirement 16: PWA 설정

**User Story:** 사용자로서, 앱을 홈 화면에 설치하고 오프라인에서도 기본 화면을 볼 수 있게 하고 싶다. 그래야 네이티브 앱처럼 편리하게 사용할 수 있다.

#### Acceptance Criteria

1. THE Frontend SHALL vite-plugin-pwa를 사용하여 Service Worker를 등록한다.
2. THE Frontend SHALL Web App Manifest를 제공하여 홈 화면 설치를 지원한다.
3. WHEN 네트워크가 오프라인 상태일 때, THE Frontend SHALL 캐시된 정적 자원을 사용하여 기본 화면을 표시한다.

### Requirement 17: Lambda 공통 규칙

**User Story:** 개발자로서, 모든 Lambda 함수가 일관된 코드 규칙을 따르게 하고 싶다. 그래야 유지보수성과 코드 품질을 보장할 수 있다.

#### Acceptance Criteria

1. THE App SHALL 모든 Lambda 함수를 Node.js 18 런타임과 async/await 패턴으로 구현한다.
2. THE App SHALL 모든 Lambda 함수에서 try/catch 블록을 사용하여 에러를 처리한다.
3. IF Lambda 함수 실행 중 예상치 못한 에러가 발생하면, THEN THE App SHALL 에러를 로깅하고 statusCode 500과 에러 메시지를 포함한 응답을 반환한다.
4. THE App SHALL 모든 API 응답을 { statusCode, body: JSON.stringify({}) } 형식으로 반환한다.
5. THE App SHALL 환경변수(KB_ID, USER_POOL_ID, USER_POOL_CLIENT_ID, 테이블명)를 통해 리소스를 참조한다.

### Requirement 18: 정적 자원 배포

**User Story:** 시스템 관리자로서, 프론트엔드를 S3와 CloudFront를 통해 배포하고 싶다. 그래야 전 세계 사용자에게 빠른 응답 속도를 제공할 수 있다.

#### Acceptance Criteria

1. THE App SHALL 빌드된 프론트엔드 정적 자원을 StaticAssetsBucket(S3)에 저장한다.
2. THE App SHALL CloudFront Distribution을 통해 정적 자원을 HTTPS로 제공한다.
3. THE App SHALL CloudFront에서 /api/* 경로의 요청을 API Gateway 오리진으로 라우팅한다.
4. THE App SHALL CloudFront의 기본 루트 객체를 index.html로 설정한다.

### Requirement 19: RAG 기반 챗봇 서비스

**User Story:** 사용자로서, 나의 불편한 증상을 자유 텍스트로 입력하면 맞춤형 해결책(눈 운동 추천, 영양제 추천, 생활 습관 조언 등)을 챗봇 응답으로 받고 싶다. 그래야 디지털 피로 증상에 대해 즉각적이고 개인화된 조언을 얻을 수 있다.

#### Acceptance Criteria

1. WHEN 사용자의 자유 텍스트 메시지가 POST /api/chat 요청으로 전달되면, THE Chat_Service SHALL 인증된 사용자의 프로필(나이, 성별)을 UsersTable에서 조회한다.
2. WHEN 사용자 프로필이 조회되면, THE Chat_Service SHALL 입력된 텍스트와 사용자 프로필(나이, 성별)을 조합하여 Knowledge_Base에 벡터 검색(retrieve)을 수행하여 관련 NIH 영양소 문서, 눈 운동 가이드, 생활 습관 가이드를 가져온다.
3. WHEN 관련 문서가 검색되면, THE Chat_Service SHALL 검색된 문서, 사용자 메시지, 사용자 프로필(나이, 성별)을 Claude Sonnet 모델에 전달하여 맞춤형 해결책(눈 운동 추천, 영양제 추천, 생활 습관 조언 등)을 생성한다.
4. WHEN 챗봇 응답이 생성되면, THE Chat_Service SHALL 사용자 메시지와 챗봇 응답을 타임스탬프와 함께 ChatHistoryTable에 저장한다.
5. THE Chat_Service SHALL 생성된 챗봇 응답 텍스트를 성공 응답(statusCode 200)으로 반환한다.
6. IF 사용자 메시지가 빈 문자열이거나 누락되면, THEN THE Chat_Service SHALL 메시지 입력 필요 오류와 함께 실패 응답(statusCode 400)을 반환한다.
7. IF Knowledge_Base 검색 또는 Claude 모델 호출이 실패하면, THEN THE Chat_Service SHALL 서비스 오류 메시지와 함께 실패 응답(statusCode 500)을 반환한다.
8. WHEN GET /api/chat/history 요청이 수신되면, THE Chat_Service SHALL 인증된 사용자의 대화 이력을 ChatHistoryTable에서 조회하여 시간순으로 정렬된 결과를 반환한다.
9. WHEN 대화 이력 조회 결과가 없으면, THE Chat_Service SHALL 빈 배열과 함께 성공 응답(statusCode 200)을 반환한다.

### Requirement 20: 챗봇 프론트엔드 화면

**User Story:** 사용자로서, 별도 탭에서 챗봇과 대화하며 나의 디지털 피로 증상에 대한 맞춤형 해결책을 받고 싶다. 그래야 직관적인 대화 인터페이스로 편리하게 조언을 얻을 수 있다.

#### Acceptance Criteria

1. THE Frontend SHALL 하단 네비게이션에 챗봇 탭을 별도로 제공한다.
2. THE Frontend SHALL 챗봇 화면에 메시지 입력 텍스트 필드와 전송 버튼을 표시한다.
3. WHEN 챗봇 화면이 로드되면, THE Frontend SHALL GET /api/chat/history 요청을 전송하여 기존 대화 이력을 표시한다.
4. WHEN 사용자가 메시지를 입력하고 전송하면, THE Frontend SHALL POST /api/chat 요청을 전송하고 사용자 메시지를 대화 영역에 즉시 표시한다.
5. WHILE 챗봇 응답을 대기 중일 때, THE Frontend SHALL 로딩 인디케이터를 대화 영역에 표시한다.
6. WHEN 챗봇 응답이 수신되면, THE Frontend SHALL 응답 텍스트를 대화 영역에 표시하고 최신 메시지로 자동 스크롤한다.
7. IF 챗봇 API 요청이 실패하면, THEN THE Frontend SHALL 오류 메시지를 대화 영역에 표시하고 재전송 옵션을 제공한다.
8. THE Frontend SHALL 챗봇 화면을 모바일 우선 UI로 최대 너비 390px에 최적화된 레이아웃으로 제공한다.
