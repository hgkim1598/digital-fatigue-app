# 디지털 피로 관리 앱 - 배포 가이드

## 사전 준비

### 1. 필수 도구 설치
- **Node.js 18+**: https://nodejs.org/
- **AWS CLI v2**: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- **AWS SAM CLI**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### 2. AWS 자격 증명 설정
```bash
# 자격 증명 설정 (IAM 사용자 키 방식)
aws configure
# → Access Key ID, Secret Access Key, Region(us-east-1) 입력

# 또는 AWS Academy/임시 자격 증명 방식
# ~/.aws/credentials 파일에 직접 붙여넣기

# 자격 증명 확인
aws sts get-caller-identity
# → Account, Arn, UserId가 출력되면 정상
```

### 3. 의존성 설치
```bash
# 백엔드 의존성
npm install

# 프론트엔드 의존성
cd frontend && npm install && cd ..
```

---

## 배포 단계

### Step 1: SAM 빌드 및 배포
```bash
# 빌드
sam build

# 첫 배포 시 (가이드 모드)
sam deploy --guided
```

가이드 모드에서 입력할 값:
| 항목 | 값 |
|------|-----|
| Stack Name | `digital-fatigue-app` |
| AWS Region | `us-east-1` |
| Confirm changes before deploy | `y` |
| Allow SAM CLI IAM role creation | `y` |
| Disable rollback | `n` |
| Save arguments to configuration file | `y` |

두 번째 배포부터는:
```bash
sam build && sam deploy
```

### Step 2: 배포 출력값 확인
```bash
# 배포 완료 후 출력값 확인
aws cloudformation describe-stacks \
  --stack-name digital-fatigue-app \
  --query "Stacks[0].Outputs" \
  --output table
```

확인해야 할 값:
- **ApiEndpoint**: API Gateway URL (예: `https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod`)
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **KnowledgeBaseId**: Bedrock KB ID
- **SupplementDataBucketName**: S3 버킷 이름
- **CloudFrontURL**: CloudFront 배포 URL

### Step 3: 테스트 계정 생성
```bash
# 환경변수 설정 (Step 2에서 확인한 값 사용)
export USER_POOL_ID="<UserPoolId>"
export USER_POOL_CLIENT_ID="<UserPoolClientId>"
export USERS_TABLE="Users"
export REGION="us-east-1"

# 테스트 계정 생성
npm run seed:test-account
```

생성되는 테스트 계정:
- 이메일: `testuser@digitalfatigue.com`
- 비밀번호: `Test1234!`

### Step 4: 더미 유저 시드
```bash
export RANKINGS_TABLE="Rankings"
export REGION="us-east-1"

npm run seed
```
→ RankingsTable에 더미 유저 50명의 순위 데이터가 삽입됩니다.

### Step 5: Knowledge Base 설정 (수동)

> ⚠️ 이 단계는 AWS 콘솔에서 수동으로 진행합니다.

1. AWS 콘솔 → **Amazon Bedrock** → **Knowledge bases** → **Create knowledge base**
2. 설정값:
   - Knowledge base name: `supplement-knowledge-base`
   - IAM role: 새로 생성 또는 기존 `supplement-kb-role` 선택
   - Embedding model: **Amazon Titan Embeddings v2** (`amazon.titan-embed-text-v2:0`)
   - Vector store: **OpenSearch Serverless** (자동 생성 옵션 선택)
   - Data source: **S3** → Step 2에서 확인한 `SupplementDataBucketName` 버킷 선택
3. 생성 완료 후 **KB ID**와 **Data Source ID**를 메모

### Step 6: Knowledge Base 데이터 배포
```bash
export KB_ID="<Knowledge Base ID>"
export DATA_SOURCE_ID="<Data Source ID>"
export SUPPLEMENT_BUCKET_NAME="<SupplementDataBucketName>"
export REGION="us-east-1"

npm run deploy-kb
```
→ `data/` 디렉토리의 텍스트 파일이 S3에 업로드되고 벡터 인덱싱이 시작됩니다.

> 💡 나중에 문서를 추가/수정하면 `npm run deploy-kb`만 다시 실행하면 됩니다.

### Step 7: 프론트엔드 빌드 및 배포
```bash
cd frontend

# API 기본 URL 설정 (CloudFront 사용 시 비워두면 됨)
# 직접 API Gateway를 사용하려면:
# echo "VITE_API_BASE_URL=https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod" > .env

# 빌드
npm run build

# S3에 업로드
aws s3 sync dist/ s3://<StaticAssetsBucket>/ --delete

# CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id <CloudFront Distribution ID> \
  --paths "/*"

cd ..
```

---

## 로컬 개발 환경

### 프론트엔드만 로컬에서 실행
```bash
cd frontend
npm run dev
# → http://localhost:5173 에서 확인
```

UI만 확인하려면 브라우저 콘솔에서 가짜 토큰을 설정:
```javascript
localStorage.setItem('idToken', 'eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InRlc3RAdGVzdC5jb20ifQ.abc');
location.reload();
```

### 백엔드 로컬 실행 (SAM Local)
```bash
# API Gateway + Lambda 로컬 실행
sam local start-api

# 프론트엔드에서 로컬 API 사용
cd frontend
echo "VITE_API_BASE_URL=http://localhost:3000" > .env.local
npm run dev
```

### 테스트 실행
```bash
# 전체 테스트
npm test

# 단위 테스트만
npm run test:unit

# Property 테스트만
npm run test:property
```

---

## 배포 순서 요약

```
1. sam build && sam deploy --guided     ← 인프라 + Lambda 배포
2. 출력값 확인 (UserPoolId 등)
3. npm run seed:test-account            ← 테스트 계정 생성
4. npm run seed                         ← 더미 유저 50명
5. AWS 콘솔에서 Bedrock KB 수동 생성    ← (선택) RAG 기능 필요 시
6. npm run deploy-kb                    ← (선택) KB 데이터 배포
7. cd frontend && npm run build         ← 프론트엔드 빌드
8. aws s3 sync dist/ s3://<버킷>/       ← 프론트엔드 S3 업로드
9. CloudFront 캐시 무효화               ← 배포 완료
```

## 테스트 계정 정보

| 항목 | 값 |
|------|-----|
| 이메일 | `testuser@digitalfatigue.com` |
| 비밀번호 | `Test1234!` |
| 나이 | 25 |
| 성별 | male |
