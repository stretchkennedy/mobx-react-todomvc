import {observable, autorun, transaction, when, untracked} from 'mobx'
import 'promise.prototype.finally'

export function attachTransport({
  collection: {klass: collectionClass, name: collectionName},
  object: {klass: objectClass, fields: fields},
  adapter
}) {
  const objDisposerMap = new Map()

  collectionClass = class extends collectionClass {
    @observable loading = false
    @observable needsReload = false
    @observable locallyDestroyed = []
    __old = []

    constructor(...args) {
      super(...args)

      autorun(() => {
        _.difference(this.__old, this[collectionName])
        .forEach(obj => obj.__destroy())

        const newObjs = _.difference(this[collectionName], this.__old)
        newObjs.forEach(obj => obj.store = this)
        newObjs.filter(obj => !obj.isPersisted()).forEach(obj => obj.__create())

        this.__old = this[collectionName].slice()
      })

      //// handle initial data load
      this.reload()
      //setInterval(this.reload.bind(this), 2000)
    }

    reload() {
      this.loading = true
      adapter.fetchInitial()
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
        retained.filter((obj) => !obj.saving).forEach((obj) =>
          obj.__withoutSaving(() =>
            transaction(() => {
              Object.assign(obj, ...remotesById[obj.id])
            })
          )
        )
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
    __autosaveEnabled = false
    __cancelPendingIo

    constructor(...args) {
      super(...args)

      // save when important fields change
      const disposer = autorun(() => {
        _.pick(this, fields) // hack to ensure we observe the relevant fields
        if (this.__autosaveEnabled) this.__save() // don't save when creating already saved objects
      })

      objDisposerMap.set(this, disposer)
      this.__autosaveEnabled = true
    }

    isPersisted() {
      return this.id !== undefined
    }

    __destroy() {
      // remember index of object
      const idx = Math.max(this.store.__old.indexOf(this), 0)

      // wait until current IO is finished
      this.__setNextIO(() => {
        // destroy thisect
        this.store.locallyDestroyed.push(this)
        this.destroying = true

        adapter.destroy(this.id)
        .then(() => {
          delete this.id
          this.retryDestroy = null
          objDisposerMap.get(this)()           // stop observing object - it's officially dead
          objDisposerMap.delete(this)
        })
        .finally(() => {
          this.destroying = false
          this.store.locallyDestroyed.remove(this)
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
