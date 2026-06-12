(function () {
  const formRoot = document.getElementById('vote-form-root');
  const voteSection = document.getElementById('vote');
  const mainContent = document.getElementById('main-content');
  const voteTriggers = document.querySelectorAll('[data-vote-trigger]');

  if (!formRoot || !voteSection || typeof VOTE_FORM === 'undefined') return;

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function buildForm() {
    const categoriesHtml = VOTE_FORM.categories.map(function (category, index) {
      const slug = slugify(category.name);
      const fieldsHtml = category.fields.map(function (field, fieldIndex) {
        const id = slug + '-choice-' + (fieldIndex + 1);
        return (
          '<div class="vote-choice">' +
            '<label class="vote-choice-label" for="' + id + '">' + escapeHtml(field.label) + '</label>' +
            '<input class="vote-input" type="text" id="' + id + '" name="entry.' + field.entry + '" autocomplete="off" placeholder="Enter nominee name">' +
          '</div>'
        );
      }).join('');

      return (
        '<fieldset class="vote-category">' +
          '<legend class="vote-category-title">' +
            '<span class="vote-category-number">' + String(index + 1).padStart(2, '0') + '</span>' +
            escapeHtml(category.name) +
          '</legend>' +
          '<p class="vote-category-hint">Vote for up to 5 nominees in this category.</p>' +
          '<div class="vote-choices">' + fieldsHtml + '</div>' +
        '</fieldset>'
      );
    }).join('');

    formRoot.innerHTML =
      '<p class="vote-form-intro">' + escapeHtml(VOTE_FORM.description) + '</p>' +
      '<form id="ballot-form" class="ballot-form" novalidate>' +
        categoriesHtml +
        '<div class="vote-form-actions">' +
          '<button type="submit" class="btn btn-primary" id="submit-ballot">Submit Ballot</button>' +
          '<button type="button" class="btn btn-secondary" id="clear-ballot">Clear Form</button>' +
        '</div>' +
      '</form>' +
      '<div id="vote-success" class="vote-success" hidden>' +
        '<div class="vote-success-icon" aria-hidden="true">✓</div>' +
        '<h2>Thank You for Voting</h2>' +
        '<p>Your ballot has been submitted. Thank you for participating in the Evan Dickerson Awards.</p>' +
        '<button type="button" class="btn btn-secondary" id="vote-success-home">Return to Home</button>' +
      '</div>';
  }

  function openVote() {
    document.body.classList.add('vote-active');
    voteSection.hidden = false;
    mainContent.hidden = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.pushState({ view: 'vote' }, '', '#vote');
  }

  function closeVote() {
    document.body.classList.remove('vote-active');
    voteSection.hidden = true;
    mainContent.hidden = false;
    if (location.hash === '#vote') {
      history.pushState({ view: 'home' }, '', '#');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSuccess() {
    document.getElementById('ballot-form').hidden = true;
    document.querySelector('.vote-form-intro').hidden = true;
    document.getElementById('vote-success').hidden = false;
  }

  function resetBallot() {
    document.getElementById('ballot-form').reset();
    document.getElementById('ballot-form').hidden = false;
    document.querySelector('.vote-form-intro').hidden = false;
    document.getElementById('vote-success').hidden = true;
  }

  async function submitBallot(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById('submit-ballot');
    const formData = new FormData(form);
    const payload = new URLSearchParams();

    formData.forEach(function (value, key) {
      if (value.trim()) {
        payload.append(key, value.trim());
      }
    });

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      await fetch(VOTE_FORM.action, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString()
      });
      showSuccess();
    } catch (error) {
      alert('There was a problem submitting your ballot. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Ballot';
    }
  }

  buildForm();

  voteTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      openVote();
      const nav = document.getElementById('site-nav');
      const toggle = document.querySelector('.menu-toggle');
      if (nav) nav.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
  });

  document.querySelectorAll('a[href^="#"]:not([data-vote-trigger])').forEach(function (link) {
    link.addEventListener('click', function () {
      if (document.body.classList.contains('vote-active')) {
        closeVote();
      }
    });
  });

  document.getElementById('vote-back-home').addEventListener('click', closeVote);

  document.getElementById('ballot-form').addEventListener('submit', submitBallot);

  document.getElementById('clear-ballot').addEventListener('click', function () {
    if (confirm('Clear all entries on this ballot?')) {
      document.getElementById('ballot-form').reset();
    }
  });

  document.getElementById('vote-success-home').addEventListener('click', function () {
    resetBallot();
    closeVote();
  });

  window.addEventListener('popstate', function () {
    if (location.hash === '#vote') {
      openVote();
    } else {
      closeVote();
    }
  });

  if (location.hash === '#vote') {
    openVote();
  }
})();