class Player {
  constructor() {
    this.maxHP = 30;
    this.hp = this.maxHP;
    this.block = 0;
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
    player.takeDamage(this.attackPower);
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

  // effects配列の効果を1つずつ適用
  card.effects.forEach(effect => {
    switch (effect.action) {
      case "damage":
        enemy.takeDamage(effect.value);
        logAction(`プレイヤーは${card.name}を使った。敵に${effect.value}ダメージ！`);
        break;

      case "multiDamage":
        for(let i = 0; i < effect.times; i++) {
          enemy.takeDamage(effect.value);
        }
        logAction(`プレイヤーは${card.name}を使った。敵に${effect.value}ダメージ×${effect.times}回！`);
        break;

      case "heal":
        player.heal(effect.value);
        logAction(`プレイヤーは${card.name}を使った。${effect.value}回復した！`);
        break;

      case "block":
        player.gainBlock(effect.value);
        logAction(`プレイヤーは${card.name}を使った。${effect.value}ブロックを得た！`);
        break;

      case "burn":
        // 燃焼効果は状態異常処理があればそちらで実装してください
        logAction(`プレイヤーは${card.name}を使った。敵に${effect.duration}ターン燃焼効果を付与！`);
        break;

      case "freeze":
        logAction(`プレイヤーは${card.name}を使った。敵に${effect.duration}ターン凍結効果を付与！`);
        break;

      default:
        logAction(`プレイヤーは${card.name}を使ったが、未対応の効果: ${effect.raw || effect.action}`);
        break;
    }
  });

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
