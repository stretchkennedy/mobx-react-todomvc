const jsonHeaders = new Headers({
  "Content-Type": "application/json"
})

const prefix = "api"

export class JsonAdapter {
  route

  constructor(route) {
    this.route = `/${prefix}/${route}`.replace("//", "/")
  }

  fetchInitial() {
    return fetch(this.route, {method: "GET", headers: jsonHeaders}).then(data => data.json())
  }

  save(id, obj) {
    if (id === undefined) return Promise.reject()

    return fetch(
      `${this.route}/${id}`,
      {method: "PUT", body: JSON.stringify(obj), headers: jsonHeaders}
    )
    .then(data => data.json())
  }

  create(obj) {
    return fetch(
      this.route,
      {method: "POST", body: JSON.stringify(obj), headers: jsonHeaders}
    )
    .then(data => data.json())
  }

  destroy(id) {
    return fetch(`${this.route}/${id}`, {method: "DELETE", headers: jsonHeaders}).then(data => data.json())
  }
}
