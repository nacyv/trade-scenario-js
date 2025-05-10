
---

# Trade Scenario JS

**Trade Scenario JS** adalah sebuah library JavaScript modular untuk mensimulasikan dan menguji strategi trading menggunakan data candlestick (forex atau crypto). Library ini mendukung berbagai indikator teknikal seperti Moving Average, Exponential Moving Average, MACD, RSI, ATR, dan SuperTrend. Cocok untuk backtesting dan pengembangan bot trading berbasis logika.

## Fitur Utama

- Simulasi strategi trading berbasis data historis
- Dukungan indikator teknikal yang dapat diperluas
- Sistem wallet internal untuk tracking saldo, profit/loss, dan fee
- Parameter fleksibel dan mudah dikustomisasi
- Support berbagai source data: `open`, `high`, `low`, `close`, `hl2`, `hlc3`, dll
- Penulisan strategi dengan JavaScript fungsional
- Dokumentasi lengkap dengan JSDoc

## Instalasi

Clone repo ini:

```bash
git clone https://github.com/nacyv/trade-scenario-js.git
cd trade-scenario-js
```

Instal dependensi jika ada (jika menggunakan npm):

npm install

Contoh Penggunaan

```javascript
import { CryptoTradeScenario } from './src/scenario/CryptoTradeScenario.js';
import { EMA, RSI } from './src/indicators/index.js';

const scenario = new CryptoTradeScenario({
  balance: 100,
  fee: 0.001,
});

scenario.addIndicator('ema100', new EMA(100, 'close'));
scenario.addIndicator('ema200', new EMA(200, 'close'));
scenario.addIndicator('rsi', new RSI(14));

scenario.setStrategy(({ indicators }) => {
  const buySignal = indicators.ema100 < indicators.ema200 && indicators.rsi < 30;
  const sellSignal = indicators.ema100 > indicators.ema200 && indicators.rsi > 70;
  return { buy: buySignal, sell: sellSignal };
});

await scenario.loadCandlesFromBinance('BTC/USDT', '1h', 1000);
scenario.run();

console.log(scenario.getReport());

```

Struktur Proyek

/src
  /indicators         -> Kumpulan indikator teknikal (EMA, RSI, dll)
  /scenario           -> Class utama untuk menjalankan simulasi trading
  /utils              -> Fungsi-fungsi pembantu (perhitungan, validasi, dll)
/test                 -> Unit test (jika ada)
/example              -> Contoh penggunaan

Rencana Pengembangan

[ ] Dukungan visualisasi hasil simulasi

[ ] UI interaktif untuk konfigurasi strategi

[ ] Integrasi dengan real-time WebSocket data

[ ] Ekspor laporan hasil ke CSV/JSON


Lisensi

MIT License © 2025 nacyv

---
