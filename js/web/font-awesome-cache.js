/**
 * Cache fontawesome Unicode codepoints.
 * Stores a mapping of CSS class name -> Unicode codepoint.
 */
class FACache {
  constructor() {
    this.cache = {};
  }

  /**
   * Get or compute a codepoint for a given class name.
   * @param {string} className - CSS classname
   * @returns {string} Unicode codepoint
   */
  get(className) {
    if (this.cache.hasOwnProperty(className)) {
      return this.cache[className];
    }

    let elem = document.createElement('i');
    elem.classList.add('fa', className);

    // element must be part of the document before we can grab its computed properties
    document.body.appendChild(elem);

    let style = window.getComputedStyle(elem, ':before');
    this.cache[className] = style.content.replace(/^"?(.*?)"?$/, '$1');

    document.body.removeChild(elem);

    return this.cache[className];
  }
}

module.exports = new FACache();
