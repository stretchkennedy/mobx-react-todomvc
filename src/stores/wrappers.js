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

        // stop observing object - it's officially dead
        .then(() => objDisposers.get(obj)())

        // put object back in collection
        .catch(() => {
          obj.needsDestroyRetry = true
          this[collectionName] = [...this[collectionName].slice(0, idx), obj, ...this[collectionName].slice(idx)]
        })
      }

      autorun(() => {
        _.differenceBy(old, this[collectionName], "id").forEach(destroy)
        old = this[collectionName].slice()
      })

      //// handle initial data load
      transport.fetchInitial()
      .then((json) => {
        this[collectionName] = json.map(data => objectClass.fromJson(this, data))
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

      const save = () => {
        transport.save(this.id, this.toJson())
        .then(json =>
          transaction(() =>
            this.mergeJson(json)
          )
        )
        .catch(() => {
          this.needsSaveRetry = true
        })
      }

      const disposer = autorun(() => {
        this.toJson()
        if (this.__constructed || this.id === undefined) {
          save()
        }
      })

      objDisposers.set(this, disposer) // allow collection class instances to dispose of observers
      this.__constructed = true
    }
  }

  return [collectionClass, objectClass]
}
