import './index.css'

class SketchesDropdown {
  constructor() {
    this.isVisible = false
    this.sketches = []
    this.dropdownRef = null
    this.init()
  }

  async init() {
    await this.loadSketches()
    this.createDropdown()
    this.attachEventListeners()
  }

  async loadSketches() {
    // Use the same glob pattern as the sketches route
    const sketchesGlob = import.meta.glob('../sketches/**/*.js', {
      eager: true,
    })

    console.log('Found sketches:', Object.keys(sketchesGlob))

    this.sketches = Object.keys(sketchesGlob).map((filePath) => {
      // Convert file path to URL path
      // ../sketches/flare-1.js -> flare-1
      // ../sketches/noise/dawn-1.js -> noise/dawn-1
      const relativePath = filePath.replace('../sketches/', '').replace('.js', '')
      const url = `/sketches/${relativePath}`

      // Extract name from path (last part before extension)
      const name = relativePath.split('/').pop() || relativePath

      return {
        name,
        path: `/${relativePath}`,
        url,
      }
    })

    console.log('Processed sketches:', this.sketches)
  }

  createDropdown() {
    // Create the overlay container
    const overlay = document.createElement('div')
    overlay.className = 'sketches-overlay'

    // Create the toggle container
    const toggle = document.createElement('div')
    toggle.className = 'sketches-toggle'

    // Create the button
    const button = document.createElement('button')
    button.className = 'sketches-toggle__button'
    button.textContent = 'Sketches'
    button.addEventListener('click', () => this.toggleSketches())

    // Create the dropdown
    const dropdown = document.createElement('div')
    dropdown.className = 'sketches-dropdown'
    dropdown.style.display = 'none'

    const content = document.createElement('div')
    content.className = 'sketches-dropdown__content'

    const list = document.createElement('div')
    list.className = 'sketches-list'

    const grid = document.createElement('div')
    grid.className = 'sketches-list__grid'

    // Create sketch cards
    if (this.sketches.length === 0) {
      const noSketches = document.createElement('div')
      noSketches.className = 'sketch-card'
      noSketches.textContent = 'No sketches found'
      grid.appendChild(noSketches)
    } else {
      this.sketches.forEach((sketch) => {
        const card = document.createElement('a')
        card.className = 'sketch-card'
        card.href = `#${sketch.url}`
        card.addEventListener('click', (e) => {
          e.preventDefault()
          this.navigateToSketch(sketch.url)
          this.hideSketches()
        })

        const title = document.createElement('h3')
        title.className = 'sketch-card__title'
        title.textContent = sketch.name

        const path = document.createElement('div')
        path.className = 'sketch-card__path'
        path.textContent = sketch.path

        card.appendChild(title)
        card.appendChild(path)
        grid.appendChild(card)
      })
    }

    list.appendChild(grid)
    content.appendChild(list)
    dropdown.appendChild(content)
    toggle.appendChild(button)
    toggle.appendChild(dropdown)
    overlay.appendChild(toggle)

    // Store references
    this.dropdownRef = toggle
    this.dropdown = dropdown
    this.overlay = overlay

    // Add to DOM
    document.body.appendChild(overlay)
  }

  attachEventListeners() {
    // Handle click outside to close dropdown
    document.addEventListener('mousedown', (event) => {
      if (this.isVisible && this.dropdownRef && !this.dropdownRef.contains(event.target)) {
        this.hideSketches()
      }
    })
  }

  toggleSketches() {
    console.log('Toggle clicked, current state:', this.isVisible)
    if (this.isVisible) {
      this.hideSketches()
    } else {
      this.showSketches()
    }
  }

  showSketches() {
    console.log('Showing sketches dropdown')
    this.isVisible = true
    this.dropdown.style.display = 'block'
  }

  hideSketches() {
    console.log('Hiding sketches dropdown')
    this.isVisible = false
    this.dropdown.style.display = 'none'
  }

  navigateToSketch(url) {
    // Use the existing router navigation
    if (window.router) {
      window.router.navigate(url)
    } else {
      // Fallback to hash navigation
      window.location.hash = url
    }
  }

  destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay)
    }
  }
}

export default SketchesDropdown
