/**
 * Simple Pan-Zoom Component
 * No dependencies - pure vanilla JavaScript
 * Works entirely in the browser for GitHub Pages deployment
 */

export class PanZoom {
  constructor(container) {
    this.container = container;
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.minScale = 0.1;
    this.maxScale = 10;

    this.setupEventListeners();
    this.updateTransform();
  }

  setupEventListeners() {
    // Mouse wheel for zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * delta));

      // Zoom towards cursor position
      const scaleDiff = newScale - this.scale;
      this.translateX -= (x - this.translateX) * (scaleDiff / this.scale);
      this.translateY -= (y - this.translateY) * (scaleDiff / this.scale);
      this.scale = newScale;

      this.updateTransform();
    }, { passive: false });

    // Mouse drag for pan
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left mouse button
      this.isDragging = true;
      this.startX = e.clientX - this.translateX;
      this.startY = e.clientY - this.translateY;
      this.container.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      this.translateX = e.clientX - this.startX;
      this.translateY = e.clientY - this.startY;
      this.updateTransform();
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.style.cursor = 'grab';
      }
    });

    // Touch support for mobile
    let lastTouchDistance = 0;

    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.startX = e.touches[0].clientX - this.translateX;
        this.startY = e.touches[0].clientY - this.translateY;
      } else if (e.touches.length === 2) {
        lastTouchDistance = this.getTouchDistance(e.touches);
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      e.preventDefault();

      if (e.touches.length === 1 && this.isDragging) {
        this.translateX = e.touches[0].clientX - this.startX;
        this.translateY = e.touches[0].clientY - this.startY;
        this.updateTransform();
      } else if (e.touches.length === 2) {
        const distance = this.getTouchDistance(e.touches);
        const delta = distance / lastTouchDistance;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * delta));

        const rect = this.container.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const scaleDiff = newScale - this.scale;
        this.translateX -= (centerX - this.translateX) * (scaleDiff / this.scale);
        this.translateY -= (centerY - this.translateY) * (scaleDiff / this.scale);
        this.scale = newScale;

        lastTouchDistance = distance;
        this.updateTransform();
      }
    }, { passive: false });

    this.container.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Initial cursor
    this.container.style.cursor = 'grab';
  }

  getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  updateTransform() {
    const content = this.container.querySelector('.pan-zoom-content');
    if (content) {
      content.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
    }
  }

  reset() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.updateTransform();
  }

  zoomIn() {
    const newScale = Math.min(this.maxScale, this.scale * 1.2);
    this.scale = newScale;
    this.updateTransform();
  }

  zoomOut() {
    const newScale = Math.max(this.minScale, this.scale * 0.8);
    this.scale = newScale;
    this.updateTransform();
  }

  fitToView() {
    const content = this.container.querySelector('.pan-zoom-content');
    if (!content) return;

    const containerRect = this.container.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();

    const scaleX = containerRect.width / contentRect.width;
    const scaleY = containerRect.height / contentRect.height;

    this.scale = Math.min(scaleX, scaleY, 1) * 0.9;
    this.translateX = (containerRect.width - contentRect.width * this.scale) / 2;
    this.translateY = (containerRect.height - contentRect.height * this.scale) / 2;

    this.updateTransform();
  }

  getTransform() {
    return {
      scale: this.scale,
      translateX: this.translateX,
      translateY: this.translateY
    };
  }

  toWorld(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const x = (clientX - rect.left - this.translateX) / this.scale;
    const y = (clientY - rect.top - this.translateY) / this.scale;
    return { wx: x, wy: y };
  }
}
