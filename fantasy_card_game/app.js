// --- Live2D関連 ---
let app;
let live2dModel;

function initLive2D() {
  const container = document.getElementById("live2d-app");
  if (!container) {
    console.error("live2d-app コンテナが見つかりません");
    return;
  }
  container.innerHTML = ""; // 既存canvas消去

  app = new PIXI.Application({
    width: 300,
    height: 500,
    transparent: true,
    premultipliedAlpha: false,
  });
  container.appendChild(app.view);

  PIXI.live2d.Live2DModel.from("IceGirl_Live2d/IceGirl.model3.json")
    .then(model => {
      live2dModel = model;
      model.scale.set(0.3);
      model.anchor.set(0.5, 0.5);
      model.x = app.renderer.width / 2;
      model.y = app.renderer.height / 2 + 20;
      app.stage.addChild(model);

      // モデル準備完了時にモーション名確認（デバッグ）
      model.once("modelReady", () => {
        if (model.internalModel && model.internalModel.motionGroups) {
          console.log("モーショングループ一覧:", Object.keys(model.internalModel.motionGroups));
        }
      });
    })
    .catch(err => {
      console.error("Live2Dモデルの読み込みに失敗:", err);
    });

  // クリックでTapBodyモーション再生（pointer-events:noneなので機能しないが念のため）
  app.view.addEventListener("click", () => {
    playMotion("TapBody", 2);
  });
}

function playMotion(group, index) {
  if (!live2dModel || !live2dModel.internalModel.motionManager) {
    console.warn("Live2Dモデルまたはモーションマネージャー未定義");
    return;
  }
  const motions = live2dModel.internalModel.motionGroups[group];
  if (!motions || !motions[index]) {
    console.warn(`モーショングループ不存在: ${group}[${index}]`);
    return;
  }
  live2dModel.internalModel.motionManager.startMotion(group, index, 2);
}

// --- ゲームロジック ---

// グローバル状態
let playerHP = 30;
let playerMaxHP = 30;
let playerBlock = 0;
let playerMana = 3;
let playerMaxMana = 3;

let enemyHP = 20;
let enemyMaxHP = 20;

let hand = [];  // 手札
let deck = [];  // デッキはHTML側で操作されるためここは空でOK（必要あれば同期可能）

// UI参照まとめ
const deckCountEl = document.getElementById("deck-count");
const cardContainerEl = document.getElementById("card-container");
const messageEl = document.getElementById("message");
const playerHPEl = document.getElementById("playerHP");
const manaEl = document.getElementById("mana");
const enemyHPEl = document.getElementById("enemyHP");
const logEl = document.getElementById("log");
const handEl = document.getElementById("hand");
const attackEffectEl = document.getElementById("attack-effect");
const battleBtn = document.getElementById("battle-button");
const getCardsBtn = document.getElementById("get-cards-btn");

// カードの効果の簡易処理（実際はもっと細分化可）
function applyCardEffect(card) {
  const effect = card.effect;
  log(`カード使用: ${card.name} - 効果: ${effect}`);

  if (/敵に(\d+)ダメージ/.test(effect)) {
    // 敵へのダメージ
    const damage = parseInt(RegExp.$1, 10);
    damageEnemy(damage);
  } else if (/味方を(\d+)回復/.test(effect)) {
    // プレイヤー回復
    const heal = parseInt(RegExp.$1, 10);
    healPlayer(heal);
  } else if (/(\d+)ブロック/.test(effect)) {
    const block = parseInt(RegExp.$1, 10);
    playerBlock += block;
    log(`プレイヤーは${block}のブロックを得た`);
  } else if (/反射/.test(effect)) {
    log("次の攻撃を反射する効果発動（未実装）");
    // 反射効果は未実装（拡張可能）
  } else {
    log("効果が未定義または未対応");
  }
  updateUI();
}

function damageEnemy(dmg) {
  enemyHP -= dmg;
  if (enemyHP < 0) enemyHP = 0;
  log(`敵に${dmg}ダメージ！ 残りHP: ${enemyHP}`);
  showAttackEffect();
  updateUI();
  if (enemyHP === 0) {
    log("敵を倒した！バトル勝利！");
    battleBtn.style.display = "none";
    getCardsBtn.style.display = "inline-block";
  }
}

function healPlayer(amount) {
  playerHP += amount;
  if (playerHP > playerMaxHP) playerHP = playerMaxHP;
  log(`味方を${amount}回復。現在HP: ${playerHP}`);
  updateUI();
}

function log(text) {
  logEl.textContent += text + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function showAttackEffect() {
  attackEffectEl.style.display = "block";
  if (live2dModel) {
    playMotion("Attack", 0); // 攻撃モーション（あれば）
  }
  setTimeout(() => {
    attackEffectEl.style.display = "none";
  }, 500);
}

function updateUI() {
  playerHPEl.textContent = `HP: ${playerHP} / ${playerMaxHP} ブロック: ${playerBlock}`;
  manaEl.textContent = `マナ: ${playerMana} / ${playerMaxMana}`;
  enemyHPEl.textContent = `敵HP: ${enemyHP} / ${enemyMaxHP}`;
  updateDeckCount();
  renderHand();
}

function updateDeckCount() {
  deckCountEl.textContent = `現在のデッキ枚数: ${deck.length} / 10`;
  if (deck.length === 10) {
    battleBtn.style.display = "inline-block";
    getCardsBtn.style.display = "none";
  } else {
    battleBtn.style.display = "none";
    getCardsBtn.style.display = "inline-block";
  }
}

function renderHand() {
  handEl.innerHTML = "";
  hand.forEach((card, idx) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.cursor = playerMana >= parseInt(card.cost, 10) ? "pointer" : "not-allowed";
    div.innerHTML = `
      <img src="${card.image || "https://via.placeholder.com/150"}" alt="${card.name}" style="width: 100px;">
      <strong>${card.name}</strong><br>
      コスト: ${card.cost}<br>
      効果: ${card.effect}
    `;
    div.onclick = () => {
      if (playerMana < parseInt(card.cost, 10)) {
        log("マナ不足でカードを使えません。");
        return;
      }
      useCard(idx);
    };
    handEl.appendChild(div);
  });
}

function useCard(handIndex) {
  const card = hand[handIndex];
  if (!card) return;
  const cost = parseInt(card.cost, 10);
  if (playerMana < cost) {
    log("マナ不足です");
    return;
  }
  playerMana -= cost;
  applyCardEffect(card);

  // 手札からカードを消す
  hand.splice(handIndex, 1);
  drawCard(); // 1枚補充
  updateUI();
}

// デッキからランダムに手札に補充（10枚限定ゲーム想定）
function drawCard() {
  if (hand.length >= 5) return; // 最大5枚まで
  if (deck.length === 0) return;

  // ランダムでデッキから1枚取り出す
  const index = Math.floor(Math.random() * deck.length);
  const card = deck[index];
  hand.push(card);
  updateUI();
}

// バトル開始時処理
function startBattle() {
  if (deck.length < 10) {
    alert("デッキが10枚になるまでカードを追加してください");
    return;
  }
  // 初期状態リセット
  playerHP = playerMaxHP;
  playerBlock = 0;
  playerMana = playerMaxMana;
  enemyHP = enemyMaxHP;
  hand = [];
  logEl.textContent = "";
  updateUI();

  // 初手に5枚引く
  for (let i = 0; i < 5; i++) drawCard();

  log("バトル開始！");
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  initLive2D();
  updateUI();
});
