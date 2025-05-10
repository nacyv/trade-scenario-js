// indicator.js

import { ArrayMap } from './utils.js';
import { Klines } from './klines.js';

/**
 * @typedef PriceObject
 * @property {number} timestamp
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @class
 * @extends ArrayMap
 */
export class Indicator extends ArrayMap {
	/**
	 * Constructs an Indicator instance.
	 * @param {Object} options - The options for the indicator.
	 * @param {string} [options.id=''] - The unique identifier of the indicator.
	 * @param {string} [options.name=''] - The name of the indicator.
	 * @param {number} [options.period=1] - The period for calculations.
	 * @param {number} [options.limit=200] - The limit on the number of values stored.
	 */
	constructor({ id = '', name = '', period = 1, limit = 200 } = {}) {
		super('base');
		this.id = id;
		this.name = name;
		this.period = period;
		this.inputType = 'numberArray'; // or 'priceArray' = TOHLCV object
		this.limit = limit;
	}
	
	/**
	 * Sets the limit for the number of values stored in the indicator.
	 * @param {number} limit - The new limit for stored values.
	 */
	setLimit(limit = 200) {
		if (typeof limit !== 'number' || limit < 0) return;
		this.limit = limit;
		if (limit < this.length) {
			this.splice(0, this.length - limit);
		}
	}
	
	/**
	 * Adds new items to the indicator.
	 * @param {...any} items - The items to add.
	 */
	push(...items) {
		super.push(...items);
		this.length;
	}
	
	/**
	 * Creates a clone of the indicator instance.
	 * @returns {this} - The cloned instance of the indicator.
	 */
	clone() {
		return new this.constructor(this);
	}
	/** @returns {number} */
	get length() {
		const count = items.length + this.length;
		super.splice(0, count > this.limit ? count - this.limit : 0);
		return super.length;
	}
}

/**
 * @class
 * @extends Indicator
 */
export class MovingAverage extends Indicator {
	/**
	 * Constructs a MovingAverage instance.
	 * @param {Object} options - The options for the moving average.
	 */
	constructor(options = {}) {
		super(options);
	}
	
	/**
	 * Adds new values to the moving average and calculates the new average.
	 * @param {number[]} numberArray - An array of numbers to calculate the moving average from.
	 */
	push(numberArray) {
		if (!Array.isArray(numberArray)) return;
		const baseArr = this.values['base'];
		const startIndex = baseArr.length;
		
		for (let i = startIndex; i < numberArray.length; i++) {
			if (i + 1 < this.period) {
				baseArr.push(null); // Belum cukup data untuk moving average
			} else {
				const slice = numberArray.slice(i + 1 - this.period, i + 1);
				const base = MovingAverage.calc(slice);
				baseArr.push(base);
			}
		}
	}
	
	static calc(values = []) {
		if (!Array.isArray(values)) return null;
		const cleaned = values.filter(v => typeof v === 'number');
		if (cleaned.length < values.length) return null; // Ada nilai tak valid
		return cleaned.reduce((sum, v) => sum + v, 0) / cleaned.length;
	}
}

/**
 * @class
 * @extends Indicator
 */
export class ExponentialMovingAverage extends Indicator {
	/**
	 * Constructs an ExponentialMovingAverage instance.
	 * @param {Object} options - The options for the exponential moving average.
	 */
	constructor(options = {}) {
		super(options);
	}
	
	/**
	 * Adds new values to calculate the exponential moving average.
	 * @param {number[]} numberArray - An array of numbers to calculate the EMA from.
	 */
	push(numberArray) {
		if (!Array.isArray(numberArray)) return;
		const baseArr = this.values['base'];
		const start = baseArr.length;
		const end = numberArray.length;
		
		for (let i = start; i < end; i++) {
			const current = numberArray[i];
			if (typeof current !== 'number') {
				baseArr.push(null);
				continue;
			}
			
			if (i < this.period - 1) {
				// Belum cukup data
				baseArr.push(null);
			} else if (i === this.period - 1) {
				// EMA pertama = SMA dari periode pertama
				const slice = numberArray.slice(i + 1 - this.period, i + 1);
				baseArr.push(MovingAverage.calc(slice));
			} else {
				const prevEMA = baseArr[i - 1];
				const ema = ExponentialMovingAverage.calc(current, prevEMA, this.period);
				baseArr.push(ema);
			}
		}
	}
	
	/**
	 * Calculates the next EMA value.
	 * @param {number} current - Current price or value.
	 * @param {number} prev - Previous EMA.
	 * @param {number} period - EMA period.
	 * @returns {number|null}
	 */
	static calc(current, prev, period) {
		if (typeof current !== 'number' || typeof prev !== 'number') return null;
		const alpha = 2 / (period + 1);
		return (current - prev) * alpha + prev;
	}
}


