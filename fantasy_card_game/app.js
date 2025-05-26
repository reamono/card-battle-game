// スプレッドシートのJSONエンドポイントを指定
const API_URL = 'https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec';

let cardPool = [];         // 全カードデータ
let playerDeck = [];       // 選ばれた10枚
let deckBuildCount = 0;    // 選択済み枚数
let player = {
  hp: 30,
  mana: 3,
  shield: 0,
};
let enemy = {
  hp: 20,
  attack: 4,
};
let floor = 1;
let playerStatus = {
  healingOverTime: 0,
  shieldTurns: 0,
  preventEnemyAction: false,
  reflectNext: false
};

let enemyStatus = {
  stunned: false
};

// JSONデータを取得して初期化
document.addEventListener("DOMContentLoaded", () => {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      cardPool = data;
      // showDeckChoices(); ← 初期表示では呼び出さない
      document.getElementById("start-battle").addEventListener("click", () => {
        document.getElementById("start-battle").style.display = "none";
        document.getElementById("deck-builder").style.display = "block";
        showDeckChoices();
      });
    });
});

// === レアリティ別の出現確率設定 ===
const rarityWeights = {
  '★': 60,
  '★★': 30,
  '★★★': 10
};

function getWeightedRandomCards(n, pool) {
  const weightedPool = [];
  pool.forEach(card => {
    const weight = rarityWeights[card.rarity] || 0;
    for (let i = 0; i < weight; i++) {
      weightedPool.push(card);
    }
  });
  const shuffled = [...weightedPool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// デッキ構築用：ランダムに3枚表示
function showDeckChoices() {
  const choiceArea = document.getElementById("deck-choice");
  choiceArea.innerHTML = "";

  const random3 = getWeightedRandomCards(3, cardPool);

  random3.forEach(card => {
    const cardElem = document.createElement("div");
    const rarityClass = getRarityClass(card.rarity);
    cardElem.className = `card ${rarityClass}`;
    cardElem.innerHTML = `
      <h3>${card.name}</h3>
      <p>${card.effect}</p>
      <p>マナ: ${card.cost}</p>
      <p class="rarity">${card.rarity}</p>
    `;

    cardElem.addEventListener("click", () => {
      playerDeck.push(card);
      deckBuildCount++;
      document.getElementById("deck-count").textContent = deckBuildCount;

      if (deckBuildCount >= 10) {
        startBattlePhase();
      } else {
        showDeckChoices();
      }
    });

    choiceArea.appendChild(cardElem);
  });
}

// ランダムにN枚選出
function getRandomCards(n, pool) {
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

function startBattlePhase() {
  document.getElementById("deck-builder").style.display = "none";
  document.getElementById("battle-screen").style.display = "block";

  drawHand();
  updateBattleStatus();

  document.getElementById("end-turn").addEventListener("click", () => {
    enemyTurn();
  });
}

function drawHand() {
  const handContainer = document.getElementById("hand-container");
  handContainer.innerHTML = "";

  const hand = getRandomCards(5, playerDeck); // 10枚から5枚引く

  hand.forEach(card => {
    const cardElem = document.createElement("div");
    const rarityClass = getRarityClass(card.rarity); // レアリティに応じたクラスを取得
    cardElem.className = `card ${rarityClass}`; // クラスに追加
    cardElem.innerHTML = `
      <h3>${card.name}</h3>
      <p>${card.effect}</p>
      <p>マナ: ${card.cost}</p>
      <p class="rarity">${card.rarity}</p>
    `;
    cardElem.addEventListener("click", () => {
      if (player.mana >= card.cost) {
        playCard(card);
        cardElem.classList.add("used");
      }
    });

    handContainer.appendChild(cardElem);
  });
}

//カード処理
function playCard(card) {
  const log = document.getElementById("log");
  log.innerHTML += `<p>${card.name} を使った！</p>`;
  player.mana -= card.cost;

  switch (card.name) {
    case "ドレイン":
      enemy.hp -= card.power;
      player.hp += 2;
      log.innerHTML += `<p>敵に${card.power}ダメージ、自分を2回復！</p>`;
      break;
    case "フレアストライク":
      enemy.hp -= card.power;
      log.innerHTML += `<p>敵に${card.power}ダメージ！次のターン使用不可（未実装）</p>`;
      break;
    case "マナブースト":
      player.mana += 2;
      log.innerHTML += `<p>マナが2回復！</p>`;
      break;
    case "パワーアップ":
      player.nextAttackBoost = 3;
      log.innerHTML += `<p>次の攻撃ダメージが+3される！</p>`;
      break;
    case "ブラッドソード":
      enemy.hp -= card.power;
      let selfDamage = 1;
      if (player.shield > 0) {
        const blocked = Math.min(player.shield, selfDamage);
        selfDamage -= blocked;
        player.shield -= blocked;
        log.innerHTML += `<p>自分のシールドで${blocked}軽減！</p>`;
      }
      player.hp -= selfDamage;
      log.innerHTML += `<p>敵に${card.power}ダメージ！自分に${selfDamage}ダメージ</p>`;
      break;
    case "シールドチャージ":
      player.shield += card.power;
      player.mana += 1;
      log.innerHTML += `<p>シールド${card.power}とマナ1を獲得！</p>`;
      break;
    case "バリア":
      playerStatus.shieldTurns = 3;
      player.shield += 2;
      log.innerHTML += `<p>3ターン持続のシールド2を獲得！</p>`;
      break;
    case "アンチマジック":
      playerStatus.preventEnemyAction = true;
      log.innerHTML += `<p>次の敵の行動を封じた！</p>`;
      break;
    case "雷鳴":
      enemy.hp -= card.power;
      enemyStatus.stunned = true;
      log.innerHTML += `<p>敵に${card.power}ダメージ＆気絶！</p>`;
      break;
    case "シールドウォール":
      playerStatus.shieldTurns = 1;
      log.innerHTML += `<p>1ターンの全ダメージ無効化！</p>`;
      break;
    case "回復の祈り":
      playerStatus.healingOverTime = 3;
      log.innerHTML += `<p>毎ターン3回復（3ターン継続）！</p>`;
      break;
    case "スモークボム":
      playerStatus.preventEnemyAction = true;
      log.innerHTML += `<p>敵の攻撃を無効化！</p>`;
      break;
    case "シャドウスラッシュ":
      enemy.hp -= card.power;
      log.innerHTML += `<p>敵に${card.power}ダメージ＋命中率低下（演出）！</p>`;
      break;
    case "オーラヒール":
      player.hp += 2;
      player.mana += 1;
      log.innerHTML += `<p>HP2回復＆マナ1回復！</p>`;
      break;
    case "反射の鏡":
      playerStatus.reflectNext = true;
      log.innerHTML += `<p>次の敵の攻撃を反射！</p>`;
      break;
    case "バーストブレード":
      const burst = player.mana + card.power;
      enemy.hp -= burst;
      player.mana = 0;
      log.innerHTML += `<p>全マナ消費して${burst}ダメージ！</p>`;
      break;
    default:
      if (card.type === "攻撃") {
        let dmg = card.power;
        if (player.nextAttackBoost) {
          dmg += player.nextAttackBoost;
          player.nextAttackBoost = 0;
        }
        enemy.hp -= dmg;
        log.innerHTML += `<p>敵に${dmg}ダメージ！</p>`;
      } else if (card.type === "回復") {
        player.hp += card.power;
        log.innerHTML += `<p>HPを${card.power}回復！</p>`;
      } else if (card.type === "防御") {
        player.shield += card.power;
        log.innerHTML += `<p>シールド${card.power}付与！</p>`;
      }
      break;
  }

  checkBattleState();
  updateBattleStatus();
}

function updateBattleStatus() {
  document.getElementById("player-hp").textContent = player.hp;
  document.getElementById("player-mana").textContent = player.mana;
  document.getElementById("player-shield").textContent = player.shield;
  document.getElementById("enemy-hp").textContent = enemy.hp;
  document.getElementById("floor").textContent = floor;
}

function processTurnEffects() {
  const log = document.getElementById("log");

  // 持続回復処理
  if (playerStatus.healingOverTime > 0) {
    player.hp += 3;
    playerStatus.healingOverTime--;
    log.innerHTML += `<p>持続回復でHPが3回復！</p>`;
  }

  // バリア（全ダメージ無効）のターン数減少
  if (playerStatus.shieldTurns > 0) {
    playerStatus.shieldTurns--;
    if (playerStatus.shieldTurns === 0) {
      log.innerHTML += `<p>バリアの効果が切れた。</p>`;
    }
  }

  // 敵の気絶解除
  if (enemyStatus.stunned) {
    enemyStatus.stunned = false;
    log.innerHTML += `<p>敵は気絶から回復した。</p>`;
  }

  // 敵行動無効フラグ解除（1回きり）
  if (playerStatus.preventEnemyAction) {
    playerStatus.preventEnemyAction = false;
  }

  // 反射状態も1回のみで解除（敵行動時に使われる）
}

// === 敵ターンの処理 ===
function enemyTurn() {
  const log = document.getElementById("log");
  log.innerHTML += `<p>敵のターン！</p>`;

  processTurnEffects();

  if (playerStatus.preventEnemyAction) {
    log.innerHTML += `<p>敵の行動は封じられている！</p>`;
  } else if (enemyStatus.stunned) {
    log.innerHTML += `<p>敵は気絶していて行動できない！</p>`;
  } else {
    let damage = enemy.attack;

    if (playerStatus.shieldTurns > 0) {
      damage = 0;
      log.innerHTML += `<p>バリアでダメージを無効化！</p>`;
    } else if (playerStatus.reflectNext) {
      log.innerHTML += `<p>敵の攻撃を反射した！敵に${damage}ダメージ！</p>`;
      enemy.hp -= damage;
      playerStatus.reflectNext = false;
    } else {
      if (player.shield > 0) {
        const blocked = Math.min(player.shield, damage);
        damage -= blocked;
        player.shield -= blocked;
        log.innerHTML += `<p>シールドで${blocked}軽減！</p>`;
      }
      player.hp -= damage;
      log.innerHTML += `<p>敵の攻撃！${damage}ダメージを受けた！</p>`;
    }
  }

  player.mana = 3; // 次ターン回復
  updateBattleStatus();
  checkBattleState();
  drawHand();
}

function checkBattleState() {
  if (enemy.hp <= 0) {
    const log = document.getElementById("log");
    log.innerHTML += `<p>敵を倒した！</p>`;
    nextFloor();
  }

  if (player.hp <= 0) {
    alert("ゲームオーバー！");
    location.reload();
  }
}

// === ボス撃破時にレアカード追加（nextFloor内） ===
function nextFloor() {
  floor++;
  enemy.hp = 20 + floor * 5;
  enemy.attack = 4 + floor;
  player.mana = 3;
  player.shield = 0;

  const log = document.getElementById("log");
  log.innerHTML += `<p>${floor}階に進んだ！敵が強くなった！</p>`;

  // ★★以上のカードから1枚追加
  const candidateCards = cardPool.filter(c => c.rarity === '★★' || c.rarity === '★★★');
  if (candidateCards.length > 0) {
    const reward = getRandomCards(1, candidateCards)[0];
    playerDeck.push(reward);
    log.innerHTML += `<p>報酬として${reward.name}（${reward.rarity}）を獲得！</p>`;
  }

  updateBattleStatus();
  drawHand();
}

function getRarityClass(rarity) {
  switch (rarity) {
    case '★': return 'rarity-common';
    case '★★': return 'rarity-rare';
    case '★★★': return 'rarity-epic';
    default: return 'rarity-common';
  }
}

