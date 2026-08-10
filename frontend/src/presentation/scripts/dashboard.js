/**
 * Dashboard JavaScript
 * Handles Google Charts initialization and data loading
 */

// Load Google Charts
google.charts.load('current', {
  'packages': ['corechart', 'geochart', 'table', 'sankey']
});

// Current Sankey limit (Top N use types)
let currentSankeyLimit = 10;

google.charts.setOnLoadCallback(initDashboard);

/**
 * Initialize dashboard and set up event listeners
 */
function initDashboard() {
  // Set up Sankey limit buttons
  setupSankeyButtons();

  // Load dashboard data
  loadDashboardData();
}

/**
 * Set up Sankey limit buttons event listeners
 */
function setupSankeyButtons() {
  const buttons = document.querySelectorAll('.sankey-limit-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const limit = parseInt(e.target.dataset.limit);

      // Update button styles
      buttons.forEach(b => {
        b.classList.remove('bg-forest-600', 'text-white', 'hover:bg-forest-700');
        b.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
      });
      e.target.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
      e.target.classList.add('bg-forest-600', 'text-white', 'hover:bg-forest-700');

      // Update current limit and reload chart
      currentSankeyLimit = limit;
      const filters = getFilters();
      await loadSankeyChart(filters, limit);
    });
  });
}

/**
 * Load all dashboard data
 */
async function loadDashboardData() {
  const filters = getFilters();

  console.log('=== Dashboard Load Start ===');
  console.log('Dashboard filters:', filters);
  console.log('Loading dashboard data...');

  try {
    console.log('Loading summary cards...');
    await loadSummaryCards(filters);
    console.log('✓ Summary cards loaded');

    console.log('Loading maps...');
    await loadMaps(filters);
    console.log('✓ Maps loaded');

    console.log('Loading charts...');
    await loadCharts(filters);
    console.log('✓ Charts loaded');

    console.log('Loading sankey...');
    await loadSankeyChart(filters, currentSankeyLimit);
    console.log('✓ Sankey loaded');

    console.log('Loading tables...');
    await loadTables(filters);
    console.log('✓ Tables loaded');

    console.log('=== Dashboard Load Complete ===');
  } catch (error) {
    console.error('=== Dashboard Load Error ===');
    console.error('Error loading dashboard data:', error);
    console.error('Stack:', error.stack);
    showError('Erro ao carregar dados do painel');
  }
}

/**
 * Get current filter values
 */
function getFilters() {
  const form = document.getElementById('filter-form');
  if (!form) return {};

  const formData = new FormData(form);
  const filters = {};

  for (const [key, value] of formData.entries()) {
    if (value) filters[key] = value;
  }

  return filters;
}

/**
 * Build query string from filters
 */
function buildQueryString(filters) {
  const params = new URLSearchParams(filters);
  return params.toString();
}

/**
 * Load summary cards data
 */
