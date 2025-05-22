class Player {
  constructor() {
    this.maxHP = 30;
    this.hp = this.maxHP;
    this.block = 0;
    this.reflectNextAttack = false; 
  }
  takeDamage(dmg) {
    const damageAfterBlock = Math.max(dmg - this.block, 0);
    this.block = Math.max(this.block - dmg, 0);
    this.hp -= damageAfterBlock;
    if (this.hp < 0) this.hp = 0;
  }
  gainBlock(amount) {
    this.block += amount;
  }
  heal(amount) {
    this.hp += amount;
    if (this.hp > this.maxHP) this.hp = this.maxHP;
  }
}

class Enemy {
  constructor() {
    this.maxHP = 20;
    this.hp = this.maxHP;
    this.attackPower = 4;
  }
  takeDamage(dmg) {
    this.hp -= dmg;
    if (this.hp < 0) this.hp = 0;
  }
  attack(player) {
    if (player.reflectNextAttack) {
      logAction('プレイヤーは攻撃を反射した！敵に反射ダメージ！');
      this.takeDamage(this.attackPower);
      player.reflectNextAttack = false;
    } else {
      player.takeDamage(this.attackPower);
    }
  }
}

// ゲーム状態
const player = new Player();
const enemy = new Enemy();
let turn = 1;
let isPlayerTurn = true;
let playerDeck = []; //デッキ
let playerHand = []; //手札
let discardPile = []; //山札
let mana = 3;          // 現在のマナ
const maxMana = 3;     // 最大マナ

function drawCards(n) {
  for (let i = 0; i < n; i++) {
    if (playerDeck.length === 0) {
      if (discardPile.length > 0) {
        // 捨て札をシャッフルして山札へ
        playerDeck = shuffle([...discardPile]);
        discardPile = [];
        logAction('捨て札をシャッフルして山札に戻しました。');
      } else {
        // 捨て札もなければ引けない
        break;
      }
    }
    const card = playerDeck.shift();
    playerHand.push(card);
    displayCardInHand(card);
  }
  // プレイ可能なカードがなければ警告 or 自動ターン終了
  if (!canPlayAnyCard()) {
    alert('使えるカードがありません。ターンを終了します。');
    logAction('使えるカードがないため、ターンを終了します。');
    endTurn(); // 自動終了処理だが、ボタンに変えることも可能
  }
}

function parseEffect(effectStr) {
  if (!effectStr) return [];
  const parts = effectStr.split('+');

  const effects = parts.map(part => {
    part = part.trim();

    let m;
    m = part.match(/敵に(\d+)ダメージ×(\d+)回/);
    if (m) return { target: "enemy", action: "multiDamage", value: Number(m[1]), times: Number(m[2]) };

    m = part.match(/敵に(\d+)ダメージ/);
    if (m) return { target: "enemy", action: "damage", value: Number(m[1]) };

    m = part.match(/味方を(\d+)回復/);
    if (m) return { target: "player", action: "heal", value: Number(m[1]) };

    m = part.match(/(\d+)ターン燃焼効果/);
    if (m) return { target: "enemy", action: "burn", duration: Number(m[1]) };

    m = part.match(/(\d+)ブロックを得る/);
    if (m) return { target: "player", action: "block", value: Number(m[1]) };

    m = part.match(/(\d+)ターン凍結/);
    if (m) return { target: "enemy", action: "freeze", duration: Number(m[1]) };

    // 解析できなければ raw 情報を残す
    return { raw: part };
  });

  return effects;
}

function prepareDeckEffects(deck) {
  deck.forEach(card => {
    card.effects = parseEffect(card.effect);
  });
}

function playCard(card) {
  const cost = Number(card.cost) || 0;
  const power = Number(card.power) || 0;

  if (mana < cost) {
    alert(`マナが足りません！（必要: ${cost}）`);
    return;
  }
  mana -= cost;

  if (card.effects && Array.isArray(card.effects)) {
    card.effects.forEach(effect => {
      const value = Number(effect.value) || 0;

      switch (effect.action) {
        case 'damage':
          enemy.takeDamage(value);
          logAction(`プレイヤーは${card.name}を使い、敵に${value}ダメージ！`);
          showAttackEffect(); // 🔥エフェクト表示
          break;
        case 'block':
          player.gainBlock(value);
          logAction(`プレイヤーは${card.name}を使い、${value}ブロックを得た！`);
          break;
        case 'heal':
          player.heal(value);
          logAction(`プレイヤーは${card.name}を使い、${value}回復した！`);
          break;
        case 'reflect':
          // reflect は次ターンの敵の攻撃を跳ね返すなど、ここでフラグを立てて処理
          player.reflectNextAttack = true;
          logAction(`プレイヤーは${card.name}を使い、次の攻撃を反射する！`);
          break;
        case 'multiDamage':
          for (let i = 0; i < effect.times; i++) {
            enemy.takeDamage(value);
            logAction(`プレイヤーは${card.name}で${i + 1}回目の攻撃！敵に${value}ダメージ！`);
          }
          break;
        default:
          logAction(`プレイヤーは${card.name}を使ったが、未対応の効果タイプ: ${effect.type}`);
      }
    });
  } else {
    logAction(`プレイヤーは${card.name}を使ったが、効果が設定されていません。`);
  }

  // プレイ後、捨て札へ
  discardPile.push(card);

  // 手札から除去
  playerHand = playerHand.filter(c => c !== card);
  // 表示も削除
  updateUI();
  checkWinLose();

  if (mana <= 0 || !canPlayAnyCard()) {
    logAction('もう出せるカードがないため、ターンを終了します。');
    endTurn();
  }
}

