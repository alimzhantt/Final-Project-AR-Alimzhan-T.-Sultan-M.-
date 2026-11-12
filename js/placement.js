// Source: WebXR Hit Test API — https://immersive-web.github.io/hit-test/

AFRAME.registerComponent('furniture-placer', {
  schema: {
    reticle: { type: 'selector' }
  },

  init: function () {
    this.hitTestSource = null;
    this.session = null;
    this.pendingItem = null;
    this.placedEl = null;
    this.placedItem = null;
    this.extraYaw = 0;
    this.doorsOpen = false;
    this.surfaceFound = false;

    this.onSelect = this.onSelect.bind(this);
    this.el.addEventListener('enter-vr', this.startHitTest.bind(this));
    this.el.addEventListener('exit-vr', this.stopHitTest.bind(this));
  },

  startHitTest: async function () {
    if (!this.el.is('ar-mode')) return;
    const session = this.el.renderer.xr.getSession();
    if (!session) return;
    this.session = session;
    this.surfaceFound = false;

    try {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    } catch (err) {
      this.el.emit('placer-message', { text: 'Hit-test недоступен: ' + err.message });
      return;
    }
    session.addEventListener('select', this.onSelect);
  },

  stopHitTest: function () {
    if (this.hitTestSource) this.hitTestSource.cancel();
    this.hitTestSource = null;
    if (this.session) this.session.removeEventListener('select', this.onSelect);
    this.session = null;
    this.data.reticle.object3D.visible = false;
  },

  tick: function () {
    const frame = this.el.frame;
    if (!frame || !this.hitTestSource) return;

    const refSpace = this.el.renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(this.hitTestSource);
    const reticle = this.data.reticle.object3D;

    if (hits.length > 0) {
      const pose = hits[0].getPose(refSpace);
      if (!pose) return;
      const p = pose.transform.position;
      const o = pose.transform.orientation;
      reticle.position.set(p.x, p.y, p.z);
      reticle.quaternion.set(o.x, o.y, o.z, o.w);
      reticle.visible = true;
      if (!this.surfaceFound) {
        this.surfaceFound = true;
        this.el.emit('surface-found');
      }
    } else {
      reticle.visible = false;
    }
  },

  setItem: function (item) {
    this.pendingItem = item;
  },

  onSelect: function () {
    if (!this.data.reticle.object3D.visible) {
      this.el.emit('placer-message', { text: 'Пол ещё не найден — медленно поводите телефоном.' });
      return;
    }
    if (this.pendingItem) {
      this.spawn(this.pendingItem);
      this.pendingItem = null;
      this.moveToReticle();
      this.el.emit('item-placed', { item: this.placedItem });
      return;
    }
    if (this.placedEl) {
      this.moveToReticle();
      this.el.emit('item-moved', { item: this.placedItem });
      return;
    }
    this.el.emit('placer-message', { text: 'Сначала выберите товар голосом, поиском или в каталоге.' });
  },

  spawn: function (item) {
    if (this.placedEl && this.placedEl.parentNode) {
      this.placedEl.parentNode.removeChild(this.placedEl);
    }
    const el = document.createElement('a-entity');
    el.classList.add('furniture');
    this.placedEl = el;
    this.placedItem = item;
    this.extraYaw = 0;
    this.doorsOpen = false;

    if (item.model) {
      el.addEventListener('model-loaded', () => this.fitToRealSize(el, item), { once: true });
      el.addEventListener('model-error', () => this.addPlaceholder(el, item), { once: true });
      el.setAttribute('gltf-model', item.model);
    } else {
      this.addPlaceholder(el, item);
    }
    this.el.appendChild(el);
  },

  fitToRealSize: function (el, item) {
    const mesh = el.getObject3D('mesh');
    if (!mesh) return;
    const obj = el.object3D;

    const savedPos = obj.position.clone();
    const savedRot = obj.rotation.clone();
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    obj.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = size.x > 0 ? item.width / size.x : 1;

    mesh.scale.setScalar(s);
    mesh.position.set(-center.x * s, -box.min.y * s, -center.z * s);

    obj.position.copy(savedPos);
    obj.rotation.copy(savedRot);
    obj.updateMatrixWorld(true);
  },

  addPlaceholder: function (el, item) {
    const box = document.createElement('a-box');
    box.setAttribute('width', item.width);
    box.setAttribute('depth', item.depth);
    box.setAttribute('height', item.height);
    box.setAttribute('position', { x: 0, y: item.height / 2, z: 0 });
    box.setAttribute('material', { color: item.hex || '#bbbbbb', opacity: 0.9, transparent: true });
    el.appendChild(box);
  },

  moveToReticle: function () {
    if (!this.placedEl) return;
    const p = this.data.reticle.object3D.position;
    const camPos = new THREE.Vector3();
    this.el.camera.getWorldPosition(camPos);
    const yawDeg = THREE.MathUtils.radToDeg(Math.atan2(camPos.x - p.x, camPos.z - p.z));

    this.placedEl.setAttribute('position', { x: p.x, y: p.y, z: p.z });
    this.placedEl.setAttribute('rotation', { x: 0, y: yawDeg + this.extraYaw, z: 0 });
  },

  rotateBy: function (deg) {
    if (!this.placedEl) return;
    this.extraYaw += deg;
    const r = this.placedEl.getAttribute('rotation');
    this.placedEl.setAttribute('rotation', { x: 0, y: r.y + deg, z: 0 });
  },

  toggleDoors: function () {
    const item = this.placedItem;
    if (!this.placedEl || !item || !item.animated) return null;
    this.doorsOpen = !this.doorsOpen;
    const clip = this.doorsOpen ? (item.clipOpen || '*') : (item.clipClose || '*');
    this.placedEl.removeAttribute('animation-mixer');
    this.placedEl.setAttribute('animation-mixer', {
      clip: clip, loop: 'once', clampWhenFinished: true, crossFadeDuration: 0
    });
    return this.doorsOpen;
  }
});

AFRAME.registerComponent('fps-meter', {
  schema: { target: { type: 'selector' } },

  init: function () {
    this.frames = 0;
    this.last = performance.now();
    this.samples = [];
  },

  tick: function () {
    this.frames++;
    const now = performance.now();
    if (now - this.last < 1000) return;
    const fps = this.frames * 1000 / (now - this.last);
    this.frames = 0;
    this.last = now;
    if (this.data.target) this.data.target.textContent = Math.round(fps) + ' fps';
    if (this.el.is('ar-mode')) this.samples.push(fps);
  },

  summary: function () {
    if (!this.samples.length) return null;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return { avg: avg, min: Math.min.apply(null, this.samples), seconds: this.samples.length };
  }
});