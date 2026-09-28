#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isTechnologyDataFile } = require('./data-files');
const { getDependencyEdges } = require('./edge-schema');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const TAXONOMY_FILE = path.join(DATA_DIR, 'taxonomy.json');
const QUALITY_SNAPSHOT_FILE = path.join(DATA_DIR, 'quality-snapshot.json');
const BASE_URL = 'https://pushme.site/techtree';
const DEFAULT_ERA_ORDER = [
  'Ancient',
  'Classical',
  'Medieval',
  'Renaissance',
  'Industrial',
  'Modern',
  'Future'
];
const PUBLIC_LINKS = {
  demo: 'https://pushme.site/techtree/demo.html',
  graph: 'https://pushme.site/techtree',
  sorted: 'https://pushme.site/techtree/sorted.html',
  repo: 'https://github.com/yodakohl/techtree',
  qualitySnapshot: 'https://github.com/yodakohl/techtree/blob/main/docs/QUALITY_SNAPSHOT.md',
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readDataFiles() {
  return fs
    .readdirSync(DATA_DIR)
    .filter(isTechnologyDataFile)
    .sort((a, b) => a.localeCompare(b))
    .flatMap(file => {
      const full = path.join(DATA_DIR, file);
      const chunk = readJson(full);
      if (!Array.isArray(chunk)) {
        throw new Error(`${file} must contain a JSON array`);
      }
      return chunk.map(item => ({ ...item, __source_file: file }));
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function readTaxonomy() {
  return readJson(TAXONOMY_FILE);
}

function readQualitySnapshot() {
  return readJson(QUALITY_SNAPSHOT_FILE);
}

// The Chinese dictionary (i18n-zh.js) is the single source of truth for labels and
// page strings; it is evaluated in a bare window sandbox so the Node generator and
// the browser runtime stay in sync. Technology translations live in data/i18n/zh.json.
function loadZhContext() {
  const labels = {};
  const strings = {};
  try {
    const fakeWindow = {};
    new Function('window', fs.readFileSync(path.join(ROOT_DIR, 'i18n-zh.js'), 'utf8'))(fakeWindow);
    Object.assign(labels, fakeWindow.ZH_LABELS || {});
    Object.assign(strings, fakeWindow.ZH_STRINGS || {});
  } catch (error) {
    console.error('Failed to load i18n-zh.js for static pages:', error);
  }
  const dataFile = path.join(DATA_DIR, 'i18n', 'zh.json');
  let data = {};
  if (fs.existsSync(dataFile)) {
    try {
      data = JSON.parse(fs.readFileSync(dataFile, 'utf8')) || {};
    } catch (error) {
      console.error('Failed to load data/i18n/zh.json for static pages:', error);
    }
  }
  return { data, labels, strings };
}

let ZH = { data: {}, labels: {}, strings: {} };

function zhString(key) {
  return ZH.strings[key] || '';
}

function zhLabel(value) {
  return ZH.labels[value] || '';
}

function zhEntry(id) {
  return ZH.data[id] || null;
}

// Renders "English中文" as two spans; static CSS shows exactly one at a time.
function bi(en, zh = '') {
  const safeEn = escapeHtml(en);
  if (!zh) return safeEn;
  return `<span class="i18n-en">${safeEn}</span><span class="i18n-zh">${escapeHtml(zh)}</span>`;
}

function biValue(value) {
  return bi(String(value ?? ''), zhLabel(String(value ?? '')));
}

function bilingualHeadExtras() {
  return `
    <style>
      html[data-lang="zh"] .i18n-en { display: none; }
      html[data-lang="en"] .i18n-zh { display: none; }
      .lang-toggle { margin-left: 0.75rem; padding: 0.15rem 0.6rem; cursor: pointer; }
    </style>`;
}

function bilingualToggleScript() {
  // Inline scripts are blocked by the server CSP (script-src 'self'), so the
  // toggle lives in the external i18n-static.js served from the site root.
  return `<script src="../i18n-static.js"></script>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, '-')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getEraOrder(eras) {
  if (!Array.isArray(eras) || !eras.length) {
    return DEFAULT_ERA_ORDER.slice();
  }
  return eras.slice();
}

function formatDatePrecision(value) {
  return String(value || 'unknown');
}

function getChecksum(content) {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

function relativeOutputPath(filePath, outputDir) {
  return path.relative(outputDir, filePath).split(path.sep).join('/');
}

function sourceList(sources = []) {
  if (!Array.isArray(sources) || !sources.length) {
    return `<p>${bi('No sources recorded.', zhString('page_no_sources'))}</p>`;
  }

  const items = sources.map(source => {
    const href = source.url
      ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || source.url)}</a>`
      : escapeHtml(source.title || zhString('page_source') || 'Source');
    const support = Array.isArray(source.supports)
      ? `${bi(' • Supports:', zhString('page_supports'))} ${escapeHtml(source.supports.join(', '))}`
      : '';
    const locator = source.source_locator
      ? `<br/><small>${bi('Locator:', zhString('page_locator'))} ${escapeHtml(source.source_locator)}</small>`
      : '';
    const publisher = source.publisher || zhString('page_unknown_publisher') || 'Unknown publisher';
    const sourceType = biValue(source.source_type || 'unknown');
    return `<li>${href} (${escapeHtml(publisher)}, ${escapeHtml(source.year || 'n/a')}, ${sourceType})${support}${locator}</li>`;
  });

  return `<ul>${items.join('')}</ul>`;
}

function canonicalTechnologyUrl(id) {
  return `${BASE_URL}/tech/${encodeURIComponent(id)}.html`;
}

function canonicalFieldUrl(fieldName) {
  return `${BASE_URL}/fields/${slugify(fieldName)}.html`;
}

function canonicalGraphUrl() {
  return `${PUBLIC_LINKS.graph}/`;
}

function renderSourceCheckedMetadata(item) {
  return [
    `<li><strong>ID:</strong> ${escapeHtml(item.id)}</li>`,
    `<li><strong>${bi('Era', zhString('label_era'))}:</strong> ${biValue(item.era)}</li>`,
    `<li><strong>${bi('First known date', zhString('meta_first_known'))}:</strong> ${escapeHtml(item.firstKnownDate)} (${biValue(item.datePrecision || 'unknown')})</li>`,
    `<li><strong>${bi('Region', zhString('meta_region'))}:</strong> ${escapeHtml(item.region)}</li>`,
    `<li><strong>${bi('Review status', zhString('meta_review'))}:</strong> ${biValue(item.reviewStatus || 'unknown')}</li>`,
    `<li><strong>${bi('Maturity', zhString('meta_maturity'))}:</strong> ${biValue(item.maturity || 'N/A')}</li>`
  ].join('');
}

function renderDependencies(item, techById) {
  const dependencies = getDependencyEdges(item);
  if (!dependencies.length) {
    return `<p>${bi('None.', zhString('page_none'))}</p>`;
  }

  const rows = dependencies
    .map(edge => {
      const prereq = techById.get(edge.prerequisite);
      const prereqName = prereq ? prereq.name : edge.prerequisite;
      const href = canonicalTechnologyUrl(edge.prerequisite);
      return `<li><a href="${href}">${bi(prereqName, prereq ? zhEntry(prereq.id)?.name : '')} (${escapeHtml(edge.prerequisite)})</a></li>`;
    })
    .sort((a, b) => a.localeCompare(b));

  return `<ul>${rows.join('')}</ul>`;
}

function renderDependenciesTable(item, techById) {
  const dependencies = getDependencyEdges(item);
  const rows = dependencies
    .map(edge => {
      const prereq = techById.get(edge.prerequisite);
      const prereqName = prereq ? prereq.name : edge.prerequisite;
      const prereqHref = canonicalTechnologyUrl(edge.prerequisite);
      const sourceSummary = sourceList(edge.sources || []);
      const confidence = typeof edge.confidence === 'number'
        ? `${Math.round(edge.confidence * 100)}%`
        : 'n/a';
      return `
            <tr>
              <td><a href="${prereqHref}">${bi(prereqName, prereq ? zhEntry(prereq.id)?.name : '')}</a> (${escapeHtml(edge.prerequisite)})</td>
              <td>${biValue(edge.type || 'enabling')}</td>
              <td>${escapeHtml(confidence)}</td>
              <td>${biValue(edge.evidence_level || 'n/a')}</td>
              <td>${escapeHtml(edge.note || '')}</td>
              <td>${sourceSummary}</td>
            </tr>`;
    })
    .join('\n');

  if (!rows) {
    return `<tr><td colspan="6">${bi('No prerequisite edges recorded.', zhString('page_no_edges'))}</td></tr>`;
  }

  return rows;
}

function renderDependents(dependents, techById) {
  if (!dependents.length) {
    return `<li>${bi('None.', zhString('page_none'))}</li>`;
  }

  return dependents
    .map(dependentId => {
      const depItem = techById.get(dependentId);
      const depName = depItem ? depItem.name : dependentId;
      return `<li><a href="${canonicalTechnologyUrl(dependentId)}">${bi(depName, depItem ? zhEntry(depItem.id)?.name : '')} (${escapeHtml(dependentId)})</a></li>`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join('');
}

function edgeEvidenceSummary(item) {
  const edges = getDependencyEdges(item);
  if (!edges.length) {
    return `<p>${bi('No prerequisite edge evidence is yet recorded.', zhString('page_no_edge_evidence'))}</p>`;
  }

  let sourceRefs = 0;
  const evidenceByType = new Map();
  const confidenceValues = [];

  for (const edge of edges) {
    const bucket = edge.evidence_level || 'n/a';
    evidenceByType.set(bucket, (evidenceByType.get(bucket) || 0) + 1);
    if (typeof edge.confidence === 'number') {
      confidenceValues.push(edge.confidence);
    }
    if (Array.isArray(edge.sources)) {
      sourceRefs += edge.sources.length;
    }
  }

  const averageConfidence = confidenceValues.length
    ? `${Math.round((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) * 100)}%`
    : 'n/a';

  const evidenceRows = Array.from(evidenceByType)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, count]) => `<li>${biValue(type)}: ${count}</li>`)
    .join('');

  return `
    <p><strong>${bi('Edge/source evidence summary:', zhString('page_edge_summary'))}</strong></p>
    <ul>
      <li>${bi('Prerequisite edges:', zhString('page_prereq_edges'))} ${edges.length}</li>
      <li>${bi('Average edge confidence:', zhString('page_avg_confidence'))} ${averageConfidence}</li>
      <li>${bi('Prerequisite sources:', zhString('page_prereq_sources'))} ${sourceRefs}</li>
      ${evidenceRows}
    </ul>`;
}

function renderTechHtml(item, techById, dependents) {
  const canonicalUrl = canonicalTechnologyUrl(item.id);
  const zh = zhEntry(item.id) || {};
  const description = item.description || `${item.name} is a technology node in TechTree.`;
  const metaDescription = escapeHtml(description).slice(0, 300);
  const fieldLinks = (item.fields || []).map(field => `<li><a href="${canonicalFieldUrl(field)}">${bi(field, zhLabel(field))}</a></li>`).join('');
  const laneRows = (item.fields || [])
    .map(field => (item.fieldLanes && item.fieldLanes[field]
      ? `<li><strong>${bi(field, zhLabel(field))}:</strong> ${biValue(item.fieldLanes[field])}</li>`
      : `<li><strong>${bi(field, zhLabel(field))}:</strong> ${biValue('General')}</li>`))
    .join('');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': canonicalUrl,
    name: item.name,
    description,
    identifier: item.id,
    inDefinedTermSet: `${BASE_URL}/`,
    url: canonicalUrl,
    dateCreated: String(item.firstKnownDate),
    sameAs: canonicalUrl
  };

  return `<!doctype html>
<html lang="en" data-lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(item.name)} - TechTree</title>
    <meta name="description" content="${metaDescription}" />
    <meta property="og:title" content="${escapeHtml(item.name)} - TechTree" />
    <meta property="og:description" content="${metaDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${escapeHtml(item.name)} - TechTree" />
    <meta property="twitter:description" content="${metaDescription}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>${bilingualHeadExtras()}
    <style>
      body { font-family: Arial, sans-serif; margin: 1.5rem; line-height: 1.5; color: #1f2937; }
      h1, h2 { margin: 1rem 0 0.5rem; }
      table { border-collapse: collapse; width: 100%; max-width: 100%; }
      th, td { border: 1px solid #ddd; padding: 0.4rem 0.5rem; vertical-align: top; }
      th { text-align: left; background: #f8fafc; }
      nav a { margin-right: 1rem; }
      ul { padding-left: 1.1rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${bi(item.name, zh.name)}</h1>
      <p>${bi(description, zh.description)}</p>
      <nav>
        <a href="${canonicalGraphUrl()}?target=${encodeURIComponent(item.id)}">${bi('Graph', zhString('nav_graph'))}</a>
        <a href="${PUBLIC_LINKS.sorted}?target=${encodeURIComponent(item.id)}">${bi('Sorted View', zhString('nav_graph_view'))}</a>
        <a href="${PUBLIC_LINKS.demo}?target=${encodeURIComponent(item.id)}">${bi('Demo', zhString('nav_demo'))}</a>
        <button type="button" id="lang-toggle" class="lang-toggle"></button>
      </nav>

      <h2>${bi('Core metadata', zhString('page_core_metadata'))}</h2>
      <ul>${renderSourceCheckedMetadata(item)}</ul>

      <h2>${bi('Prerequisites', zhString('prereq_heading'))}</h2>
      ${renderDependencies(item, techById)}

      <h2>${bi('Dependents', zhString('page_dependents'))}</h2>
      <ul>${renderDependents(dependents, techById)}</ul>

      <h2>${bi('Fields', zhString('label_field'))}</h2>
      <ul>${fieldLinks || `<li>${bi('None.', zhString('page_none'))}</li>`}</ul>

      ${laneRows ? `<h2>${bi('Field lanes', zhString('sorted_lanes'))}</h2><ul>${laneRows}</ul>` : ''}

      <h2>${bi('Node sources', zhString('page_node_sources'))}</h2>
      ${sourceList(item.sources)}

      <h2>${bi('Prerequisite edge evidence', zhString('page_edge_evidence'))}</h2>
      ${edgeEvidenceSummary(item)}

      <table>
        <thead>
          <tr>
            <th>${bi('Prerequisite', zhString('th_prerequisite'))}</th>
            <th>${bi('Type', zhString('th_type'))}</th>
            <th>${bi('Confidence', zhString('th_confidence'))}</th>
            <th>${bi('Evidence level', zhString('th_evidence_level'))}</th>
            <th>${bi('Note', zhString('th_note'))}</th>
            <th>${bi('Sources', zhString('th_sources'))}</th>
          </tr>
        </thead>
        <tbody>
          ${renderDependenciesTable(item, techById)}
        </tbody>
      </table>

      <p><small>${bi('This page is generated from canonical era JSON and is indexable by URL.', zhString('page_generated_note'))}</small></p>
    </main>
    ${bilingualToggleScript()}
  </body>
</html>`;
}

