
(() => {
  const ticker = document.querySelector('[data-rate-ticker]');
  if (!ticker) return;
  const groups = [...ticker.querySelectorAll('.rate-ticker-items')];
  const status = ticker.querySelector('.rate-ticker-status');
  const labels = { USD: 'Dolar', EUR: 'Euro', GBP: 'Sterlin', CHF: 'İsviçre Frangı' };
  const order = ['USD', 'EUR', 'GBP', 'CHF'];
  const format = value => new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);

  function render(rates, date) {
    const html = order.map(code => {
      const rate = rates[code];
      if (!Number.isFinite(rate)) return '';
      return `<span class="rate-ticker-item"><span>${labels[code]}</span><b>${format(rate)} TL</b></span>`;
    }).join('') + `<span class="rate-ticker-item"><small>Referans tarihi: ${date || 'son iş günü'}</small></span>`;
    groups.forEach(group => group.innerHTML = html);
    if (status) status.hidden = true;
  }

  function fallbackFromSiteData() {
    const data = window.MARKET_DATA;
    if (!data?.fx) return false;
    const key = Object.keys(data.fx).filter(k => data.fx[k]).sort().at(-1);
    const row = data.fx[key];
    if (!row) return false;
    render({ USD: row.USD, EUR: row.EUR, GBP: row.GBP, CHF: row.CHF }, row.date || key);
    return true;
  }

  fetch('https://api.frankfurter.dev/v1/latest?base=TRY&symbols=USD,EUR,GBP,CHF', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Kur servisi yanıt vermedi');
      return response.json();
    })
    .then(data => {
      const tlRates = {};
      order.forEach(code => {
        const tryToCurrency = Number(data.rates?.[code]);
        tlRates[code] = tryToCurrency > 0 ? 1 / tryToCurrency : NaN;
      });
      render(tlRates, data.date);
    })
    .catch(() => {
      if (!fallbackFromSiteData() && status) {
        status.textContent = 'Güncel referans kurlar şu anda alınamıyor.';
      }
    });
})();
