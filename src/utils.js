export function pluralize(count, word) {
	return count === 1 ? word : word + 's';
}

function randomFailurePromise(func) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			const r = Math.random()
			if (r > 0.5) {
				resolve(func())
			} else {
				reject("Random failure!")
			}
		}, Math.random * 300 + 300)
	})
}

export function storeDataToLocalStore(namespace, data) {
	return randomFailurePromise(() => {
		if (data) {
			localStorage.setItem(namespace, JSON.stringify(data));
		}
	})
}

export function getDataFromLocalStore(namespace) {
	return randomFailurePromise(() => {
		var store = localStorage.getItem(namespace);
		return (store && JSON.parse(store)) || [];
	})
}
