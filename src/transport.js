const jsonHeaders = new Headers({
  "Content-Type": "application/json"
})

const prefix = "api"

class Transport {
  route

  constructor(route) {
    this.route = `/${prefix}/${route}`.replace("//", "/")
  }

  fetchInitial() {
    return fetch(this.route, {method: "GET", headers: jsonHeaders}).then(data => data.json())
  }

  save(id, obj) {
    if (id === undefined) {
      var method = "POST"
      var uri = this.route
    } else {
      var method = "PUT"
      var uri = `${this.route}/${id}`
    }

    return fetch(uri, {method: method, body: JSON.stringify(obj), headers: jsonHeaders}).then(data => data.json())
  }

  destroy(id) {
    return fetch(`${this.route}/${id}`, {method: "DELETE", headers: jsonHeaders}).then(data => data.json())
  }
}

export function createTransport(route) {
  return new Transport(route)
}
