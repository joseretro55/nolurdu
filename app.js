const D = window.MARKET_DATA;
const C = window.CRYPTO_DATA;
const traditionalAssets = [
  ['usd', 'Dolar', 'USD'], ['eur', 'Euro', 'EUR'], ['gold', 'Gram altın', 'ALTIN'],
  ['silver', 'Gümüş', 'GÜMÜŞ'], ['copper', 'Bakır', 'BAKIR'],
  ['gbp', 'Sterlin', 'GBP'], ['chf', 'İsviçre frangı', 'CHF']
];
const cryptoOrder = ['btc', 'eth', 'sol', 'doge'];
const cryptoLabels = { btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana', doge: 'Dogecoin' };
let selected = 'gold';
let selectedYear = '2020';
let cryptoActive = false;
let selectedCrypto = 'btc';
let LIVE = null;

const $ = selector => document.querySelector(selector);
const fmt = (number, digits = 0) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(number);
const tl = number => `${fmt(number)} TL`;
const keys = Object.keys(D.fx).filter(key => D.fx[key]);
const last = keys.at(-1);
const years = [...new Set(keys.map(key => key.slice(0, 4)))].filter(year => +year >= 2000 && +year <= 2025);
const minimumWages = { '2000':'86,92', '2001':'122,19', '2002':'184,25', '2003':'226,00', '2004':'318,23', '2005':'350,15', '2006':'380,46', '2007':'419,15', '2008':'503,26', '2009':'546,48', '2010':'599,12', '2011':'658,95', '2012':'739,79', '2013':'803,68', '2014':'891,03', '2015':'1.000,54', '2016':'1.300,99', '2017':'1.404,06', '2018':'1.603,12', '2019':'2.020,90', '2020':'2.324,71', '2021':'2.825,90', '2022':'5.500,35', '2023':'11.402,32', '2024':'17.002,12', '2025':'22.104,67' };

function assetInfo(key) {
  if (C.assets[key]) return [key, cryptoLabels[key], C.assets[key].symbol];
  return traditionalAssets.find(asset => asset[0] === key);
}

function price(asset, month) {
  const fx = D.fx[month];
  if (!fx) return null;
  if (C.assets[asset]) {
    const usdPrice = C.assets[asset].monthlyUSD[month];
    return usdPrice ? usdPrice * fx.USD : null;
  }
  if (['usd', 'eur', 'gbp', 'chf'].includes(asset)) return fx[asset.toUpperCase()];
  const commodity = D.commodities[month];
  if (!commodity || !commodity[asset]) return null;
  if (asset === 'gold') return commodity.gold * fx.USD / 31.1034768;
  if (asset === 'silver') return commodity.silver * fx.USD / 31.1034768;
  return commodity.copper * fx.USD / 1e6;
}

function annual(asset, year) {
  const prices = keys.filter(key => key.startsWith(year)).map(key => price(asset, key)).filter(Boolean);
  return prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null;
}

function latest(asset) {
  if (C.assets[asset]) {
    const usd = LIVE?.fx?.USD || D.fx[last].USD;
    return C.assets[asset].latestUSD * usd;
  }
  if (LIVE) {
    if (['usd', 'eur', 'gbp', 'chf'].includes(asset)) return LIVE.fx[asset.toUpperCase()];
    const usd = LIVE.fx.USD;
    if (asset === 'gold') return LIVE.metals.XAU * usd / 31.1034768;
    if (asset === 'silver') return LIVE.metals.XAG * usd / 31.1034768;
    if (asset === 'copper') return LIVE.metals.HG * usd / 453.59237;
  }
  for (let index = keys.length - 1; index >= 0; index--) {
    const value = price(asset, keys[index]);
    if (value) return value;
  }
  return null;
}

function parseMoney(value) {
  let text = String(value).trim().replace(/\s/g, '');
  if (!text) return 0;
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
  else if ((text.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(text)) text = text.replace(/\./g, '');
  return Number(text.replace(/[^\d.-]/g, '')) || 0;
}

function formatMoneyInput() {
  const input = $('#amount');
  input.value = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseMoney(input.value));
}

function formatMoneyTyping(event) {
  const input = event.target;
  const raw = input.value.replace(/\./g, '').replace(/[^\d,]/g, '');
  const comma = raw.indexOf(',');
  const integer = (comma < 0 ? raw : raw.slice(0, comma)).replace(/^0+(?=\d)/, '') || '0';
  const fraction = comma < 0 ? '' : raw.slice(comma + 1).replace(/,/g, '').slice(0, 2);
  input.value = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(Number(integer)) + (comma < 0 ? '' : `,${fraction}`);
  input.setSelectionRange(input.value.length, input.value.length);
}

function updateMinimumWage() {
  const note = $('#minimumWage');
  if (note) note.textContent = `* ${selectedYear} net asgari ücret: ${minimumWages[selectedYear]} TL / ay`;
}

function cryptoWarning(message = '') {
  const warning = $('#cryptoWarning');
  warning.textContent = message;
  warning.classList.toggle('show', Boolean(message));
}

function setYear(year, smooth = false) {
  let targetYear = year;
  if (cryptoActive) {
    const firstYear = C.assets[selectedCrypto].firstYear;
    if (+targetYear < +firstYear) {
      targetYear = firstYear;
      cryptoWarning(`${cryptoLabels[selectedCrypto]} için fiyat verisi ${firstYear} yılında başlıyor. Yıl otomatik olarak ${firstYear} yapıldı.`);
    } else {
      cryptoWarning();
    }
  }
  selectedYear = targetYear;
  const rail = $('#yearRail');
  const target = document.querySelector(`.year-box[data-year="${targetYear}"]`);
  document.querySelectorAll('.year-box').forEach(box => box.classList.toggle('active', box.dataset.year === targetYear));
  if (target) rail.scrollTo({ top: target.offsetTop - (rail.clientHeight - target.offsetHeight) / 2, behavior: smooth ? 'smooth' : 'auto' });
  updateMinimumWage();
}

function setupYearWheel() {
  const rail = $('#yearRail');
  const boxes = [...rail.querySelectorAll('.year-box')];
  let settleTimer;
  let lastWheel = 0;
  const changeYear = direction => {
    const index = years.indexOf(selectedYear);
    const next = Math.max(0, Math.min(years.length - 1, index + direction));
    if (next !== index) setYear(years[next]);
  };
  const nearestCenter = () => {
    const center = rail.getBoundingClientRect().top + rail.clientHeight / 2;
    return boxes.reduce((nearest, box) => Math.abs(box.getBoundingClientRect().top + box.offsetHeight / 2 - center) < Math.abs(nearest.getBoundingClientRect().top + nearest.offsetHeight / 2 - center) ? box : nearest);
  };
  const paint = () => {
    const center = rail.getBoundingClientRect().top + rail.clientHeight / 2;
    let nearest = boxes[0];
    let best = Infinity;
    boxes.forEach(box => {
      const rect = box.getBoundingClientRect();
      const distance = Math.abs(center - (rect.top + rect.height / 2));
      const strength = Math.max(0, 1 - distance / 70);
      box.style.setProperty('--scale', (.68 + strength * .32).toFixed(3));
      box.style.setProperty('--opacity', (.28 + strength * .72).toFixed(3));
      if (distance < best) { best = distance; nearest = box; }
    });
    boxes.forEach(box => box.classList.toggle('active', box === nearest));
  };
  rail.addEventListener('scroll', () => {
    paint();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => setYear(nearestCenter().dataset.year), 45);
  }, { passive: true });
  rail.addEventListener('wheel', event => {
    event.preventDefault();
    const now = Date.now();
    if (now - lastWheel < 55) return;
    lastWheel = now;
    changeYear(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  rail.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    changeYear(event.key === 'ArrowDown' ? 1 : -1);
  });
  $('.year-up').onclick = () => changeYear(-1);
  $('.year-down').onclick = () => changeYear(1);
  paint();
}

function selectCrypto(key, recalculate = true) {
  cryptoActive = true;
  selectedCrypto = key;
  selected = key;
  document.querySelectorAll('.crypto-option').forEach(button => button.classList.toggle('active', button.dataset.crypto === key));
  const rail = $('#cryptoRail');
  const activeOption = rail.querySelector(`.crypto-option[data-crypto="${key}"]`);
  if (activeOption) rail.scrollTo({ left: activeOption.offsetLeft - (rail.clientWidth - activeOption.offsetWidth) / 2, behavior: 'smooth' });
  document.querySelectorAll('.chip').forEach(button => button.classList.toggle('active', button.dataset.a === 'crypto'));
  setYear(selectedYear);
  if (recalculate) calc();
}

function setupCryptoPicker() {
  const picker = $('#cryptoPicker');
  $('#cryptoRail').innerHTML = cryptoOrder.map(key => `<button type="button" class="crypto-option ${key === selectedCrypto ? 'active' : ''}" data-crypto="${key}"><b>${C.assets[key].symbol}</b><span>${cryptoLabels[key]}</span></button>`).join('');
  const change = direction => {
    const index = cryptoOrder.indexOf(selectedCrypto);
    selectCrypto(cryptoOrder[(index + direction + cryptoOrder.length) % cryptoOrder.length]);
  };
  picker.addEventListener('wheel', event => { event.preventDefault(); change(event.deltaY > 0 ? 1 : -1); }, { passive: false });
  $('#cryptoPrev').onclick = () => change(-1);
  $('#cryptoNext').onclick = () => change(1);
  $('#cryptoRail').onclick = event => {
    const button = event.target.closest('.crypto-option');
    if (button) selectCrypto(button.dataset.crypto);
  };
}

function ranking(year, amount) {
  const candidates = [...traditionalAssets, ...cryptoOrder.map(key => assetInfo(key))];
  const rows = candidates.map(asset => {
    const start = annual(asset[0], year);
    const end = latest(asset[0]);
    return start && end ? { name: asset[1], r: (end / start - 1) * 100, v: amount * end / start } : null;
  }).filter(Boolean).sort((a, b) => b.r - a.r);
  const max = Math.max(...rows.map(row => row.r), 1);
  $('#ranking').innerHTML = rows.map((row, index) => `<div class="rank"><b>${index + 1}</b><span>${row.name}</span><div class="track"><i style="width:${Math.max(2, row.r / max * 100)}%"></i></div><strong>${tl(row.v)}<br><small>%${fmt(row.r, 1)}</small></strong></div>`).join('');
}

function numberToTurkishLira(number) {
  const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
  const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
  const scales = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon'];
  const threeDigits = value => {
    const words = [];
    const hundred = Math.floor(value / 100);
    const ten = Math.floor(value % 100 / 10);
    const one = value % 10;
    if (hundred) words.push(hundred === 1 ? 'yüz' : `${ones[hundred]} yüz`);
    if (ten) words.push(tens[ten]);
    if (one) words.push(ones[one]);
    return words.join(' ');
  };
  let lira = Math.floor(Math.abs(number));
  let kurus = Math.round((Math.abs(number) - lira) * 100);
  if (kurus === 100) { lira++; kurus = 0; }
  const groups = [];
  let scale = 0;
  if (lira === 0) groups.push('sıfır');
  while (lira > 0 && scale < scales.length) {
    const group = lira % 1000;
    if (group) groups.unshift(group === 1 && scale === 1 ? 'bin' : `${threeDigits(group)}${scales[scale] ? ` ${scales[scale]}` : ''}`);
    lira = Math.floor(lira / 1000);
    scale++;
  }
  const prefix = number < 0 ? 'eksi ' : '';
  return `${prefix}${groups.join(' ')} Türk lirası${kurus ? ` ${threeDigits(kurus)} kuruş` : ''}`;
}

function calc(show = true) {
  const amount = parseMoney($('#amount').value);
  const start = annual(selected, selectedYear);
  const end = latest(selected);
  if (!amount || !start || !end) return;
  const quantity = amount / start;
  const value = quantity * end;
  const gain = value - amount;
  const rate = gain / amount * 100;
  const info = assetInfo(selected);
  $('#sentence').textContent = `${selectedYear} yıllık ortalama fiyatıyla ${fmt(amount, 2)} TL ${info[1]} alsaydın bugün`;
  $('#value').textContent = tl(value);
  $('#valueWords').textContent = numberToTurkishLira(value);
  $('#gain').textContent = `${gain >= 0 ? '+' : ''}${tl(gain)} kazanç`;
  $('#return').textContent = `%${fmt(rate, 1)}`;
  const unit = ['gold', 'silver', 'copper'].includes(selected) ? 'gram' : info[2];
  $('#quantity').textContent = `${fmt(quantity, quantity < 10 ? 4 : 2)} ${unit}`;
  $('#startPrice').textContent = `${fmt(start, start < 1 ? 6 : 2)} TL`;
  $('#endPrice').textContent = `${fmt(end, end < 1 ? 6 : 2)} TL`;
  $('#bar').style.width = `${Math.min(100, Math.max(2, rate / 15))}%`;
  if (show) $('#result').classList.add('show');
  ranking(selectedYear, amount);
}

async function loadLive() {
  try {
    const response = await fetch('/api/live');
    if (!response.ok) throw new Error('Canlı veri alınamadı');
    LIVE = await response.json();
  } catch (error) {
    try {
      const [gold, silver, copper] = await Promise.all(['XAU', 'XAG', 'HG'].map(symbol => fetch(`https://api.gold-api.com/price/${symbol}`).then(response => response.json())));
      LIVE = { fx: D.fx[last], metals: { XAU: gold.price, XAG: silver.price, HG: copper.price }, dates: { tcmb: D.fx[last].date, metals: gold.updatedAt } };
    } catch (_) { LIVE = null; }
  }
  if (LIVE) {
    $('#dataDate').textContent = LIVE.dates.tcmb || LIVE.dates.metals || D.generated;
    calc(false);
  }
}

$('#dataDate').textContent = D.generated.split('-').reverse().join('.');
$('#chips').innerHTML = [...traditionalAssets, ['crypto', 'Kripto', 'KRİPTO']].map(asset => `<button class="chip ${asset[0] === selected ? 'active' : ''}" data-a="${asset[0]}">${asset[1]}</button>`).join('');
$('#chips').insertAdjacentHTML('afterend', '<div id="cryptoPicker" class="crypto-picker" hidden><button id="cryptoPrev" class="crypto-nav" type="button" aria-label="Önceki kripto">‹</button><div id="cryptoRail" class="crypto-rail" aria-label="Kripto para seçimi"></div><button id="cryptoNext" class="crypto-nav" type="button" aria-label="Sonraki kripto">›</button><small id="cryptoWarning" class="crypto-warning" role="status"></small></div>');
$('#yearRail').insertAdjacentHTML('beforebegin', '<span class="year-prefix" aria-hidden="true">20</span><button type="button" class="year-arrow year-up" aria-label="Önceki yıl">▲</button>');
$('#yearRail').insertAdjacentHTML('afterend', '<button type="button" class="year-arrow year-down" aria-label="Sonraki yıl">▼</button>');
$('#yearRail').innerHTML = years.map(year => `<button type="button" class="year-box ${year === selectedYear ? 'active' : ''}" data-year="${year}" aria-label="${year}">${year.slice(2)}</button>`).join('');
$('#yearRail').onclick = event => { const button = event.target.closest('.year-box'); if (button) setYear(button.dataset.year, true); };

setYear(selectedYear);
setupYearWheel();
setupCryptoPicker();

const amountInput = $('#amount');
amountInput.type = 'text';
amountInput.inputMode = 'decimal';
formatMoneyInput();
amountInput.addEventListener('input', formatMoneyTyping);
amountInput.addEventListener('blur', formatMoneyInput);
amountInput.addEventListener('keydown', event => { if (event.key === 'Enter') { formatMoneyInput(); calc(); } });
$('.money').insertAdjacentHTML('afterend', '<small id="minimumWage" class="minimum-wage-note" title="Kaynak: T.C. Çalışma ve Sosyal Güvenlik Bakanlığı"></small>');
updateMinimumWage();

$('#chips').onclick = event => {
  const button = event.target.closest('.chip');
  if (!button) return;
  if (button.dataset.a === 'crypto') {
    $('#cryptoPicker').hidden = false;
    selectCrypto(selectedCrypto);
    return;
  }
  cryptoActive = false;
  cryptoWarning();
  $('#cryptoPicker').hidden = true;
  selected = button.dataset.a;
  document.querySelectorAll('.chip').forEach(chip => chip.classList.toggle('active', chip === button));
  calc();
};
$('#calc').onclick = () => { formatMoneyInput(); calc(); };
calc(false);
loadLive();
