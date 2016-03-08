const jsonHeaders = new Headers({
  "Content-Type": "application/json"
})

const prefix = "api"

class Transport {
  route

  constructor(route) {
    this.route = `/${prefix}/${route}`.replace("//", "/")
  }

  fetchAll() {
    return fetch(this.route, {method: "GET", headers: jsonHeaders}).then(data => data.json())
  }

  save(obj) {
    if (obj.id === undefined) {
      var method = "POST"
      var uri = this.route
    } else {
      var method = "PUT"
      var uri = `${this.route}/${obj.id}`
    }

    fetch(uri, {method: method, body: JSON.stringify(obj.toJson()), headers: jsonHeaders})
    .then(data => data.json())
    .then(json => Object.assign(obj, json))
  }
}

export function createTransport(route) {
  return new Transport(route)
}
