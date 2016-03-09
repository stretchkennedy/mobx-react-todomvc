import {observable, autorun, transaction} from 'mobx'

export function attachTransport({
  collection: {klass: collectionClass, name: collectionName},
  object: {klass: objectClass, fields: fields},
  transport
}) {
  const objDisposers = new Map()


  collectionClass = class extends collectionClass {
    constructor(...args) {
      super(...args)

      //// handle destruction
      var old = []
      const destroy = (obj) => {
        const idx = Math.max(old.indexOf(obj), 0)

        transport.destroy(obj.id)
        .then(() => objDisposers.get(obj)()) // stop observing object - it's officially dead
        .catch(() => {                       // put object back in collection
          obj.needsDestroyRetry = true
          this[collectionName] = [...this[collectionName].slice(0, idx), obj, ...this[collectionName].slice(idx)]
        })
      }

      autorun(() => {
        _.differenceBy(old, this[collectionName], "id").forEach(destroy)
        old = this[collectionName].slice()
      })

      //// handle initial data load
      this.reload()
    }

    reload() {
      transport.fetchInitial()
      .then((json) => {
        this[collectionName] = json.map(data => new objectClass(this, _.pick(data, fields)))
      })
      .catch(() => {
        alert("page failed to load!")
      })
    }
  }


  objectClass = class extends objectClass {
    @observable needsSaveRetry = false
    @observable needsDestroyRetry = false
    __constructed = false

    constructor(...args) {
      super(...args)

      const disposer = autorun(() => {
        _.pick(this, fields) // hack to force update
        if (this.__constructed || this.id === undefined) {
          this.save()
        }
      })

      objDisposers.set(this, disposer) // allow collection class instances to dispose of observers
      this.__constructed = true
    }

    save() {
      transport.save(this.id, _.pick(this, fields))
      .then(json => {
        transaction(() => {
          Object.assign(this, _.pick(json, fields))
          this.needsSaveRetry = false
        })
      })
      .catch(() => {
        this.needsSaveRetry = true
      })
    }
  }

  return [collectionClass, objectClass]
}
