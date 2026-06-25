// Prewbalus.js - موتور بازی سه‌بعدی با CSS 3D و Canvas 2D (نسخه‌ی نهایی)
(function (global) {
    'use strict';

    // ========== کلاس‌های ریاضی ==========
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x; this.y = y; this.z = z;
        }
        set(x, y, z) {
            this.x = x; this.y = y; this.z = z;
            return this;
        }
        clone() { return new Vector3(this.x, this.y, this.z); }
        add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
        sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
        multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
        length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
        normalize() { const l = this.length(); if (l > 0) this.multiplyScalar(1 / l); return this; }
        dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
        cross(v) { return new Vector3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
        lerp(v, t) { return new Vector3(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.z + (v.z - this.z) * t); }
        distanceTo(v) { return this.clone().sub(v).length(); }
        copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
        static addVectors(a, b) { return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z); }
        static subVectors(a, b) { return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z); }
        static lerpVectors(a, b, t) { return a.clone().lerp(b, t); }
    }

    class Euler {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x; this.y = y; this.z = z;
        }
        clone() { return new Euler(this.x, this.y, this.z); }
        copy(e) { this.x = e.x; this.y = e.y; this.z = e.z; return this; }
    }

    // ========== کلاس Material ==========
    class Material {
        constructor(options = {}) {
            this.color = options.color || '#3498db';
            this.map = options.map || null;
            this.opacity = options.opacity || 1;
            this.border = options.border || '1px solid #2c3e50';
            this.emissive = options.emissive || false;
            this.shininess = options.shininess || 0;
        }
    }

    // ========== کلاس BoxGeometry ==========
    class BoxGeometry {
        constructor(width = 1, height = 1, depth = 1) {
            this.width = width;
            this.height = height;
            this.depth = depth;
            this.faces = [
                { pos: [0, 0, depth / 2], rot: [0, 0, 0], size: [width, height] },
                { pos: [0, 0, -depth / 2], rot: [0, Math.PI, 0], size: [width, height] },
                { pos: [width / 2, 0, 0], rot: [0, Math.PI / 2, 0], size: [depth, height] },
                { pos: [-width / 2, 0, 0], rot: [0, -Math.PI / 2, 0], size: [depth, height] },
                { pos: [0, -height / 2, 0], rot: [-Math.PI / 2, 0, 0], size: [width, depth] },
                { pos: [0, height / 2, 0], rot: [Math.PI / 2, 0, 0], size: [width, depth] }
            ];
        }
    }

    // ========== کلاس Object3D ==========
    class Object3D {
        constructor() {
            this.position = new Vector3();
            this.rotation = new Euler();
            this.scale = new Vector3(1, 1, 1);
            this.parent = null;
            this.children = [];
            this.element = null;
            this.userData = {};
            this.visible = true;
        }

        add(child) {
            if (child.parent) child.parent.remove(child);
            child.parent = this;
            this.children.push(child);
            if (this.element && child.element) {
                this.element.appendChild(child.element);
            }
        }

        remove(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) {
                this.children.splice(index, 1);
                child.parent = null;
                if (this.element && child.element) {
                    this.element.removeChild(child.element);
                }
            }
        }

        getCSSMatrix() {
            const p = this.position;
            const r = this.rotation;
            const s = this.scale;
            return `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateX(${r.x}rad) rotateY(${r.y}rad) rotateZ(${r.z}rad) scale3d(${s.x}, ${s.y}, ${s.z})`;
        }

        updateTransform() {
            if (this.element && this.visible) {
                this.element.style.transform = this.getCSSMatrix();
                this.element.style.display = 'block';
            } else if (this.element) {
                this.element.style.display = 'none';
            }
        }

        rotateX(angle) { this.rotation.x += angle; return this; }
        rotateY(angle) { this.rotation.y += angle; return this; }
        rotateZ(angle) { this.rotation.z += angle; return this; }
        translate(x, y, z) { this.position.x += x; this.position.y += y; this.position.z += z; return this; }
    }

    // ========== کلاس Mesh ==========
    class Mesh extends Object3D {
        constructor(geometry, material) {
            super();
            this.geometry = geometry;
            this.material = material;
            this.build();
        }

        build() {
            const container = document.createElement('div');
            container.style.cssText = `
                position: absolute;
                transform-style: preserve-3d;
                width: 0;
                height: 0;
                top: 0;
                left: 0;
                pointer-events: none;
            `;
            this.element = container;

            const geo = this.geometry;
            const mat = this.material;
            const w = geo.width;
            const h = geo.height;
            const d = geo.depth;

            geo.faces.forEach(face => {
                const faceDiv = document.createElement('div');
                const [px, py, pz] = face.pos;
                const [rx, ry, rz] = face.rot;
                const [fw, fh] = face.size;

                let bg = mat.color;
                if (mat.map) {
                    bg = `url(${mat.map})`;
                }
                if (mat.emissive) {
                    bg = `${mat.color}80`;
                }

                faceDiv.style.cssText = `
                    position: absolute;
                    width: ${fw}px;
                    height: ${fh}px;
                    background: ${bg};
                    background-size: cover;
                    border: ${mat.border};
                    opacity: ${mat.opacity};
                    transform: translate3d(${px}px, ${py}px, ${pz}px) rotateX(${rx}rad) rotateY(${ry}rad) rotateZ(${rz}rad);
                    backface-visibility: visible;
                    box-sizing: border-box;
                    ${mat.emissive ? 'box-shadow: inset 0 0 30px rgba(255,255,255,0.5);' : ''}
                `;
                container.appendChild(faceDiv);
            });
        }
    }

    // ========== کلاس Camera ==========
    class Camera {
        constructor(options = {}) {
            this.position = new Vector3(0, 0, 500);
            this.rotation = new Euler(0, 0, 0);
            this.fov = options.fov || 60;
            this.near = options.near || 1;
            this.far = options.far || 2000;
            this.aspect = 1;
        }

        getCSSMatrix() {
            const p = this.position;
            const r = this.rotation;
            return `translate3d(${-p.x}px, ${-p.y}px, ${-p.z}px) rotateX(${r.x}rad) rotateY(${r.y}rad) rotateZ(${r.z}rad)`;
        }

        updateAspect(width, height) {
            this.aspect = width / height;
        }
    }

    // ========== کلاس Scene ==========
    class Scene {
        constructor() {
            this.objects = [];
            this.camera = new Camera();
            this.group = document.createElement('div');
            this.group.style.cssText = `
                transform-style: preserve-3d;
                width: 0;
                height: 0;
                position: absolute;
                top: 50%;
                left: 50%;
            `;
            this.background = '#1a1a2e';
        }

        add(object) {
            this.objects.push(object);
            if (object.element) {
                this.group.appendChild(object.element);
            }
            object.parent = this;
        }

        remove(object) {
            const index = this.objects.indexOf(object);
            if (index !== -1) {
                this.objects.splice(index, 1);
                if (object.element && object.element.parentNode === this.group) {
                    this.group.removeChild(object.element);
                }
                object.parent = null;
            }
        }

        update(deltaTime) {
            for (const obj of this.objects) {
                if (obj.update) obj.update(deltaTime);
            }
        }

        render() {
            this.group.style.transform = this.camera.getCSSMatrix();
            for (const obj of this.objects) {
                obj.updateTransform();
            }
        }
    }

    // ========== کلاس Engine ==========
    class Engine {
        constructor(options = {}) {
            this.container = options.container || document.body;
            this.scene = null;
            this.canvas = null;
            this.ctx = null;
            this.running = false;
            this.lastTime = 0;
            this.deltaTime = 0;

            this.keys = {};
            this.mouse = { x: 0, y: 0, deltaX: 0, deltaY: 0, locked: false };

            this.canvas = document.createElement('canvas');
            this.canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 10;
            `;
            this.ctx = this.canvas.getContext('2d');

            this.cssContainer = document.createElement('div');
            this.cssContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                perspective: 1000px;
                overflow: hidden;
                background: #1a1a2e;
                z-index: 1;
            `;
            this.container.appendChild(this.cssContainer);
            this.container.appendChild(this.canvas);

            this._bindEvents();
            this._resize();
            window.addEventListener('resize', () => this._resize());
        }

        _resize() {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.canvas.width = w;
            this.canvas.height = h;
            this.cssContainer.style.width = w + 'px';
            this.cssContainer.style.height = h + 'px';
            if (this.scene) {
                this.scene.camera.updateAspect(w, h);
            }
        }

        _bindEvents() {
            document.addEventListener('keydown', (e) => { this.keys[e.key] = true; });
            document.addEventListener('keyup', (e) => { this.keys[e.key] = false; });

            this.cssContainer.addEventListener('click', () => {
                if (this.cssContainer.requestPointerLock) {
                    try {
                        this.cssContainer.requestPointerLock();
                    } catch (e) {
                        console.warn('⚠️ قفل ماوس در این محیط در دسترس نیست:', e.message);
                    }
                }
            });

            document.addEventListener('pointerlockchange', () => {
                this.mouse.locked = document.pointerLockElement === this.cssContainer;
            });

            document.addEventListener('mousemove', (e) => {
                if (this.mouse.locked) {
                    this.mouse.deltaX += e.movementX;
                    this.mouse.deltaY += e.movementY;
                }
            });
        }

        setScene(scene) {
            if (this.scene) {
                this.cssContainer.removeChild(this.scene.group);
            }
            this.scene = scene;
            if (scene) {
                this.cssContainer.style.background = scene.background || '#1a1a2e';
                this.cssContainer.appendChild(scene.group);
                if (scene.camera) {
                    scene.camera.updateAspect(this.canvas.width, this.canvas.height);
                }
            }
        }

        start() {
            if (this.running) return;
            this.running = true;
            this.lastTime = performance.now();
            this._loop();
        }

        stop() {
            this.running = false;
        }

        _loop() {
            if (!this.running) return;
            const now = performance.now();
            this.deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
            this.lastTime = now;

            if (this.scene) {
                this.scene.update(this.deltaTime);
                this.scene.render();
            }

            this._renderCanvas();
            requestAnimationFrame(() => this._loop());
        }

        _renderCanvas() {
            const ctx = this.ctx;
            const w = this.canvas.width;
            const h = this.canvas.height;
            ctx.clearRect(0, 0, w, h);

            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '16px monospace';
            ctx.fillText(`Prewbalus Engine | FPS: ${Math.round(1/this.deltaTime)}`, 20, 30);
            if (this.scene) {
                ctx.fillText(`Objects: ${this.scene.objects.length}`, 20, 50);
            }
            if (this.scene && typeof this.scene.canvasRender === 'function') {
                this.scene.canvasRender(ctx, w, h);
            }
        }

        getKey(key) { return !!this.keys[key]; }
        getMouseDelta() { return { x: this.mouse.deltaX, y: this.mouse.deltaY }; }
        resetMouseDelta() { this.mouse.deltaX = 0; this.mouse.deltaY = 0; }
    }

    // ========== صادرات ==========
    global.Prewbalus = {
        Engine,
        Scene,
        Camera,
        Object3D,
        Mesh,
        BoxGeometry,
        Material,
        Vector3,
        Euler
    };

})(window);

// اطمینان از تعریف متغیر سراسری (در صورت نیاز)
if (typeof window !== 'undefined' && !window.Prewbalus) {
    window.Prewbalus = {
        Engine: Engine,
        Scene: Scene,
        Camera: Camera,
        Object3D: Object3D,
        Mesh: Mesh,
        BoxGeometry: BoxGeometry,
        Material: Material,
        Vector3: Vector3,
        Euler: Euler
    };
}

console.log('✅ Prewbalus Engine بارگذاری شد!');
