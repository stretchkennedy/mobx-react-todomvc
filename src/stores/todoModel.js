import {observable, computed, autorun} from 'mobx'
import _ from 'lodash'
import * as Utils from '../utils'
import {createTransport} from '../transport'

const transport = createTransport("todos")

export class TodoModel {
  @observable reading = false
  @observable todos = []

  constructor() {
	this.readFromLocalStorage()
    this.subscribeTransport()
  }

  @computed get activeTodoCount() {
	return this.todos.reduce(
	  (sum, todo) => sum + (todo.completed ? 0 : 1),
	  0
	)
  }

  @computed get completedCount() {
	return this.todos.length - this.activeTodoCount
  }

  readFromLocalStorage(model) {
	this.reading = true

	transport.fetchAll()
	.then((json) => {
	  this.todos = json.map(data => Todo.fromJson(this, data))
	  this.reading = false
	  console.log("loaded")
	})
	.catch(() => {
	  console.log("failed to load")
	})
  }

  subscribeTransport() {
    const destroy = (todo, idx) => {
      transport.destroy(todo.id)
    }

    var oldTodos = []

	autorun(() => {
      _.differenceBy(oldTodos, this.todos, "id").forEach(destroy)
      oldTodos = this.todos.slice()
	})
  }


  addTodo (title) {
	this.todos.push(new Todo(this, title, false))
  }

  toggleAll (checked) {
	this.todos.forEach(
	  todo => todo.completed = checked
	)
  }

  clearCompleted () {
	this.todos = this.todos.filter(
	  todo => !todo.completed
	)
  }
}

export class Todo {
  store
  id
  @observable title
  @observable completed

  constructor(store, title, completed, id) {
	this.store = store
	this.id = id
	this.title = title
	this.completed = completed

    this.subscribeTransport()
  }

  toggle() {
	this.completed = !this.completed
  }

  destroy() {
	this.store.todos.remove(this)
  }

  setTitle(title) {
	this.title = title
  }

  toJson() {
    return _.pick(this, ["id", "title", "completed"])
  }

  subscribeTransport() {
    var running = false
	autorun(() => {
      this.toJson()
	  if (running === true || this.id === undefined) {
        transport.save(this.id, this.toJson()).then(data => {
          Object.assign(this, _.pick(data, ["id", "title", "completed"]))
        })
      }
	})
    running = true
  }

  static fromJson(store, json) {
	return new Todo(store, json.title, json.completed, json.id)
  }
}
