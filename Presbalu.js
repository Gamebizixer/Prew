// ============================================================
// Prewbalus 2.0 - با مقیاس بزرگ و پرسپکتیو درست
// ============================================================

(function (global) {
    'use strict';

    // ==================== کلاس‌های ریاضی ====================
    class Vector3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        set(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
            return this;
        }
        clone() { return new Vector3(this.x, this.y, this.z); }
        add(v) { this.x += v.x;
            this.y += v.y;
            this.z += v.z;
            return this; }
        sub(v) { this.x -= v.x;
            this.y -= v.y;
            this.z -= v.z;
            return this; }
        multiplyScalar(s) { this.x *= s;
            this.y *= s;
            this.z *= s;
            return this; }
        length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
        normalize() { const l = this.length(); if (l > 0) this.multiplyScalar(1 / l); return this; }
        dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
        cross(v) {
            return new Vector3(
                this.y * v.z - this.z * v.y,
                this.z * v.x - this.x * v.z,
                this.x * v.y - this.y * v.x
            );
        }
        copy(v) { this.x = v.x;
            this.y = v.y;
            this.z = v.z;
            return this; }
        distanceTo(v) { return this.clone().sub(v).length(); }
    }

    class Euler {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        clone() { return new Euler(this.x, this.y, this.z); }
        copy(e) { this.x = e.x;
            this.y = e.y;
            this.z = e.z;
            return this; }
    }

    // ==================== هندسه‌ها ====================
    class BoxGeometry {
        constructor(w = 1, h = 1, d = 1) {
            this.width = w;
            this.height = h;
            this.depth = d;
            this.faces = [
                { pos: [0, 0, d / 2], rot: [0, 0, 0], size: [w, h] },
                { pos: [0, 0, -d / 2], rot: [0, Math.PI, 0], size: [w, h] },
                { pos: [w / 2, 0, 0], rot: [0, Math.PI / 2, 0], size: [d, h] },
                { pos: [-w / 2, 0, 0], rot: [0, -Math.PI / 2, 0], size: [d, h] },
                { pos: [0, -h / 2, 0], rot: [-Math.PI / 2, 0, 0], size: [w, d] },
                { pos: [0, h / 2, 0], rot: [Math.PI / 2, 0, 0], size: [w, d] }
            ];
        }
    }

    class PlaneGeometry {
        constructor(w = 1, h = 1) {
            this.width = w;
            this.height = h;
            this.faces = [
                { pos: [0, 0, 0], rot: [0, 0, 0], size: [w, h] }
            ];
        }
    }

    // ==================== Material ====================
    class Material {
        constructor(options = {}) {
            this.color = options.color || '#ffffff';
            this.map = options.map || null;
            this.opacity = options.opacity !== undefined ? options.opacity : 1;
            this.border = options.border || 'none';
            this.emissive = options.emissive || false;
        }
    }

    // ==================== Object3D ====================
    class Object3D {
        constructor() {
            this.position = new Vector3(0, 0, 0);
            this.rotation = new Euler(0, 0, 0);
            this.scale = new Vector3(1, 1, 1);
            this.parent = null;
            this.children = [];
            this.element = null;
            this.visible = true;
        }
        add(child) {
            if (child.parent) child.parent.remove(child);
            child.parent = this;
            this.children.push(child);
            if (this.element && child.element) this.element.appendChild(child.element);
        }
        remove(child) {
            const i = this.children.indexOf(child);
            if (i !== -1) {
                this.children.splice(i, 1);
                child.parent = null;
                if (this.element && child.element) this.element.removeChild(child.element);
            }
        }
        getCSSMatrix() {
            const p = this.position,
                r = this.rotation,
                s = this.scale;
            return `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateX(${r.x}rad) rotateY(${r.y}rad) rotateZ(${r.z}rad) scale3d(${s.x},${s.y},${s.z})`;
        }
        updateTransform() {
            if (this.element && this.visible) {
                this.element.style.transform = this.getCSSMatrix();
                this.element.style.display = 'block';
            } else if (this.element) {
                this.element.style.display = 'none';
            }
        }
        rotateX(a) { this.rotation.x += a; return this; }
        rotateY(a) { this.rotation.y += a; return this; }
        rotateZ(a) { this.rotation.z += a; return this; }
        translate(x, y, z) { this.position.x += x;
            this.position.y += y;
            this.position.z += z; return this; }
    }

    // ==================== Mesh ====================
    class Mesh extends Object3D {
        constructor(geometry, material) {
            super();
            this.geometry = geometry;
            this.material = material;
            this.collider = null;
            this.body = null;
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

            geo.faces.forEach(face => {
                const div = document.createElement('div');
                const [px, py, pz] = face.pos;
                const [rx, ry, rz] = face.rot;
                const [fw, fh] = face.size;

                let bg = mat.color;
                if (mat.map) bg = `url(${mat.map})`;

                div.style.cssText = `
                    position: absolute;
                    width: ${fw}px;
                    height: ${fh}px;
                    background: ${bg};
                    background-size: cover;
                    border: ${mat.border};
                    opacity: ${mat.opacity};
                    transform: translate3d(${px}px,${py}px,${pz}px) rotateX(${rx}rad) rotateY(${ry}rad) rotateZ(${rz}rad);
                    backface-visibility: visible;
                    box-sizing: border-box;
                    ${mat.emissive ? 'box-shadow: inset 0 0 30px rgba(255,255,255,0.5);' : ''}
                `;
                container.appendChild(div);
            });
        }
    }

    // ==================== Sprite ====================
    class Sprite extends Object3D {
        constructor(options = {}) {
            super();
            this.texture = options.texture || null;
            this.width = options.width || 64;
            this.height = options.height || 64;
            this.build();
        }
        build() {
            const div = document.createElement('div');
            div.style.cssText = `
                position: absolute;
                width: ${this.width}px;
                height: ${this.height}px;
                background: ${this.texture ? `url(${this.texture})` : '#ff00ff'};
                background-size: cover;
                pointer-events: none;
                transform-style: preserve-3d;
            `;
            this.element = div;
        }
    }

    // ==================== PhysicsBody ====================
    class PhysicsBody {
        constructor(options = {}) {
            this.velocity = new Vector3(0, 0, 0);
            this.gravity = options.gravity !== undefined ? options.gravity : -20;
            this.mass = options.mass || 1;
            this.isGrounded = false;
            this.useGravity = options.useGravity !== undefined ? options.useGravity : true;
            this.friction = options.friction || 0.9;
        }
        applyForce(force) { this.velocity.add(force.clone().multiplyScalar(1 / this.mass)); }
        update(dt) {
            if (this.useGravity) this.velocity.y += this.gravity * dt;
            this.velocity.x *= (1 - (1 - this.friction) * dt);
            this.velocity.z *= (1 - (1 - this.friction) * dt);
        }
    }

    // ==================== Collision ====================
    class Collision {
        static AABB(a, b) {
            if (!a.collider || !b.collider) return false;
            const pa = a.position,
                pb = b.position;
            const ha = a.collider,
                hb = b.collider;
            const ax = pa.x - ha.width / 2,
                bx = pa.x + ha.width / 2;
            const ay = pa.y - ha.height / 2,
                by = pa.y + ha.height / 2;
            const az = pa.z - ha.depth / 2,
                bz = pa.z + ha.depth / 2;
            const cx = pb.x - hb.width / 2,
                dx = pb.x + hb.width / 2;
            const cy = pb.y - hb.height / 2,
                dy = pb.y + hb.height / 2;
            const cz = pb.z - hb.depth / 2,
                dz = pb.z + hb.depth / 2;
            return (ax < dx && bx > cx && ay < dy && by > cy && az < dz && bz > cz);
        }
        static resolveAABB(a, b) {
            if (!Collision.AABB(a, b)) return null;
            const pa = a.position,
                pb = b.position;
            const ha = a.collider,
                hb = b.collider;
            const overlapX = (ha.width / 2 + hb.width / 2) - Math.abs(pa.x - pb.x);
            const overlapY = (ha.height / 2 + hb.height / 2) - Math.abs(pa.y - pb.y);
            const overlapZ = (ha.depth / 2 + hb.depth / 2) - Math.abs(pa.z - pb.z);
            let min = Math.min(overlapX, overlapY, overlapZ);
            let dir = new Vector3();
            if (min === overlapX) dir.x = (pa.x > pb.x) ? 1 : -1;
            else if (min === overlapY) dir.y = (pa.y > pb.y) ? 1 : -1;
            else dir.z = (pa.z > pb.z) ? 1 : -1;
            return { overlap: min, direction: dir };
        }
    }

    // ==================== Raycaster ====================
    class Raycaster {
        constructor() { this.ray = { origin: new Vector3(), direction: new Vector3() }; }
        set(origin, direction) { this.ray.origin.copy(origin);
            this.ray.direction.copy(direction).normalize(); }
        intersectObjects(objects) {
            const results = [];
            for (const obj of objects) {
                if (!obj.collider) continue;
                const hit = this._intersectAABB(obj);
                if (hit) results.push({ object: obj, distance: hit.distance, point: hit.point });
            }
            results.sort((a, b) => a.distance - b.distance);
            return results;
        }
        _intersectAABB(obj) {
            const pos = obj.position;
            const half = { x: obj.collider.width / 2, y: obj.collider.height / 2, z: obj.collider.depth / 2 };
            const origin = this.ray.origin,
                dir = this.ray.direction;
            let t1 = (-half.x - (pos.x - origin.x)) / dir.x;
            let t2 = (half.x - (pos.x - origin.x)) / dir.x;
            let t3 = (-half.y - (pos.y - origin.y)) / dir.y;
            let t4 = (half.y - (pos.y - origin.y)) / dir.y;
            let t5 = (-half.z - (pos.z - origin.z)) / dir.z;
            let t6 = (half.z - (pos.z - origin.z)) / dir.z;
            let tmin = Math.max(Math.min(t1, t2), Math.min(t3, t4), Math.min(t5, t6));
            let tmax = Math.min(Math.max(t1, t2), Math.max(t3, t4), Math.max(t5, t6));
            if (tmax < 0 || tmin > tmax) return null;
            const distance = tmin > 0 ? tmin : tmax;
            const point = origin.clone().add(dir.clone().multiplyScalar(distance));
            return { distance, point };
        }
    }

    // ==================== Camera ====================
    class Camera {
        constructor(options = {}) {
            this.position = new Vector3(0, 0, 0);
            this.rotation = new Euler(0, 0, 0);
            this.fov = options.fov || 60;
            this.near = options.near || 0.1;
            this.far = options.far || 1000;
            this.aspect = 1;
        }
        getCSSMatrix() {
            const p = this.position,
                r = this.rotation;
            return `translate3d(${-p.x}px,${-p.y}px,${-p.z}px) rotateX(${r.x}rad) rotateY(${r.y}rad) rotateZ(${r.z}rad)`;
        }
        updateAspect(w, h) { this.aspect = w / h; }
        getForward() {
            const e = this.rotation;
            const cx = Math.cos(e.x),
                sx = Math.sin(e.x);
            const cy = Math.cos(e.y),
                sy = Math.sin(e.y);
            return new Vector3(-sy * cx, sx, cy * cx).normalize();
        }
        getRight() {
            const e = this.rotation;
            const cy = Math.cos(e.y),
                sy = Math.sin(e.y);
            return new Vector3(cy, 0, sy).normalize();
        }
    }

    // ==================== FPSController ====================
    class FPSController {
        constructor(camera, options = {}) {
            this.camera = camera;
            this.speed = options.speed || 5;
            this.sprintSpeed = options.sprintSpeed || 8;
            this.jumpSpeed = options.jumpSpeed || 6;
            this.mouseSensitivity = options.mouseSensitivity || 0.002;
            this.yaw = 0;
            this.pitch = 0;
            this.body = new PhysicsBody({ gravity: -20, mass: 1 });
            this.body.useGravity = true;
            this.isOnGround = false;
        }
        update(dt, keys, mouseDelta) {
            if (mouseDelta) {
                this.yaw -= mouseDelta.x * this.mouseSensitivity;
                this.pitch -= mouseDelta.y * this.mouseSensitivity;
                this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
                this.camera.rotation.x = this.pitch;
                this.camera.rotation.y = this.yaw;
            }
            const forward = this.camera.getForward();
            const right = this.camera.getRight();
            const move = new Vector3(0, 0, 0);
            let speed = keys['Shift'] ? this.sprintSpeed : this.speed;
            if (keys['w'] || keys['W']) move.add(forward);
            if (keys['s'] || keys['S']) move.sub(forward);
            if (keys['a'] || keys['A']) move.sub(right);
            if (keys['d'] || keys['D']) move.add(right);
            if (move.length() > 0) move.normalize().multiplyScalar(speed);
            this.body.velocity.x = move.x;
            this.body.velocity.z = move.z;
            if ((keys[' '] || keys['Space']) && this.isOnGround) {
                this.body.velocity.y = this.jumpSpeed;
                this.isOnGround = false;
            }
            this.body.update(dt);
            this.camera.position.x += this.body.velocity.x * dt;
            this.camera.position.y += this.body.velocity.y * dt;
            this.camera.position.z += this.body.velocity.z * dt;
        }
    }

    // ==================== ParticleEmitter ====================
    class ParticleEmitter {
        constructor(options = {}) {
            this.count = options.count || 100;
            this.life = options.life || 2;
            this.speed = options.speed || 50;
            this.color = options.color || '#ffaa44';
            this.size = options.size || 4;
            this.particles = [];
            this.element = document.createElement('div');
            this.element.style.cssText =
                'position:absolute;top:0;left:0;transform-style:preserve-3d;pointer-events:none;width:0;height:0;';
            this._init();
        }
        _init() {
            for (let i = 0; i < this.count; i++) {
                const p = document.createElement('div');
                p.style.cssText = `
                    position:absolute;
                    width:${this.size}px;
                    height:${this.size}px;
                    background:${this.color};
                    border-radius:50%;
                    opacity:0;
                    transform:translate3d(0,0,0);
                `;
                this.element.appendChild(p);
                this.particles.push({
                    el: p,
                    life: Math.random() * this.life,
                    maxLife: this.life,
                    vel: new Vector3((Math.random() - 0.5) * this.speed, (Math.random() - 0.5) * this.speed, (Math.random() - 0.5) * this
                        .speed),
                    pos: new Vector3(0, 0, 0)
                });
            }
        }
        emit(position, count = 10) {
            let emitted = 0;
            for (const p of this.particles) {
                if (p.life <= 0 && emitted < count) {
                    p.life = p.maxLife;
                    p.pos.copy(position);
                    p.vel.set((Math.random() - 0.5) * this.speed, (Math.random() - 0.5) * this.speed, (Math.random() - 0.5) * this
                        .speed);
                    emitted++;
                }
            }
        }
        update(dt) {
            for (const p of this.particles) {
                p.life -= dt;
                if (p.life > 0) {
                    p.pos.add(p.vel.clone().multiplyScalar(dt));
                    const s = 1 - (p.life / p.maxLife);
                    p.el.style.transform = `translate3d(${p.pos.x}px,${p.pos.y}px,${p.pos.z}px)`;
                    p.el.style.opacity = 1 - s;
                    const size = this.size * (1 + s * 2);
                    p.el.style.width = size + 'px';
                    p.el.style.height = size + 'px';
                } else {
                    p.el.style.opacity = 0;
                }
            }
        }
    }

    // ==================== AudioSystem ====================
    class AudioSystem {
        constructor() {
            this.context = new(window.AudioContext || window.webkitAudioContext)();
            this.buffers = {};
        }
        load(url, callback) {
            fetch(url).then(res => res.arrayBuffer()).then(data => this.context.decodeAudioData(data)).then(buffer => {
                this.buffers[url] = buffer;
                if (callback) callback();
            }).catch(err => console.error('Audio load error:', err));
        }
        play(url, volume = 1) {
            if (!this.buffers[url]) { console.warn('Audio not loaded:', url); return; }
            const source = this.context.createBufferSource();
            source.buffer = this.buffers[url];
            const gain = this.context.createGain();
            gain.gain.value = volume;
            source.connect(gain);
            gain.connect(this.context.destination);
            source.start(0);
        }
    }

    // ==================== Scene ====================
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
            this.colliders = [];
            this.raycaster = new Raycaster();
        }
        add(object) {
            this.objects.push(object);
            if (object.element) this.group.appendChild(object.element);
            object.parent = this;
            if (object.collider) this.colliders.push(object);
        }
        remove(object) {
            const i = this.objects.indexOf(object);
            if (i !== -1) {
                this.objects.splice(i, 1);
                if (object.element && object.element.parentNode === this.group) {
                    this.group.removeChild(object.element);
                }
                object.parent = null;
                const ci = this.colliders.indexOf(object);
                if (ci !== -1) this.colliders.splice(ci, 1);
            }
        }
        update(dt) {
            for (const obj of this.objects) {
                if (obj.update) obj.update(dt);
            }
            for (let i = 0; i < this.colliders.length; i++) {
                for (let j = i + 1; j < this.colliders.length; j++) {
                    const a = this.colliders[i];
                    const b = this.colliders[j];
                    if (Collision.AABB(a, b)) {
                        const res = Collision.resolveAABB(a, b);
                        if (res) {
                            a.position.add(res.direction.clone().multiplyScalar(res.overlap));
                            if (a.body) a.body.velocity.multiplyScalar(0.2);
                            if (b.body) b.body.velocity.multiplyScalar(0.2);
                            if (a.onCollision) a.onCollision(b);
                            if (b.onCollision) b.onCollision(a);
                        }
                    }
                }
            }
        }
        render() {
            this.group.style.transform = this.camera.getCSSMatrix();
            for (const obj of this.objects) {
                if (obj instanceof Sprite) {
                    const dir = this.camera.position.clone().sub(obj.position);
                    const angle = Math.atan2(dir.x, dir.z);
                    obj.rotation.y = angle;
                }
                obj.updateTransform();
            }
        }
    }

    // ==================== Engine ====================
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
            this.mouse = { deltaX: 0, deltaY: 0, locked: false };
            this.audio = new AudioSystem();

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

            // 🔥 تنظیم perspective به مقدار بسیار کم برای بزرگ‌نمایی
            this.cssContainer = document.createElement('div');
            this.cssContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                perspective: 200px;
                overflow: hidden;
                background: #1a1a2e;
                z-index: 1;
                transform-style: preserve-3d;
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
            if (this.scene) this.scene.camera.updateAspect(w, h);
        }

        _bindEvents() {
            document.addEventListener('keydown', e => { this.keys[e.key] = true; });
            document.addEventListener('keyup', e => { this.keys[e.key] = false; });
            this.cssContainer.addEventListener('click', () => {
                try { this.cssContainer.requestPointerLock(); } catch (e) {}
            });
            document.addEventListener('pointerlockchange', () => {
                this.mouse.locked = document.pointerLockElement === this.cssContainer;
            });
            document.addEventListener('mousemove', e => {
                if (this.mouse.locked) {
                    this.mouse.deltaX += e.movementX;
                    this.mouse.deltaY += e.movementY;
                }
            });
        }

        setScene(scene) {
            if (this.scene) this.cssContainer.removeChild(this.scene.group);
            this.scene = scene;
            if (scene) {
                this.cssContainer.style.background = scene.background || '#1a1a2e';
                this.cssContainer.appendChild(scene.group);
                if (scene.camera) scene.camera.updateAspect(this.canvas.width, this.canvas.height);
            }
        }

        start() {
            if (this.running) return;
            this.running = true;
            this.lastTime = performance.now();
            this._loop();
        }

        stop() { this.running = false; }

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
            ctx.fillText(`Prewbalus 2.0 | FPS: ${Math.round(1 / this.deltaTime)}`, 20, 30);
            if (this.scene) {
                ctx.fillText(`Objects: ${this.scene.objects.length}`, 20, 50);
            }
            if (this.scene && typeof this.scene.canvasRender === 'function') {
                this.scene.canvasRender(ctx, w, h);
            }
        }

        loadTexture(url, callback) {
            const img = new Image();
            img.onload = () => { callback && callback(img); };
            img.src = url;
        }
        loadAudio(url, callback) { this.audio.load(url, callback); }
        raycastFromCamera() {
            if (!this.scene) return [];
            const cam = this.scene.camera;
            const origin = cam.position.clone();
            const dir = cam.getForward();
            this.scene.raycaster.set(origin, dir);
            return this.scene.raycaster.intersectObjects(this.scene.objects);
        }
    }

    // ==================== صادرات ====================
    global.Prewbalus = {
        Engine,
        Scene,
        Camera,
        Object3D,
        Mesh,
        Sprite,
        BoxGeometry,
        PlaneGeometry,
        Material,
        Vector3,
        Euler,
        PhysicsBody,
        Collision,
        Raycaster,
        FPSController,
        ParticleEmitter,
        AudioSystem
    };

})(window);

console.log('✅ Prewbalus 2.0 با پرسپکتیو ۲۰۰px بارگذاری شد!');
