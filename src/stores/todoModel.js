import {observable, computed} from 'mobx'
import _ from 'lodash'
import * as Utils from '../utils'
import {createTransport, attachTransport} from '../transport'

var TodoModel = class {
  @observable todos = []

  @computed get activeTodoCount() {
    return this.todos.reduce(
      (sum, todo) => sum + (todo.completed ? 0 : 1),
      0
    )
  }

  @computed get completedCount() {
    return this.todos.length - this.activeTodoCount
  }

  addTodo (title) {
    this.todos.push(new Todo(this, {title, completed: false}))
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

var Todo = class {
  store
  id
  @observable title
  @observable completed

  static EXTERNAL_FIELDS = ["id", "title", "completed"]

  constructor(store, {title, completed, id}) {
    this.store = store
    this.id = id
    this.title = title
    this.completed = completed
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
}

// semi-colon is necessary
;[TodoModel, Todo] = attachTransport({
  collection: {klass: TodoModel, name: "todos"},
  object:     {klass: Todo, fields: Todo.EXTERNAL_FIELDS},
  transport:  createTransport("todos")
})

export { TodoModel, Todo }
