/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */
import * as LAppDefine from './lappdefine';
import { LAppGlManager } from './lappglmanager';
import { LAppLive2DManager } from './lapplive2dmanager';
import { LAppPal } from './lapppal';
import { LAppTextureManager } from './lapptexturemanager';
import { LAppView } from './lappview';
/**
 * Canvasに関連する操作を取りまとめるクラス
 */
export class LAppSubdelegate {
    /**
     * コンストラクタ
     */
    constructor() {
        this._canvas = null;
        this._glManager = new LAppGlManager();
        this._textureManager = new LAppTextureManager();
        this._live2dManager = new LAppLive2DManager();
        this._view = new LAppView();
        this._frameBuffer = null;
        this._captured = false;
    }
    /**
     * デストラクタ相当の処理
     */
    release() {
        this._resizeObserver.unobserve(this._canvas);
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
        this._live2dManager.release();
        this._live2dManager = null;
        this._view.release();
        this._view = null;
        this._textureManager.release();
        this._textureManager = null;
        this._glManager.release();
        this._glManager = null;
    }
    /**
     * APPに必要な物を初期化する。
     */
    initialize(canvas) {
        if (!this._glManager.initialize(canvas)) {
            return false;
        }
        this._canvas = canvas;
        if (LAppDefine.CanvasSize === 'auto') {
            this.resizeCanvas();
        }
        else {
            canvas.width = LAppDefine.CanvasSize.width;
            canvas.height = LAppDefine.CanvasSize.height;
        }
        this._textureManager.setGlManager(this._glManager);
        const gl = this._glManager.getGl();
        if (!this._frameBuffer) {
            this._frameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        }
        // 透過設定
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        // AppViewの初期化
        this._view.initialize(this);
        this._view.initializeSprite();
        this._live2dManager.initialize(this);
        this._resizeObserver = new ResizeObserver((entries, observer) => this.resizeObserverCallback.call(this, entries, observer));
        this._resizeObserver.observe(this._canvas);
        return true;
    }
    /**
     * Resize canvas and re-initialize view.
     */
    onResize() {
        this.resizeCanvas();
        this._view.initialize(this);
        this._view.initializeSprite();
    }
    resizeObserverCallback(entries, observer) {
        if (LAppDefine.CanvasSize === 'auto') {
            this._needResize = true;
        }
    }
    /**
     * ループ処理
     */
    update() {
        if (this._glManager.getGl().isContextLost()) {
            return;
        }
        // キャンバスのサイズが変わっている場合はリサイズに必要な処理をする。
        if (this._needResize) {
            this.onResize();
            this._needResize = false;
        }
        const gl = this._glManager.getGl();
        // 画面の初期化
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        // 深度テストを有効化
        gl.enable(gl.DEPTH_TEST);
        // 近くにある物体は、遠くにある物体を覆い隠す
        gl.depthFunc(gl.LEQUAL);
        // カラーバッファや深度バッファをクリアする
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.clearDepth(1.0);
        // 透過設定
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        // 描画更新
        this._view.render();
    }
    /**
     * シェーダーを登録する。
     */
    createShader() {
        const gl = this._glManager.getGl();
        // バーテックスシェーダーのコンパイル
        const vertexShaderId = gl.createShader(gl.VERTEX_SHADER);
        if (vertexShaderId == null) {
            LAppPal.printMessage('failed to create vertexShader');
            return null;
        }
        const vertexShader = 'precision mediump float;' +
            'attribute vec3 position;' +
            'attribute vec2 uv;' +
            'varying vec2 vuv;' +
            'void main(void)' +
            '{' +
            '   gl_Position = vec4(position, 1.0);' +
            '   vuv = uv;' +
            '}';
        gl.shaderSource(vertexShaderId, vertexShader);
        gl.compileShader(vertexShaderId);
        // フラグメントシェーダのコンパイル
        const fragmentShaderId = gl.createShader(gl.FRAGMENT_SHADER);
        if (fragmentShaderId == null) {
            LAppPal.printMessage('failed to create fragmentShader');
            return null;
        }
        const fragmentShader = 'precision mediump float;' +
            'varying vec2 vuv;' +
            'uniform sampler2D texture;' +
            'void main(void)' +
            '{' +
            '   gl_FragColor = texture2D(texture, vuv);' +
            '}';
        gl.shaderSource(fragmentShaderId, fragmentShader);
        gl.compileShader(fragmentShaderId);
        // プログラムオブジェクトの作成
        const programId = gl.createProgram();
        gl.attachShader(programId, vertexShaderId);
        gl.attachShader(programId, fragmentShaderId);
        gl.deleteShader(vertexShaderId);
        gl.deleteShader(fragmentShaderId);
        // リンク
        gl.linkProgram(programId);
        gl.useProgram(programId);
        return programId;
    }
    getTextureManager() {
        return this._textureManager;
    }
    getFrameBuffer() {
        return this._frameBuffer;
    }
    getCanvas() {
        return this._canvas;
    }
    getGlManager() {
        return this._glManager;
    }
    getLive2DManager() {
        return this._live2dManager;
    }
    /**
     * Resize the canvas to fill the screen.
     */
    resizeCanvas() {
        this._canvas.width = this._canvas.clientWidth * window.devicePixelRatio;
        this._canvas.height = this._canvas.clientHeight * window.devicePixelRatio;
        const gl = this._glManager.getGl();
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    /**
     * マウスダウン、タッチダウンしたときに呼ばれる。
     */
    onPointBegan(pageX, pageY) {
        if (!this._view) {
            LAppPal.printMessage('view notfound');
            return;
        }
        this._captured = true;
        const localX = pageX - this._canvas.offsetLeft;
        const localY = pageY - this._canvas.offsetTop;
        this._view.onTouchesBegan(localX, localY);
    }
    /**
     * マウスポインタが動いたら呼ばれる。
     */
    onPointMoved(pageX, pageY) {
        if (!this._captured) {
            return;
        }
        const localX = pageX - this._canvas.offsetLeft;
        const localY = pageY - this._canvas.offsetTop;
        this._view.onTouchesMoved(localX, localY);
    }
    /**
     * クリックが終了したら呼ばれる。
     */
    onPointEnded(pageX, pageY) {
        this._captured = false;
        if (!this._view) {
            LAppPal.printMessage('view notfound');
            return;
        }
        const localX = pageX - this._canvas.offsetLeft;
        const localY = pageY - this._canvas.offsetTop;
        this._view.onTouchesEnded(localX, localY);
    }
    /**
     * タッチがキャンセルされると呼ばれる。
     */
    onTouchCancel(pageX, pageY) {
        this._captured = false;
        if (!this._view) {
            LAppPal.printMessage('view notfound');
            return;
        }
        const localX = pageX - this._canvas.offsetLeft;
        const localY = pageY - this._canvas.offsetTop;
        this._view.onTouchesEnded(localX, localY);
    }
    isContextLost() {
        return this._glManager.getGl().isContextLost();
    }
}
//# sourceMappingURL=lappsubdelegate.js.map