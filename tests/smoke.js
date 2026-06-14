import { spawn } from 'child_process';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const PREVIEW_PORT = 5177;
const PREVIEW_HOST = 'localhost';

let passed = 0;
let failed = 0;
let failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  ❌ ${message}`);
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('Request timeout'));
    });
  });
}

function waitForServer(url, maxRetries = 30, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const tryConnect = async () => {
      try {
        const res = await httpGet(url);
        if (res.status === 200 || res.status === 301 || res.status === 302) {
          resolve();
        } else {
          retries++;
          if (retries >= maxRetries) {
            reject(new Error(`Server returned status ${res.status} after ${maxRetries} retries`));
          } else {
            setTimeout(tryConnect, intervalMs);
          }
        }
      } catch (e) {
        retries++;
        if (retries >= maxRetries) {
          reject(new Error(`Server not reachable after ${maxRetries} retries: ${e.message}`));
        } else {
          setTimeout(tryConnect, intervalMs);
        }
      }
    };
    tryConnect();
  });
}

async function checkPage(path, description, expectedContent) {
  const url = `http://${PREVIEW_HOST}:${PREVIEW_PORT}${path}`;
  console.log(`\n--- ${description} ---`);
  try {
    const res = await httpGet(url);
    assert(res.status === 200, `HTTP 状态码为 200 (实际: ${res.status})`);
    if (expectedContent) {
      const hasContent = res.body.includes(expectedContent);
      assert(hasContent, `页面包含预期内容: "${expectedContent}"`);
    }
    assert(res.body.length > 0, '响应体非空');
    return res;
  } catch (e) {
    assert(false, `请求失败: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('\n=== 构建冒烟测试 ===\n');

  let previewProcess = null;

  try {
    console.log('正在启动 vite preview 服务...');
    previewProcess = spawn('npx', ['vite', 'preview', '--host', PREVIEW_HOST, '--port', PREVIEW_PORT], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let previewOutput = '';
    previewProcess.stdout.on('data', (data) => {
      previewOutput += data.toString();
    });
    previewProcess.stderr.on('data', (data) => {
      previewOutput += data.toString();
    });

    previewProcess.on('error', (err) => {
      console.error('启动 preview 服务失败:', err.message);
    });

    await waitForServer(`http://${PREVIEW_HOST}:${PREVIEW_PORT}/`);
    console.log('✅ preview 服务已启动\n');

    await checkPage('/', '主页面 /', '读书会');
    await checkPage('/public/test-event-id', '公开活动页 /public/[eventId]', '读书会报名');
    await checkPage('/public/series/test-series-id', '公开系列页 /public/series/[seriesId]', '读书会系列活动');

    console.log(`\n--- 构建产物检查 ---`);
    const fs = await import('fs');
    const buildDir = path.join(projectRoot, '.svelte-kit');
    const hasBuildDir = fs.existsSync(buildDir);
    assert(hasBuildDir, `.svelte-kit 构建目录存在`);

    const outputDir = path.join(projectRoot, 'build');
    const hasOutputDir = fs.existsSync(outputDir);
    assert(hasOutputDir || hasBuildDir, '构建产物目录存在 (build 或 .svelte-kit)');

  } catch (e) {
    failed++;
    failures.push(`冒烟测试整体失败: ${e.message}`);
    console.error(`\n❌ 冒烟测试失败: ${e.message}`);
  } finally {
    if (previewProcess) {
      previewProcess.kill('SIGTERM');
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!previewProcess.killed) {
        previewProcess.kill('SIGKILL');
      }
    }
  }

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.error('\n失败项:');
    failures.forEach((f, i) => {
      console.error(`  ${i + 1}. ${f}`);
    });
    console.error('\n⚠️ 冒烟测试失败，请检查！');
    process.exit(1);
  } else {
    console.log('\n✅ 全部冒烟测试通过！');
    process.exit(0);
  }
}

main();
