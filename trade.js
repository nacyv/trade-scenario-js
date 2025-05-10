import { Indicator, Indicators } from './indicator.js';
import { numArr, invertPriceData } from './utils.js';

/**
 * @typedef PriceData
 * @property {number} timestamp
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef TradeData
 * @property {Array<PriceData>} price
 * @property {{[key: string]: typeof Indicator}} indicators
 */

/**
 * @callback APIRequestFunction
 * @param {string} symbol1
 * @param {string} symbol2
 * @param {number} limit
 * @returns {Promise<Array<PriceData>>}
 */

/**
 * @callback IndicatorDataSourceFunction
 * @param {Indicator} self
 * @param {TradeData} data
 * @returns {(PriceData|number)}
 */

/**
 * @callback StrategyFunction
 * @param {[string, string]} pair
 * @param {TradeData} data
 * @param {{[key: string]: number}} wallet
 * @param {(side: ('buy' | 'sell'), value: number) => void} action
 */

/**
 * Parse symbol pair string menjadi array dua elemen
 * @param {string} input
 * @returns {[string, string] | null}
 */
const parseSymbolPair = (input = '') => {
	const match = input.match(/([a-zA-Z0-9]+)[\W\s]+([a-zA-Z0-9]+)/);
	if (!match) return null;
	const [, sym1, sym2] = match;
	return [sym1.toUpperCase(), sym2.toUpperCase()];
};

/**
 * Class utama untuk simulasi perdagangan kripto menggunakan strategi dan indikator
 */
export class CryptoTradeScenario {
	/**
	 * @constructor
	 */
	constructor() {
		/** @type {{[pair: string]: TradeData}} */
		this.dataMap = {};
		
		/** @type {{[symbol: string]: number}} */
		this.wallet = {};
		
		/** @type {APIRequestFunction | null} */
		this.api = null;
		
		/** @type {{[key: string]: Indicator}} */
		this.indicators = {};
		
		/** @type {StrategyFunction[]} */
		this.strategies = [];
		
		/** @type {number} */
		this.limit = 100;
	}
	
	/**
	 * Set batas jumlah data historis
	 * @param {number} limit
	 * @returns {this}
	 */
	setLimit(limit = 100) {
		this.limit = limit;
		return this;
	}
	
	/**
	 * Menambahkan pasangan simbol kripto yang ingin dianalisis
	 * @param {...string} symbols - Format bisa "BTC/USDT", "ETH-USDT", dll
	 * @returns {this}
	 */
	addSymbol(...symbols) {
		symbols.forEach((pairStr) => {
			const pair = parseSymbolPair(pairStr);
			if (!pair) return;
			const key = `${pair[0]}/${pair[1]}`;
			this.dataMap[key] = {
				price: numArr(),
				indicators: {}
			};
		});
		return this;
	}
	
	/**
	 * Menetapkan saldo awal untuk masing-masing aset di wallet
	 * @param {{[symbol: string]: number}} wallet
	 * @returns {this}
	 */
	setWallet(wallet) {
		Object.keys(wallet).forEach((key) => {
			this.wallet[key.toUpperCase()] = wallet[key];
		});
		return this;
	}
	
	/**
	 * Mengatur fungsi pengambil data harga dari API
	 * @param {APIRequestFunction} apiReqFn
	 * @returns {this}
	 */
	setAPI(apiReqFn) {
		this.api = typeof apiReqFn === 'function' ? apiReqFn : null;
		return this;
	}
	
	/**
	 * Menambahkan indikator yang akan digunakan
	 * @param {string} key - Nama unik indikator
	 * @param {Indicator} indicator - Instance indikator
	 * @param {string|IndicatorDataSourceFunction} [source='close'] - Data sumber indikator
	 * @returns {this}
	 */
	addIndicator(key, indicator) {
		if (indicator instanceof Indicator) {
			indicator.setLimit(this.limit);
			this.indicators[key] = indicator;
		}
		return this;
	}
	
