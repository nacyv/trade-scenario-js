/**
 * A utility class that stores key-value arrays with synchronized lengths, acting like an array of objects.
 * Useful for tabular data with dynamic columns.
 */
export class ArrayMap {
	/**
	 * @param {...(string|number)} keys - Initial keys to be used in the map.
	 */
	constructor(...keys) {
		/** @type {Record<string|number, any[]>} */
		this.values = {};
		/** @type {Record<string, Function>} */
		this.listeners = {};
		this.addKey(...keys);
	}
	
	/**
	 * Adds new keys (columns) to the map.
	 * @param {...(string|number)} keys
	 */
	addKey(...keys) {
		for (let key of keys) {
			if (typeof key !== 'string' && typeof key !== 'number') continue;
			if (!Array.isArray(this.values[key])) {
				this.values[key] = new Array(this.length).fill(undefined);
				this.trigger('onNewPropertyAdded', key);
			}
		}
	}
	
	/**
	 * Deletes specified keys (columns) from the map.
	 * @param {...(string|number)} keys
	 */
	deleteKey(...keys) {
		for (let key of keys) {
			if (key in this.values) {
				delete this.values[key];
				this.trigger('onPropertyDeleted', key);
			}
		}
	}
	
	/**
	 * Adds new row(s) to the map.
	 * @param {...object} objects - Objects with key-value pairs matching column names.
	 */
	push(...objects) {
		for (let obj of objects) {
			if (typeof obj !== 'object') continue;
			this.addKey(...Object.keys(obj));
			for (let key in this.values) {
				const value = key in obj ? obj[key] : undefined;
				this.values[key].push(value);
			}
			this.trigger('onAdded', obj);
		}
	}
	
	/**
	 * Removes the last row from the map and returns it.
	 * @returns {object|undefined} The removed row, or undefined if empty.
	 */
	pop() {
		if (this.length === 0) return;
		const removed = {};
		for (let key in this.values) {
			removed[key] = this.values[key].pop();
		}
		this.trigger('onRemoved', removed);
		return removed;
	}
	
	/**
	 * Removes and/or inserts rows at the given index.
	 * @param {number} start - The starting index.
	 * @param {number} deleteCount - The number of rows to remove.
	 * @param {...object} items - Items to insert.
	 */
	splice(start, deleteCount, ...items) {
		start = Math.max(0, Math.min(start, this.length));
		deleteCount = Math.min(this.length - start, deleteCount);
		const removedList = [];
		
		for (let i = 0; i < deleteCount; i++) {
			const removed = {};
			for (let key in this.values) {
				removed[key] = this.values[key][start + i];
			}
			removedList.push(removed);
		}
		
		for (let key in this.values) {
			const valuesToInsert = items.map(item => item[key]);
			this.values[key].splice(start, deleteCount, ...valuesToInsert);
		}
		
		if (deleteCount > 0) this.trigger('onRemoved', removedList);
		if (items.length > 0) this.trigger('onAdded', items);
	}
	
	/**
	 * Clears all data in the map.
	 */
	clear() {
		for (let key in this.values) {
			this.values[key] = [];
		}
		//this.length = 0;
		this.trigger('onCleared');
	}
	
	/**
	 * Applies a function to each row and returns the results.
	 * @param {(item: object, index: number) => any} callback
	 * @returns {any[]}
	 */
	map(callback) {
		const result = [];
		for (let i = 0; i < this.length; i++) {
			const item = this.getItemAt(i);
			result.push(callback(item, i));
		}
		return result;
	}
	
	/**
	 * Executes a function for each row.
	 * @param {(item: object, index: number) => void} callback
	 */
	forEach(callback) {
		for (let i = 0; i < this.length; i++) {
			const item = this.getItemAt(i);
			callback(item, i);
		}
	}
	
