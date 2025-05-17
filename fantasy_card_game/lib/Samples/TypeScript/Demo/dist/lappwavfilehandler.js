/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/** @deprecated この変数は getInstance() が非推奨になったことに伴い、非推奨となりました。 */
export let s_instance = null;
export class LAppWavFileHandler {
    /**
     * クラスのインスタンス（シングルトン）を返す。
     * インスタンスが生成されていない場合は内部でインスタンスを生成する。
     *
     * @return クラスのインスタンス
     * @deprecated このクラスでのシングルトンパターンの使用は非推奨となりました。代わりに new LAppWavFileHandler() を使用してください。
     */
    static getInstance() {
        if (s_instance == null) {
            s_instance = new LAppWavFileHandler();
        }
        return s_instance;
    }
    /**
     * クラスのインスタンス（シングルトン）を解放する。
     *
     * @deprecated この関数は getInstance() が非推奨になったことに伴い、非推奨となりました。
     */
    static releaseInstance() {
        if (s_instance != null) {
            s_instance = void 0;
        }
        s_instance = null;
    }
    update(deltaTimeSeconds) {
        let goalOffset;
        let rms;
        // データロード前/ファイル末尾に達した場合は更新しない
        if (this._pcmData == null ||
            this._sampleOffset >= this._wavFileInfo._samplesPerChannel) {
            this._lastRms = 0.0;
            return false;
        }
        // 経過時間後の状態を保持
        this._userTimeSeconds += deltaTimeSeconds;
        goalOffset = Math.floor(this._userTimeSeconds * this._wavFileInfo._samplingRate);
        if (goalOffset > this._wavFileInfo._samplesPerChannel) {
            goalOffset = this._wavFileInfo._samplesPerChannel;
        }
        // RMS計測
        rms = 0.0;
        for (let channelCount = 0; channelCount < this._wavFileInfo._numberOfChannels; channelCount++) {
            for (let sampleCount = this._sampleOffset; sampleCount < goalOffset; sampleCount++) {
                const pcm = this._pcmData[channelCount][sampleCount];
                rms += pcm * pcm;
            }
        }
        rms = Math.sqrt(rms /
            (this._wavFileInfo._numberOfChannels *
                (goalOffset - this._sampleOffset)));
        this._lastRms = rms;
        this._sampleOffset = goalOffset;
        return true;
    }
    start(filePath) {
        // サンプル位参照位置を初期化
        this._sampleOffset = 0;
        this._userTimeSeconds = 0.0;
        // RMS値をリセット
        this._lastRms = 0.0;
        this.loadWavFile(filePath);
    }
    getRms() {
        return this._lastRms;
    }
    loadWavFile(filePath) {
        return new Promise(resolveValue => {
            let ret = false;
            if (this._pcmData != null) {
                this.releasePcmData();
            }
            // ファイルロード
            const asyncFileLoad = () => __awaiter(this, void 0, void 0, function* () {
                return fetch(filePath).then(responce => {
                    return responce.arrayBuffer();
                });
            });
            const asyncWavFileManager = (() => __awaiter(this, void 0, void 0, function* () {
                this._byteReader._fileByte = yield asyncFileLoad();
                this._byteReader._fileDataView = new DataView(this._byteReader._fileByte);
                this._byteReader._fileSize = this._byteReader._fileByte.byteLength;
                this._byteReader._readOffset = 0;
                // ファイルロードに失敗しているか、先頭のシグネチャ"RIFF"を入れるサイズもない場合は失敗
                if (this._byteReader._fileByte == null ||
                    this._byteReader._fileSize < 4) {
                    resolveValue(false);
                    return;
                }
                // ファイル名
                this._wavFileInfo._fileName = filePath;
                try {
                    // シグネチャ "RIFF"
                    if (!this._byteReader.getCheckSignature('RIFF')) {
                        ret = false;
                        throw new Error('Cannot find Signeture "RIFF".');
                    }
                    // ファイルサイズ-8（読み飛ばし）
                    this._byteReader.get32LittleEndian();
                    // シグネチャ "WAVE"
                    if (!this._byteReader.getCheckSignature('WAVE')) {
                        ret = false;
                        throw new Error('Cannot find Signeture "WAVE".');
                    }
                    // シグネチャ "fmt "
                    if (!this._byteReader.getCheckSignature('fmt ')) {
                        ret = false;
                        throw new Error('Cannot find Signeture "fmt".');
                    }
                    // fmtチャンクサイズ
                    const fmtChunkSize = this._byteReader.get32LittleEndian();
                    // フォーマットIDは1（リニアPCM）以外受け付けない
                    if (this._byteReader.get16LittleEndian() != 1) {
                        ret = false;
                        throw new Error('File is not linear PCM.');
                    }
                    // チャンネル数
                    this._wavFileInfo._numberOfChannels =
                        this._byteReader.get16LittleEndian();
                    // サンプリングレート
                    this._wavFileInfo._samplingRate =
                        this._byteReader.get32LittleEndian();
                    // データ速度[byte/sec]（読み飛ばし）
                    this._byteReader.get32LittleEndian();
                    // ブロックサイズ（読み飛ばし）
                    this._byteReader.get16LittleEndian();
                    // 量子化ビット数
                    this._wavFileInfo._bitsPerSample =
                        this._byteReader.get16LittleEndian();
                    // fmtチャンクの拡張部分の読み飛ばし
                    if (fmtChunkSize > 16) {
                        this._byteReader._readOffset += fmtChunkSize - 16;
                    }
                    // "data"チャンクが出現するまで読み飛ばし
                    while (!this._byteReader.getCheckSignature('data') &&
                        this._byteReader._readOffset < this._byteReader._fileSize) {
                        this._byteReader._readOffset +=
                            this._byteReader.get32LittleEndian() + 4;
                    }
                    // ファイル内に"data"チャンクが出現しなかった
                    if (this._byteReader._readOffset >= this._byteReader._fileSize) {
                        ret = false;
                        throw new Error('Cannot find "data" Chunk.');
                    }
                    // サンプル数
                    {
                        const dataChunkSize = this._byteReader.get32LittleEndian();
                        this._wavFileInfo._samplesPerChannel =
                            (dataChunkSize * 8) /
                                (this._wavFileInfo._bitsPerSample *
                                    this._wavFileInfo._numberOfChannels);
                    }
                    // 領域確保
                    this._pcmData = new Array(this._wavFileInfo._numberOfChannels);
                    for (let channelCount = 0; channelCount < this._wavFileInfo._numberOfChannels; channelCount++) {
                        this._pcmData[channelCount] = new Float32Array(this._wavFileInfo._samplesPerChannel);
                    }
                    // 波形データ取得
                    for (let sampleCount = 0; sampleCount < this._wavFileInfo._samplesPerChannel; sampleCount++) {
                        for (let channelCount = 0; channelCount < this._wavFileInfo._numberOfChannels; channelCount++) {
                            this._pcmData[channelCount][sampleCount] = this.getPcmSample();
                        }
                    }
                    ret = true;
                    resolveValue(ret);
                }
                catch (e) {
                    console.log(e);
                }
            }))().then(() => {
                resolveValue(ret);
            });
        });
    }
    getPcmSample() {
        let pcm32;
        // 32ビット幅に拡張してから-1～1の範囲に丸める
        switch (this._wavFileInfo._bitsPerSample) {
            case 8:
                pcm32 = this._byteReader.get8() - 128;
                pcm32 <<= 24;
                break;
            case 16:
                pcm32 = this._byteReader.get16LittleEndian() << 16;
                break;
            case 24:
                pcm32 = this._byteReader.get24LittleEndian() << 8;
                break;
            default:
                // 対応していないビット幅
                pcm32 = 0;
                break;
        }
        return pcm32 / 2147483647; //Number.MAX_VALUE;
    }
    /**
     * 指定したチャンネルから音声サンプルの配列を取得する
     *
     * @param usechannel 利用するチャンネル
     * @returns 指定したチャンネルの音声サンプルの配列
     */
    getPcmDataChannel(usechannel) {
        // 指定したチャンネル数がデータ用配列の長さより多いならnullを返す。
        if (!this._pcmData || !(usechannel < this._pcmData.length)) {
            return null;
        }
        // _pcmDataから新規に指定したチャンネルのFloat32Arrayを作成する。
        return Float32Array.from(this._pcmData[usechannel]);
    }
    /**
     * 音声のサンプリング周波数を取得する。
     *
     * @returns 音声のサンプリング周波数
     */
    getWavSamplingRate() {
        if (!this._wavFileInfo || this._wavFileInfo._samplingRate < 1) {
            return null;
        }
        return this._wavFileInfo._samplingRate;
    }
    releasePcmData() {
        for (let channelCount = 0; channelCount < this._wavFileInfo._numberOfChannels; channelCount++) {
            this._pcmData[channelCount] = null;
        }
        delete this._pcmData;
        this._pcmData = null;
    }
    constructor() {
        this.loadFiletoBytes = (arrayBuffer, length) => {
            this._byteReader._fileByte = arrayBuffer;
            this._byteReader._fileDataView = new DataView(this._byteReader._fileByte);
            this._byteReader._fileSize = length;
        };
        this._pcmData = null;
        this._userTimeSeconds = 0.0;
        this._lastRms = 0.0;
        this._sampleOffset = 0.0;
        this._wavFileInfo = new WavFileInfo();
        this._byteReader = new ByteReader();
    }
}
export class WavFileInfo {
    constructor() {
        this._fileName = '';
        this._numberOfChannels = 0;
        this._bitsPerSample = 0;
        this._samplingRate = 0;
        this._samplesPerChannel = 0;
    }
}
export class ByteReader {
    constructor() {
        this._fileByte = null;
        this._fileDataView = null;
        this._fileSize = 0;
        this._readOffset = 0;
    }
    /**
     * @brief 8ビット読み込み
     * @return Csm::csmUint8 読み取った8ビット値
     */
    get8() {
        const ret = this._fileDataView.getUint8(this._readOffset);
        this._readOffset++;
        return ret;
    }
    /**
     * @brief 16ビット読み込み（リトルエンディアン）
     * @return Csm::csmUint16 読み取った16ビット値
     */
    get16LittleEndian() {
        const ret = (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
            this._fileDataView.getUint8(this._readOffset);
        this._readOffset += 2;
        return ret;
    }
    /**
     * @brief 24ビット読み込み（リトルエンディアン）
     * @return Csm::csmUint32 読み取った24ビット値（下位24ビットに設定）
     */
    get24LittleEndian() {
        const ret = (this._fileDataView.getUint8(this._readOffset + 2) << 16) |
            (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
            this._fileDataView.getUint8(this._readOffset);
        this._readOffset += 3;
        return ret;
    }
    /**
     * @brief 32ビット読み込み（リトルエンディアン）
     * @return Csm::csmUint32 読み取った32ビット値
     */
    get32LittleEndian() {
        const ret = (this._fileDataView.getUint8(this._readOffset + 3) << 24) |
            (this._fileDataView.getUint8(this._readOffset + 2) << 16) |
            (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
            this._fileDataView.getUint8(this._readOffset);
        this._readOffset += 4;
        return ret;
    }
    /**
     * @brief シグネチャの取得と参照文字列との一致チェック
     * @param[in] reference 検査対象のシグネチャ文字列
     * @retval  true    一致している
     * @retval  false   一致していない
     */
    getCheckSignature(reference) {
        const getSignature = new Uint8Array(4);
        const referenceString = new TextEncoder().encode(reference);
        if (reference.length != 4) {
            return false;
        }
        for (let signatureOffset = 0; signatureOffset < 4; signatureOffset++) {
            getSignature[signatureOffset] = this.get8();
        }
        return (getSignature[0] == referenceString[0] &&
            getSignature[1] == referenceString[1] &&
            getSignature[2] == referenceString[2] &&
            getSignature[3] == referenceString[3]);
    }
}
//# sourceMappingURL=lappwavfilehandler.js.map