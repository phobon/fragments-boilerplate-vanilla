class Router {
  constructor(routeHandler) {
    this.routeHandler = routeHandler
    this.currentRoute = null
    this.init()
  }

  // Initialize router and listen for hash changes
  init() {
    // Handle initial load
    this.handleRoute()

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
      this.handleRoute()
    })
  }

  // Parse current hash and execute route handler
  handleRoute() {
    const hash = window.location.hash.slice(1) // Remove #
    const path = hash || '/'

    this.currentRoute = path

    // Call the route handler with the current path
    if (this.routeHandler) {
      this.routeHandler(path)
    }
  }

  // Navigate to a route
  navigate(path) {
    window.location.hash = path
  }

  // Get current route
  getCurrentRoute() {
    return this.currentRoute
  }
}

export default Router