function buildFieldPage(fieldName, technologies, eraOrder) {
  const canonicalUrl = canonicalFieldUrl(fieldName);
  const fieldLabel = zhLabel(fieldName);
  const description = `Technologies curated under the ${fieldName} field in TechTree.`;
  const zhDescription = (zhString('page_field_description') || 'TechTree 中 {field} 领域下策划的技术合集。').replace('{field}', fieldLabel || fieldName);
  const safeEraOrder = getEraOrder(eraOrder);
  const eraIndex = new Map(safeEraOrder.map((era, i) => [era, i]));

  const byEra = new Map();
  for (const era of safeEraOrder) {
    byEra.set(era, []);
  }

  const sorted = technologies
    .slice()
    .sort((a, b) => {
      const aEra = eraIndex.has(a.era) ? eraIndex.get(a.era) : safeEraOrder.length + 1;
      const bEra = eraIndex.has(b.era) ? eraIndex.get(b.era) : safeEraOrder.length + 1;
      const eraDelta = aEra - bEra;
      if (eraDelta !== 0) return eraDelta;
      const aDate = Number.isFinite(Number(a.firstKnownDate)) ? Number(a.firstKnownDate) : Number.MAX_SAFE_INTEGER;
      const bDate = Number.isFinite(Number(b.firstKnownDate)) ? Number(b.firstKnownDate) : Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) return aDate - bDate;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  for (const item of sorted) {
    const bucket = byEra.get(item.era) || [];
    bucket.push(item);
    byEra.set(item.era, bucket);
  }

  const sectionBlocks = [];
  for (const [era, items] of byEra.entries()) {
    if (!items.length) continue;
    const list = items
      .map(item => `<li><a href="${canonicalTechnologyUrl(item.id)}">${bi(item.name, zhEntry(item.id)?.name)} (${escapeHtml(item.id)})</a> — ${escapeHtml(item.firstKnownDate)} / ${biValue(item.datePrecision || 'exact')}</li>`)
      .join('');
    sectionBlocks.push(`<h2>${biValue(era)}</h2><ul>${list}</ul>`);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': canonicalUrl,
    name: `${fieldName} technologies`,
    description,
    url: canonicalUrl
  };

  return `<!doctype html>
<html lang="en" data-lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fieldName)} — TechTree</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(fieldName)} | TechTree" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${escapeHtml(fieldName)} | TechTree" />
    <meta property="twitter:description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>${bilingualHeadExtras()}
    <style>
      body { font-family: Arial, sans-serif; margin: 1.5rem; line-height: 1.5; color: #1f2937; }
      h1, h2 { margin: 1rem 0 0.5rem; }
      nav a { margin-right: 1rem; }
      ul { padding-left: 1.1rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${bi(`${fieldName} field`, zhString('page_field_h1').replace('{field}', fieldLabel || fieldName))}</h1>
      <p>${bi(description, zhDescription)}</p>
      <nav>
        <a href="${canonicalGraphUrl()}">${bi('Graph', zhString('nav_graph'))}</a>
        <a href="${PUBLIC_LINKS.sorted}">${bi('Sorted View', zhString('nav_graph_view'))}</a>
        <a href="${PUBLIC_LINKS.demo}">${bi('Demo', zhString('nav_demo'))}</a>
        <button type="button" id="lang-toggle" class="lang-toggle"></button>
      </nav>
      ${sectionBlocks.join('\n') || `<p>${bi('No technologies in this field yet.', zhString('page_no_techs_yet'))}</p>`}
    </main>
    ${bilingualToggleScript()}
  </body>
</html>`;
}

function generateSitemap(urls) {
  const rows = urls
    .sort()
    .map(url => `    <url>\n      <loc>${escapeHtml(url)}</loc>\n      <changefreq>weekly</changefreq>\n      <priority>0.7</priority>\n    </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

function metricByLabel(snapshot, label) {
  return (snapshot.metrics || []).find(entry => entry.label === label) || null;
}

function formatMetricLine(label, item) {
  if (!item) return null;
  if (item.denominator == null) {
    return `- ${label}: ${item.formatted}`;
  }
  if (item.note) {
    return `- ${label}: ${item.formatted} (${item.note})`;
  }
  return `- ${label}: ${item.formatted}`;
}

function buildLLms(snapshot, fieldPages, techById) {
  const lines = [
    '# TechTree',
    '',
    'TechTree is a source-backed human technology dependency graph for AI and human consumption. It supports evidence-aware exploration and stable public page URLs.',
    '',
    'Primary links:',
    ''
  ];
  lines.push(`- Demo: ${PUBLIC_LINKS.demo}`);
  lines.push(`- Graph: ${canonicalGraphUrl()}`);
  lines.push(`- Sorted: ${PUBLIC_LINKS.sorted}`);
  lines.push('- Technology entrypoint pattern: `https://pushme.site/techtree/tech/<id>.html` (example: `https://pushme.site/techtree/tech/crispr_gene_editing.html`)');
  lines.push('- Field entrypoint pattern: `https://pushme.site/techtree/fields/<slug>.html`');
  lines.push(`- Live GitHub repository: ${PUBLIC_LINKS.repo}`);
  lines.push(`- Data model: ${PUBLIC_LINKS.repo}/blob/main/data`);
  lines.push(`- Quality snapshot: ${PUBLIC_LINKS.qualitySnapshot}`);
  lines.push(`- Total technology pages: ${techById.size}`);
  lines.push(`- Total field pages: ${fieldPages.length}`);

  lines.push('', 'Current quality metrics (from data/quality-snapshot.json):');
  const metricNames = [
    'Technologies',
    'Launch-quality scope (non-Future nodes)',
    'Source-checked nodes',
    'Source-checked nodes with resolved chronology',
    'Source-checked nodes with unresolved chronology',
    'Source-checked nodes with strong-type node sources',
    'Source-checked nodes with located strong-type evidence',
    'Source-checked nodes using only weak/generic sources',
    'Nodes with node-level sources',
    'Nodes with located node-level evidence',
    'Dependency edges with edge-level sources',
    'Dependency edges with located evidence',
    'Era-default placeholder dates'
  ];
  for (const name of metricNames) {
    const metric = formatMetricLine(name, metricByLabel(snapshot, name));
    if (metric) lines.push(metric);
  }

  lines.push('', 'Example technology pages:');
  lines.push(`- CRISPR/Cas9: ${canonicalTechnologyUrl('crispr_gene_editing')}`);
  lines.push(`- RAG: ${canonicalTechnologyUrl('retrieval_augmented_generation')}`);
  lines.push(`- EUV lithography: ${canonicalTechnologyUrl('euv_lithography')}`);
  lines.push(`- Grid-scale battery storage: ${canonicalTechnologyUrl('grid_scale_battery_storage')}`);

  const sampleFields = fieldPages
    .slice(0, 8)
    .map(field => `- ${field.name}: ${canonicalFieldUrl(field.name)}`);
  lines.push('', 'Representative field pages:');
  if (sampleFields.length) {
    lines.push(...sampleFields);
  } else {
    lines.push('- None.');
  }

  return `${lines.join('\n')}\n`;
}

function buildOutputs({ outputDir = ROOT_DIR } = {}) {
  ZH = loadZhContext();
  const technologies = readDataFiles();
  const taxonomy = readTaxonomy();
  const snapshot = readQualitySnapshot();

  const techById = new Map(technologies.map(item => [item.id, item]));
  const dependentsMap = new Map(technologies.map(item => [item.id, []]));
  for (const item of technologies) {
    for (const edge of getDependencyEdges(item)) {
      if (dependentsMap.has(edge.prerequisite)) {
        dependentsMap.get(edge.prerequisite).push(item.id);
      }
    }
  }
  for (const list of dependentsMap.values()) {
    list.sort();
  }

  const fieldMap = new Map();
  for (const item of technologies) {
    for (const field of item.fields || []) {
      if (!fieldMap.has(field)) {
        fieldMap.set(field, []);
      }
      fieldMap.get(field).push(item);
    }
  }

  const taxonomyFields = new Set(Object.keys((taxonomy || {}).fields || {}));
  const fieldPages = Array.from(new Set([...taxonomyFields, ...fieldMap.keys()]))
    .filter(field => fieldMap.has(field))
    .map(field => ({
      name: field,
      slug: slugify(field),
      technologies: fieldMap.get(field)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const techDir = path.join(outputDir, 'tech');
  const fieldDir = path.join(outputDir, 'fields');
  const sitemapFile = path.join(outputDir, 'sitemap.xml');
  const llmsFile = path.join(outputDir, 'llms.txt');

  if (fs.existsSync(techDir)) fs.rmSync(techDir, { recursive: true, force: true });
  if (fs.existsSync(fieldDir)) fs.rmSync(fieldDir, { recursive: true, force: true });
  fs.mkdirSync(techDir, { recursive: true });
  fs.mkdirSync(fieldDir, { recursive: true });

  const manifest = new Map();
  const eraOrder = getEraOrder((taxonomy || {}).eras);

  for (const item of technologies) {
    const file = path.join(techDir, `${item.id}.html`);
    const content = renderTechHtml(item, techById, dependentsMap.get(item.id) || []);
    fs.writeFileSync(file, content);
    manifest.set(relativeOutputPath(file, outputDir), getChecksum(content));
  }

  for (const field of fieldPages) {
    const file = path.join(fieldDir, `${field.slug}.html`);
    const content = buildFieldPage(field.name, field.technologies, eraOrder);
    fs.writeFileSync(file, content);
    manifest.set(relativeOutputPath(file, outputDir), getChecksum(content));
  }

  const urls = [
    `${PUBLIC_LINKS.demo}`,
    `${canonicalGraphUrl()}`,
    `${PUBLIC_LINKS.sorted}`
  ];
  for (const item of technologies) {
    urls.push(canonicalTechnologyUrl(item.id));
  }
  for (const field of fieldPages) {
    urls.push(canonicalFieldUrl(field.name));
  }

  const sitemap = generateSitemap(urls);
  fs.writeFileSync(sitemapFile, sitemap);
  manifest.set(relativeOutputPath(sitemapFile, outputDir), getChecksum(sitemap));

  const llms = buildLLms(snapshot, fieldPages, techById);
  fs.writeFileSync(llmsFile, llms);
  manifest.set(relativeOutputPath(llmsFile, outputDir), getChecksum(llms));

  return {
    technologies,
    taxonomy,
    fieldPages,
    manifest,
    techDir,
    fieldDir,
    snapshot
  };
}

function runCli() {
  const args = process.argv.slice(2);
  const outDirArg = args.indexOf('--out-dir');
  const outputDir = outDirArg !== -1 && args[outDirArg + 1]
    ? path.resolve(process.cwd(), args[outDirArg + 1])
    : ROOT_DIR;

  const result = buildOutputs({ outputDir });
  console.log(`Generated ${result.technologies.length} technology pages in ${relativeOutputPath(result.techDir, outputDir)}`);
  console.log(`Generated ${result.fieldPages.length} field pages in ${relativeOutputPath(result.fieldDir, outputDir)}`);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildOutputs,
  readDataFiles,
  readTaxonomy,
  readQualitySnapshot,
  slugify,
  getChecksum,
  canonicalTechnologyUrl,
  canonicalFieldUrl,
  canonicalGraphUrl,
  metricByLabel,
  relativeOutputPath,
  ROOT_DIR
};