/**
 * @class
 * @extends Indicator
 */
export class MovingAverageConvergenceDivergence extends Indicator {
	constructor(options = {}) {
		super(options);
		delete this.period;
		
		this.shortPeriod = typeof options?.shortPeriod === 'number' && options.shortPeriod > 0 ? options.shortPeriod : 12;
		this.longPeriod = typeof options?.longPeriod === 'number' && options.longPeriod > 0 ? options.longPeriod : 26;
		this.signalPeriod = typeof options?.signalPeriod === 'number' && options.signalPeriod > 0 ? options.signalPeriod : 9;
		
		super.addKey('short', 'long', 'signal', 'histogram');
	}
	
	push(numberArray) {
		if (!Array.isArray(numberArray)) return;
		
		const start = this.values['base'].length;
		const end = numberArray.length;
		
		const shortArr = this.values['short'];
		const longArr = this.values['long'];
		const baseArr = this.values['base'];
		const signalArr = this.values['signal'];
		const histogramArr = this.values['histogram'];
		
		for (let i = start; i < end; i++) {
			const price = numberArray[i];
			if (typeof price !== 'number') {
				shortArr.push(null);
				longArr.push(null);
				baseArr.push(null);
				signalArr.push(null);
				histogramArr.push(null);
				continue;
			}
			
			// Hitung short EMA
			let short = null;
			if (i === this.shortPeriod - 1) {
				const slice = numberArray.slice(i + 1 - this.shortPeriod, i + 1);
				short = MovingAverage.calc(slice);
			} else if (i >= this.shortPeriod) {
				short = ExponentialMovingAverage.calc(price, shortArr[i - 1], this.shortPeriod);
			}
			shortArr.push(short);
			
			// Hitung long EMA
			let long = null;
			if (i === this.longPeriod - 1) {
				const slice = numberArray.slice(i + 1 - this.longPeriod, i + 1);
				long = MovingAverage.calc(slice);
			} else if (i >= this.longPeriod) {
				long = ExponentialMovingAverage.calc(price, longArr[i - 1], this.longPeriod);
			}
			longArr.push(long);
			
			// Hitung MACD Line (base)
			let base = null;
			if (typeof short === 'number' && typeof long === 'number') {
				base = short - long;
			}
			baseArr.push(base);
			
			// Hitung Signal Line
			let signal = null;
			if (i === this.longPeriod + this.signalPeriod - 2) {
				const slice = baseArr.slice(i + 1 - this.signalPeriod, i + 1);
				signal = MovingAverage.calc(slice);
			} else if (i > this.longPeriod + this.signalPeriod - 2) {
				signal = ExponentialMovingAverage.calc(base, signalArr[i - 1], this.signalPeriod);
			}
			signalArr.push(signal);
			
			// Hitung Histogram
			let histogram = null;
			if (typeof base === 'number' && typeof signal === 'number') {
				histogram = base - signal;
			}
			histogramArr.push(histogram);
		}
	}
}

/**
 * @class
 * @extends Indicator
 */
export class RelativeStrengthIndex extends Indicator {
	constructor(options = { period: 17 }) {
		super(options);
		super.addKey('gain', 'loss'); // gunakan key yang konsisten
	}
	
	/**
	 * @param {number[]} numberArray - deret harga penutupan (close)
	 */
	push(numberArray) {
		if (!Array.isArray(numberArray)) return;
		
		const baseArr = this.values['base'];
		const gainArr = this.values['gain'];
		const lossArr = this.values['loss'];
		
		for (let i = baseArr.length; i < numberArray.length; i++) {
			const curr = numberArray[i];
			const prev = numberArray[i - 1];
			
			if (typeof curr !== 'number' || typeof prev !== 'number') {
				baseArr.push(null);
				gainArr.push(null);
				lossArr.push(null);
				continue;
			}
			
			const change = curr - prev;
			const gain = Math.max(change, 0);
			const loss = Math.max(-change, 0);
			
			gainArr.push(gain);
			lossArr.push(loss);
			
			let rsi = null;
			if (gainArr.length >= this.period) {
				const avgGain = gainArr.slice(-this.period).reduce((a, b) => a + b, 0) / this.period;
				const avgLoss = lossArr.slice(-this.period).reduce((a, b) => a + b, 0) / this.period;
				const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
				rsi = 100 - 100 / (1 + rs);
			}
			
			baseArr.push(rsi);
		}
	}
}

/**
 * @class
 * @extends Indicator
 */
