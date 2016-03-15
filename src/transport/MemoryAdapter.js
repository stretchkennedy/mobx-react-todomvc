export class MemoryAdapter {
  constructor(data=[]) {
    this.data = data
  }

  fetchInitial() {
    return Promise.resolve(this.data)
  }

  save(id, obj) {
    if (id === undefined) return Promise.reject()

    return new Promise(resolve => {
      const i = this.data.findIndex(d => d.id === id)
      this.data[i] = obj
      resolve(obj)
    })
  }

  create(obj) {
    return new Promise(resolve => {
      const largestId = this.data.map(d => d.id).reduce((a, b) => Math.max(a, b), 0)
      obj.id = largestId + 1
      this.data.push(obj)
      resolve(obj)
    })
  }

  destroy(id) {
    return new Promise(resolve => {
      var destroyed
      this.data = this.data.filter(datum => {
        if (datum.id !== id) {
          return true
        } else {
          destroyed = datum
          return false
        }
      })
      resolve(destroyed)
    })
  }
}