async function loadSummaryCards(filters) {
  const queryString = buildQueryString(filters);

  try {
    // Community count
    const communityUrl = `/painel/api/stats/community-count?${queryString}`;
    console.debug('Fetching:', communityUrl);
    const communityRes = await fetch(communityUrl);
    if (communityRes.ok) {
      const communityData = await communityRes.json();
      if (communityData && communityData.total !== undefined) {
        document.getElementById('community-count').textContent = communityData.total.toLocaleString('pt-BR');
      } else {
        console.error('Invalid community data:', communityData);
        document.getElementById('community-count').textContent = '0';
      }
    } else {
      console.error('Community count error:', communityRes.status, communityRes.statusText);
      const errorData = await communityRes.json();
      console.error('Error details:', errorData);
      document.getElementById('community-count').textContent = '0';
    }

    // Evidence count
    const evidenceUrl = `/painel/api/stats/evidence-count?${queryString}`;
    console.debug('Fetching:', evidenceUrl);
    const evidenceRes = await fetch(evidenceUrl);
    if (evidenceRes.ok) {
      const evidenceData = await evidenceRes.json();
      if (evidenceData && evidenceData.approved !== undefined) {
        document.getElementById('evidence-count').textContent = evidenceData.approved.toLocaleString('pt-BR');
      } else {
        console.error('Invalid evidence data:', evidenceData);
        document.getElementById('evidence-count').textContent = '0';
      }
    } else {
      console.error('Evidence count error:', evidenceRes.status, evidenceRes.statusText);
      const errorData = await evidenceRes.json();
      console.error('Error details:', errorData);
      document.getElementById('evidence-count').textContent = '0';
    }

    // Top plants (just to get count)
    const plantsUrl = `/painel/api/stats/top-plants?limit=1000&${queryString}`;
    console.debug('Fetching:', plantsUrl);
    const plantsRes = await fetch(plantsUrl);
    if (plantsRes.ok) {
      const plantsData = await plantsRes.json();
      if (Array.isArray(plantsData)) {
        document.getElementById('plant-count').textContent = plantsData.length.toLocaleString('pt-BR');
      } else {
        console.error('Invalid plants data:', plantsData);
        document.getElementById('plant-count').textContent = '0';
      }
    } else {
      console.error('Plants error:', plantsRes.status, plantsRes.statusText);
      const errorData = await plantsRes.json();
      console.error('Error details:', errorData);
      document.getElementById('plant-count').textContent = '0';
    }

    // Top authors (just to get count)
    const authorsUrl = `/painel/api/stats/top-authors?limit=1000&${queryString}`;
    console.debug('Fetching:', authorsUrl);
    const authorsRes = await fetch(authorsUrl);
    if (authorsRes.ok) {
      const authorsData = await authorsRes.json();
      if (Array.isArray(authorsData)) {
        document.getElementById('author-count').textContent = authorsData.length.toLocaleString('pt-BR');
      } else {
        console.error('Invalid authors data:', authorsData);
        document.getElementById('author-count').textContent = '0';
      }
    } else {
      console.error('Authors error:', authorsRes.status, authorsRes.statusText);
      const errorData = await authorsRes.json();
      console.error('Error details:', errorData);
      document.getElementById('author-count').textContent = '0';
    }

  } catch (error) {
    console.error('Error loading summary cards:', error);
    document.getElementById('community-count').textContent = '0';
    document.getElementById('evidence-count').textContent = '0';
    document.getElementById('plant-count').textContent = '0';
    document.getElementById('author-count').textContent = '0';
  }
}

/**
 * Load maps (Google GeoChart)
 */
async function loadMaps(filters) {
  const queryString = buildQueryString(filters);

  try {
    // Evidences by state
    const evidenceUrl = `/painel/api/stats/evidences-by-state?${queryString}`;
    console.debug('Fetching:', evidenceUrl);
    const evidenceRes = await fetch(evidenceUrl);
    if (evidenceRes.ok) {
      const evidencesByState = await evidenceRes.json();
      if (Array.isArray(evidencesByState)) {
        drawGeoChart('map-references', evidencesByState, 'Evidências');
      } else {
        console.error('Invalid evidences by state data:', evidencesByState);
        drawGeoChart('map-references', [], 'Evidências');
      }
    } else {
      console.error('Evidences by state error:', evidenceRes.status, evidenceRes.statusText);
      const errorData = await evidenceRes.json();
      console.error('Error details:', errorData);
      drawGeoChart('map-references', [], 'Evidências');
    }

    // Communities by state
    const communitiesUrl = `/painel/api/stats/communities-by-state?${queryString}`;
    console.debug('Fetching:', communitiesUrl);
    const communitiesRes = await fetch(communitiesUrl);
    if (communitiesRes.ok) {
      const communitiesByState = await communitiesRes.json();
      if (Array.isArray(communitiesByState)) {
        drawGeoChart('map-communities', communitiesByState, 'Comunidades');
      } else {
        console.error('Invalid communities by state data:', communitiesByState);
        drawGeoChart('map-communities', [], 'Comunidades');
      }
    } else {
      console.error('Communities by state error:', communitiesRes.status, communitiesRes.statusText);
      const errorData = await communitiesRes.json();
      console.error('Error details:', errorData);
      drawGeoChart('map-communities', [], 'Comunidades');
    }

  } catch (error) {
    console.error('Error loading maps:', error);
    drawGeoChart('map-references', [], 'Evidências');
    drawGeoChart('map-communities', [], 'Comunidades');
  }
}

/**
 * Draw Google GeoChart for Brazil
 */
