import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.resolve(rootDir, '../.debug-screenshots');

fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('Capturing UI screenshots for visual debugging...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });

    // Mock API requests for Traverse backend
    await page.route('**/api/query', async (route) => {
      const fixturePath = path.resolve(rootDir, 'tests/fixtures/query_results.json');
      const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    });

    await page.route('**/api/schema', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          labels: ['Movie', 'Person'],
          relationship_types: ['ACTED_IN', 'DIRECTED'],
          property_keys: { title: 'STRING', released: 'INTEGER', name: 'STRING' },
        }),
      });
    });

    // Serve built files or test against preview
    const previewUrl = process.env.TEST_URL || 'http://localhost:4173';
    console.log(`Connecting to: ${previewUrl}`);
    await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 15000 });

    // Capture initial query runner view
    await page.screenshot({ path: path.join(outDir, '01_query_runner_initial.png') });
    console.log('Captured 01_query_runner_initial.png');

    // Click run query to populate table
    const runBtn = page.locator('[data-testid="run-query-btn"]');
    if (await runBtn.isVisible()) {
      await runBtn.click();
      await page.waitForSelector('[data-testid="results-table"]');
      await page.screenshot({ path: path.join(outDir, '02_query_runner_results.png') });
      console.log('Captured 02_query_runner_results.png');
    }

    // Switch to Graph tab
    await page.click('[data-testid="tab-graph"]');
    await page.waitForSelector('[data-testid="graph-placeholder"]');
    await page.screenshot({ path: path.join(outDir, '03_graph_tab_placeholder.png') });
    console.log('Captured 03_graph_tab_placeholder.png');

    // Switch to Schema tab
    await page.click('[data-testid="tab-schema"]');
    await page.waitForSelector('[data-testid="schema-placeholder"]');
    await page.screenshot({ path: path.join(outDir, '04_schema_tab_placeholder.png') });
    console.log('Captured 04_schema_tab_placeholder.png');

    console.log('Screenshot capture complete!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