	/**
	 * Filters rows based on a callback function.
	 * @param {(item: object, index: number) => boolean} callback
	 * @returns {ArrayMap}
	 */
	filter(callback) {
		const newMap = new ArrayMap(...Object.keys(this.values));
		for (let i = 0; i < this.length; i++) {
			const item = this.getItemAt(i);
			if (callback(item, i)) newMap.push(item);
		}
		return newMap;
	}
	
	/**
	 * Finds the first row that satisfies the condition.
	 * @param {(item: object, index: number) => boolean} callback
	 * @returns {object|undefined}
	 */
	find(callback) {
		for (let i = 0; i < this.length; i++) {
			const item = this.getItemAt(i);
			if (callback(item, i)) return item;
		}
		return undefined;
	}
	
	/**
	 * Tests if some rows meet the condition.
	 * @param {(item: object, index: number) => boolean} callback
	 * @returns {boolean}
	 */
	some(callback) {
		for (let i = 0; i < this.length; i++) {
			if (callback(this.getItemAt(i), i)) return true;
		}
		return false;
	}
	
	/**
	 * Tests if all rows meet the condition.
	 * @param {(item: object, index: number) => boolean} callback
	 * @returns {boolean}
	 */
	every(callback) {
		for (let i = 0; i < this.length; i++) {
			if (!callback(this.getItemAt(i), i)) return false;
		}
		return true;
	}
	
	/**
	 * Checks if a row with the same values exists in the map.
	 * @param {object} obj - The row to check.
	 * @returns {boolean}
	 */
	includes(obj) {
		for (let i = 0; i < this.length; i++) {
			let match = true;
			for (let key in this.values) {
				if (this.values[key][i] !== obj[key]) {
					match = false;
					break;
				}
			}
			if (match) return true;
		}
		return false;
	}
	
	/**
	 * Sets the value of a specific key at a given index.
	 * @param {number} index
	 * @param {string|number} key
	 * @param {*} value
	 */
	setValueAt(index, key, value) {
		if (typeof key !== 'string' && typeof key !== 'number') return;
		if (!Array.isArray(this.values[key])) {
			this.addKey(key);
		}
		if (index < 0 || index >= this.length) {
			this.trigger('onError', new Error(`Index ${index} out of bounds`));
			return;
		}
		const oldValue = this.values[key][index];
		this.values[key][index] = value;
		this.trigger('onChanged', index, key, oldValue, value);
	}
	
	/**
	 * Returns an object representing the row at a given index.
	 * @param {number} index
	 * @returns {object}
	 */
	getItemAt(index) {
		const item = {};
		for (let key in this.values) {
			item[key] = this.values[key][index];
		}
		return item;
	}
	
	/**
	 * Triggers an event listener by name.
	 * @param {string} event
	 * @param {...any} args
	 */
	trigger(event, ...args) {
		try {
			const fn = this.listeners[event];
			if (typeof fn === 'function') fn(...args);
		} catch (e) {
			this.trigger('onError', e);
		}
	}
	
	/**
	 * Creates a deep copy of the current ArrayMap.
	 * @returns {ArrayMap}
	 */
	clone() {
		const newMap = new ArrayMap(...Object.keys(this.values));
		for (let i = 0; i < this.length; i++) {
			newMap.push(this.getItemAt(i));
		}
		return newMap;
	}
	
	/**
	 * Returns the length (number of rows).
	 * @returns {number}
	 */
	get length() {
		let len = 0;
		for (let key in this.values) {
			const arr = this.values[key];
			if (Array.isArray(arr) && arr.length > len) len = arr.length;
		}
		return len;
	}
	
	/**
	 * Sets the length (number of rows), trimming or extending with `undefined`.
	 * @param {number} len
	 */
	set length(len) {
		if (typeof len !== 'number' || isNaN(len) || len < 0) return;
		len = Math.floor(len);
		for (let key in this.values) {
			const arr = this.values[key];
			if (Array.isArray(arr)) arr.length = len;
		}
	}
}