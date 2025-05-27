// スプレッドシートのJSONエンドポイントを指定
const API_URL = 'https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec';

let cardPool = [];         // 全カードデータ
let playerDeck = [];       // 山札
let discardPile = [];      // 捨て札
let currentHand = [];      // 現在の手札
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

// キャラクター画像の表示処理
function showCharacters() {
  const battleArea = document.getElementById("battle-area");

  const playerWrapper = document.createElement("div");
  playerWrapper.className = "character-wrapper";
  const playerImg = document.createElement("img");
  playerImg.src = "images/player.png";
  playerImg.alt = "プレイヤー";
  playerWrapper.appendChild(playerImg);

  const bossWrapper = document.createElement("div");
  bossWrapper.className = "character-wrapper";
  const bossImg = document.createElement("img");
  bossImg.src = "images/boss.png";
  bossImg.alt = "ボス";
  bossWrapper.appendChild(bossImg);

  battleArea.appendChild(playerWrapper);
  battleArea.appendChild(bossWrapper);
}

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
  showCharacters();
  drawHand();
  updateBattleStatus();

  document.getElementById("end-turn").addEventListener("click", () => {
    endPlayerTurn();
    enemyTurn();
  });
}

function drawHand() {
  const handContainer = document.getElementById("hand-container");
  handContainer.innerHTML = "";
  currentHand = [];

  let drawCount = 5; // ← 🔧 ここを追加！

  // 捨て札を山札に戻す（足りないとき）
  if (playerDeck.length < drawCount && discardPile.length > 0) {
    playerDeck = [...playerDeck, ...shuffle(discardPile)];
    discardPile = [];
  }

  // 本当に何も引けないときだけログを出して終了
  if (playerDeck.length === 0 && discardPile.length === 0 && cardPool.length === 0) {
    addLogEntry("カードが尽きてこれ以上引けません！");
    return;
  }

  // デッキが空でカードプールが残っている場合、最初の配布とみなす
  if (playerDeck.length === 0 && cardPool.length > 0) {
    playerDeck = [...cardPool];
  }


  // 実際にカードを引く（最大5枚）
  const drawn = playerDeck.splice(0, drawCount);
  currentHand = [...drawn];

  // 手札を表示
  currentHand.forEach(card => {
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
      if (player.mana >= card.cost) {
        playCard(card);
        discardPile.push(card);
        currentHand = currentHand.filter(c => c !== card);
        cardElem.remove();
        updateDiscardPileDisplay();
      }
    });
    handContainer.appendChild(cardElem);
  });
}

// シャッフル関数
function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

// エフェクト処理
function showEffect(type) {
  const effectElem = document.createElement("div");
  effectElem.className = `card-effect ${type}`;

  // 絵文字の中身を直接設定する
  if (type === "attack") {
    effectElem.textContent = "💥";
  } else if (type === "heal") {
    effectElem.textContent = "✨";
  } else if (type === "defense") {
    effectElem.textContent = "🛡️";
  }

  document.body.appendChild(effectElem);

  setTimeout(() => {
    effectElem.remove();
  }, 1000);
}

