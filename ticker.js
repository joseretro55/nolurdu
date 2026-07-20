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

  const nf = (value, min = 2, max = 4) => new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: min,
    maximumFractionDigits: max
  }).format(value);

  const cryptoFormat = value => {
    if (value >= 1000) return nf(value, 0, 0);
    if (value >= 1) return nf(value, 2, 2);
    return nf(value, 4, 6);
  };

  const card = (label, value, cssClass = '') => {
    if (!Number.isFinite(value)) return '';
    return `<span class="rate-ticker-item ${cssClass}"><span>${label}</span><b>${value} TL</b></span>`;
  };

  function render(snapshot) {
    const { fx = {}, crypto = {}, metals = {}, date = '', note = '' } = snapshot;
    const parts = [];

    fxOrder.forEach(code => {
      if (Number.isFinite(fx[code])) parts.push(card(fxLabels[code], nf(fx[code]), 'is-fx'));
    });

    if (Number.isFinite(metals.goldGram)) parts.push(card('Gram Altın', nf(metals.goldGram, 2, 2), 'is-metal'));
    if (Number.isFinite(metals.silverGram)) parts.push(card('Gram Gümüş', nf(metals.silverGram, 2, 2), 'is-metal'));
    if (Number.isFinite(metals.copperKg)) parts.push(card('Bakır / kg', nf(metals.copperKg, 2, 2), 'is-metal'));

    if (Number.isFinite(crypto.bitcoin)) parts.push(card('Bitcoin', cryptoFormat(crypto.bitcoin), 'is-crypto'));
    if (Number.isFinite(crypto.ethereum)) parts.push(card('Ethereum', cryptoFormat(crypto.ethereum), 'is-crypto'));
    if (Number.isFinite(crypto.solana)) parts.push(card('Solana', cryptoFormat(crypto.solana), 'is-crypto'));
    if (Number.isFinite(crypto.dogecoin)) parts.push(card('Dogecoin', cryptoFormat(crypto.dogecoin), 'is-crypto'));

    parts.push(`<span class="rate-ticker-item is-date"><small>${note || 'Referans'}: ${date || 'son kayıt'}</small></span>`);

    const html = parts.join('');
    groups.forEach(group => { group.innerHTML = html; });
    if (status) status.hidden = true;
  }

  function latestLocalSnapshot() {
    const market = window.MARKET_DATA;
    const cryptoData = window.CRYPTO_DATA;
    const snapshot = { fx: {}, crypto: {}, metals: {}, date: '', note: 'Son güvenilir kayıt' };

    if (market?.fx) {
      const key = Object.keys(market.fx).filter(k => market.fx[k]).sort().at(-1);
      const row = key ? market.fx[key] : null;
      if (row) {
        ['USD', 'EUR', 'GBP', 'CHF'].forEach(code => {
          const value = Number(row[code]);
          if (Number.isFinite(value)) snapshot.fx[code] = value;
        });
        snapshot.date = row.date || key;

        const commodity = market.commodities?.[key];
        const usdTry = Number(row.USD);
        if (commodity && Number.isFinite(usdTry)) {
          const gold = Number(commodity.gold);
          const silver = Number(commodity.silver);
          const copper = Number(commodity.copper);
          if (Number.isFinite(gold)) snapshot.metals.goldGram = gold * usdTry / 31.1034768;
          if (Number.isFinite(silver)) snapshot.metals.silverGram = silver * usdTry / 31.1034768;
          if (Number.isFinite(copper)) snapshot.metals.copperKg = copper * usdTry / 1000;
        }

        const assets = cryptoData?.assets || {};
        const map = { bitcoin: 'btc', ethereum: 'eth', solana: 'sol', dogecoin: 'doge' };
        Object.entries(map).forEach(([out, keyName]) => {
          const usd = Number(assets[keyName]?.latestUSD);
          if (Number.isFinite(usd) && Number.isFinite(usdTry)) snapshot.crypto[out] = usd * usdTry;
        });
      }
    }
    return snapshot;
  }

  function withTimeout(url, milliseconds = 6500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), milliseconds);
    return fetch(url, { cache: 'no-store', signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  async function fetchFx() {
    const symbols = fxOrder.join(',');
    const response = await withTimeout(`https://api.frankfurter.dev/v1/latest?base=TRY&symbols=${symbols}`);
    if (!response.ok) throw new Error('Kur servisi yanıt vermedi');
    const data = await response.json();
    const rates = {};
    fxOrder.forEach(code => {
      const inverse = Number(data.rates?.[code]);
      if (inverse > 0) rates[code] = 1 / inverse;
    });
    return { rates, date: data.date };
  }

  async function fetchCrypto() {
    const response = await withTimeout('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=try');
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
    const response = await withTimeout(`https://api.gold-api.com/price/${symbol}`);
    if (!response.ok) throw new Error(`${symbol} alınamadı`);
    return response.json();
  }

  async function fetchMetals(usdTry) {
    if (!Number.isFinite(usdTry)) return {};
    const results = await Promise.allSettled(['XAU', 'XAG', 'HG'].map(fetchMetal));
    const get = i => results[i].status === 'fulfilled' ? Number(results[i].value?.price) : NaN;
    const xau = get(0), xag = get(1), hg = get(2);
    return {
      goldGram: Number.isFinite(xau) ? xau * usdTry / 31.1034768 : NaN,
      silverGram: Number.isFinite(xag) ? xag * usdTry / 31.1034768 : NaN,
      copperKg: Number.isFinite(hg) ? hg * usdTry / 0.45359237 : NaN
    };
  }

  async function updateLive(base) {
    const next = JSON.parse(JSON.stringify(base));
    let liveCount = 0;

    try {
      const fx = await fetchFx();
      next.fx = { ...next.fx, ...fx.rates };
      next.date = fx.date || next.date;
      liveCount++;
    } catch (_) {}

    const [cryptoResult, metalsResult] = await Promise.allSettled([
      fetchCrypto(),
      fetchMetals(Number(next.fx.USD))
    ]);

    if (cryptoResult.status === 'fulfilled') {
      next.crypto = { ...next.crypto, ...cryptoResult.value };
      liveCount++;
    }
    if (metalsResult.status === 'fulfilled') {
      const valid = Object.fromEntries(Object.entries(metalsResult.value).filter(([, v]) => Number.isFinite(v)));
      if (Object.keys(valid).length) {
        next.metals = { ...next.metals, ...valid };
        liveCount++;
      }
    }

    next.note = liveCount ? 'Güncel referans' : 'Son güvenilir kayıt';
    render(next);
  }

  const fallback = latestLocalSnapshot();
  render(fallback); // API beklenirken bant hiçbir zaman boş kalmaz.
  updateLive(fallback).catch(() => render(fallback));
})();
