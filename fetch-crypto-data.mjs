import { writeFile } from 'node:fs/promises';

const coins = [
  { key: 'btc', id: 1, name: 'Bitcoin', symbol: 'BTC', start: '2013-01-01' },
  { key: 'eth', id: 1027, name: 'Ethereum', symbol: 'ETH', start: '2015-08-07' },
  { key: 'sol', id: 5426, name: 'Solana', symbol: 'SOL', start: '2020-04-10' },
  { key: 'doge', id: 74, name: 'Dogecoin', symbol: 'DOGE', start: '2013-12-15' },
];

const unix = date => Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
const end = Math.floor(Date.now() / 1000);
const assets = {};

for (const coin of coins) {
  const url = `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/historical?id=${coin.id}&convertId=2781&timeStart=${unix(coin.start)}&timeEnd=${end}&interval=1d`;
  const response = await fetch(url, { headers: { 'user-agent': 'Nolurdu/1.0' } });
  if (!response.ok) throw new Error(`${coin.name}: ${response.status}`);
  const json = await response.json();
  const quotes = json.data?.quotes || [];
  const grouped = {};
  for (const item of quotes) {
    const month = item.timeClose.slice(0, 7);
    if (month > '2025-12') continue;
    (grouped[month] ||= []).push(Number(item.quote.close));
  }
  if (coin.key === 'btc') {
    const earlyUrl = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-01-01&end_time=2012-12-31&page_size=10000';
    const earlyResponse = await fetch(earlyUrl, { headers: { 'user-agent': 'Nolurdu/1.0' } });
    if (!earlyResponse.ok) throw new Error(`Bitcoin erken dönem: ${earlyResponse.status}`);
    const earlyJson = await earlyResponse.json();
    for (const item of earlyJson.data || []) {
      const month = item.time.slice(0, 7);
      (grouped[month] ||= []).push(Number(item.PriceUSD));
    }
  }
  const monthlyUSD = Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => [month, values.reduce((sum, value) => sum + value, 0) / values.length]));
  const latest = quotes.at(-1)?.quote?.close || Object.values(monthlyUSD).at(-1);
  assets[coin.key] = { name: coin.name, symbol: coin.symbol, firstYear: Object.keys(monthlyUSD)[0].slice(0, 4), monthlyUSD, latestUSD: Number(latest) };
}

const output = `window.CRYPTO_DATA=${JSON.stringify({ generated: new Date().toISOString().slice(0, 10), source: 'CoinMarketCap; Bitcoin 2010-2012: Coin Metrics Community', assets })};\n`;
await writeFile(new URL('./crypto-data.js', import.meta.url), output, 'utf8');