function endTurn() {
  if (isPlayerTurn) {
    isPlayerTurn = false;
    enemy.attack(player);
    logAction(`敵の攻撃！プレイヤーに${enemy.attackPower}ダメージ！`);
    updateUI();
    checkWinLose();

    // プレイヤーのターン開始
    turn++;
    isPlayerTurn = true;
    mana = maxMana; // マナ回復

    // ■ 手札をリセット（使ったカードも使わなかったカードも捨てる）
    // 手札をすべて捨て札に移動
    discardPile.push(...playerHand);
    playerHand = [];
    document.getElementById('hand').innerHTML = '';

    // ■ 5枚引く（山札から）
    drawCards(5);

    logAction(`プレイヤーのターン開始。マナが${mana}に回復しました。`);
    updateUI();
  }
}


function checkWinLose() {
  if (enemy.hp <= 0) {
    alert('勝利！敵を倒した！');
    resetGame();
  } else if (player.hp <= 0) {
    alert('敗北…プレイヤーが倒れた。');
    resetGame();
  }
}

function logAction(text) {
  const logElem = document.getElementById('log');
  logElem.textContent += text + '\n';
  logElem.scrollTop = logElem.scrollHeight;
}

function updateUI() {
  document.getElementById('playerHP').textContent = `HP: ${player.hp}/${player.maxHP} ブロック: ${player.block}`;
  document.getElementById('enemyHP').textContent = `敵HP: ${enemy.hp}/${enemy.maxHP}`;
  document.getElementById('mana').textContent = `マナ: ${mana} / ${maxMana}`;
}

function resetGame() {
  player.hp = player.maxHP;
  player.block = 0;
  enemy.hp = enemy.maxHP;
  turn = 1;
  isPlayerTurn = true;
  document.getElementById('log').textContent = '';
  updateUI();
}

function displayCardInHand(card) {
  const handDiv = document.getElementById('hand');
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card';
  cardDiv.innerHTML = `
    <img src="${card.image || 'https://via.placeholder.com/150'}" alt="${card.name}">
    <strong>${card.name}</strong><br>
    種類: ${card.type}<br>
    効果: ${card.effect}<br>
    レア: ${card.rarity}
  `;
  cardDiv.onclick = () => {
    const cost = Number(card.cost) || 0;
    if (mana < cost) {
      alert(`マナが足りません！（必要: ${cost}）`);
      return;
    }
    playCard(card);
    // 使ったカードを手札から削除
    playerHand = playerHand.filter(c => c !== card);
    cardDiv.remove();
  };
  handDiv.appendChild(cardDiv);
}

function startBattle() {
  // 初期化
  resetGame();

  // デッキからカード10枚をセット
  playerDeck = shuffle([...deck]);
  prepareDeckEffects(playerDeck);

  // プレイヤー手札を空に
  playerHand = [];

  // カード表示用のhand要素をクリア
  document.getElementById('hand').innerHTML = '';

  // 手札に最初の5枚を配る（例）
  drawCards(5);

  // ログをクリア
  document.getElementById('log').textContent = 'バトル開始！\n';

  // UI更新
  updateUI();
  
  // 「3枚のカードを取得」ボタンを非表示に
  document.getElementById('get-cards-btn').style.display = 'none';
  
  // ボタンなど表示調整
  document.getElementById('battle-button').style.display = 'none';
  document.getElementById('deck-count').style.display = 'none';
  document.getElementById('card-container').style.display = 'none';
}

function canPlayAnyCard() {
  return playerHand.some(card => mana >= (Number(card.cost) || 0));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showAttackEffect() {
  const effect = document.getElementById('attack-effect');
  if (!effect) return;

  effect.style.display = 'block';
  effect.style.opacity = '1';

  setTimeout(() => {
    effect.style.transition = 'opacity 0.5s';
    effect.style.opacity = '0';
    setTimeout(() => {
      effect.style.display = 'none';
      effect.style.transition = '';
    }, 500);
  }, 500);
}

// 1. モデル読み込み後に、Live2DModelオブジェクトにアクセス
// PixiJS アプリケーションを作成して表示
const app = new PIXI.Application({
  width: 300,
  height: 500,
  transparent: true
});
document.getElementById('live2d-container').appendChild(app.view);

let live2dModel; // ここにモデルインスタンスを保持

Live2DModel.from("model/IceGirl/IceGirl.model3.json").then(model => {
  live2dModel = model;

  model.x = 0;
  model.y = 0;
  model.scale.set(0.5);

  app.stage.addChild(model);

  // 2. 初期モーション再生（例: "Idle"）
  playMotion("Idle", 0);
});

// 3. モーション再生関数
function playMotion(group, index) {
  if (!live2dModel || !live2dModel.internalModel.motionManager) return;

  const motions = live2dModel.internalModel.motionGroups[group];
  if (!motions || !motions[index]) {
    console.warn("モーショングループが存在しない:", group, index);
    return;
  }

  live2dModel.internalModel.motionManager.startMotion(group, index, 2); // 2 = 中優先度
}

  const motionManager = live2dModel.internalModel.motionManager;
  const motionIndex = live2dModel.internalModel.motionGroups[name]?.length > 0 ? 0 : null;

  if (motionIndex !== null) {
    motionManager.startMotion(name, motionIndex, priority);
  } else {
    console.warn(`モーショングループ '${name}' が見つかりません`);
  }

// 例：クリックで TapBody を再生
app.view.addEventListener("click", () => {
  console.log("Clicked!");
  playMotion("TapBody", 2);
});