//カード処理
function playCard(card) {
  const log = document.getElementById("log");
  addLogEntry(`${card.name} を使った！`);
  player.mana -= card.cost;

  switch (card.name) {
    case "ドレイン":
      enemy.hp -= card.power;
      player.hp += 2;
      addLogEntry(`敵に${card.power}ダメージ、自分を2回復！`);
      break;
    case "フレアストライク":
      enemy.hp -= card.power;
      addLogEntry(`敵に${card.power}ダメージ！次のターン使用不可（未実装）`);
      break;
    case "マナブースト":
      player.mana += 2;
      addLogEntry(`マナが2回復！`);
      break;
    case "パワーアップ":
      player.nextAttackBoost = 3;
      addLogEntry(`次の攻撃ダメージが+3される！`);
      break;
    case "ブラッドソード":
      enemy.hp -= card.power;
      let selfDamage = 1;
      if (player.shield > 0) {
        const blocked = Math.min(player.shield, selfDamage);
        selfDamage -= blocked;
        player.shield -= blocked;
        addLogEntry(`自分のシールドで${blocked}軽減！`);
      }
      player.hp -= selfDamage;
      addLogEntry(`敵に${card.power}ダメージ！自分に${selfDamage}ダメージ`);
      break;
    case "シールドチャージ":
      player.shield += card.power;
      player.mana += 1;
      addLogEntry(`シールド${card.power}とマナ1を獲得！`);
      break;
    case "バリア":
      playerStatus.shieldTurns = 3;
      player.shield += 2;
      addLogEntry(`<p>3ターン持続のシールド2を獲得！`);
      break;
    case "アンチマジック":
      playerStatus.preventEnemyAction = true;
      addLogEntry(`次の敵の行動を封じた！`);
      break;
    case "雷鳴":
      enemy.hp -= card.power;
      enemyStatus.stunned = true;
      addLogEntry(`敵に${card.power}ダメージ＆気絶！`);
      break;
    case "シールドウォール":
      playerStatus.shieldTurns = 1;
      addLogEntry(`1ターンの全ダメージ無効化！`);
      break;
    case "回復の祈り":
      playerStatus.healingOverTime = 3;
      addLogEntry(`毎ターン3回復（3ターン継続）！`);
      break;
    case "スモークボム":
      playerStatus.preventEnemyAction = true;
      addLogEntry(`敵の攻撃を無効化！`);
      break;
    case "シャドウスラッシュ":
      enemy.hp -= card.power;
      addLogEntry(`敵に${card.power}ダメージ＋命中率低下（演出）！`);
      break;
    case "オーラヒール":
      player.hp += 2;
      player.mana += 1;
      addLogEntry(`HP2回復＆マナ1回復！`);
      break;
    case "反射の鏡":
      playerStatus.reflectNext = true;
      addLogEntry(`次の敵の攻撃を反射！`);
      break;
    case "バーストブレード":
      const burst = player.mana + card.power;
      enemy.hp -= burst;
      player.mana = 0;
      addLogEntry(`全マナ消費して${burst}ダメージ！`);
      break;
    default:
      if (card.type === "攻撃") {
        showEffect("attack");
        let dmg = card.power;
        if (player.nextAttackBoost) {
          dmg += player.nextAttackBoost;
          player.nextAttackBoost = 0;
        }
        enemy.hp -= dmg;
        addLogEntry(`敵に${dmg}ダメージ！`);
      } else if (card.type === "回復") {
        showEffect("heal");
        player.hp += card.power;
        addLogEntry(`HPを${card.power}回復！`);
      } else if (card.type === "防御") {
        showEffect("defense");
        player.shield += card.power;
        addLogEntry(`シールド${card.power}付与！`);
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
    addLogEntry(`持続回復でHPが3回復！`);
  }

  // バリア（全ダメージ無効）のターン数減少
  if (playerStatus.shieldTurns > 0) {
    playerStatus.shieldTurns--;
    if (playerStatus.shieldTurns === 0) {
      addLogEntry(`バリアの効果が切れた。`);
    }
  }

  // 敵の気絶解除
  if (enemyStatus.stunned) {
    enemyStatus.stunned = false;
    addLogEntry(`敵は気絶から回復した。`);
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
  addLogEntry(`敵のターン！`);

  processTurnEffects();

  if (playerStatus.preventEnemyAction) {
    addLogEntry(`敵の行動は封じられている！`);
  } else if (enemyStatus.stunned) {
    addLogEntry(`敵は気絶していて行動できない！`);
  } else {
    let damage = enemy.attack;

    if (playerStatus.shieldTurns > 0) {
      damage = 0;
      addLogEntry(`バリアでダメージを無効化！`);
    } else if (playerStatus.reflectNext) {
      addLogEntry(`敵の攻撃を反射した！敵に${damage}ダメージ！`);
      enemy.hp -= damage;
      playerStatus.reflectNext = false;
    } else {
      if (player.shield > 0) {
        const blocked = Math.min(player.shield, damage);
        damage -= blocked;
        player.shield -= blocked;
        addLogEntry(`シールドで${blocked}軽減！`);
      }
      player.hp -= damage;
      addLogEntry(`敵の攻撃！${damage}ダメージを受けた！`);
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
    addLogEntry(`敵を倒した！`);
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
  addLogEntry(`${floor}階に進んだ！敵が強くなった！`);

  // ★★以上のカードから1枚追加
  const candidateCards = cardPool.filter(c => c.rarity === '★★' || c.rarity === '★★★');
  if (candidateCards.length > 0) {
    const reward = getRandomCards(1, candidateCards)[0];
    playerDeck.push(reward);
    addLogEntry(`報酬として${reward.name}（${reward.rarity}）を獲得！`);
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

function endPlayerTurn() {
  // 使っていない手札をすべて捨て札に
  discardPile.push(...currentHand);
  currentHand = [];
  // 画面からもすべての手札カードを削除
  const handContainer = document.getElementById("hand-container");
  handContainer.innerHTML = "";

  updateDiscardPileDisplay(); // 捨て札を更新表示
  drawHand();
}

function updateDiscardPileDisplay() {
  const discardContainer = document.getElementById("discard-container");
  if (!discardContainer) return;

  discardContainer.innerHTML = `
    <h3>使用済みカード <button id="toggle-discard">表示切替</button></h3>
    <div id="discard-list" style="display: none;"></div>
  `;

  const discardList = discardContainer.querySelector("#discard-list");
  discardPile.forEach(card => {
    const cardElem = document.createElement("div");
    cardElem.className = `card small ${getRarityClass(card.rarity)}`;
    cardElem.innerHTML = `
      <h4>${card.name}</h4>
      <p>${card.effect}</p>
    `;
    discardList.appendChild(cardElem);
  });

  const toggleButton = document.getElementById("toggle-discard");
  toggleButton.addEventListener("click", () => {
    const visible = discardList.style.display === "block";
    discardList.style.display = visible ? "none" : "block";
    toggleButton.textContent = visible ? "表示" : "非表示";
  });
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-battle").addEventListener("click", () => {
    startDeckBuilding();
  });
});
