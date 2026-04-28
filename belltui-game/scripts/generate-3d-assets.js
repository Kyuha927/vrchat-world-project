#!/usr/bin/env node
/**
 * 🎮 벨튀 대작전 — 3D 에셋 AI 생성 스크립트
 *
 * Meshy AI / Tripo AI API를 사용해 3D GLB 에셋을 자동 생성합니다.
 *
 * 사용법:
 *   node generate-3d-assets.js              # 전체 생성
 *   node generate-3d-assets.js --dry-run    # API 호출 없이 프롬프트 확인
 *   node generate-3d-assets.js --single choroki_idle   # 단일 에셋
 *   node generate-3d-assets.js --category character    # 카테고리별
 *   node generate-3d-assets.js --priority 1            # 우선순위별
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── 설정 ──────────────────────────────────────────────
const CONFIG = {
  provider: process.env.ASSET_PROVIDER || 'meshy',
  meshyKey: process.env.MESHY_API_KEY || '',
  tripoKey: process.env.TRIPO_API_KEY || '',
  maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '3', 10),
  pollInterval: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
  maxRetries: 3,
  rawDir: path.join(ROOT, 'assets', 'raw', '3d'),
  readyDir: path.join(ROOT, 'assets', 'ready', '3d'),
  logDir: path.join(ROOT, 'logs'),
  manifestPath: path.join(ROOT, 'assets', '3d', 'asset_manifest.json'),
  promptsPath: path.join(__dirname, 'prompts', '3d_assets.json'),
};

// ── CLI 인수 파싱 ─────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const singleIdx = args.indexOf('--single');
const SINGLE_ID = singleIdx !== -1 ? args[singleIdx + 1] : null;
const catIdx = args.indexOf('--category');
const CATEGORY = catIdx !== -1 ? args[catIdx + 1] : null;
const prioIdx = args.indexOf('--priority');
const PRIORITY = prioIdx !== -1 ? parseInt(args[prioIdx + 1], 10) : null;

// ── 유틸리티 ──────────────────────────────────────────
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function log(message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}`;
  console.log(line);
  const logFile = path.join(CONFIG.logDir, `3d-gen-${timestamp().slice(0, 10)}.log`);
  await fs.appendFile(logFile, line + '\n').catch(() => {});
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 매니페스트 관리 ───────────────────────────────────
async function loadManifest() {
  try {
    const data = await fs.readFile(CONFIG.manifestPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { version: '1.0', provider: CONFIG.provider, generated_at: null, assets: [] };
  }
}

async function saveManifest(manifest) {
  manifest.generated_at = new Date().toISOString();
  await fs.mkdir(path.dirname(CONFIG.manifestPath), { recursive: true });
  await fs.writeFile(CONFIG.manifestPath, JSON.stringify(manifest, null, 2));
}

function findInManifest(manifest, assetId) {
  return manifest.assets.find(a => a.id === assetId);
}

function upsertManifest(manifest, entry) {
  const idx = manifest.assets.findIndex(a => a.id === entry.id);
  if (idx >= 0) {
    manifest.assets[idx] = { ...manifest.assets[idx], ...entry };
  } else {
    manifest.assets.push(entry);
  }
}

// ── Meshy API 클라이언트 ──────────────────────────────
const MESHY_BASE = 'https://api.meshy.ai/openapi/v2';

async function meshyRequest(endpoint, options = {}) {
  const url = `${MESHY_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CONFIG.meshyKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Meshy API ${res.status}: ${text}`);
  }
  return res.json();
}

async function meshyCreateImageTo3d(assetId) {
  const imagePath = path.join(ROOT, 'assets', 'turnaround', `${assetId}_turnaround.png`);
  
  await log(`[Meshy] 이미지 로드 중: ${imagePath}`);
  let imageBuffer;
  try {
    imageBuffer = await fs.readFile(imagePath);
  } catch (err) {
    throw new Error(`Turnaround image not found for ${assetId}. Generate it first.`);
  }

  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64Image}`;

  await log(`[Meshy] Image-to-3D 생성 요청: ${assetId} (${(base64Image.length / 1024).toFixed(1)}KB)`);

  const data = await meshyRequest('/image-to-3d', {
    method: 'POST',
    body: JSON.stringify({
      image_url: dataUrl,
      enable_pbr: true,
    }),
  });

  return data.result; // task_id
}

async function meshyPollTask(taskId) {
  while (true) {
    const data = await meshyRequest(`/image-to-3d/${taskId}`);
    const status = data.status;

    if (status === 'SUCCEEDED') {
      await log(`[Meshy] 태스크 완료: ${taskId}`);
      return data;
    }
    if (status === 'FAILED' || status === 'EXPIRED') {
      throw new Error(`Meshy task ${taskId} failed: ${status}`);
    }

    await log(`[Meshy] 폴링 중... ${taskId} → ${status} (${data.progress || 0}%)`);
    await sleep(CONFIG.pollInterval);
  }
}

async function meshyDownloadGlb(taskData, outputPath) {
  const glbUrl = taskData.model_urls?.glb;
  if (!glbUrl) throw new Error('GLB URL not found in task result');

  await log(`[Meshy] GLB 다운로드: ${glbUrl}`);
  const res = await fetch(glbUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  await log(`[Meshy] 저장 완료: ${outputPath} (${(buffer.length / 1024).toFixed(1)}KB)`);
  return buffer.length;
}

async function generateWithMeshy(asset, stylePrefix) {
  // Step 1: Create Image to 3D task
  const taskId = await meshyCreateImageTo3d(asset.id);
  
  // Step 2: Poll for completion
  const taskResult = await meshyPollTask(taskId);

  // Step 3: Download
  const outputPath = path.join(CONFIG.rawDir, `${asset.id}.glb`);
  const fileSize = await meshyDownloadGlb(taskResult, outputPath);

  return {
    task_id: taskId,
    raw_path: outputPath,
    file_size: fileSize,
  };
}

// ── Tripo API 클라이언트 ──────────────────────────────
const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

async function tripoRequest(endpoint, options = {}) {
  const url = `${TRIPO_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CONFIG.tripoKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tripo API ${res.status}: ${text}`);
  }
  return res.json();
}

async function tripoCreateTask(prompt, stylePrefix) {
  const fullPrompt = `${stylePrefix} ${prompt}`;
  await log(`[Tripo] 모델 생성 요청: ${fullPrompt.slice(0, 80)}...`);

  const data = await tripoRequest('/task', {
    method: 'POST',
    body: JSON.stringify({
      type: 'text_to_model',
      prompt: fullPrompt,
    }),
  });

  return data.data.task_id;
}

async function tripoPollTask(taskId) {
  while (true) {
    const data = await tripoRequest(`/task/${taskId}`);
    const status = data.data.status;

    if (status === 'success') {
      await log(`[Tripo] 태스크 완료: ${taskId}`);
      return data.data;
    }
    if (status === 'failed' || status === 'cancelled') {
      throw new Error(`Tripo task ${taskId} failed: ${status}`);
    }

    await log(`[Tripo] 폴링 중... ${taskId} → ${status} (${data.data.progress || 0}%)`);
    await sleep(CONFIG.pollInterval);
  }
}

async function tripoDownloadGlb(taskData, outputPath) {
  const glbUrl = taskData.output?.model;
  if (!glbUrl) throw new Error('GLB URL not found in Tripo result');

  await log(`[Tripo] GLB 다운로드: ${glbUrl}`);
  const res = await fetch(glbUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
  await log(`[Tripo] 저장 완료: ${outputPath} (${(buffer.length / 1024).toFixed(1)}KB)`);
  return buffer.length;
}

async function generateWithTripo(asset, stylePrefix) {
  const taskId = await tripoCreateTask(asset.prompt, stylePrefix);
  const taskData = await tripoPollTask(taskId);

  const outputPath = path.join(CONFIG.rawDir, `${asset.id}.glb`);
  const fileSize = await tripoDownloadGlb(taskData, outputPath);

  return {
    task_id: taskId,
    raw_path: outputPath,
    file_size: fileSize,
  };
}

// ── 통합 생성 함수 ────────────────────────────────────
async function generateAsset(asset, stylePrefix, manifest) {
  const existing = findInManifest(manifest, asset.id);

  // 이미 성공한 에셋은 스킵
  if (existing?.status === 'succeeded') {
    await log(`⏭️  스킵 (이미 생성됨): ${asset.id}`);
    return;
  }

  const retries = existing?.retries || 0;
  if (retries >= CONFIG.maxRetries) {
    await log(`❌ 스킵 (재시도 한도 초과): ${asset.id} (${retries}/${CONFIG.maxRetries})`);
    return;
  }

  const entry = {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    prompt: `${stylePrefix} ${asset.prompt}`,
    priority: asset.priority,
    poly_target: asset.poly_target,
    texture_size: asset.texture_size,
    status: 'generating',
    provider: CONFIG.provider,
    retries,
    task_id: null,
    raw_path: null,
    ready_path: null,
    file_size: null,
    created_at: new Date().toISOString(),
  };

  upsertManifest(manifest, entry);
  await saveManifest(manifest);

  try {
    let result;
    if (CONFIG.provider === 'meshy') {
      result = await generateWithMeshy(asset, stylePrefix);
    } else if (CONFIG.provider === 'tripo') {
      result = await generateWithTripo(asset, stylePrefix);
    } else {
      throw new Error(`Unknown provider: ${CONFIG.provider}`);
    }

    entry.status = 'succeeded';
    entry.task_id = result.task_id;
    entry.raw_path = result.raw_path;
    entry.file_size = result.file_size;
    await log(`✅ 생성 완료: ${asset.id} (${(result.file_size / 1024).toFixed(1)}KB)`);
  } catch (err) {
    entry.status = 'failed';
    entry.retries = retries + 1;
    entry.error = err.message;
    await log(`❌ 생성 실패: ${asset.id} — ${err.message} (재시도 ${entry.retries}/${CONFIG.maxRetries})`);
  }

  upsertManifest(manifest, entry);
  await saveManifest(manifest);
}

// ── 배치 실행 (동시성 제어) ───────────────────────────
async function runBatch(assets, stylePrefix, manifest) {
  const queue = [...assets];
  const running = [];

  while (queue.length > 0 || running.length > 0) {
    // 동시 실행 슬롯이 있으면 큐에서 꺼냄
    while (running.length < CONFIG.maxConcurrent && queue.length > 0) {
      const asset = queue.shift();
      const promise = generateAsset(asset, stylePrefix, manifest)
        .finally(() => {
          const idx = running.indexOf(promise);
          if (idx >= 0) running.splice(idx, 1);
        });
      running.push(promise);
    }

    // 하나라도 끝날 때까지 대기
    if (running.length > 0) {
      await Promise.race(running);
    }
  }
}

// ── 메인 ──────────────────────────────────────────────
async function main() {
  await log('═══════════════════════════════════════════');
  await log('🎮 벨튀 대작전 — 3D 에셋 AI 생성 시작');
  await log(`   Provider: ${CONFIG.provider}`);
  await log(`   Dry Run: ${DRY_RUN}`);
  await log('═══════════════════════════════════════════');

  // 프롬프트 로드
  const promptData = JSON.parse(await fs.readFile(CONFIG.promptsPath, 'utf-8'));
  const stylePrefix = promptData.style_prefix;

  // 에셋 목록 플랫화
  let allAssets = [];
  for (const [catKey, cat] of Object.entries(promptData.categories)) {
    for (const asset of cat.assets) {
      allAssets.push({ ...asset, category: catKey });
    }
  }

  await log(`📦 전체 에셋: ${allAssets.length}개`);

  // 필터링
  if (SINGLE_ID) {
    allAssets = allAssets.filter(a => a.id === SINGLE_ID);
    if (allAssets.length === 0) {
      await log(`❌ 에셋 ID '${SINGLE_ID}'를 찾을 수 없습니다.`);
      process.exit(1);
    }
  }
  if (CATEGORY) {
    allAssets = allAssets.filter(a => a.category === CATEGORY);
  }
  if (PRIORITY !== null) {
    allAssets = allAssets.filter(a => a.priority === PRIORITY);
  }

  // 우선순위 정렬
  allAssets.sort((a, b) => a.priority - b.priority);

  await log(`🎯 대상 에셋: ${allAssets.length}개`);

  // Dry Run 모드
  if (DRY_RUN) {
    await log('\n📋 [DRY RUN] 프롬프트 목록:');
    await log('─'.repeat(60));
    for (const asset of allAssets) {
      await log(`\n[${asset.category}] ${asset.id} — ${asset.name}`);
      await log(`  Priority: ${asset.priority} | Poly: ${asset.poly_target} | Tex: ${asset.texture_size}`);
      await log(`  Prompt: ${stylePrefix} ${asset.prompt}`);
    }
    await log('\n─'.repeat(60));
    await log(`✅ DRY RUN 완료. 총 ${allAssets.length}개 에셋 확인됨.`);

    // 비용 추정
    const estimatedCredits = allAssets.length * 15; // Meshy 기준 ~15 크레딧/에셋
    await log(`💰 예상 크레딧: ~${estimatedCredits} (Meshy 기준)`);
    return;
  }

  // API 키 확인
  if (CONFIG.provider === 'meshy' && !CONFIG.meshyKey) {
    await log('❌ MESHY_API_KEY가 설정되지 않았습니다. scripts/.env 파일을 확인하세요.');
    process.exit(1);
  }
  if (CONFIG.provider === 'tripo' && !CONFIG.tripoKey) {
    await log('❌ TRIPO_API_KEY가 설정되지 않았습니다. scripts/.env 파일을 확인하세요.');
    process.exit(1);
  }

  // 디렉토리 생성
  await fs.mkdir(CONFIG.rawDir, { recursive: true });
  await fs.mkdir(CONFIG.readyDir, { recursive: true });
  await fs.mkdir(CONFIG.logDir, { recursive: true });
  await fs.mkdir(path.dirname(CONFIG.manifestPath), { recursive: true });

  // 매니페스트 로드
  const manifest = await loadManifest();
  manifest.provider = CONFIG.provider;

  // 배치 실행
  const startTime = Date.now();
  await runBatch(allAssets, stylePrefix, manifest);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 결과 요약
  const succeeded = manifest.assets.filter(a => a.status === 'succeeded').length;
  const failed = manifest.assets.filter(a => a.status === 'failed').length;
  const pending = manifest.assets.filter(a => a.status === 'pending' || a.status === 'generating').length;

  await log('\n═══════════════════════════════════════════');
  await log('📊 생성 결과 요약');
  await log(`   ✅ 성공: ${succeeded}`);
  await log(`   ❌ 실패: ${failed}`);
  await log(`   ⏳ 대기: ${pending}`);
  await log(`   ⏱️  소요 시간: ${elapsed}초`);
  await log('═══════════════════════════════════════════');
}

main().catch(async (err) => {
  await log(`💥 치명적 오류: ${err.message}`);
  console.error(err);
  process.exit(1);
});
