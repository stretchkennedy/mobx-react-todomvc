import {observable, computed, autorun} from 'mobx';
import * as Utils from '../utils';

export class TodoModel {
	key;
	@observable reading = false;
	@observable todos = [];

	constructor(key) {
		this.key = key;

		this.readFromLocalStorage();
		this.subscribeLocalStorageToModel();
	}

	@computed get activeTodoCount() {
		return this.todos.reduce(
			(sum, todo) => sum + (todo.completed ? 0 : 1),
			0
		)
	}

	@computed get completedCount() {
		return this.todos.length - this.activeTodoCount;
	}

	readFromLocalStorage(model) {
		this.reading = true

		Utils.getDataFromLocalStore(this.key)
		.then((json) => {
			this.todos = json.map(data => Todo.fromJson(this, data));
			this.reading = false
			console.log("loaded")
		})
		.catch(() => {
			this.readFromLocalStorage(model)
			console.log("failed to load")
		})
	}

	subscribeLocalStorageToModel(model) {
		const storeTodos = () => {
			if (this.reading) {
				return
			}

			Utils.storeDataToLocalStore(this.key, this.todos.map(todo => todo.toJson()))
			.then(() => {
				console.log("saved")
			})
			.catch(() => {
				storeTodos()
				console.log("failed to save")
			})
		}

		autorun(storeTodos);
	}

	addTodo (title) {
		this.todos.push(new Todo(this, Utils.uuid(), title, false));
	}

	toggleAll (checked) {
		this.todos.forEach(
			todo => todo.completed = checked
		);
	}

	clearCompleted () {
		this.todos = this.todos.filter(
			todo => !todo.completed
		);
	}
}

export class Todo {
	store;
	id;
	@observable title;
	@observable completed;

	constructor(store, id, title, completed) {
		this.store = store;
		this.id = id;
		this.title = title;
		this.completed = completed;
	}

	toggle() {
		this.completed = !this.completed;
	}

	destroy() {
		this.store.todos.remove(this);
	}

	setTitle(title) {
		this.title = title;
	}

	toJson() {
		return {
			id: this.id,
			title: this.title,
			completed: this.completed
		};
	}

	static fromJson(store, json) {
		return new Todo(store, json.id, json.title, json.completed);
	}
}
