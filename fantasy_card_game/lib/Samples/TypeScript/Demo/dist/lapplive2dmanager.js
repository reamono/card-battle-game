/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */
import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { csmVector } from '@framework/type/csmvector';
import * as LAppDefine from './lappdefine';
import { LAppModel } from './lappmodel';
import { LAppPal } from './lapppal';
/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
    /**
     * 現在のシーンで保持しているすべてのモデルを解放する
     */
    releaseAllModel() {
        this._models.clear();
    }
    /**
     * 画面をドラッグした時の処理
     *
     * @param x 画面のX座標
     * @param y 画面のY座標
     */
    onDrag(x, y) {
        const model = this._models.at(0);
        if (model) {
            model.setDragging(x, y);
        }
    }
    /**
     * 画面をタップした時の処理
     *
     * @param x 画面のX座標
     * @param y 画面のY座標
     */
    onTap(x, y) {
        if (LAppDefine.DebugLogEnable) {
            LAppPal.printMessage(`[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`);
        }
        const model = this._models.at(0);
        if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
            if (LAppDefine.DebugLogEnable) {
                LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameHead}]`);
            }
            model.setRandomExpression();
        }
        else if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
            if (LAppDefine.DebugLogEnable) {
                LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameBody}]`);
            }
            model.startRandomMotion(LAppDefine.MotionGroupTapBody, LAppDefine.PriorityNormal, this.finishedMotion, this.beganMotion);
        }
    }
    /**
     * 画面を更新するときの処理
     * モデルの更新処理及び描画処理を行う
     */
    onUpdate() {
        const { width, height } = this._subdelegate.getCanvas();
        const projection = new CubismMatrix44();
        const model = this._models.at(0);
        if (model.getModel()) {
            if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
                // 横に長いモデルを縦長ウィンドウに表示する際モデルの横サイズでscaleを算出する
                model.getModelMatrix().setWidth(2.0);
                projection.scale(1.0, width / height);
            }
            else {
                projection.scale(height / width, 1.0);
            }
            // 必要があればここで乗算
            if (this._viewMatrix != null) {
                projection.multiplyByMatrix(this._viewMatrix);
            }
        }
        model.update();
        model.draw(projection); // 参照渡しなのでprojectionは変質する。
    }
    /**
     * 次のシーンに切りかえる
     * サンプルアプリケーションではモデルセットの切り替えを行う。
     */
    nextScene() {
        const no = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
        this.changeScene(no);
    }
    /**
     * シーンを切り替える
     * サンプルアプリケーションではモデルセットの切り替えを行う。
     * @param index
     */
    changeScene(index) {
        this._sceneIndex = index;
        if (LAppDefine.DebugLogEnable) {
            LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
        }
        // ModelDir[]に保持したディレクトリ名から
        // model3.jsonのパスを決定する。
        // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
        const model = LAppDefine.ModelDir[index];
        const modelPath = LAppDefine.ResourcesPath + model + '/';
        let modelJsonName = LAppDefine.ModelDir[index];
        modelJsonName += '.model3.json';
        this.releaseAllModel();
        const instance = new LAppModel();
        instance.setSubdelegate(this._subdelegate);
        instance.loadAssets(modelPath, modelJsonName);
        this._models.pushBack(instance);
    }
    setViewMatrix(m) {
        for (let i = 0; i < 16; i++) {
            this._viewMatrix.getArray()[i] = m.getArray()[i];
        }
    }
    /**
     * モデルの追加
     */
    addModel(sceneIndex = 0) {
        this._sceneIndex = sceneIndex;
        this.changeScene(this._sceneIndex);
    }
    /**
     * コンストラクタ
     */
    constructor() {
        // モーション再生開始のコールバック関数
        this.beganMotion = (self) => {
            LAppPal.printMessage('Motion Began:');
            console.log(self);
        };
        // モーション再生終了のコールバック関数
        this.finishedMotion = (self) => {
            LAppPal.printMessage('Motion Finished:');
            console.log(self);
        };
        this._subdelegate = null;
        this._viewMatrix = new CubismMatrix44();
        this._models = new csmVector();
        this._sceneIndex = 0;
    }
    /**
     * 解放する。
     */
    release() { }
    /**
     * 初期化する。
     * @param subdelegate
     */
    initialize(subdelegate) {
        this._subdelegate = subdelegate;
        this.changeScene(this._sceneIndex);
    }
}
//# sourceMappingURL=lapplive2dmanager.js.map