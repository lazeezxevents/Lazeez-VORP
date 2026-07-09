const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer');

marked.setOptions({
  highlight: function(code, lang) {
    const valid = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language: valid }).value;
  },
  gfm: true,
  breaks: false,
  headerIds: true,
});

async function build() {
  const root = path.resolve(__dirname, '..');
  const docsRoot = root;

  const filesInOrder = [
    'README.md',
    '1_product_requirements.md',
    '2_architecture.md',
    'diagrams/sequence_diagrams.mmd',
    'diagrams/dfd.mmd',
    'diagrams/uml_class.mmd',
    'diagrams/flowchart.mmd',
    'diagrams/bpmn.mmd',
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
    'build_and_deployment_reports.md'
  ];

  // Prepare output directories
  const outDir = path.join(docsRoot, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const diagramOut = path.join(outDir, 'diagrams');
  if (!fs.existsSync(diagramOut)) fs.mkdirSync(diagramOut);

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });

  // Generate a PDF per source file and, for .mmd, also an SVG
  for (const rel of filesInOrder) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) continue;
    const ext = path.extname(full).toLowerCase();
    const basename = path.basename(rel, ext);
    const content = fs.readFileSync(full, 'utf8');

    let htmlFragment = '';
    if (ext === '.mmd') {
      htmlFragment = `<div class="mermaid">\n${content}\n</div>`;
    } else if (ext === '.yaml' || ext === '.yml') {
      htmlFragment = '<pre><code class="language-yaml">' + escapeHtml(content) + '</code></pre>';
    } else {
      htmlFragment = marked(content);
    }

    const html = buildHtmlPage(`${basename}`, htmlFragment);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // If mermaid, wait for SVG then extract it
    if (ext === '.mmd') {
      try {
        await page.waitForSelector('svg', { timeout: 5000 });
        const svg = await page.$eval('.mermaid', el => el.innerHTML);
        const svgPath = path.join(diagramOut, `${basename}.svg`);
        fs.writeFileSync(svgPath, svg, 'utf8');
      } catch (e) {
        // render delay: give extra time and try again
        await page.waitForTimeout(1500);
        try {
          const svg = await page.$eval('.mermaid', el => el.innerHTML);
          const svgPath = path.join(diagramOut, `${basename}.svg`);
          fs.writeFileSync(svgPath, svg, 'utf8');
        } catch (err) {
          console.warn('Could not extract SVG for', rel, err.message);
        }
      }
    }

    const outPath = path.join(outDir, `${basename}.pdf`);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
    await page.close();
    console.log('Generated', outPath);
  }

  // Now generate the combined global PDF (all files)
  let md = '# Technical Documentation\n\n';
  md += 'Generated on: ' + new Date().toISOString() + '\n\n---\n\n';
  for (const rel of filesInOrder) {
    const full = path.join(docsRoot, rel);
    if (!fs.existsSync(full)) continue;
    const ext = path.extname(full).toLowerCase();
    const basename = path.basename(rel);
    md += `\n\n## ${basename}\n\n`;
    const content = fs.readFileSync(full, 'utf8');
    if (ext === '.mmd') {
      md += `<div class="mermaid">\n${content}\n</div>\n\n`;
    } else if (ext === '.yaml' || ext === '.yml') {
      md += '```yaml\n' + content + '\n```\n\n';
    } else {
      md += content + '\n\n';
    }
  }

  const htmlBody = marked(md);
  const fullHtml = buildHtmlPage('Technical Documentation', htmlBody);
  const pageAll = await browser.newPage();
  await pageAll.setContent(fullHtml, { waitUntil: 'networkidle0' });
  await pageAll.waitForTimeout(2000);
  const combinedPath = path.join(docsRoot, 'technical_documentation.pdf');
  await pageAll.pdf({ path: combinedPath, format: 'A4', printBackground: true });
  await pageAll.close();

  await browser.close();

  console.log('Combined PDF generated at', combinedPath);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtmlPage(title, bodyHtml) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css">
    <style>
      body { font-family: Arial, Helvetica, sans-serif; padding: 40px; color: #222 }
      pre { background: #f6f8fa; padding: 12px; overflow: auto }
      code { font-family: monospace }
      h1, h2, h3 { color: #111 }
    </style>
  </head>
  <body>
    ${bodyHtml}
    <script src="https://unpkg.com/mermaid@10/dist/mermaid.min.js"></script>
    <script>
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      document.querySelectorAll('.mermaid').forEach((el, idx) => {
        try {
          mermaid.render('m'+idx, el.textContent, (svgCode) => { el.innerHTML = svgCode; });
        } catch(e) { console.error(e); }
      });
    </script>
  </body>
</html>`;
}

build().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
