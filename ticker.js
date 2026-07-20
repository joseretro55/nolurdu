(() => {
  const ticker = document.querySelector('[data-rate-ticker]');
  if (!ticker) return;

  const groups = [...ticker.querySelectorAll('.rate-ticker-items')];
  const status = ticker.querySelector('.rate-ticker-status');

  const fxLabels = {
    USD: 'Dolar', EUR: 'Euro', GBP: 'Sterlin', CHF: 'İsviçre Frangı',
    JPY: 'Japon Yeni', CAD: 'Kanada Doları', AUD: 'Avustralya Doları',
    CNY: 'Çin Yuanı', SAR: 'Suudi Riyali', AED: 'BAE Dirhemi'
  };
  const fxOrder = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'CNY', 'SAR', 'AED'];

  const format = (value, min = 2, max = 4) => new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: min,
    maximumFractionDigits: max
  }).format(value);

  const formatCrypto = value => {
    if (value >= 1000) return format(value, 0, 0);
    if (value >= 1) return format(value, 2, 2);
    return format(value, 4, 6);
  };

  const item = (label, value, suffix = 'TL', className = '') => {
    if (!Number.isFinite(value)) return '';
    return `<span class="rate-ticker-item ${className}"><span>${label}</span><b>${value} ${suffix}</b></span>`;
  };

  function render({ fx = {}, crypto = {}, metals = {}, date = '' }) {
    const parts = [];

    fxOrder.forEach(code => {
      if (Number.isFinite(fx[code])) parts.push(item(fxLabels[code], format(fx[code]), 'TL', 'is-fx'));
    });

    if (Number.isFinite(metals.goldGram)) parts.push(item('Gram Altın', format(metals.goldGram, 2, 2), 'TL', 'is-metal'));
    if (Number.isFinite(metals.silverGram)) parts.push(item('Gram Gümüş', format(metals.silverGram, 2, 2), 'TL', 'is-metal'));
    if (Number.isFinite(metals.copperKg)) parts.push(item('Bakır / kg', format(metals.copperKg, 2, 2), 'TL', 'is-metal'));

    if (Number.isFinite(crypto.bitcoin)) parts.push(item('Bitcoin', formatCrypto(crypto.bitcoin), 'TL', 'is-crypto'));
    if (Number.isFinite(crypto.ethereum)) parts.push(item('Ethereum', formatCrypto(crypto.ethereum), 'TL', 'is-crypto'));
    if (Number.isFinite(crypto.solana)) parts.push(item('Solana', formatCrypto(crypto.solana), 'TL', 'is-crypto'));
    if (Number.isFinite(crypto.dogecoin)) parts.push(item('Dogecoin', formatCrypto(crypto.dogecoin), 'TL', 'is-crypto'));

    parts.push(`<span class="rate-ticker-item"><small>Referans tarihi: ${date || 'son güncelleme'}</small></span>`);
    const html = parts.join('');
    groups.forEach(group => { group.innerHTML = html; });
    if (status) status.hidden = true;
  }

  function siteFallbackFx() {
    const data = window.MARKET_DATA;
    if (!data?.fx) return null;
    const key = Object.keys(data.fx).filter(k => data.fx[k]).sort().at(-1);
    const row = data.fx[key];
    if (!row) return null;
    return {
      rates: { USD: row.USD, EUR: row.EUR, GBP: row.GBP, CHF: row.CHF },
      date: row.date || key
    };
  }

  async function fetchFx() {
    const symbols = fxOrder.join(',');
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=TRY&symbols=${symbols}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Kur servisi yanıt vermedi');
    const data = await response.json();
    const tlRates = {};
    fxOrder.forEach(code => {
      const tryToCurrency = Number(data.rates?.[code]);
      tlRates[code] = tryToCurrency > 0 ? 1 / tryToCurrency : NaN;
    });
    return { rates: tlRates, date: data.date };
  }

  async function fetchCrypto() {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=try';
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Kripto servisi yanıt vermedi');
    const data = await response.json();
    return {
      bitcoin: Number(data.bitcoin?.try),
      ethereum: Number(data.ethereum?.try),
      solana: Number(data.solana?.try),
      dogecoin: Number(data.dogecoin?.try)
    };
  }

  async function fetchMetal(symbol) {
    const response = await fetch(`https://api.gold-api.com/price/${symbol}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${symbol} fiyatı alınamadı`);
    return response.json();
  }

  async function fetchMetals(usdTry) {
    if (!Number.isFinite(usdTry)) return {};
    const results = await Promise.allSettled(['XAU', 'XAG', 'HG'].map(fetchMetal));
    const price = index => results[index].status === 'fulfilled' ? Number(results[index].value?.price) : NaN;
    const xau = price(0);
    const xag = price(1);
    const hg = price(2);
    return {
      goldGram: Number.isFinite(xau) ? xau * usdTry / 31.1034768 : NaN,
      silverGram: Number.isFinite(xag) ? xag * usdTry / 31.1034768 : NaN,
      copperKg: Number.isFinite(hg) ? hg * usdTry / 0.45359237 : NaN
    };
  }

  async function start() {
    let fxResult;
    try {
      fxResult = await fetchFx();
    } catch (_) {
      fxResult = siteFallbackFx() || { rates: {}, date: '' };
    }

    const [cryptoResult, metalsResult] = await Promise.allSettled([
      fetchCrypto(),
      fetchMetals(Number(fxResult.rates.USD))
    ]);

    render({
      fx: fxResult.rates,
      date: fxResult.date,
      crypto: cryptoResult.status === 'fulfilled' ? cryptoResult.value : {},
      metals: metalsResult.status === 'fulfilled' ? metalsResult.value : {}
    });
  }

  start().catch(() => {
    const fallback = siteFallbackFx();
    if (fallback) render({ fx: fallback.rates, date: fallback.date });
    else if (status) status.textContent = 'Güncel piyasa değerleri şu anda alınamıyor.';
  });
})();
