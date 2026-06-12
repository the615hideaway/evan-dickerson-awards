(function (global) {
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function getVotingOpens() {
    return new Date(SITE_CONFIG.votingOpens);
  }

  global.isVotingOpen = function () {
    return new Date() >= getVotingOpens();
  };

  function updateCountdownSet(prefix) {
    const daysEl = document.getElementById(prefix + 'countdown-days');
    const hoursEl = document.getElementById(prefix + 'countdown-hours');
    const minutesEl = document.getElementById(prefix + 'countdown-minutes');
    const countdownEl = document.getElementById(prefix + 'countdown');

    if (!daysEl || !hoursEl || !minutesEl) return;

    const diff = getVotingOpens() - new Date();

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      if (countdownEl) {
        const label = countdownEl.querySelector('.countdown-label');
        if (label) label.textContent = 'First Round Voting Is Open';
      }
      return;
    }

    const totalMinutes = Math.floor(diff / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    daysEl.textContent = String(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
  }

  global.initCountdowns = function () {
    function tick() {
      updateCountdownSet('');
      updateCountdownSet('vote-');
    }
    tick();
    setInterval(tick, 60000);
  };
})(window);