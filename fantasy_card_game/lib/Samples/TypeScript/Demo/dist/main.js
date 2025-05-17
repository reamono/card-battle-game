/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */
import { LAppDelegate } from './lappdelegate';
/**
 * ブラウザロード後の処理
 */
window.addEventListener('load', () => {
    // Initialize WebGL and create the application instance
    if (!LAppDelegate.getInstance().initialize()) {
        return;
    }
    LAppDelegate.getInstance().run();
}, { passive: true });
/**
 * 終了時の処理
 */
window.addEventListener('beforeunload', () => LAppDelegate.releaseInstance(), { passive: true });
//# sourceMappingURL=main.js.map