	/**
	 * Menambahkan strategi yang akan dijalankan di tiap tick
	 * @param {StrategyFunction} strategyFn
	 * @returns {this}
	 */
	addStrategy(strategyFn) {
		if (typeof strategyFn === 'function') {
			this.strategies.push(strategyFn);
		}
		return this;
	}
	
	/**
	 * Memulai simulasi perdagangan
	 * @param {number} interval - Delay antar iterasi dalam ms
	 * @returns {void}
	 */
	start(interval = 1000) {
		if (!this.api) throw new Error('API not set');
		
		/** @type {string[]} */
		const pairs = Object.keys(this.dataMap);
		
		/** @type {{[pair: string]: TradeData}} */
		const tempDataMap = {};
		
		/** @type {number[]} */
		let timestamps = [];
		
		/**
		 * Mengambil semua data harga awal
		 * @returns {Promise<void>}
		 */
		const fetchAll = async () => {
			const apis = pairs.map((pair) => {
				const [sym1, sym2] = parseSymbolPair(pair);
				return invertPriceData(await this.api(sym1, sym2, this.limit));
			});
			
			const results = await Promise.all(apis);
			
			for (let i = 0; i < pairs.length; i++) {
				const pair = pairs[i];
				const priceList = results[i];
				const tradeData = this.dataMap[pair];
				
				tradeData.price = [];
				tradeData.indicators = {};
				
				tempDataMap[pair] = {
					price: priceList,
					indicators: {}
				};
				
				for (let key in this.indicators) {
					tempDataMap[pair].indicators[key] = this.indicators[key].clone();
				}
				
				timestamps = timestamps.concat(priceList.map(e => e.timestamp));
			}
			
			timestamps = Array.from(new Set(timestamps)).sort((a, b) => a - b);
		};
		
		let t = 0;
		
		/**
		 * Melakukan iterasi simulasi pada setiap timestamp
		 */
		const loop = () => {
			const timestamp = timestamps[t];
			
			for (const pair of pairs) {
				const [sym1, sym2] = parseSymbolPair(pair);
				const tradeData = this.dataMap[pair];
				const reference = tempDataMap[pair];
				
				let p = 0;
				let price;
				while (p < reference.price.length) {
					price = reference.price[p];
					if (price.timestamp === timestamp) break;
					p++;
				}
				
				if (!price || price.timestamp !== timestamp) continue;
				
				tradeData.price.push(price);
				
				for (let key in reference.indicators) {
					const indicator = reference.indicators[key];
					const source = indicator.source;
					
					/** @type {any} */
					let input = typeof source === 'function' ?
						source(indicator, tradeData) :
						price;
					
					indicator.push(input);
					tradeData.indicators[key] = indicator;
				}
				
				for (const strategy of this.strategies) {
					strategy([sym1, sym2], tradeData, this.wallet, (side, value) => {
						if (value <= 0) return;
						
						this.wallet[sym1] = this.wallet[sym1] || 0;
						this.wallet[sym2] = this.wallet[sym2] || 0;
						
						switch (side) {
							case 'buy': {
								const priceAvg = (price.high + price.close) / 2;
								const amount = value / priceAvg;
								if (this.wallet[sym2] >= value) {
									this.wallet[sym2] -= value;
									this.wallet[sym1] += amount;
								}
								break;
							}
							case 'sell': {
								const priceAvg = (price.low + price.close) / 2;
								const quantity = value / priceAvg;
								if (this.wallet[sym1] >= quantity) {
									this.wallet[sym1] -= quantity;
									this.wallet[sym2] += value;
								}
								break;
							}
						}
					});
				}
			}
			
			t++;
			if (t < timestamps.length) {
				setTimeout(loop, interval);
			}
		};
		
		fetchAll().then(() => {
			loop();
		});
	}
}


class TradeData{
	constructor(){
		this.price=new Klines();
		this.indicators=[];
	}
	setIndicator(id,indicatorId,opsions={}){
		
	}
	push(){
		
	}
	getItemAt(){
		
	}
	static get indicators(){
		return {
			'MovingAverage': MovingAverage
		}
	}
}