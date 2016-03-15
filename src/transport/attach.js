import {observable, observe, autorun, when} from 'mobx'
import 'promise.prototype.finally'

export function attachTransport({
  collection: {klass: collectionClass, name: collectionName},
  object: {klass: objectClass, fields: fields},
  adapter
}) {
  collectionClass = class extends collectionClass {
    @observable loading = false
    @observable needsReload = false
    @observable locallyDestroyed = []
    __old = []

    constructor(...args) {
      super(...args)

      //// handle initial data load
      this.reload()
      .then(() => {
        autorun(() => {
          _.difference(this.__old, this[collectionName]).forEach(obj => obj.__destroy())

          const newObjs = _.difference(this[collectionName], this.__old)
          newObjs.filter(obj => !obj.isPersisted()).forEach(obj => obj.__create())
          newObjs.forEach(obj => obj.__attachStore(this))

          this.__old = this[collectionName].slice()
        })

        //setInterval(this.reload.bind(this), 2000)
      })
    }

    reload() {
      this.loading = true
      return adapter.fetchInitial()
      .then((json) => {
        const persisted = this[collectionName].filter((obj) => obj.isPersisted())
        const unpersisted = this[collectionName].filter((obj) => !obj.isPersisted())
        const remotes = json.map((data) => _.pick(data, fields))

        // calculate newly added objects, without locally deleted objects
        const added = _.differenceBy(json, persisted.concat(...this.locallyDestroyed), "id").map((data) => {
          return new objectClass(_.pick(data, fields))
        })

        // merge new objects unless the old objects are saving
        const retained = _.intersectionBy(persisted, json, "id")
        const remotesById = _.groupBy(remotes, "id")
        retained.filter((obj) => !obj.saving).forEach((obj) => {
          Object.assign(obj, ...remotesById[obj.id])
        })

        this[collectionName] = _.sortBy(retained.concat(added), "id").concat(unpersisted)
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
    @observable creating = false
    @observable retrySave
    @observable retryDestroy
    @observable retryCreate
    store
    __autosaveEnabled = false
    __cancelPendingIo
    __disposer


    isPersisted() {
      return this.id !== undefined
    }


    __attachStore(store) {
      this.store = store
      this.__disposer = observe(this, (change) => {
        if(this.__autosaveEnabled && fields.some(field => field === change.name)) {
          this.__save()
        }
      })
      this.__autosaveEnabled = true
    }


    __detachStore() {
      this.__autosaveEnabled = false
      this.__disposer()
      delete this.__disposer
      delete this.store
    }


    __destroy() {
      this.__autosaveEnabled = false

      // remember index of object
      const idx = Math.max(this.store.__old.indexOf(this), 0)

      // wait until current IO is finished
      this.__setNextIO(() => {
        // destroy thisect
        this.store.locallyDestroyed.push(this)
        this.destroying = true

        adapter.destroy(this.id)
        .finally(() => {
          this.destroying = false
          this.store.locallyDestroyed.remove(this)
        })
        .then(() => {
          this.retryDestroy = null
          this.__detachStore()
          delete this.id
        })
        .catch(() => {
          this.retryDestroy = this.__destroy.bind(this)
          this.store[collectionName] = [           // put object back in collection
            ...this.store[collectionName].slice(0, idx),
            this,
            ...this.store[collectionName].slice(idx)
          ]
        })
      })
    }


    __save() {
      this.__setNextIO(() => {
        if (!this.isPersisted()) throw new Error("tried to save unpersisted object")
        this.saving = true

        adapter.save(this.id, _.pick(this, fields))
        .finally(() => {
          this.retrySave = null
          this.saving = false
        })
        .catch(() => this.retrySave = this.__save.bind(this))
      })
    }


    __create() {
      this.__setNextIO(() => {
        if(this.isPersisted()) return

        this.creating = true
        adapter.create(_.pick(this, fields))
        .then(data => {
          this.id = data.id
          this.retryCreate = null
        })
        .finally(() => this.creating = false)
        .catch(() => this.retryCreate = this.__create.bind(this))
      })
    }


    __setNextIO(f) {
      if (this.destroying) return false // don't allow io operations to be queued after destruction

      const autosaveWasEnabled = this.__autosaveEnabled
      this.__cancelPendingIo && this.__cancelPendingIo()
      this.__cancelPendingIo = when(
        () => !this.saving,
        () => {
          if (!this.store) return
          autosaveWasEnabled ? f() : this.__withoutSaving(f)
        }
      )
      return true
    }


    __withoutSaving(f) {
      const oldValue = this.__autosaveEnabled
      this.__autosaveEnabled = false
      f()
      this.__autosaveEnabled = oldValue
    }
  }


  return [collectionClass, objectClass]
}