function drawGeoChart(elementId, data, metric) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`Container not found: ${elementId}`);
    return;
  }

  // If no data, show placeholder
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-12">Sem dados disponíveis</div>';
    return;
  }

  try {
    // Convert state names to BR-XX format
    const stateCodeMap = {
      'Acre': 'BR-AC',
      'Alagoas': 'BR-AL',
      'Amapá': 'BR-AP',
      'Amazonas': 'BR-AM',
      'Bahia': 'BR-BA',
      'Ceará': 'BR-CE',
      'Distrito Federal': 'BR-DF',
      'Espírito Santo': 'BR-ES',
      'Goiás': 'BR-GO',
      'Maranhão': 'BR-MA',
      'Mato Grosso': 'BR-MT',
      'Mato Grosso do Sul': 'BR-MS',
      'Minas Gerais': 'BR-MG',
      'Pará': 'BR-PA',
      'Paraíba': 'BR-PB',
      'Paraná': 'BR-PR',
      'Pernambuco': 'BR-PE',
      'Piauí': 'BR-PI',
      'Rio de Janeiro': 'BR-RJ',
      'Rio Grande do Norte': 'BR-RN',
      'Rio Grande do Sul': 'BR-RS',
      'Rondônia': 'BR-RO',
      'Roraima': 'BR-RR',
      'Santa Catarina': 'BR-SC',
      'São Paulo': 'BR-SP',
      'Sergipe': 'BR-SE',
      'Tocantins': 'BR-TO'
    };

    // Prepare data for Google Charts
    const chartData = [['Estado', metric]];
    data.forEach(item => {
      const stateCode = stateCodeMap[item.state];
      if (stateCode) {
        chartData.push([stateCode, item.count]);
      }
    });

    const dataTable = google.visualization.arrayToDataTable(chartData);

    const options = {
      region: 'BR',
      resolution: 'provinces',
      colorAxis: {
        colors: ['#dcfce7', '#86efac', '#22c55e', '#15803d', '#14532d']
      },
      backgroundColor: '#f9fafb',
      datalessRegionColor: '#e5e7eb',
      defaultColor: '#e5e7eb',
      tooltip: {
        textStyle: {
          fontName: 'system-ui',
          fontSize: 13
        }
      }
    };

    const chart = new google.visualization.GeoChart(container);
    chart.draw(dataTable, options);
  } catch (error) {
    console.error(`Error drawing GeoChart for ${elementId}:`, error);
    container.innerHTML = '<div class="text-center text-red-400 py-12">Erro ao renderizar mapa</div>';
  }
}

/**
 * Load charts (publications by year, top plants)
 */
async function loadCharts(filters) {
  const queryString = buildQueryString(filters);

  try {
    // Publications by year
    const pubUrl = `/painel/api/stats/publications-by-year?${queryString}`;
    console.debug('Fetching:', pubUrl);
    const pubRes = await fetch(pubUrl);
    if (pubRes.ok) {
      const pubByYear = await pubRes.json();
      if (Array.isArray(pubByYear)) {
        drawAreaChart('chart-publications', pubByYear);
      } else {
        console.error('Invalid publications by year data:', pubByYear);
        drawAreaChart('chart-publications', []);
      }
    } else {
      console.error('Publications by year error:', pubRes.status, pubRes.statusText);
      const errorData = await pubRes.json();
      console.error('Error details:', errorData);
      drawAreaChart('chart-publications', []);
    }

    // Top plants
    const topPlantsUrl = `/painel/api/stats/top-plants?limit=10&${queryString}`;
    console.debug('Fetching:', topPlantsUrl);
    const topPlantsRes = await fetch(topPlantsUrl);
    if (topPlantsRes.ok) {
      const topPlants = await topPlantsRes.json();
      if (Array.isArray(topPlants)) {
        drawBarChart('chart-top-plants', topPlants);
      } else {
        console.error('Invalid top plants data:', topPlants);
        drawBarChart('chart-top-plants', []);
      }
    } else {
      console.error('Top plants error:', topPlantsRes.status, topPlantsRes.statusText);
      const errorData = await topPlantsRes.json();
      console.error('Error details:', errorData);
      drawBarChart('chart-top-plants', []);
    }

  } catch (error) {
    console.error('Error loading charts:', error);
    drawAreaChart('chart-publications', []);
    drawBarChart('chart-top-plants', []);
  }
}

/**
 * Draw area chart for publications by year
 */
