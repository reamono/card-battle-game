// スプレッドシートのJSONエンドポイントを指定
const API_URL = 'https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec';

// === レアリティ別の出現確率設定 ===
const rarityWeights = {
  '★': 60,
  '★★': 30,
  '★★★': 10
};

const MAX_HP = 30;

let cardPool = [];         // 全カードデータ
let playerDeck = [];       // 山札
let discardPile = [];      // 捨て札
let currentHand = [];      // 現在の手札
let deckBuildCount = 0;    // 選択済み枚数
let pendingRewards = [];   // 報酬カード
let player = {
  hp: MAX_HP,
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
  reflectNext: false,
  poisoned: 0,
  burned: 0,
  attackBoost: 0,
  nextCardFree: false
};

let enemyStatus = {
  stunned: false,
  poisoned: 0,
  burned: 0,
  attackDown: 0
};

function showRewardSelection() {
  const rewardArea = document.getElementById("reward-area");
  rewardArea.innerHTML = "<h3>報酬カードを1枚選んでください</h3>";

  if (!Array.isArray(cardPool) || cardPool.length === 0) {
    rewardArea.innerHTML = "<p>カードデータの読み込みに失敗しました。</p>";
    console.error("cardPool が空、または無効です。");
    return;
  }

  const choices = getRandomCards(3, cardPool);
  pendingRewards = choices;

  choices.forEach(card => {
    const cardElem = document.createElement("div");
    cardElem.className = "card reward-card";
    cardElem.innerHTML = `
      <h4>${card.name}</h4>
      <p>${card.description}</p>
      <p>マナ: ${card.cost}</p>
      <p class="rarity">${card.rarity}</p>
    `;
    cardElem.addEventListener("click", () => {
      playerDeck.push(card);
      rewardArea.innerHTML = "<p>カードを獲得しました！</p>";
      document.getElementById("next-floor-button").style.display = "block";
    });
    rewardArea.appendChild(cardElem);
  });

  rewardArea.style.display = "block";
}

// ボス撃破時の報酬処理
function applyPlayerStatusEffects() {
  if (playerStatus.poisoned > 0) {
    player.hp -= 2;
    playerStatus.poisoned--;
    addLogEntry("プレイヤーは毒で2ダメージを受けた！");
  }
  if (playerStatus.burned > 0) {
    player.hp -= 3;
    playerStatus.burned--;
    addLogEntry("プレイヤーは火傷で3ダメージを受けた！");
  }
  if (playerStatus.attackBoost > 0) {
    playerStatus.attackBoost--;
    addLogEntry("プレイヤーの攻撃強化が1ターン減少した");
  }
}

function getRandomCards(n, pool) {
  const results = [];
  const weights = pool.map(card => rarityWeights[card.rarity] || 1);
  while (results.length < n) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        results.push(pool[i]);
        break;
      }
    }
  }
  return results;
}

// 次の階層ボタン処理
function advanceToNextFloor() {
  floor++;
  document.getElementById("reward-area").style.display = "none";
  document.getElementById("next-floor-button").style.display = "none";
  updateBossArt();
  startBattlePhase();
}

// ボスの種類の処理
function updateBossArt() {
  const bossImage = document.getElementById("boss-character");
  if (bossImage) {
    const index = ((floor - 1) % 5) + 1; // boss1.png ~ boss5.png まで繰り返す
    bossImage.src = `images/boss${index}.png`;
  }
}

function applyEnemyStatusEffects() {
  if (enemyStatus.poisoned > 0) {
    enemy.hp -= 2;
    enemyStatus.poisoned--;
    addLogEntry("敵は毒で2ダメージを受けた！");
  }
  if (enemyStatus.burned > 0) {
    enemy.hp -= 3;
    enemyStatus.burned--;
    addLogEntry("敵は火傷で3ダメージを受けた！");
  }
  if (enemyStatus.attackDown > 0) {
    enemyStatus.attackDown--;
    addLogEntry("敵の攻撃力低下が1ターン減少した");
  }
}

