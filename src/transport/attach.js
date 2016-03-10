import {observable, autorun, transaction, when, untracked} from 'mobx'
import 'promise.prototype.finally'

export function attachTransport({
  collection: {klass: collectionClass, name: collectionName},
  object: {klass: objectClass, fields: fields},
  transport
}) {
  const objDisposerMap = new Map()

  collectionClass = class extends collectionClass {
    @observable loading = false
    @observable needsReload = false
    @observable locallyDestroyed = []

    constructor(...args) {
      super(...args)

      //// handle destruction
      var old = []
      const destroy = (obj) => {

        // remember index of object
        const idx = Math.max(old.indexOf(obj), 0)

        // wait until current
        obj.__setNextIO(() => {
          // don't destroy objects already being destroyed
          if (obj.destroying) {
            return
          }
          // final cleanup once we know the object is gone
          const cleanup = () => {
            obj.needsDestroyRetry = false
            objDisposerMap.get(obj)()           // stop observing object - it's officially dead
            objDisposerMap.delete(obj)
          }

          // clean up objects that haven't been saved and aren't being saved immediately
          if (!obj.isPersisted()) {
            cleanup()
            return
          }

          // destroy object
          this.locallyDestroyed.push(obj)
          obj.destroying = true

          transport.destroy(obj.id)
          .finally(() => {
            obj.destroying = false
            this.locallyDestroyed.remove(obj)
          })
          .then(cleanup)
          .catch(() => {
            obj.needsDestroyRetry = true
            this[collectionName] = [           // put object back in collection
              ...this[collectionName].slice(0, idx),
              obj,
              ...this[collectionName].slice(idx)
            ]
          })
        })
      }

      autorun(() => {
        _.difference(old, this[collectionName]).forEach(destroy)
        old = this[collectionName].slice()
      })

      //// handle initial data load
      this.reload()
      setInterval(this.reload.bind(this), 2000)
    }

    reload() {
      this.loading = true
      transport.fetchInitial()
      .then((json) => {
        const persisted = this[collectionName].filter((obj) => obj.isPersisted())
        const unpersisted = this[collectionName].filter((obj) => !obj.isPersisted())
        const remotes = json.map((data) => _.pick(data, fields))

        // calculate newly added objects, without locally deleted objects
        const added = _.differenceBy(json, persisted.concat(...this.locallyDestroyed), "id").map((data) => {
          return new objectClass(this, _.pick(data, fields))
        })

        // merge new objects unless the old objects are saving
        const retained = _.intersectionBy(persisted, json, "id")
        const remotesById = _.groupBy(remotes, "id")
        transaction(() => {
          retained.filter((obj) => !obj.saving).forEach((obj) => {
            Object.assign(obj, ...remotesById[obj.id])
          })
          this[collectionName] = _.sortBy(retained.concat(added), "id").concat(unpersisted)
        })
        this.needsReload = false
      })
      .finally(() => this.loading = false)
      .catch(() => {
        this.needsReload = true
      })
    }
  }


  objectClass = class extends objectClass {
    @observable saving = false
    @observable destroying = false
    @observable needsSaveRetry = false
    @observable needsDestroyRetry = false
    __constructed = false
    __cancelPendingIo

    constructor(...args) {
      super(...args)

        // save when important fields change
      const disposer = autorun(() => {
        _.pick(this, fields) // hack to ensure we observe the relevant fields
        if (!this.__constructed && this.isPersisted()) return // don't save when creating already saved objects
        this.save()
      })
      objDisposerMap.set(this, disposer)
      this.__constructed = true
    }

    save() {
      this.__setNextIO(() => {
        this.saving = true

        transport.save(this.id, _.pick(this, fields))
        .then(json => Object.assign(this, _.pick(json, fields), {needsSaveRetry: false}))
        .finally(() => this.saving = false)
        .catch(() => this.needsSaveRetry = true)
      })
    }

    __setNextIO(f) {
      if (this.destroying) return false // don't allow io operations to be queued after destruction
      this.__cancelPendingIo && this.__cancelPendingIo()
      this.__cancelPendingIo = when(() => !this.saving, f)
      return true
    }

    isPersisted() {
      return this.id !== undefined
    }
  }


  return [collectionClass, objectClass]
}