function drawAreaChart(elementId, data) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`Container not found: ${elementId}`);
    return;
  }

  // If no data, show placeholder
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-12">Sem dados disponíveis</div>';
    return;
  }

  try {
    const chartData = [['Ano', 'Publicações']];
    data.forEach(item => {
      if (item && item.year !== undefined && item.count !== undefined) {
        chartData.push([item.year.toString(), item.count]);
      }
    });

    const dataTable = google.visualization.arrayToDataTable(chartData);

    const options = {
      title: '',
      hAxis: { title: 'Ano', titleTextStyle: { fontSize: 12 } },
      vAxis: { title: 'Número de Publicações', minValue: 0, titleTextStyle: { fontSize: 12 } },
      legend: { position: 'none' },
      colors: ['#16a34a'],
      backgroundColor: 'transparent',
      chartArea: { width: '85%', height: '70%' },
      fontSize: 12,
      fontName: 'system-ui'
    };

    const chart = new google.visualization.AreaChart(container);
    chart.draw(dataTable, options);
  } catch (error) {
    console.error(`Error drawing AreaChart for ${elementId}:`, error);
    container.innerHTML = '<div class="text-center text-red-400 py-12">Erro ao renderizar gráfico</div>';
  }
}

/**
 * Draw bar chart for top plants
 */
function drawBarChart(elementId, data) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`Container not found: ${elementId}`);
    return;
  }

  // If no data, show placeholder
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-12">Sem dados disponíveis</div>';
    return;
  }

  try {
    const chartData = [['Planta', 'Citações']];
    data.forEach(item => {
      if (item && item.nomeCientifico && item.count !== undefined) {
        // Use full scientific name without truncation
        chartData.push([item.nomeCientifico, item.count]);
      }
    });

    if (chartData.length < 2) {
      container.innerHTML = '<div class="text-center text-gray-400 py-12">Sem dados disponíveis</div>';
      return;
    }

    const dataTable = google.visualization.arrayToDataTable(chartData);

    const options = {
      title: '',
      hAxis: {
        title: 'Número de Citações',
        minValue: 0,
        titleTextStyle: { fontSize: 11 }
      },
      vAxis: {
        title: '',
        textStyle: {
          fontSize: 10,
          italic: true
        },
        maxTextLines: 1
      },
      legend: { position: 'none' },
      colors: ['#f59e0b'],
      backgroundColor: 'transparent',
      chartArea: { left: 150, width: '55%', height: '85%' },
      fontSize: 10,
      fontName: 'system-ui',
      bars: 'horizontal',
      bar: { groupWidth: '80%' }
    };

    const chart = new google.visualization.BarChart(container);
    chart.draw(dataTable, options);
  } catch (error) {
    console.error(`Error drawing BarChart for ${elementId}:`, error);
    container.innerHTML = '<div class="text-center text-red-400 py-12">Erro ao renderizar gráfico</div>';
  }
}

/**
 * Load Sankey chart data
 * @param {Object} filters - Dashboard filters
 * @param {number} limitUsos - Top N use types to show (default: 10)
 */
async function loadSankeyChart(filters, limitUsos = 10) {
  const queryString = buildQueryString(filters);

  try {
    const sankeyUrl = `/painel/api/stats/sankey?${queryString}&limitUsos=${limitUsos}`;
    console.debug('Fetching:', sankeyUrl);
    const sankeyRes = await fetch(sankeyUrl);
    if (sankeyRes.ok) {
      const sankeyData = await sankeyRes.json();
      if (sankeyData && sankeyData.links) {
        drawSankeyChart('chart-sankey', sankeyData);
      } else {
        console.error('Invalid sankey data:', sankeyData);
        drawSankeyChart('chart-sankey', { links: [], useTypeOrder: [], communityTypeOrder: [], variants: {} });
      }
    } else {
      console.error('Sankey error:', sankeyRes.status, sankeyRes.statusText);
      const errorData = await sankeyRes.json();
      console.error('Error details:', errorData);
      drawSankeyChart('chart-sankey', { links: [], useTypeOrder: [], communityTypeOrder: [], variants: {} });
    }
  } catch (error) {
    console.error('Error loading sankey chart:', error);
    drawSankeyChart('chart-sankey', { links: [], useTypeOrder: [], communityTypeOrder: [], variants: {} });
  }
}

/**
 * Escape a string for safe interpolation into HTML tooltip markup.
 * @param {*} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Build the HTML tooltip for one Sankey flow. When the target label absorbed
 * synonymous terms (Termo Preferencial aggregation), list them so the merge
 * is visible instead of reading as missing data.
 * @param {{source: string, target: string, value: number}} item
 * @param {Object<string, string[]>} variants - preferred label -> raw variants
 * @returns {string}
 */