export class AverageTrueRange extends Indicator {
	constructor(options = { period: 14 }) {
		super(options);
		this.inputType = 'priceArray';
		this.addKey('range'); // key 'base' sudah di inisialisasi pada class Indicator
		this.prevClose = null; // pada iterasi pertama, prevClose hasil dari hl2
	}
	
	/**
	 * @param {PriceObject[]} priceArray
	 */
	push(priceArray = []) {
		if (!Array.isArray(priceArray) || priceArray.length === 0) return;
		const baseArr = this.values['base'];
		const trueRangeArr = this.values['range'];
		const period = this.period ?? 14;
		
		for (let value of priceArray) {
			if (typeof value !== 'object') continue;
			
			const high = value.high;
			const low = value.low;
			const close = value.close ?? (high + low) / 2;
			
			// Gunakan hl2 jika prevClose belum ada (bar pertama)
			const prevClose = this.prevClose ?? (high + low) / 2;
			
			// True Range (TR)
			const tr = Math.max(
				high - low,
				Math.abs(high - prevClose),
				Math.abs(low - prevClose)
			);
			
			trueRangeArr.push(tr);
			
			// Average True Range (ATR)
			if (trueRangeArr.length < period) {
				baseArr.push(NaN); // belum cukup data
			} else if (trueRangeArr.length === period) {
				// Rata-rata pertama
				const sum = trueRangeArr.slice(0, period).reduce((a, b) => a + b, 0);
				const atr = sum / period;
				baseArr.push(atr);
			} else {
				// Smoothed ATR
				const prevATR = baseArr.at(-1);
				const atr = ((prevATR * (period - 1)) + tr) / period;
				baseArr.push(atr);
			}
			
			this.prevClose = close;
		}
	}
}


/**
 * @class
 * @extends AverageTrueRange
 */
export class SuperTrend extends AverageTrueRange {
	constructor(options = { period: 10, multiplier: 3 }) {
		super(options);
		this.multiplier = options.multiplier || 3;
		this.addKey('upper', 'lower', 'trend');
	}
	/**
	 * @param {PriceObject[]} priceArray
	 */
	push(priceArray) {
		if (!Array.isArray(priceArray) || priceArray.length === 0) return;
		
		const baseArr = this.values['base'];
		const upperArr = this.values['upper'];
		const lowerArr = this.values['lower'];
		const trendArr = this.values['trend'];
		
		let prevUpper = upperArr.at(-1);
		let prevLower = lowerArr.at(-1);
		let prevTrend = trendArr.at(-1);
		
		for (let price of priceArray) {
			if (typeof price !== 'object') continue;
			
			super.push([price]); // hitung ATR dari parent class
			
			const high = price.high;
			const low = price.low;
			const close = price.close ?? (high + low) / 2;
			const atr = baseArr.at(-1);
			
			if (!isFinite(atr)) {
				upperArr.push(NaN);
				lowerArr.push(NaN);
				trendArr.push(null);
				continue;
			}
			
			const hl2 = (high + low) / 2;
			const multiplier = this.multiplier;
			
			const upperBand = hl2 + multiplier * atr;
			const lowerBand = hl2 - multiplier * atr;
			
			// Awal trend, atau lanjut dari sebelumnya
			let trend;
			if (prevTrend == null) {
				trend = 1; // default awal: uptrend
			} else if (close > prevUpper) {
				trend = 1; // uptrend
			} else if (close < prevLower) {
				trend = -1; // downtrend
			} else {
				trend = prevTrend;
			}
			
			// Update band berdasarkan trend
			const finalUpper = (trend === 1 && prevUpper != null) ? Math.min(upperBand, prevUpper) : upperBand;
			const finalLower = (trend === -1 && prevLower != null) ? Math.max(lowerBand, prevLower) : lowerBand;
			
			upperArr.push(finalUpper);
			lowerArr.push(finalLower);
			trendArr.push(trend);
			
			prevUpper = finalUpper;
			prevLower = finalLower;
			prevTrend = trend;
		}
	}
}

/**
 * @type {{
 * MA: typeof MovingAverage,
 * EMA: typeof ExponentialMovingAverage,
 * MACD: typeof MovingAverageConvergenceDivergence,
 * RSI: typeof RelativeStrengthIndex,
 * ATR: typeof AverageTrueRange,
 * ST: typeof SuperTrend
 * }}
 */
export const Indicators = {
	MA: MovingAverage,
	EMA: ExponentialMovingAverage,
	MACD: MovingAverageConvergenceDivergence,
	RSI: RelativeStrengthIndex,
	ATR: AverageTrueRange,
	ST: SuperTrend
};
