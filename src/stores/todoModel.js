import {observable, computed, autorun, autorunAsync} from 'mobx'
import _ from 'lodash'
import * as Utils from '../utils'
import {createTransport} from '../transport'

const transport = createTransport("todos")

const AUTORUN_DELAY = 500

export class TodoModel {
  @observable todos = []

  constructor() {
    this.readFromTransport()
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

  readFromTransport() {
    transport.fetchAll()
    .then((json) => {
      this.todos = json.map(data => Todo.fromJson(this, data))
      console.log("loaded")
    })
    .catch(() => {
      alert("page failed to load!")
      console.log("failed to load")
    })
  }

  subscribeTransport() {
    var oldTodos = []

    const destroy = (todo) => {
      const idx = Math.max(oldTodos.indexOf(todo), 0)
      transport.destroy(todo.id)
      .then(() => todo.dispose())
      .catch(() => {
        todo.needsDestroyRetry = true
        this.todos = [...this.todos.slice(0, idx), todo, ...this.todos.slice(idx)]
      })
    }

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
  @observable needsSaveRetry = false
  @observable needsDestroyRetry = false

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
    var lastSave
    const save = () => {
      lastSave = transport.save(this.id, this.toJson()).then(data => {
        Object.assign(this, _.pick(data, ["id", "title", "completed"]))
      })
      lastSave.catch(() => {
        this.lastSave = null
        this.needsSaveRetry = true
        console.log("failed to save")
      })
    }

    var firstTime = true
    this.autorunDisposer = autorunAsync(() => {
      // if this is the first run, do nothing
      if (firstTime === true) return

      // if we're already saving, wait until we're finished
      lastSave ? lastSave.then(save) : save()
    }, AUTORUN_DELAY)
    firstTime = false

    // if we don't have an id, save for the first time
    if (this.id === undefined) save()
  }

  dispose() {
    this.autorunDisposer && this.autorunDisposer()
  }

  static fromJson(store, json) {
    return new Todo(store, json.title, json.completed, json.id)
  }
}