function buildSankeyTooltip(item, variants) {
  const rawVariants = (variants && variants[item.target]) || [];
  const otherLabels = rawVariants.filter((label) => label !== item.target);

  let html = '<div style="padding:8px 12px;font-family:system-ui;font-size:13px;">'
    + `<b>${escapeHtml(item.source)} \u2192 ${escapeHtml(item.target)}</b><br>`
    + `${escapeHtml(item.value)} ocorrência(s)`;

  if (otherLabels.length > 0) {
    html += `<br><span style="color:#6b7280;">agrega: ${escapeHtml(otherLabels.join(', '))}</span>`;
  }

  html += '</div>';
  return html;
}

/**
 * Draw Sankey diagram for community type to use type relationships
 * @param {string} elementId - DOM element ID
 * @param {Object} data - { links, useTypeOrder, communityTypeOrder, variants }
 */
function drawSankeyChart(elementId, data) {
  const container = document.getElementById(elementId);
  if (!container) {
    console.error(`Container not found: ${elementId}`);
    return;
  }

  // If no data, show placeholder
  if (!data || !data.links || data.links.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-12">Sem dados disponíveis</div>';
    return;
  }

  try {
    const { links, useTypeOrder, communityTypeOrder, variants } = data;
    const hasVariants = !!(variants && Object.keys(variants).length > 0);

    // Sort links by community type order (source) and use type order (target)
    // This helps Google Charts render nodes in the correct order
    const sortedLinks = [...links].sort((a, b) => {
      const aSourceIdx = communityTypeOrder.indexOf(a.source);
      const bSourceIdx = communityTypeOrder.indexOf(b.source);
      if (aSourceIdx !== bSourceIdx) {
        return aSourceIdx - bSourceIdx;
      }
      const aTargetIdx = useTypeOrder.indexOf(a.target);
      const bTargetIdx = useTypeOrder.indexOf(b.target);
      return aTargetIdx - bTargetIdx;
    });

    // Prepare data for Google Charts Sankey. When variants exist, add a
    // tooltip column so merged labels (Termo Preferencial) show what was
    // aggregated instead of just disappearing with no explanation.
    const chartData = hasVariants
      ? [['De', 'Para', 'Quantidade', { type: 'string', role: 'tooltip', p: { html: true } }]]
      : [['De', 'Para', 'Quantidade']];

    sortedLinks.forEach(item => {
      if (item && item.source && item.target && item.value) {
        chartData.push(
          hasVariants
            ? [item.source, item.target, item.value, buildSankeyTooltip(item, variants)]
            : [item.source, item.target, item.value]
        );
      }
    });

    if (chartData.length < 2) {
      container.innerHTML = '<div class="text-center text-gray-400 py-12">Sem dados disponíveis</div>';
      return;
    }

    const dataTable = google.visualization.arrayToDataTable(chartData);

    // Color palette for nodes - distinct colors for better visualization
    const colors = [
      '#1e3a5f', '#2d5a87', '#3d7aaf', // Blues
      '#15803d', '#22c55e', '#86efac', // Greens
      '#b45309', '#f59e0b', '#fcd34d', // Ambers
      '#7c2d12', '#dc2626', '#f87171', // Reds
      '#581c87', '#9333ea', '#c084fc', // Purples
      '#155e75', '#0891b2', '#22d3ee', // Cyans
      '#713f12', '#ca8a04', '#fde047', // Yellows
      '#be185d', '#ec4899', '#f9a8d4'  // Pinks
    ];

    const options = {
      height: 500,
      sankey: {
        node: {
          colors: colors,
          label: {
            fontName: 'system-ui',
            fontSize: 12,
            color: '#1f2937',
            bold: true
          },
          nodePadding: 20,
          width: 15
        },
        link: {
          colorMode: 'gradient',
          colors: colors
        },
        iterations: 0 // Disable automatic reordering to preserve our sort order
      },
      tooltip: hasVariants
        ? { isHtml: true }
        : {
            textStyle: {
              fontName: 'system-ui',
              fontSize: 13
            }
          }
    };

    const chart = new google.visualization.Sankey(container);
    chart.draw(dataTable, options);
  } catch (error) {
    console.error(`Error drawing Sankey chart for ${elementId}:`, error);
    container.innerHTML = '<div class="text-center text-red-400 py-12">Erro ao renderizar diagrama Sankey</div>';
  }
}

