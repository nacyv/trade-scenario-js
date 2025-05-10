// klines.js

import {ArrayMap} from './utils.js';

/**
 * Represents a collection of Klines (candlestick data) with utility methods to manipulate and parse them.
 * Extends ArrayMap for column-based storage.
 */
export class Klines extends ArrayMap {
	/**
	 * Constructs a new Klines instance with a default limit of 100.
	 */
	constructor() {
		super(); // pastikan ini ada agar pewarisan berjalan benar
		/** @type {number} */
		this.limit = 100;
	}
	
	/**
	 * Adds Kline objects to the collection, ensuring that the total number of Klines does not exceed the limit.
	 * @param {...Object} objects - Kline objects to be added.
	 */
	push(...objects) {
		const results = Klines.invert(objects);
		const count = results.length + this.length;
		super.splice(0, count > this.limit ? count - this.limit : 0);
		super.push(...results);
	}
	
	/**
	 * Removes and/or inserts Kline objects at the specified index.
	 * @param {number} start - The starting index for the splice operation.
	 * @param {number} deleteCount - The number of Klines to remove.
	 * @param {...Object} objects - Kline objects to insert.
	 */
	splice(start, deleteCount, ...objects) {
		if (typeof start !== 'number' || start < 0) return;
		const results = Klines.invert(objects);
		const len = (this.length - start) - (typeof deleteCount === 'number' && deleteCount >= 0 ? deleteCount : 0);
		const count = results.length + len;
		super.splice(0, count > this.limit ? count - this.limit : 0);
		super.splice(start, deleteCount, ...results);
	}
	
	/**
	 * Gets the first Kline at a given index.
	 * @param {number} [index=0] - The index offset from the first element.
	 * @returns {Object} - The Kline object at the given index.
	 */
	first(index = 0) {
		return this.getItemAt(index);
	}
	
	/**
	 * Gets the last Kline at a given index.
	 * @param {number} [index=0] - The index offset from the last element.
	 * @returns {Object} - The Kline object at the given index.
	 */
	last(index = 0) {
		return this.getItemAt(this.length - (1 + index));
	}
	
	/**
	 * Retrieves Kline values from a specified source field.
	 * @param {string} [source='close'] - The source field to extract values from.
	 * @param {number} [count=1] - The number of Klines to retrieve.
	 * @returns {Array} - An array of values from the specified source field.
	 */
	getItemsBySource(source = 'close', count = 1) {
		const len = typeof count === 'number' && count > 0 ? (count > this.length ? this.length : count) : 0;
		if (!Klines.source.includes(source) || len == 0) return [];
		const result = [];
		for (let i = this.length - len; i < this.length; i++) {
			const item = this.getItemAt(i);
			result.push(Klines.parse(item, source));
		}
		return result;
	}
	
	/**
	 * Returns the list of supported source fields for Kline data.
	 * @returns {string[]} - The supported source field names.
	 */
	static get source() { return ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4']; }
	
	/**
	 * Converts raw input data with various key names into normalized Kline format.
	 * @param {Object[]} [data=[]] - The raw array of Kline-like objects with varied key naming.
	 * @returns {Object[]} - The normalized array of Kline objects.
	 */
	static invert(data = []) {
		if (!data?.length) return [];
		
		let keysOut = this.source.slice(6, 10);
		let keysIn = null;
		let result = [];
		
		const candidates = [1, 'o', 'open', 'O', 'OPEN'];
		const transformFn = [
			(e) => e[0],
			(e) => e[0],
			(e) => e,
			(e) => e[0].toUpperCase(),
			(e) => e.toUpperCase()
		];
		for (let i = 0; i < candidates.length; i++) {
			if (!isNaN(parseFloat(data[0][candidates[i]]))) {
				keysIn = keysOut.map(transformFn[i]);
				break;
			}
		}
		
		if (keysIn === null) return [];
		
		for (let d of data) {
			const c = {};
			for (let i = 0; i < keysIn.length; i++) {
				c[keysOut[i]] = i === 0 ?
					parseInt(d[keysIn[i]]) :
					parseFloat(d[keysIn[i]]);
			}
			result.push(c);
		}
		
		return result;
	}
	
	/**
	 * Parses a value from a Kline object using a specific source field.
	 * Supports derived values like hl2, hlc3, etc.
	 * @param {{timestamp?:number, open:number, high:number, low:number, close:number, volume?:number}|number} data - A Kline object or raw number.
	 * @param {'timestamp'|'open'|'high'|'low'|'close'|'volume'|'hl2'|'hlc3'|'ohlc4'|'hlcc4'} [source='close'] - The source field to extract.
	 * @returns {number} - The extracted or calculated value.
	 */
	static parse(data, source = 'close') {
		if (typeof data !== 'object' || !this.source.includes(source)) return NaN;
		const v = {
			hl2: () => (data.high + data.low) / 2,
			hlc3: () => (data.high + data.low + data.close) / 3,
			ohlc4: () => (data.open + data.high + data.low + data.close) / 4,
			hlcc4: () => (data.high + data.low + data.close * 2) / 4
		};
		return (v[source] || (() => data[source]))() ?? NaN;
	}
}
