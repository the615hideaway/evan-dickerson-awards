(function () {
  const SESSION_KEY = 'eda_admin_auth';
  const loginScreen = document.getElementById('login-screen');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const searchInput = document.getElementById('category-search');
  const resultsRoot = document.getElementById('results-root');
  const duplicatesRoot = document.getElementById('duplicates-root');
  const statusBanner = document.getElementById('status-banner');
  const setupNotice = document.getElementById('setup-notice');

  let refreshTimer = null;
  let lastResults = null;

  function isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }

  function showLogin() {
    loginScreen.hidden = false;
    dashboard.hidden = true;
    sessionStorage.removeItem(SESSION_KEY);
    stopAutoRefresh();
  }

  function showDashboard() {
    loginScreen.hidden = true;
    dashboard.hidden = false;
    sessionStorage.setItem(SESSION_KEY, 'true');
    loadDashboard();
    startAutoRefresh();
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (ADMIN_CONFIG.refreshSeconds > 0) {
      refreshTimer = setInterval(loadDashboard, ADMIN_CONFIG.refreshSeconds * 1000);
    }
  }

  function setStatus(message, type) {
    if (!message) {
      statusBanner.hidden = true;
      return;
    }
    statusBanner.hidden = false;
    statusBanner.textContent = message;
    statusBanner.className = 'status-banner ' + (type || 'loading');
  }

  async function fetchResponses() {
    const url = ADMIN_CONFIG.dataFile + '?t=' + Date.now();
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        'Could not load ' + ADMIN_CONFIG.dataFile + '. Run sync-responses.ps1, then open admin.html via serve.ps1 (http://localhost:8080/admin.html).'
      );
    }

    const data = await response.json();
    return {
      updatedAt: data.syncedAt || new Date().toISOString(),
      totalBallots: data.totalBallots || (data.rows ? data.rows.length : 0),
      headers: data.headers || [],
      rows: data.rows || []
    };
  }

  function buildColumnMap(headers) {
    const map = {};

    VOTE_FORM.categories.forEach(function (category) {
      category.fields.forEach(function (field) {
        const expected = category.name + ' - ' + field.label;
        const idx = headers.findIndex(function (header) {
          return normalizeHeader(header) === normalizeHeader(expected);
        });
        if (idx >= 0) {
          if (!map[category.name]) map[category.name] = [];
          map[category.name].push(idx);
        }
      });
    });

    return map;
  }

  function normalizeHeader(header) {
    return String(header).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function normalizeName(name) {
    if (!name) return '';
    return String(name)
      .trim()
      .toLowerCase()
      .replace(/^the\s+/, '')
      .replace(/[''`]/g, "'")
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9'\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sortedTokens(name) {
    return normalizeName(name).split(/[\s-]+/).filter(Boolean).sort().join(' ');
  }

  function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  function similarityScore(a, b) {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (sortedTokens(a) === sortedTokens(b)) return 0.97;

    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length > nb.length ? na : nb;

    if (longer.indexOf(shorter) >= 0 && shorter.length / longer.length >= 0.65) {
      return 0.93;
    }

    const distance = levenshtein(na, nb);
    const ratio = 1 - distance / Math.max(na.length, nb.length);

    if (na.length >= 8 && nb.length >= 8 && distance <= 2) {
      return Math.max(ratio, 0.9);
    }

    return ratio;
  }

  function areSimilar(a, b) {
    return similarityScore(a, b) >= 0.88;
  }

  function clusterNames(rawCounts) {
    const names = Object.keys(rawCounts);
    const parent = names.map(function (_, i) { return i; });

    function find(i) {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    }

    function union(i, j) {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[rj] = ri;
    }

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (areSimilar(names[i], names[j])) union(i, j);
      }
    }

    const groups = {};
    names.forEach(function (name, index) {
      const root = find(index);
      if (!groups[root]) groups[root] = [];
      groups[root].push(name);
    });

    return Object.values(groups).map(function (group) {
      const variants = group.slice().sort(function (a, b) {
        return rawCounts[b] - rawCounts[a] || a.localeCompare(b);
      });
      const count = group.reduce(function (sum, name) { return sum + rawCounts[name]; }, 0);
      const variantCounts = variants.map(function (name) {
        return { name: name, count: rawCounts[name] };
      });

      return {
        name: variants[0],
        count: count,
        variants: variants,
        variantCounts: variantCounts,
        isMerged: variants.length > 1
      };
    }).sort(function (a, b) {
      return b.count - a.count || a.name.localeCompare(b.name);
    });
  }

  function tallyVotes(data) {
    const columnMap = buildColumnMap(data.headers);
    const categories = VOTE_FORM.categories.map(function (category) {
      const indices = columnMap[category.name] || [];
      const rawCounts = {};

      data.rows.forEach(function (row) {
        indices.forEach(function (idx) {
          const value = row[idx] ? String(row[idx]).trim() : '';
          if (value) {
            rawCounts[value] = (rawCounts[value] || 0) + 1;
          }
        });
      });

      const allNominees = clusterNames(rawCounts);
      const totalVotes = allNominees.reduce(function (sum, item) { return sum + item.count; }, 0);
      const rawEntries = Object.keys(rawCounts).length;
      const mergedCount = Math.max(0, rawEntries - allNominees.length);
      const duplicates = allNominees.filter(function (n) { return n.isMerged; });

      return {
        name: category.name,
        totalVotes: totalVotes,
        mergedCount: mergedCount,
        duplicates: duplicates,
        nominees: allNominees.slice(0, ADMIN_CONFIG.topNominees)
      };
    });

    const totalVoteEntries = categories.reduce(function (sum, cat) { return sum + cat.totalVotes; }, 0);
    const mergedGroups = categories.reduce(function (sum, cat) { return sum + cat.mergedCount; }, 0);
    const allDuplicates = categories
      .filter(function (cat) { return cat.duplicates.length > 0; })
      .map(function (cat) {
        return {
          category: cat.name,
          groups: cat.duplicates
        };
      });

    return {
      updatedAt: data.updatedAt,
      totalBallots: data.totalBallots,
      totalVoteEntries: totalVoteEntries,
      mergedGroups: mergedGroups,
      allDuplicates: allDuplicates,
      categories: categories
    };
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  }

  function updateStats(results) {
    document.getElementById('stat-ballots').textContent = results.totalBallots;
    document.getElementById('stat-votes').textContent = results.totalVoteEntries;
    document.getElementById('stat-categories').textContent = results.categories.length;
    document.getElementById('stat-merged').textContent = results.mergedGroups;
    document.getElementById('stat-updated').textContent = formatTime(results.updatedAt);
  }

  function renderDuplicates(results) {
    if (!results.allDuplicates.length) {
      duplicatesRoot.innerHTML =
        '<div class="duplicates-empty">No duplicate or misspelled names detected yet.</div>';
      return;
    }

    const html = results.allDuplicates.map(function (item) {
      const groupsHtml = item.groups.map(function (group) {
        const breakdown = group.variantCounts.map(function (variant) {
          return escapeHtml(variant.name) + ' (' + variant.count + ')';
        }).join(' · ');

        return (
          '<div class="duplicate-group">' +
            '<div class="duplicate-canonical">' + escapeHtml(group.name) + ' — ' + group.count + ' total votes</div>' +
            '<div class="duplicate-breakdown">Variants: ' + breakdown + '</div>' +
          '</div>'
        );
      }).join('');

      return (
        '<article class="duplicate-category">' +
          '<h3>' + escapeHtml(item.category) + '</h3>' +
          groupsHtml +
        '</article>'
      );
    }).join('');

    duplicatesRoot.innerHTML = html;
  }

  function renderResults(results, filter) {
    const query = (filter || '').trim().toLowerCase();

    const html = results.categories
      .filter(function (cat) {
        return !query || cat.name.toLowerCase().indexOf(query) >= 0;
      })
      .map(function (cat) {
        const maxCount = cat.nominees[0] ? cat.nominees[0].count : 1;
        const nomineesHtml = cat.nominees.length
          ? cat.nominees.map(function (nominee, index) {
              const barWidth = Math.round((nominee.count / maxCount) * 100);
              const mergedBadge = nominee.isMerged
                ? '<span class="merged-badge" title="Similar spellings combined">Merged</span>'
                : '';
              const variantsHtml = nominee.isMerged
                ? '<div class="nominee-variants">Variants: ' +
                    nominee.variantCounts.slice(1).map(function (v) {
                      return escapeHtml(v.name) + ' (' + v.count + ')';
                    }).join(', ') +
                  '</div>'
                : '';
              return (
                '<li class="nominee-row' + (nominee.isMerged ? ' has-variants' : '') + '">' +
                  '<span class="nominee-rank">' + (index + 1) + '</span>' +
                  '<div>' +
                    '<div class="nominee-name">' + escapeHtml(nominee.name) + mergedBadge + '</div>' +
                    variantsHtml +
                    '<div class="nominee-bar-wrap"><div class="nominee-bar" style="width:' + barWidth + '%"></div></div>' +
                  '</div>' +
                  '<span class="nominee-count">' + nominee.count + '</span>' +
                '</li>'
              );
            }).join('')
          : '<div class="empty-category">No votes yet in this category.</div>';

        const dupNote = cat.mergedCount > 0
          ? '<span class="category-dup-note">' + cat.mergedCount + ' duplicate' + (cat.mergedCount === 1 ? '' : 's') + ' merged</span>'
          : '';

        return (
          '<article class="category-panel">' +
            '<div class="category-panel-header">' +
              '<h3>' + escapeHtml(cat.name) + '</h3>' +
              '<div class="category-meta">' +
                '<span class="category-total">' + cat.totalVotes + ' votes</span>' +
                dupNote +
              '</div>' +
            '</div>' +
            '<ol class="nominee-list">' + nomineesHtml + '</ol>' +
          '</article>'
        );
      }).join('');

    resultsRoot.innerHTML = html || '<p class="empty-category">No categories match your search.</p>';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadDashboard() {
    setStatus('Loading results…', 'loading');
    refreshBtn.disabled = true;

    try {
      const data = await fetchResponses();
      setupNotice.hidden = true;
      lastResults = tallyVotes(data);
      updateStats(lastResults);
      renderResults(lastResults, searchInput.value);
      renderDuplicates(lastResults);
      setStatus('', '');
    } catch (error) {
      setupNotice.hidden = false;
      var msg = error.message;
      if (location.protocol === 'file:') {
        msg += ' Browsers block local JSON when opening files directly — use serve.ps1 instead.';
      }
      setStatus(msg, 'error');
      resultsRoot.innerHTML = '';
      duplicatesRoot.innerHTML = '';
    } finally {
      refreshBtn.disabled = false;
    }
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const password = document.getElementById('admin-password').value;
    if (password === ADMIN_CONFIG.password) {
      loginError.textContent = '';
      showDashboard();
    } else {
      loginError.textContent = 'Incorrect password. Please try again.';
    }
  });

  logoutBtn.addEventListener('click', showLogin);
  refreshBtn.addEventListener('click', loadDashboard);

  searchInput.addEventListener('input', function () {
    if (lastResults) renderResults(lastResults, searchInput.value);
  });

  if (isAuthenticated()) {
    showDashboard();
  } else {
    showLogin();
  }
})();