/**
 * Load tables data
 */
async function loadTables(filters) {
  const queryString = buildQueryString(filters);

  try {
    // Top authors
    const authorsUrl = `/painel/api/stats/top-authors?limit=10&${queryString}`;
    console.debug('Fetching:', authorsUrl);
    const authorsRes = await fetch(authorsUrl);
    if (authorsRes.ok) {
      const authors = await authorsRes.json();
      if (Array.isArray(authors)) {
        drawTable('table-authors', authors, [
          { label: 'Autor', key: 'author', type: 'text' },
          { label: 'Publicações', key: 'count', type: 'number' }
        ]);
      } else {
        console.error('Invalid authors data:', authors);
        drawTable('table-authors', [], [
          { label: 'Autor', key: 'author', type: 'text' },
          { label: 'Publicações', key: 'count', type: 'number' }
        ]);
      }
    } else {
      console.error('Top authors error:', authorsRes.status, authorsRes.statusText);
      const errorData = await authorsRes.json();
      console.error('Error details:', errorData);
      drawTable('table-authors', [], [
        { label: 'Autor', key: 'author', type: 'text' },
        { label: 'Publicações', key: 'count', type: 'number' }
      ]);
    }

    // Top communities
    const communitiesUrl = `/painel/api/stats/top-communities?limit=10&${queryString}`;
    console.debug('Fetching:', communitiesUrl);
    const communitiesRes = await fetch(communitiesUrl);
    if (communitiesRes.ok) {
      const communities = await communitiesRes.json();
      if (Array.isArray(communities)) {
        drawTable('table-communities', communities, [
          { label: 'Comunidade', key: 'community', type: 'text' },
          { label: 'Estado', key: 'estado', type: 'state' },
          { label: 'Plantas', key: 'plantCount', type: 'number' }
        ]);
      } else {
        console.error('Invalid communities data:', communities);
        drawTable('table-communities', [], [
          { label: 'Comunidade', key: 'community', type: 'text' },
          { label: 'Estado', key: 'estado', type: 'state' },
          { label: 'Plantas', key: 'plantCount', type: 'number' }
        ]);
      }
    } else {
      console.error('Top communities error:', communitiesRes.status, communitiesRes.statusText);
      const errorData = await communitiesRes.json();
      console.error('Error details:', errorData);
      drawTable('table-communities', [], [
        { label: 'Comunidade', key: 'community', type: 'text' },
        { label: 'Estado', key: 'estado', type: 'state' },
        { label: 'Plantas', key: 'plantCount', type: 'number' }
      ]);
    }

    // Evidences with most communities
    const evidenceCommunitiesUrl = `/painel/api/stats/evidences-by-communities?limit=10&${queryString}`;
    console.debug('Fetching:', evidenceCommunitiesUrl);
    const evidenceCommunitiesRes = await fetch(evidenceCommunitiesUrl);
    if (evidenceCommunitiesRes.ok) {
      const evidenceCommunities = await evidenceCommunitiesRes.json();
      if (Array.isArray(evidenceCommunities)) {
        drawTable('table-ref-communities', evidenceCommunities, [
          { label: 'Título', key: 'titulo', type: 'text' },
          { label: 'Ano', key: 'ano', type: 'year' },
          { label: 'Comunidades', key: 'communityCount', type: 'number' }
        ]);
      } else {
        console.error('Invalid evidence-communities data:', evidenceCommunities);
        drawTable('table-ref-communities', [], [
          { label: 'Título', key: 'titulo', type: 'text' },
          { label: 'Ano', key: 'ano', type: 'year' },
          { label: 'Comunidades', key: 'communityCount', type: 'number' }
        ]);
      }
    } else {
      console.error('Evidences by communities error:', evidenceCommunitiesRes.status, evidenceCommunitiesRes.statusText);
      const errorData = await evidenceCommunitiesRes.json();
      console.error('Error details:', errorData);
      drawTable('table-ref-communities', [], [
        { label: 'Título', key: 'titulo', type: 'text' },
        { label: 'Ano', key: 'ano', type: 'year' },
        { label: 'Comunidades', key: 'communityCount', type: 'number' }
      ]);
    }

    // Evidences with most plants
    const evidencePlantsUrl = `/painel/api/stats/evidences-by-plants?limit=10&${queryString}`;
    console.debug('Fetching:', evidencePlantsUrl);
    const evidencePlantsRes = await fetch(evidencePlantsUrl);
    if (evidencePlantsRes.ok) {
      const evidencePlants = await evidencePlantsRes.json();
      if (Array.isArray(evidencePlants)) {
        drawTable('table-ref-plants', evidencePlants, [
          { label: 'Título', key: 'titulo', type: 'text' },
          { label: 'Ano', key: 'ano', type: 'year' },
          { label: 'Plantas', key: 'plantCount', type: 'number' }
        ]);
      } else {
        console.error('Invalid evidence-plants data:', evidencePlants);
        drawTable('table-ref-plants', [], [
          { label: 'Título', key: 'titulo', type: 'text' },
          { label: 'Ano', key: 'ano', type: 'year' },
          { label: 'Plantas', key: 'plantCount', type: 'number' }
        ]);
      }
    } else {
      console.error('Evidences by plants error:', evidencePlantsRes.status, evidencePlantsRes.statusText);
      const errorData = await evidencePlantsRes.json();
      console.error('Error details:', errorData);
      drawTable('table-ref-plants', [], [
        { label: 'Título', key: 'titulo', type: 'text' },
        { label: 'Ano', key: 'ano', type: 'year' },
        { label: 'Plantas', key: 'plantCount', type: 'number' }
      ]);
    }

  } catch (error) {
    console.error('Error loading tables:', error);
    drawTable('table-authors', [], [
      { label: 'Autor', key: 'author', type: 'text' },
      { label: 'Publicações', key: 'count', type: 'number' }
    ]);
    drawTable('table-communities', [], [
      { label: 'Comunidade', key: 'community', type: 'text' },
      { label: 'Estado', key: 'estado', type: 'state' },
      { label: 'Plantas', key: 'plantCount', type: 'number' }
    ]);
    drawTable('table-ref-communities', [], [
      { label: 'Título', key: 'titulo', type: 'text' },
      { label: 'Ano', key: 'ano', type: 'year' },
      { label: 'Comunidades', key: 'communityCount', type: 'number' }
    ]);
    drawTable('table-ref-plants', [], [
      { label: 'Título', key: 'titulo', type: 'text' },
      { label: 'Ano', key: 'ano', type: 'year' },
      { label: 'Plantas', key: 'plantCount', type: 'number' }
    ]);
  }
}

