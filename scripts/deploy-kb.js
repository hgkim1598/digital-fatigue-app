'use strict';

/**
 * Knowledge Base 배포 스크립트
 * 1. data/ 디렉토리의 모든 txt 파일을 S3 버킷에 업로드
 * 2. Bedrock Knowledge Base의 DataSource에 대해 startIngestionJob 호출
 * 3. Ingestion Job 완료 대기
 *
 * 환경변수:
 *   KB_ID - Bedrock Knowledge Base ID
 *   DATA_SOURCE_ID - Bedrock DataSource ID
 *   SUPPLEMENT_BUCKET_NAME - S3 버킷 이름
 *   REGION - AWS 리전 (기본값: us-east-1)
 *
 * 사용법: npm run deploy-kb
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { BedrockAgentClient, StartIngestionJobCommand, GetIngestionJobCommand } = require('@aws-sdk/client-bedrock-agent');

const REGION = process.env.REGION || 'us-east-1';
const KB_ID = process.env.KB_ID;
const DATA_SOURCE_ID = process.env.DATA_SOURCE_ID;
const BUCKET_NAME = process.env.SUPPLEMENT_BUCKET_NAME;

if (!KB_ID || !DATA_SOURCE_ID || !BUCKET_NAME) {
  console.error('❌ 필수 환경변수가 설정되지 않았습니다:');
  console.error('   KB_ID, DATA_SOURCE_ID, SUPPLEMENT_BUCKET_NAME');
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });
const bedrockAgent = new BedrockAgentClient({ region: REGION });

/**
 * data/ 디렉토리에서 모든 txt 파일 경로를 재귀적으로 수집
 */
function collectTextFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(fullPath));
    } else if (entry.name.endsWith('.txt')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * S3에 파일 업로드
 */
async function uploadFile(filePath) {
  const key = path.relative('data', filePath);
  const body = fs.readFileSync(filePath, 'utf-8');

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: 'text/plain; charset=utf-8',
  }));

  console.log(`  ✅ 업로드: s3://${BUCKET_NAME}/${key}`);
}

/**
 * Ingestion Job 시작 및 완료 대기
 */
async function startAndWaitIngestion() {
  console.log('\n📦 Ingestion Job 시작...');

  const startRes = await bedrockAgent.send(new StartIngestionJobCommand({
    knowledgeBaseId: KB_ID,
    dataSourceId: DATA_SOURCE_ID,
  }));

  const jobId = startRes.ingestionJob.ingestionJobId;
  console.log(`  Job ID: ${jobId}`);

  // 폴링으로 완료 대기 (최대 10분)
  const maxWait = 600;
  const interval = 10;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    elapsed += interval;

    const getRes = await bedrockAgent.send(new GetIngestionJobCommand({
      knowledgeBaseId: KB_ID,
      dataSourceId: DATA_SOURCE_ID,
      ingestionJobId: jobId,
    }));

    const status = getRes.ingestionJob.status;
    console.log(`  상태: ${status} (${elapsed}초 경과)`);

    if (status === 'COMPLETE') {
      const stats = getRes.ingestionJob.statistics;
      console.log(`  처리 결과: ${stats?.numberOfDocumentsScanned || 0}개 스캔, ${stats?.numberOfNewDocumentsIndexed || 0}개 인덱싱`);
      return;
    }

    if (status === 'FAILED') {
      const reasons = getRes.ingestionJob.failureReasons || [];
      console.error(`  ❌ Ingestion 실패: ${reasons.join(', ')}`);
      process.exit(1);
    }
  }

  console.error('  ❌ Ingestion 타임아웃 (10분 초과)');
  process.exit(1);
}

/**
 * 메인 실행
 */
async function main() {
  try {
    console.log('=== Knowledge Base 배포 스크립트 ===');
    console.log(`KB ID: ${KB_ID}`);
    console.log(`DataSource ID: ${DATA_SOURCE_ID}`);
    console.log(`S3 버킷: ${BUCKET_NAME}`);
    console.log(`리전: ${REGION}`);
    console.log('');

    // 1. 파일 수집
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      console.error('❌ data/ 디렉토리가 존재하지 않습니다');
      process.exit(1);
    }

    const files = collectTextFiles(dataDir);
    console.log(`📄 ${files.length}개 텍스트 파일 발견\n`);

    // 2. S3 업로드
    console.log('☁️  S3 업로드 시작...');
    for (const file of files) {
      await uploadFile(file);
    }
    console.log(`\n✅ ${files.length}개 파일 업로드 완료`);

    // 3. Ingestion Job
    await startAndWaitIngestion();

    console.log('\n🎉 Knowledge Base 배포 완료!');
  } catch (err) {
    console.error('❌ 배포 실패:', err.message);
    process.exit(1);
  }
}

main();
