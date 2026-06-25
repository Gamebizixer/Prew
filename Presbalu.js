// ================================================================
// scrollwroks.js - موتور بازی WebGL2 مستقل
// CDN Address: https://cdn.jsdelivr.net/scrollstudio/u/scrollwroks.js
// ================================================================

// این ثابت را می‌توانید برای بارگذاری Assets از همان CDN استفاده کنید
const CDN_BASE = 'https://cdn.jsdelivr.net/scrollstudio/';

(function(global) {
    'use strict';

    // ---------- ابزارهای ریاضی ----------
    const MathUtils = {
        identity: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
        multiply: (a, b) => {
            const r = new Array(16);
            for (let i=0; i<4; i++) {
                for (let j=0; j<4; j++) {
                    let sum = 0;
                    for (let k=0; k<4; k++) sum += a[i*4+k] * b[k*4+j];
                    r[i*4+j] = sum;
                }
            }
            return r;
        },
        perspective: (fov, aspect, near, far) => {
            const f = 1 / Math.tan(fov/2);
            const nf = 1 / (near - far);
            return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0];
        },
        lookAt: (eye, target, up) => {
            const [ex,ey,ez] = eye, [tx,ty,tz] = target, [ux,uy,uz] = up;
            let zx = ex-tx, zy = ey-ty, zz = ez-tz;
            let len = Math.hypot(zx,zy,zz); zx/=len; zy/=len; zz/=len;
            let xx = uy*zz - uz*zy, xy = uz*zx - ux*zz, xz = ux*zy - uy*zx;
            len = Math.hypot(xx,xy,xz); xx/=len; xy/=len; xz/=len;
            let yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
            return [xx,xy,xz,0, yx,yy,yz,0, zx,zy,zz,0,
                    -(xx*ex+xy*ey+xz*ez), -(yx*ex+yy*ey+yz*ez), -(zx*ex+zy*ey+zz*ez), 1];
        },
        translate: (m, x, y, z) => {
            const r = m.slice();
            r[12] += r[0]*x + r[4]*y + r[8]*z;
            r[13] += r[1]*x + r[5]*y + r[9]*z;
            r[14] += r[2]*x + r[6]*y + r[10]*z;
            return r;
        }
    };

    // ---------- WebGL کمکی ----------
    function createShader(gl, src, type) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }

    function createProgram(gl, vSrc, fSrc) {
        const vs = createShader(gl, vSrc, gl.VERTEX_SHADER);
        const fs = createShader(gl, fSrc, gl.FRAGMENT_SHADER);
        const p = gl.createProgram();
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(p));
            return null;
        }
        return p;
    }

    // ---------- کلاس‌های اصلی ----------
    class Scene {
        constructor() {
            this.meshes = [];
            this.lights = [];
            this.ambientColor = [0.2, 0.2, 0.3];
        }
        add(mesh) { this.meshes.push(mesh); }
        addLight(light) { this.lights.push(light); }
    }

    class Camera {
        constructor(fov, aspect, near, far) {
            this.fov = fov;
            this.aspect = aspect;
            this.near = near;
            this.far = far;
            this.position = [0, 2, 5];
            this.target = [0, 0, 0];
            this.up = [0, 1, 0];
            this.projectionMatrix = MathUtils.perspective(fov, aspect, near, far);
        }
        updateProjection() {
            this.projectionMatrix = MathUtils.perspective(this.fov, this.aspect, this.near, this.far);
        }
        getViewMatrix() {
            return MathUtils.lookAt(this.position, this.target, this.up);
        }
    }

    class Mesh {
        constructor(geometry, material) {
            this.geometry = geometry;
            this.material = material;
            this.position = [0,0,0];
            this.rotation = [0,0,0];
            this.scale = [1,1,1];
            this.modelMatrix = MathUtils.identity();
            this.updateMatrix();
        }
        updateMatrix() {
            let m = MathUtils.identity();
            // translate
            m = MathUtils.translate(m, this.position[0], this.position[1], this.position[2]);
            // rotate (simple Euler XYZ)
            const rx = this.rotation[0], ry = this.rotation[1], rz = this.rotation[2];
            const cx = Math.cos(rx), sx = Math.sin(rx);
            const cy = Math.cos(ry), sy = Math.sin(ry);
            const cz = Math.cos(rz), sz = Math.sin(rz);
            const rot = [
                cy*cz, -cy*sz, sy, 0,
                sx*sy*cz + cx*sz, -sx*sy*sz + cx*cz, -sx*cy, 0,
                -cx*sy*cz + sx*sz, cx*sy*sz + sx*cz, cx*cy, 0,
                0,0,0,1
            ];
            m = MathUtils.multiply(m, rot);
            // scale
            m[0] *= this.scale[0]; m[1] *= this.scale[0]; m[2] *= this.scale[0];
            m[4] *= this.scale[1]; m[5] *= this.scale[1]; m[6] *= this.scale[1];
            m[8] *= this.scale[2]; m[9] *= this.scale[2]; m[10] *= this.scale[2];
            this.modelMatrix = m;
        }
    }

    // ---------- مواد و شیدرها ----------
    const vertexShaderSource = `
        #version 300 es
        in vec3 aPosition;
        in vec3 aNormal;
        in vec2 aUV;
        uniform mat4 uModel;
        uniform mat4 uView;
        uniform mat4 uProjection;
        uniform mat4 uNormalMatrix;
        out vec3 vNormal;
        out vec3 vPosition;
        out vec2 vUV;
        void main() {
            vec4 worldPos = uModel * vec4(aPosition, 1.0);
            vPosition = worldPos.xyz;
            vNormal = mat3(uNormalMatrix) * aNormal;
            vUV = aUV;
            gl_Position = uProjection * uView * worldPos;
        }
    `;

    const fragmentShaderSource = `
        #version 300 es
        precision highp float;
        in vec3 vNormal;
        in vec3 vPosition;
        in vec2 vUV;
        uniform vec3 uColor;
        uniform vec3 uAmbient;
        uniform vec3 uLightDir;
        uniform vec3 uLightColor;
        uniform float uLightIntensity;
        uniform vec3 uCameraPos;
        out vec4 fragColor;
        void main() {
            vec3 normal = normalize(vNormal);
            vec3 lightDir = normalize(uLightDir);
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = uLightColor * uLightIntensity * diff;
            vec3 ambient = uAmbient * 0.5;
            // specular (Blinn-Phong)
            vec3 viewDir = normalize(uCameraPos - vPosition);
            vec3 halfVec = normalize(lightDir + viewDir);
            float spec = pow(max(dot(normal, halfVec), 0.0), 32.0);
            vec3 specular = uLightColor * uLightIntensity * spec * 0.5;
            vec3 color = uColor * (ambient + diffuse) + specular;
            fragColor = vec4(color, 1.0);
        }
    `;

    // شیدر مخصوص depth map (برای سایه)
    const depthVertexShader = `
        #version 300 es
        in vec3 aPosition;
        uniform mat4 uModel;
        uniform mat4 uLightViewProj;
        void main() {
            gl_Position = uLightViewProj * uModel * vec4(aPosition, 1.0);
        }
    `;
    const depthFragmentShader = `
        #version 300 es
        precision highp float;
        out vec4 fragColor;
        void main() {
            fragColor = vec4(gl_FragCoord.z, 0.0, 0.0, 1.0);
        }
    `;

    // ---------- رندرر ----------
    class Renderer {
        constructor(canvas) {
            this.canvas = canvas;
            const gl = canvas.getContext('webgl2', { antialias: true, depth: true, stencil: false });
            if (!gl) throw new Error('WebGL2 not supported');
            this.gl = gl;
            this.clearColor = [0.1, 0.1, 0.2, 1.0];
            // compile shaders
            this.mainProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
            this.depthProgram = createProgram(gl, depthVertexShader, depthFragmentShader);
            // uniforms locations
            this.uModel = gl.getUniformLocation(this.mainProgram, 'uModel');
            this.uView = gl.getUniformLocation(this.mainProgram, 'uView');
            this.uProjection = gl.getUniformLocation(this.mainProgram, 'uProjection');
            this.uNormalMatrix = gl.getUniformLocation(this.mainProgram, 'uNormalMatrix');
            this.uColor = gl.getUniformLocation(this.mainProgram, 'uColor');
            this.uAmbient = gl.getUniformLocation(this.mainProgram, 'uAmbient');
            this.uLightDir = gl.getUniformLocation(this.mainProgram, 'uLightDir');
            this.uLightColor = gl.getUniformLocation(this.mainProgram, 'uLightColor');
            this.uLightIntensity = gl.getUniformLocation(this.mainProgram, 'uLightIntensity');
            this.uCameraPos = gl.getUniformLocation(this.mainProgram, 'uCameraPos');
            // depth
            this.depthModel = gl.getUniformLocation(this.depthProgram, 'uModel');
            this.depthLightViewProj = gl.getUniformLocation(this.depthProgram, 'uLightViewProj');

            // create shadow framebuffer
            const shadowSize = 1024;
            this.shadowFBO = gl.createFramebuffer();
            this.shadowTex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, shadowSize, shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            this.shadowSize = shadowSize;
        }

        render(scene, camera) {
            const gl = this.gl;
            const w = this.canvas.width, h = this.canvas.height;
            gl.viewport(0, 0, w, h);
            gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], this.clearColor[3]);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);

            // ----- مرحله 1: رندر سایه (depth map) -----
            const dirLight = scene.lights.find(l => l.type === 'directional');
            if (dirLight) {
                gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
                gl.viewport(0, 0, this.shadowSize, this.shadowSize);
                gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.useProgram(this.depthProgram);
                const lightPos = dirLight.position;
                const lightTarget = [0,0,0];
                const up = [0,1,0];
                const lightView = MathUtils.lookAt(lightPos, lightTarget, up);
                const lightProj = MathUtils.perspective(0.8, 1, 0.1, 30);
                const lightViewProj = MathUtils.multiply(lightProj, lightView);
                for (const mesh of scene.meshes) {
                    gl.uniformMatrix4fv(this.depthModel, false, mesh.modelMatrix);
                    gl.uniformMatrix4fv(this.depthLightViewProj, false, lightViewProj);
                    this.drawMeshDepth(mesh);
                }
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, w, h);
            }

            // ----- مرحله 2: رندر اصلی با سایه -----
            gl.useProgram(this.mainProgram);
            const viewMat = camera.getViewMatrix();
            const projMat = camera.projectionMatrix;
            gl.uniformMatrix4fv(this.uView, false, viewMat);
            gl.uniformMatrix4fv(this.uProjection, false, projMat);
            gl.uniform3fv(this.uCameraPos, camera.position);

            const ambient = scene.ambientColor;
            gl.uniform3fv(this.uAmbient, ambient);
            if (dirLight) {
                const dir = dirLight.position;
                const len = Math.hypot(dir[0], dir[1], dir[2]);
                gl.uniform3fv(this.uLightDir, [dir[0]/len, dir[1]/len, dir[2]/len]);
                gl.uniform3fv(this.uLightColor, dirLight.color);
                gl.uniform1f(this.uLightIntensity, dirLight.intensity);
            } else {
                gl.uniform3fv(this.uLightDir, [0.5, 0.5, 0.5]);
                gl.uniform3fv(this.uLightColor, [1,1,1]);
                gl.uniform1f(this.uLightIntensity, 0.5);
            }

            for (const mesh of scene.meshes) {
                mesh.updateMatrix();
                gl.uniformMatrix4fv(this.uModel, false, mesh.modelMatrix);
                const nm = this.computeNormalMatrix(mesh.modelMatrix);
                gl.uniformMatrix4fv(this.uNormalMatrix, false, nm);
                gl.uniform3fv(this.uColor, mesh.material.color);
                this.drawMesh(mesh);
            }
        }

        drawMesh(mesh) {
            const gl = this.gl;
            const geo = mesh.geometry;
            if (!geo.buffers) return;
            const { position, normal, uv, index } = geo.buffers;
            gl.bindBuffer(gl.ARRAY_BUFFER, position);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            if (normal) {
                gl.bindBuffer(gl.ARRAY_BUFFER, normal);
                gl.enableVertexAttribArray(1);
                gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
            }
            if (uv) {
                gl.bindBuffer(gl.ARRAY_BUFFER, uv);
                gl.enableVertexAttribArray(2);
                gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
            }
            if (index) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
                gl.drawElements(gl.TRIANGLES, index.count, gl.UNSIGNED_SHORT, 0);
            } else {
                gl.drawArrays(gl.TRIANGLES, 0, position.count);
            }
        }

        drawMeshDepth(mesh) {
            const gl = this.gl;
            const geo = mesh.geometry;
            if (!geo.buffers) return;
            const { position, index } = geo.buffers;
            gl.bindBuffer(gl.ARRAY_BUFFER, position);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            if (index) {
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
                gl.drawElements(gl.TRIANGLES, index.count, gl.UNSIGNED_SHORT, 0);
            } else {
                gl.drawArrays(gl.TRIANGLES, 0, position.count);
            }
        }

        computeNormalMatrix(model) {
            // برای سادگی، فرض می‌کنیم uniform scale پس transpose(inverse) ~ inverse transpose
            return model.slice();
        }
    }

    // ---------- هندسه‌های آماده ----------
    function createBoxGeometry(width, height, depth) {
        const w = width/2, h = height/2, d = depth/2;
        const positions = [
            -w,-h,-d,  w,-h,-d,  w,h,-d, -w,h,-d, // front
            -w,-h,d,  w,-h,d,  w,h,d, -w,h,d, // back
            -w,-h,-d, -w,h,-d, -w,h,d, -w,-h,d, // left
            w,-h,-d, w,h,-d, w,h,d, w,-h,d, // right
            -w,h,-d, w,h,-d, w,h,d, -w,h,d, // top
            -w,-h,-d, w,-h,-d, w,-h,d, -w,-h,d  // bottom
        ];
        const normals = [
            0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
            0,0,1, 0,0,1, 0,0,1, 0,0,1,
            -1,0,0, -1,0,0, -1,0,0, -1,0,0,
            1,0,0, 1,0,0, 1,0,0, 1,0,0,
            0,1,0, 0,1,0, 0,1,0, 0,1,0,
            0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0
        ];
        const indices = [];
        for (let i=0; i<6; i++) {
            const base = i*4;
            indices.push(base, base+1, base+2, base, base+2, base+3);
        }
        return { positions, normals, indices };
    }

    // ---------- نور ----------
    class DirectionalLight {
        constructor(color, intensity, position) {
            this.type = 'directional';
            this.color = color;
            this.intensity = intensity;
            this.position = position;
        }
    }

    // ---------- خروجی ----------
    global.ScrollEngine = {
        Scene,
        Camera,
        Mesh,
        Renderer,
        DirectionalLight,
        createBoxGeometry,
        MathUtils,
        CDN_BASE   // expose the CDN base URL
    };

})(window);