/**
 * Draw HTML table
 * Column types: 'text', 'year', 'number', 'state'
 */
function drawTable(elementId, data, columns) {
  const container = document.getElementById(elementId);

  if (!container) {
    console.error(`Container not found: ${elementId}`);
    return;
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-400 py-8">Nenhum dado disponível</div>';
    return;
  }

  if (!columns || columns.length === 0) {
    console.error(`No columns provided for ${elementId}`);
    container.innerHTML = '<div class="text-center text-red-400 py-8">Erro: Colunas não configuradas</div>';
    return;
  }

  try {
    let html = '<table class="dashboard-table"><thead><tr>';

    // Headers with column type classes
    columns.forEach(col => {
      const colType = col.type || 'text';
      html += `<th class="col-${colType}">${col.label}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Rows
    data.forEach((row, index) => {
      if (!row || typeof row !== 'object') {
        return;
      }

      html += '<tr>';
      columns.forEach(col => {
        let value = row[col.key];
        const colType = col.type || 'text';

        // Handle null/undefined values
        if (value === null || value === undefined) {
          value = '-';
        } else if (typeof value === 'number') {
          if (colType === 'year') {
            // Years: no thousand separator
            value = value.toString();
          } else {
            // Other numbers: use locale formatting
            value = value.toLocaleString('pt-BR');
          }
        }

        html += `<td class="col-${colType}">${value}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    console.error(`Error drawing table for ${elementId}:`, error);
    container.innerHTML = '<div class="text-center text-red-400 py-8">Erro ao renderizar tabela</div>';
  }
}

/**
 * Show error message with UI feedback
 */
function showError(message) {
  console.error('Dashboard Error:', message);

  // Show error toast/notification if possible
  const errorContainer = document.createElement('div');
  errorContainer.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm';
  errorContainer.textContent = message;
  document.body.appendChild(errorContainer);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    errorContainer.remove();
  }, 5000);
}

/**
 * Responsive charts - redraw on window resize
 */
let resizeTimer;
window.addEventListener('resize', () => {
  // Debounce resize events
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    loadDashboardData();
  }, 250);
});
