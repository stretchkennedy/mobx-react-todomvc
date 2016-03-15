import {observable, computed} from 'mobx'
import _ from 'lodash'
import * as Utils from '../utils'
import {JsonAdapter, attachTransport} from '../transport'

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
    this.todos.push(new Todo({title, completed: false}))
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
  id
  @observable title
  @observable completed

  static EXTERNAL_FIELDS = ["id", "title", "completed"]

  constructor({title, completed, id}) {
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
  adapter:    new JsonAdapter("todos")
})

export { TodoModel, Todo }