// カードの特殊効果実装
function executeEffect(effectStr) {
  const effects = effectStr.split(";");
  effects.forEach(eff => {
    const match = eff.match(/(\w+)\(([^)]*)\)/);
    if (!match) return;
    const func = match[1];
    const arg = parseFloat(match[2]);

    const effectFuncs = {
      damageEnemy: val => {
        const boost = playerStatus.attackBoost > 0 ? 1.5 : 1; // 仮に1.5倍
        enemy.hp -= val * boost;
      },
      heal: val => player.hp = Math.min(player.hp + val, 30),
      shield: val => player.shield += val,
      selfDamage: val => player.hp -= val,
      stunEnemy: () => enemyStatus.stunned = true,
      manaBoost: val => player.mana += val,
      poisonEnemy: turns => enemyStatus.poisoned = turns,
      burnEnemy: turns => enemyStatus.burned = turns,
      poisonSelf: turns => playerStatus.poisoned = turns,
      burnSelf: turns => playerStatus.burned = turns,
      multiHit: times => {
        for (let i = 0; i < times; i++) {
          const boost = playerStatus.attackBoost > 0 ? 1.5 : 1;
          const damage = 2 * boost;
          enemy.hp -= damage;
          addLogEntry(`連撃 ${i + 1}発目で${damage}ダメージ`);
        }
      },
      buffAttack: turns => playerStatus.attackBoost = turns,
      debuffEnemyAttack: turns => enemyStatus.attackDown = turns,
      nextCardFree: () => playerStatus.nextCardFree = true
    };

    if (effectFuncs[func]) {
      effectFuncs[func](arg);
    }
  });
}

// キャラクター画像の表示処理
function showCharacters() {
  const battleArea = document.getElementById("battle-area");

  const playerWrapper = document.createElement("div");
  playerWrapper.className = "character-wrapper";
  const playerImg = document.createElement("img");
  playerImg.src = "images/player.png";
  playerImg.alt = "プレイヤー";
  playerImg.id = "player-character";
  playerWrapper.appendChild(playerImg);

  const bossWrapper = document.createElement("div");
  bossWrapper.className = "character-wrapper";
  const bossImg = document.createElement("img");
  bossImg.src = "images/boss1.png";
  bossImg.alt = "ボス";
  bossImg.id = "boss-character";
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
      <p>${card.description}</p>
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
  document.getElementById("battle-area").innerHTML = `
  <div class="character-wrapper">
    <img src="images/player.png" alt="プレイヤー" id="player-character">
  </div>
  <div class="character-wrapper">
    <img src="images/boss${index}.png" alt="ボス" id="boss-character">
  </div>
  `;
  enemy = {
  hp: 20 + floor * 5,  // 階層に応じて強化
  attack: 4 + floor,   // 攻撃力も強化
  };

  showCharacters();
  applyPlayerStatusEffects(); // 状態異常処理（自分）
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
      <p>${card.description}</p>
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

function animateCharacter(card) {
  const playerElem = document.getElementById("player-character");
  const bossElem = document.getElementById("boss-character");

  // カードタイプごとにクラス付与（CSSで動き）
  if (card.type === "攻撃") {
    playerElem.classList.add("player-attack");
    bossElem.classList.add("boss-hit");
  } else if (card.type === "回復") {
    playerElem.classList.add("player-heal");
  }

  // アニメーション終了後にクラスを除去
  setTimeout(() => {
    playerElem.classList.remove("player-attack", "player-heal");
    bossElem.classList.remove("boss-hit");
  }, 1000);
}

//カード処理
function playCard(card) {
  if (card.effect) {
    executeEffect(card.effect);
  }
  player.mana -= card.cost;
  animateCharacter(card);
  if (card.type === "攻撃") showEffect("attack");
  else if (card.type === "回復") showEffect("heal");
  else if (card.type === "防御") showEffect("defense");
  updateBattleStatus();
  addLogEntry(`${card.name} を使った！`);
  checkBattleState();
}

function generateEnemy(floor) {
  const enemyList = [
    { name: "スライム", hp: 10, attack: 2 },
    { name: "ゴーレム", hp: 20, attack: 4 },
    { name: "ウィザード", hp: 15, attack: 3, special: "stun" },
    { name: "ドラゴン", hp: 30, attack: 6, special: "fire" }
  ];
  const index = Math.floor(Math.random() * enemyList.length);
  const selected = enemyList[index];
  enemy = { ...selected };
  addLogEntry(`${enemy.name} が現れた！`);
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
  applyEnemyStatusEffects(); // 状態異常処理（敵）

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
    document.getElementById("end-turn-button").style.display = "none";
    addLogEntry(`敵を倒した！`);
    showRewardSelection();  // ✅ 報酬選択を表示
    return;                 // ✅ 自動で進まないように return で止める
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
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      cardPool = data;
      document.getElementById("start-battle").addEventListener("click", () => {
        document.getElementById("start-battle").style.display = "none";
        document.getElementById("deck-builder").style.display = "block";
        showDeckChoices();
      });
    });
});
