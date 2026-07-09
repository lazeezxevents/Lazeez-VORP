const fs = require('fs');
const path = require('path');
const md = require('markdown-it')({ html: true, linkify: true });
const puppeteer = require('puppeteer');

const workspaceDir = path.resolve(__dirname);
const outPdf = path.join(workspaceDir, 'Product_Technical_Docs.pdf');

function readIfExists(p) {
  try { return fs.readFileSync(path.join(workspaceDir, p), 'utf8'); } catch (e) { return null; }
}

async function build() {
  const order = [
    'README.md',
    '1_product_requirements.md',
    '2_architecture.md',
    '3_api_documentation.md',
    'openapi.yaml',
    '4_data_database.md',
    '5_security_compliance.md',
    '6_devops_deployment.md',
    '7_testing_qa.md',
    '8_release_versioning.md',
    '9_monitoring_observability.md',
    '10_technical_roadmap.md',
    'code_quality_and_reports.md',
    'build_and_deployment_reports.md',
    'diagrams/sequence_diagrams.mmd',
    'diagrams/er_diagram.mmd'
  ];

  let combined = '';
  for (const f of order) {
    const content = readIfExists(f);
    if (!content) continue;
    combined += `\n\n---\n\n# File: ${f}\n\n`;
    if (f.endsWith('.yaml') || f.endsWith('.yml')) {
      combined += '```yaml\n' + content + '\n```\n';
    } else if (f.endsWith('.mmd')) {
      combined += '```mermaid\n' + content + '\n```\n';
    } else {
      combined += content + '\n';
    }
  }

  const htmlBody = md.render(combined);

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Product Technical Docs</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 24px; }
      pre { background:#f6f8fa; padding:12px; overflow:auto }
      code { font-family: monospace }
      h1,h2,h3 { color: #0b3d91 }
      .page-break { page-break-after: always; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  </head>
  <body>
  ${htmlBody}

  <script>
    // Replace code blocks labelled "language-mermaid" with mermaid divs
    document.querySelectorAll('pre > code[class*="language-mermaid"]').forEach(function(code){
      const parent = code.parentElement;
      const txt = code.textContent;
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = txt;
      parent.parentElement.replaceChild(div, parent);
    });
    mermaid.initialize({ startOnLoad:true });
  </script>
  </body>
  </html>`;

  const tmpHtml = path.join(workspaceDir, 'ALL_DOCS.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');

  console.log('Launching headless browser to generate PDF (this may download Chromium on first run)...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('file://' + tmpHtml, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outPdf, format: 'A4', printBackground: true });
  await browser.close();

  console.log('PDF generated at:', outPdf);
}

build().catch(err => { console.error(err); process.exit(1); });
