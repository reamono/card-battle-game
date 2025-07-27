// スプレッドシートのJSONエンドポイントを指定
const API_URL = 'https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec';

// === レアリティ別の出現確率設定 ===
const rarityWeights = {
  '★': 60,
  '★★': 25,
  '★★★': 10,
  '★★★★': 4,
  '★★★★★': 1
};

const MAX_HP = 30;
const GACHA_COST = 10; // ガチャ1回のコイン消費量

// === サウンド効果管理 ===
const sounds = {
  cardPlay: null,
  damage: null,
  heal: null,
  gacha: null,
  buttonClick: null,
  victory: null,
  defeat: null
};

// サウンド初期化関数
function initSounds() {
  try {
    // 音源ファイルが存在する場合のみ読み込み
    if (document.querySelector('audio[src*="sounds/card-play"]')) {
      sounds.cardPlay = new Audio('sounds/card-play.mp3');
    }
    if (document.querySelector('audio[src*="sounds/damage"]')) {
      sounds.damage = new Audio('sounds/damage.mp3');
    }
    if (document.querySelector('audio[src*="sounds/heal"]')) {
      sounds.heal = new Audio('sounds/heal.mp3');
    }
    if (document.querySelector('audio[src*="sounds/gacha"]')) {
      sounds.gacha = new Audio('sounds/gacha.mp3');
    }
    if (document.querySelector('audio[src*="sounds/button-click"]')) {
      sounds.buttonClick = new Audio('sounds/button-click.mp3');
    }
    if (document.querySelector('audio[src*="sounds/victory"]')) {
      sounds.victory = new Audio('sounds/victory.mp3');
    }
    if (document.querySelector('audio[src*="sounds/defeat"]')) {
      sounds.defeat = new Audio('sounds/defeat.mp3');
    }
  } catch (e) {
    console.log("音源ファイルが見つかりません。サウンド機能は無効です。");
  }
}

// サウンド再生関数
function playSound(soundName) {
  const sound = sounds[soundName];
  if (sound) {
    sound.currentTime = 0; // 再生位置をリセット
    sound.play().catch(e => console.log("サウンド再生エラー:", e));
  }
}

let cardPool = [];         // 全カードデータ
let initialCardPool = []; // 初期カード用（initial=true）
let gachaCardPool = []; // ガチャ用（initial=false）
let playerOwnedCards = []; // 所持カード（図鑑や管理用）
let playerDeck = [];       // 山札
let constructedDeck = []; // デッキ構築で選んだ10枚（固定）
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
let playerCoins = 0; // コイン管理用変数を追加
let turnCount = 0; // ターン数管理用変数を追加
// === 戦績管理用変数 ===
let gameStats = {
  totalDamage: 0,        // 総ダメージ
  cardsPlayed: 0,        // 使用カード数
  battlesWon: 0,         // 勝利回数
  battlesLost: 0,        // 敗北回数
  totalCoinsEarned: 0,   // 獲得コイン総数
  gachaPulls: 0,         // ガチャ回数
  maxFloor: 1,           // 到達最高階層
  playTime: 0            // プレイ時間（秒）
};

// === バトル統計用変数 ===
let battleStats = {
  damageDealt: 0,      // このバトルでの与ダメージ
  damageTaken: 0,      // このバトルでの被ダメージ
  cardsUsed: 0,        // このバトルでの使用カード数
  turnsElapsed: 0      // このバトルでの経過ターン数
};

// === パーティクルエフェクト関数 ===
function createParticle(x, y, type, text = "✨") {
  const particle = document.createElement("div");
  particle.className = `particle ${type}-particle`;
  particle.textContent = text;
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;

  document.body.appendChild(particle);

  // アニメーション終了後に要素を削除
  setTimeout(() => {
    particle.remove();
  }, 2000);
}

// 複数パーティクル生成
function createMultipleParticles(x, y, type, count = 5, text = "✨") {
  for (let i = 0; i < count; i++) {
    const offsetX = x + (Math.random() - 0.5) * 100;
    const offsetY = y + (Math.random() - 0.5) * 50;
    const delay = Math.random() * 500;

    setTimeout(() => {
      createParticle(offsetX, offsetY, type, text);
    }, delay);
  }
}
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

// === 戦績更新関数 ===
function updateStats() {
  document.getElementById("stat-total-damage").textContent = gameStats.totalDamage;
  document.getElementById("stat-cards-played").textContent = gameStats.cardsPlayed;
  document.getElementById("stat-battles-won").textContent = gameStats.battlesWon;
  document.getElementById("stat-battles-lost").textContent = gameStats.battlesLost;
  document.getElementById("stat-total-coins").textContent = gameStats.totalCoinsEarned;
  document.getElementById("stat-gacha-pulls").textContent = gameStats.gachaPulls;
  document.getElementById("stat-max-floor").textContent = gameStats.maxFloor;
  
  const minutes = Math.floor(gameStats.playTime / 60);
  const seconds = gameStats.playTime % 60;
  document.getElementById("stat-play-time").textContent = `${minutes}分${seconds}秒`;
}

// 戦績表示機能
function showStats() {
  updateStats();
  document.getElementById("stats-screen").style.display = "block";
  document.getElementById("main-title").style.display = "none";
  document.getElementById("main-menu").style.display = "none";
  document.getElementById("deck-builder").style.display = "none";
  document.getElementById("battle-screen").style.display = "none";
  document.getElementById("gacha-area").style.display = "none";
  document.getElementById("collection-book").style.display = "none";
  document.getElementById("return-main-from-gacha").style.display = "none";
  document.getElementById("return-main").style.display = "block";
}

function closeStats() {
  document.getElementById("stats-screen").style.display = "none";
  document.getElementById("main-title").style.display = "block";
  document.getElementById("main-menu").style.display = "flex";
  document.getElementById("return-main").style.display = "none";
  // メインメニューのボタンを正しく表示
  document.getElementById("start-battle").style.display = "block";
  document.getElementById("go-gacha").style.display = "block";
  document.getElementById("open-collection").style.display = "block";
  document.getElementById("load-game").style.display = "inline-block";
  document.getElementById("show-stats").style.display = "block";
}

// === コイン表示の更新関数 ===
function updateCoinDisplay() {
  const coinElem = document.getElementById("coin-count");
  if (coinElem) {
    coinElem.textContent = playerCoins;
  }
}

// JSONデータを取得して初期化
document.addEventListener("DOMContentLoaded", () => {
  initSounds(); // サウンド機能を初期化
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      cardPool = data;
      initialCardPool = cardPool.filter(card => String(card.initial).toUpperCase() === "TRUE");
      gachaCardPool = cardPool.filter(card => String(card.initial).toUpperCase() !== "TRUE");
      console.log("initialCardPool:", initialCardPool);
      playerOwnedCards = [...initialCardPool];

      document.getElementById("start-battle").addEventListener("click", () => {
        // デッキ構築済みの場合は直接バトル開始
        if (constructedDeck.length > 0) {
          startBattlePhase();
          return;
        }
        
        document.getElementById("start-battle").style.display = "none";
        document.getElementById("go-gacha").style.display = "none";
        document.getElementById("open-collection").style.display = "none";
        document.getElementById("show-stats").style.display = "none";
        document.getElementById("deck-builder").style.display = "block";
        showDeckChoices();
      });

      const collectionBtn = document.getElementById("open-collection");
      if (collectionBtn) {
        collectionBtn.addEventListener("click", () => {
          const collectionArea = document.getElementById("collection-book");
          collectionArea.innerHTML = "";
          cardPool.forEach(card => {
            const owned = playerOwnedCards.some(c => c.id === card.id);
            const cardElem = document.createElement("div");
            cardElem.className = `card ${getRarityClass(card.rarity)} ${owned ? "" : "unowned"}`;
            cardElem.innerHTML = owned
              ? `<h3>${card.name}</h3><p>${card.description}</p><p>マナ: ${card.cost}</p><p class="rarity">${card.rarity}</p>`
              : `<h3>？？？</h3><p>？？？</p><p>マナ: ？</p><p class="rarity">${card.rarity}</p>`;
            collectionArea.appendChild(cardElem);
          });
          collectionArea.style.display = "grid";
          document.getElementById("close-collection").style.display = "inline-block";
          document.getElementById("main-title").style.display = "none";
          document.getElementById("deck-builder").style.display = "none";
          document.getElementById("battle-screen").style.display = "none";
          document.getElementById("gacha-area").style.display = "none";
          document.getElementById("start-battle").style.display = "none";
          document.getElementById("go-gacha").style.display = "none";
          document.getElementById("open-collection").style.display = "none";
          document.getElementById("show-stats").style.display = "none";
          document.getElementById("load-game").style.display = "none";
          document.getElementById("save-game").style.display = "none";
          document.getElementById("return-main-from-gacha").style.display = "none";
          document.getElementById("return-main").style.display = "none";
          document.getElementById("main-title").style.display = "none";
        });
      }

      const closeBtn = document.getElementById("close-collection");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          document.getElementById("collection-book").style.display = "none";
          closeBtn.style.display = "none";
          // メインメニューを正しく復元
          document.getElementById("main-title").style.display = "block";
          document.getElementById("main-menu").style.display = "flex";
          document.getElementById("start-battle").style.display = "block";
          document.getElementById("go-gacha").style.display = "block";
          document.getElementById("open-collection").style.display = "block";
          document.getElementById("show-stats").style.display = "block";
          document.getElementById("load-game").style.display = "inline-block";
        });
      }

      const saveBtn = document.getElementById("save-game");
      const loadBtn = document.getElementById("load-game");
      const returnBtn = document.getElementById("return-main");
      const returnFromGachaBtn = document.getElementById("return-main-from-gacha");
      const statsBtn = document.getElementById("show-stats");
      const closeStatsBtn = document.getElementById("close-stats");
      if (saveBtn) saveBtn.addEventListener("click", saveGame);
      if (loadBtn) loadBtn.addEventListener("click", loadGame);
      if (returnBtn) returnBtn.addEventListener("click", returnToMainMenu);
      if (returnFromGachaBtn) returnFromGachaBtn.addEventListener("click", returnToMainMenu);
      if (statsBtn) statsBtn.addEventListener("click", showStats);
      if (closeStatsBtn) closeStatsBtn.addEventListener("click", closeStats);
      if (loadBtn) loadBtn.style.display = "inline-block";

      const goGachaButton = document.getElementById("go-gacha");
      if (goGachaButton) {
        goGachaButton.addEventListener("click", () => {
          document.getElementById("deck-builder").style.display = "none";
          document.getElementById("battle-screen").style.display = "none";
          document.getElementById("gacha-area").style.display = "block";
          document.getElementById("start-battle").style.display = "none";
          document.getElementById("go-gacha").style.display = "none";
          document.getElementById("open-collection").style.display = "none";
          document.getElementById("show-stats").style.display = "none";
          document.getElementById("load-game").style.display = "none";
          document.getElementById("save-game").style.display = "none";
          document.getElementById("return-main").style.display = "none";
          document.getElementById("return-main-from-gacha").style.display = "inline-block";
          document.getElementById("main-title").style.display = "none";
          document.getElementById("gacha-button").style.display = "inline-block";
          document.body.classList.add("gacha-background");
        });
      }

      const gachaButton = document.getElementById("gacha-button");
      if (gachaButton) {
        gachaButton.addEventListener("click", () => {
          if (playerCoins < GACHA_COST) {
            alert("コインが足りません！");
            return;
          }
          playerCoins -= GACHA_COST;
          updateCoinDisplay();
          playSound('gacha'); // ガチャ音を再生
          gameStats.gachaPulls++; // 戦績更新
          gameStats.totalCoinsEarned += GACHA_COST; // 消費コインも記録
          
          // ガチャパーティクル
          const gachaButtonRect = gachaButton.getBoundingClientRect();
          createMultipleParticles(gachaButtonRect.left + gachaButtonRect.width / 2, gachaButtonRect.top, "gacha", 8, "⭐");
          const resultArea = document.getElementById("gacha-result");
          resultArea.innerHTML = "";
          const drawn = getWeightedRandomCards(3, gachaCardPool);
          drawn.forEach((card, i) => {
            // カードのflip構造
            const cardBack = document.createElement("div");
            cardBack.classList.add("card-back");
            const cardInner = document.createElement("div");
            cardInner.classList.add("card-back-inner");

            // 裏面
            const back = document.createElement("div");
            back.classList.add("card-back-back");

            // 表面
            const front = document.createElement("div");
            front.classList.add("card-back-front", getRarityClass(card.rarity));
            front.innerHTML = `
              <h3>${card.name}</h3>
              <p>${card.description}</p>
              <p>マナ: ${card.cost}</p>
              <p class="rarity">${card.rarity}</p>
            `;

            cardInner.appendChild(back);
            cardInner.appendChild(front);
            cardBack.appendChild(cardInner);

            cardBack.addEventListener("click", () => {
              if (cardBack.classList.contains("card-flipped")) return;
              cardBack.classList.add("card-flipped");
              // 所持カードに追加
              if (!playerOwnedCards.some(c => c.id === card.id)) {
                playerOwnedCards.push(card);
                // 初期カードプールに追加（ガチャで引いたカードを選択可能にする）
                if (!initialCardPool.some(c => c.id === card.id)) {
                  initialCardPool.push(card);
                }
                addLogEntry(`${card.name}を獲得しました！`);
              }
            });

            resultArea.appendChild(cardBack);
          });
        });
      }
      const gacha10Button = document.getElementById("gacha-10-button");
      if (gacha10Button) {
        gacha10Button.addEventListener("click", () => {
          const totalCost = GACHA_COST * 10;
          if (playerCoins < totalCost) {
            alert("コインが足りません！（10連には" + totalCost + "コイン必要です）");
            return;
          }
          playerCoins -= totalCost;
          updateCoinDisplay();
          const resultArea = document.getElementById("gacha-result");
          resultArea.innerHTML = "";
          const drawn = getWeightedRandomCards(10, gachaCardPool);
          drawn.forEach((card, i) => {
            // カードのflip構造
            const cardBack = document.createElement("div");
            cardBack.classList.add("card-back");
            const cardInner = document.createElement("div");
            cardInner.classList.add("card-back-inner");

            // 裏面
            const back = document.createElement("div");
            back.classList.add("card-back-back");

            // 表面
            const front = document.createElement("div");
            front.classList.add("card-back-front", getRarityClass(card.rarity));
            front.innerHTML = `
              <h3>${card.name}</h3>
              <p>${card.description}</p>
              <p>マナ: ${card.cost}</p>
              <p class="rarity">${card.rarity}</p>
            `;

            cardInner.appendChild(back);
            cardInner.appendChild(front);
            cardBack.appendChild(cardInner);

            cardBack.addEventListener("click", () => {
              if (cardBack.classList.contains("card-flipped")) return;
              cardBack.classList.add("card-flipped");
              // 所持カードに追加
              if (!playerOwnedCards.some(c => c.id === card.id)) {
                playerOwnedCards.push(card);
                // 初期カードプールに追加（ガチャで引いたカードを選択可能にする）
                if (!initialCardPool.some(c => c.id === card.id)) {
                  initialCardPool.push(card);
                }
                addLogEntry(`${card.name}を獲得しました！`);
              }
            });

            resultArea.appendChild(cardBack);
          });
        });
      }
      updateCoinDisplay(); // 初期表示
    });
});

// === 状態アイコンの表示 ===
function updateStatusIcons() {
  const playerArea = document.getElementById("player-status-icons");
  const enemyArea = document.getElementById("enemy-status-icons");

  if (playerArea) {
    const playerIcons = [];
    if (playerStatus.reflectNext) playerIcons.push("🪞 反射");
    if (playerStatus.attackBoost > 0) playerIcons.push(`⚔️ 攻+${playerStatus.attackBoost}`);
    if (playerStatus.poisoned > 0) playerIcons.push(`☠️ 毒(${playerStatus.poisoned})`);
    if (playerStatus.burned > 0) playerIcons.push(`🔥 火傷(${playerStatus.burned})`);
    if (playerStatus.nextCardFree) playerIcons.push("💫 無料");
    playerArea.innerHTML = playerIcons.map(txt => `<span class="status-icon">${txt}</span>`).join(" ");
  }

  if (enemyArea) {
    const enemyIcons = [];
    if (enemyStatus.poisoned > 0) enemyIcons.push(`☠️ 毒(${enemyStatus.poisoned})`);
    if (enemyStatus.burned > 0) enemyIcons.push(`🔥 火傷(${enemyStatus.burned})`);
    if (enemyStatus.attackDown > 0) enemyIcons.push(`⬇️ 攻撃-${enemyStatus.attackDown}`);
    if (enemyStatus.stunned) enemyIcons.push(`💫 気絶`);
    enemyArea.innerHTML = enemyIcons.map(txt => `<span class="status-icon">${txt}</span>`).join(" ");
  }
}

// 敵の攻撃に状態異常を追加する
function enemyAttack() {
  const damage = Math.floor(Math.random() * 4) + 2; // 通常ダメージ
  playerStatus.hp -= damage;
  // バトル統計更新
  battleStats.damageTaken += damage;
  addLogEntry(`敵の攻撃！${damage} ダメージを受けた`);

  // 状態異常をランダムに付与
  const rand = Math.random();
  if (rand < 0.33) {
    playerStatus.poisoned += 2;
    addLogEntry("☠️ プレイヤーは毒状態になった！");
  } else if (rand < 0.66) {
    playerStatus.burned += 2;
    addLogEntry("🔥 プレイヤーは火傷状態になった！");
  }

  updateBattleStatus();
  updateStatusIcons();
}

// === バトル状態の更新関数 ===
function updateBattleStatus() {
  document.getElementById("player-hp").textContent = player.hp;
  document.getElementById("player-mana").textContent = player.mana;
  document.getElementById("player-shield").textContent = player.shield;
  document.getElementById("enemy-hp").textContent = enemy.hp;
  document.getElementById("floor").textContent = floor;
  document.getElementById("hand-count").textContent = currentHand.length;
  // 構築デッキの枚数を表示（追加されたカードも含む）
  const constructedDeckCount = constructedDeck.length;
  document.getElementById("deck-count-battle").textContent = constructedDeckCount;
  document.getElementById("turn-count").textContent = turnCount;
}

// === エフェクト処理 ===
function reflectNext() {
  playerStatus.reflectNext = true;
  addLogEntry("次の敵の攻撃を反射する！");
  updateStatusIcons();
}

function buffAttack(amount, turns = 2) {
  playerStatus.attackBoost = amount;
  playerStatus.attackBoostTurns = turns;
  addLogEntry(`次の${turns}ターン、自分の攻撃力が${amount}上がる！`);
  updateStatusIcons();
}

function multiHit(times) {
  for (let i = 0; i < times; i++) {
    dealDamage(2); // 基本2ダメージの連打
  }
  addLogEntry(`連続攻撃で${times * 2}ダメージを与えた！`);
}

function nextCardFree() {
  playerStatus.nextCardFree = true;
  addLogEntry("次のカードのマナコストが無料になる！");
  updateStatusIcons();
}

function applyAttackBoost(baseDamage) {
  if (playerStatus.attackBoost > 0) {
    baseDamage += playerStatus.attackBoost;
    playerStatus.attackBoostTurns--;
    if (playerStatus.attackBoostTurns <= 0) {
      playerStatus.attackBoost = 0;
    }
    updateStatusIcons();
  }
  return baseDamage;
}

// === 通常のダメージ処理に反映例 ===
function dealDamage(baseDamage) {
  const damage = applyAttackBoost(baseDamage);
  
  // ダメージ表示アニメーション
  const enemyElem = document.getElementById("boss-character");
  if (enemyElem) {
    const damageText = document.createElement("div");
    damageText.className = "damage-text";
    damageText.textContent = `-${damage}`;
    damageText.style.left = `${enemyElem.offsetLeft + enemyElem.offsetWidth / 2}px`;
    damageText.style.top = `${enemyElem.offsetTop}px`;
    document.body.appendChild(damageText);
    
    setTimeout(() => {
      damageText.remove();
    }, 1500);
  }
  
  // ダメージ音を再生
  playSound('damage');
  
  // 戦績更新
  gameStats.totalDamage += damage;
  // バトル統計更新
  battleStats.damageDealt += damage;
  
  // ダメージパーティクル
  if (enemyElem) {
    const rect = enemyElem.getBoundingClientRect();
    createMultipleParticles(rect.left + rect.width / 2, rect.top, "damage", 5, "💥");
  }
  
  if (enemy.shield && enemy.shield > 0) {
    enemy.shield -= damage;
    if (enemy.shield < 0) {
      enemy.hp += enemy.shield; // 超過分ダメージ
      enemy.shield = 0;
    }
  } else {
    enemy.hp -= damage;
  }
  addLogEntry(`敵に${damage}のダメージを与えた！`);
  updateUI();
  checkBattleState();
}

function showRewardSelection() {
  const rewardArea = document.getElementById("reward-area");
  const nextFloorBtn = document.getElementById("next-floor-button");
  const endTurnBtn = document.getElementById("end-turn-button");
  const handArea = document.getElementById("hand-container");

  if (!rewardArea || !nextFloorBtn || !endTurnBtn) {
    console.error("必要なDOM要素が見つかりません。");
    return;
  }

  // カード表示＆操作を一時無効化
  handArea.innerHTML = "";
  endTurnBtn.style.display = "none";

  // 報酬カードのUI
  rewardArea.innerHTML = "<h3>報酬カードを1枚選んでください</h3>";

  if (!Array.isArray(cardPool) || cardPool.length === 0) {
    rewardArea.innerHTML = "<p>カードデータの読み込みに失敗しました。</p>";
    console.error("cardPool が空、または無効です。");
    return;
  }

  const choices = getRandomCards(3, cardPool);
  pendingRewards = choices;

  endTurnBtn.style.display = "none";

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
      // 構築デッキに追加
      constructedDeck.push(card);
      // 山札にも追加
      playerDeck.push(card);
      rewardArea.innerHTML = "<p>カードを獲得しました！</p>";
      nextFloorBtn.style.display = "block";
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
  const rewardArea = document.getElementById("reward-area");
  const nextFloorBtn = document.getElementById("next-floor-button");
  if (rewardArea) rewardArea.style.display = "none";
  if (nextFloorBtn) nextFloorBtn.style.display = "none";

  showPathSelection(); // ← 直接バトルへ行かず分岐画面へ
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
    console.log(`毒ダメージ処理: 残り${enemyStatus.poisoned}ターン, 敵HP: ${enemy.hp}`);
  }
  if (enemyStatus.burned > 0) {
    enemy.hp -= 3;
    enemyStatus.burned--;
    addLogEntry("敵は火傷で3ダメージを受けた！");
    console.log(`火傷ダメージ処理: 残り${enemyStatus.burned}ターン, 敵HP: ${enemy.hp}`);
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
  document.getElementById("load-game").style.display = "none";
  document.getElementById("show-stats").style.display = "none";
  document.getElementById("return-main").style.display = "block";
  const choiceArea = document.getElementById("deck-choice");
  choiceArea.innerHTML = "";
  const random3 = getWeightedRandomCards(3, initialCardPool); // 初期カードプールから選択

  if (random3.length === 0) {
    console.warn("初期カードが0枚のため、デッキ構築できません。initialCardPool:", initialCardPool);
    return;
  }
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
        // デッキ構築完了時、構築したデッキを保存
        constructedDeck = [...playerDeck];
        // バトル用の山札を構築デッキで初期化
        playerDeck = [...constructedDeck];
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

function startBattlePhase() {
  isInBattle = true;
  turnCount = 1; // ターン数をリセット
  // バトル統計をリセット
  battleStats = {
    damageDealt: 0,
    damageTaken: 0,
    cardsUsed: 0,
    turnsElapsed: 0
  };
  document.getElementById("main-title").style.display = "none";
  document.getElementById("save-game").style.display = "inline-block";
  document.getElementById("deck-builder").style.display = "none";
  document.getElementById("load-game").style.display = "none";
  document.getElementById("show-stats").style.display = "none";
  document.getElementById("battle-screen").style.display = "block";
  document.getElementById("gacha-area").style.display = "none";
  document.getElementById("path-selection").style.display = "none";
  document.getElementById("collection-book").style.display = "none";
  document.getElementById("close-collection").style.display = "none";
  document.getElementById("return-main-from-gacha").style.display = "none";
  document.getElementById("return-main").style.display = "inline-block";

  // キャラクター再表示や初期UI処理
  document.getElementById("battle-area").innerHTML = `
    <div class="character-wrapper">
      <img src="images/player.png" alt="プレイヤー" id="player-character">
    </div>
    <div class="character-wrapper">
      <img src="images/boss1.png" alt="ボス" id="boss-character">
    </div>
  `;

  updateBossArt();
  applyPlayerStatusEffects();

  player.mana = 3; // プレイヤーのマナをリセット
  player.shield = 0; // プレイヤーのシールドをリセット

  enemy = {
    hp: 20 + floor * 5,
    attack: 4 + floor,
  };

  // 山札を構築デッキで初期化（シャッフルして）
  // 構築デッキ（追加カードを含む）で山札を初期化
  playerDeck = shuffle([...constructedDeck]);
  discardPile = []; // 捨て札をリセット

  drawHand();
  updateBattleStatus();
  updateDiscardPileDisplay();
  addLogEntry("バトルフェーズ開始！");

  document.getElementById("end-turn-button").addEventListener("click", () => {
    endPlayerTurn();
    enemyTurn();
  });

  // 山札確認ボタンのイベント
  const showDeckButton = document.getElementById("show-deck-button");
  if (showDeckButton) {
    // 既存のイベントリスナーを削除
    showDeckButton.replaceWith(showDeckButton.cloneNode(true));
    const newShowDeckButton = document.getElementById("show-deck-button");
    
    newShowDeckButton.addEventListener("click", () => {
      const deckList = document.getElementById("deck-list");
      const isVisible = deckList.style.display === "block";

      if (isVisible) {
        deckList.style.display = "none";
        newShowDeckButton.textContent = "山札を確認";
      } else {
        deckList.innerHTML = "";
        
        deckList.innerHTML = `<h4>構築デッキ (${constructedDeck.length}枚)</h4>`;

        if (constructedDeck.length === 0) {
          deckList.innerHTML += "<p>山札は空です</p>";
        } else {
          constructedDeck.forEach((card, index) => {
            const cardElem = document.createElement("div");
            cardElem.className = `card small ${getRarityClass(card.rarity)}`;
            cardElem.innerHTML = `
              <h4>${card.name}</h4>
              <p>${card.description}</p>
              <p>マナ: ${card.cost}</p>
              <p class="rarity">${card.rarity}</p>
            `;
            deckList.appendChild(cardElem);
          });
        }

        deckList.style.display = "block";
        newShowDeckButton.textContent = "山札を隠す";
      }
    });
  }

  document.getElementById("end-turn-button").style.display = "block";
}

function drawHand() {
  const handContainer = document.getElementById("hand-container");
  handContainer.innerHTML = "";
  currentHand = [];

  let drawCount = 5;

  // デバッグログ
  console.log(`=== drawHand開始 ===`);
  console.log(`山札枚数: ${playerDeck.length}`);
  console.log(`捨て札枚数: ${discardPile.length}`);
  console.log(`手札枚数: ${currentHand.length}`);

  // 山札が5枚未満で捨て札がある場合、捨て札を山札に戻す
  if (playerDeck.length < drawCount && discardPile.length > 0) {
    playerDeck = [...playerDeck, ...shuffle(discardPile)];
    discardPile = [];
    addLogEntry("捨て札を山札に戻しました");
    console.log(`捨て札を山札に戻しました - 山札: ${playerDeck.length}枚`);
  }

  // 山札が5枚未満で捨て札が0枚の場合、構築デッキから山札を再構築
  if (playerDeck.length < drawCount && discardPile.length === 0 && constructedDeck.length > 0) {
    playerDeck = shuffle([...constructedDeck]);
    addLogEntry("山札を再構築しました");
    console.log(`山札を再構築しました - 山札: ${playerDeck.length}枚`);
  }

  // 本当に何も引けないときだけログを出して終了
  if (playerDeck.length === 0 && discardPile.length === 0 && constructedDeck.length === 0) {
    addLogEntry("カードが尽きてこれ以上引けません！");
    console.log(`カードが尽きてこれ以上引けません！`);
    return;
  }

  // 実際にカードを引く（最大5枚）
  const actualDrawCount = Math.min(drawCount, playerDeck.length);
  const drawn = playerDeck.splice(0, actualDrawCount);
  currentHand = [...drawn];

  console.log(`実際に引いた枚数: ${actualDrawCount}枚`);
  console.log(`引いた後の山札: ${playerDeck.length}枚`);
  console.log(`=== drawHand終了 ===`);

  // 手札を表示
  currentHand.forEach(card => {
    const cardElem = document.createElement("div");
    const rarityClass = getRarityClass(card.rarity);
    cardElem.className = `card ${rarityClass}`;
    // マナ不足時はカードをグレーアウト
    if (player.mana < card.cost) {
      cardElem.style.opacity = "0.5";
      cardElem.style.cursor = "not-allowed";
    }
    cardElem.innerHTML = `
      <h3>${card.name}</h3>
      <p>${card.description}</p>
      <p>マナ: ${card.cost}</p>
      <p class="rarity">${card.rarity}</p>
    `;
    cardElem.addEventListener("click", () => {
      if (player.mana < card.cost) {
        addLogEntry(`マナが足りません！（必要: ${card.cost}, 所持: ${player.mana}）`);
        return;
      }
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

  // 手札枚数表示を更新
  addLogEntry(`手札を${currentHand.length}枚引きました`);
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
  // カード使用アニメーション
  const cardElements = document.querySelectorAll('.card');
  cardElements.forEach(elem => {
    if (elem.textContent.includes(card.name)) {
      elem.classList.add('used');
      setTimeout(() => {
        elem.classList.remove('used');
      }, 800);
    }
  });
  
  // マナ消費アニメーション
  const manaElem = document.getElementById("player-mana");
  if (manaElem) {
    manaElem.classList.add('mana-consumed');
    setTimeout(() => {
      manaElem.classList.remove('mana-consumed');
    }, 600);
  }
  
  // カード使用音を再生
  playSound('cardPlay');
  
  // 戦績更新
  gameStats.cardsPlayed++;
  // バトル統計更新
  battleStats.cardsUsed++;
  
  // パーティクルエフェクト
  const cardRect = cardElements[0]?.getBoundingClientRect();
  if (cardRect) {
    createMultipleParticles(cardRect.left + cardRect.width / 2, cardRect.top, "magic", 3, "✨");
  }
  
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
  turnCount++; // ターン数をカウントアップ
  battleStats.turnsElapsed++; // バトル統計更新
  addLogEntry(`敵のターン！`);
  processTurnEffects();
  applyEnemyStatusEffects(); // 状態異常処理（敵）

  if (playerStatus.preventEnemyAction) {
    addLogEntry(`敵の行動は封じられている！`);
  } else if (enemyStatus.stunned) {
    addLogEntry(`敵は気絶していて行動できない！`);
  } else {
    if (playerStatus.shieldTurns > 0) {
      addLogEntry(`バリアでダメージを無効化！`);
    } else if (playerStatus.reflectNext) {
      const damage = enemy.attack;
      addLogEntry(`敵の攻撃を反射した！敵に${damage}ダメージ！`);
      enemy.hp -= damage;
      playerStatus.reflectNext = false;
    } else {
      enemyAttack(); // ← ここで攻撃ロジックを呼び出す
    }
  }

  player.mana = 3; // 次ターン回復
  updateBattleStatus();
  checkBattleState();
  drawHand();
}

function checkBattleState() {
  const nextFloorBtn = document.getElementById("next-floor-button");
  if (enemy.hp <= 0) {
    playerCoins += 10; // ボス撃破でコイン獲得
    updateCoinDisplay();
    gameStats.battlesWon++; // 勝利回数を更新
    gameStats.totalCoinsEarned += 10; // 獲得コインを記録
    if (floor > gameStats.maxFloor) {
      gameStats.maxFloor = floor; // 最高階層を更新
    }
    
    // 勝利パーティクル
    const battleArea = document.getElementById("battle-area");
    if (battleArea) {
      const rect = battleArea.getBoundingClientRect();
      createMultipleParticles(rect.left + rect.width / 2, rect.top, "magic", 10, "🎉");
    }
    if (nextFloorBtn && (nextFloorBtn.style.display === "none" || nextFloorBtn.style.display === "")) {
      addLogEntry("敵を倒した！");
      showRewardSelection();
    }
    return;
  }
  if (player.hp <= 0) {
    gameStats.battlesLost++; // 敗北回数を更新
    
    // 敗北パーティクル
    const playerElem = document.getElementById("player-character");
    if (playerElem) {
      const rect = playerElem.getBoundingClientRect();
      createMultipleParticles(rect.left + rect.width / 2, rect.top, "damage", 5, "💀");
    }
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

  // 状態異常とシールドをリセット
  // プレイヤーの状態異常リセット
  playerStatus = {
    healingOverTime: 0,
    shieldTurns: 0,
    preventEnemyAction: false,
    reflectNext: false,
    poisoned: 0,
    burned: 0,
    attackBoost: 0,
    nextCardFree: false
  };
  
  // 敵の状態異常リセット
  enemyStatus = {
    stunned: false,
    poisoned: 0,
    burned: 0,
    attackDown: 0
  };

  const log = document.getElementById("log");
  addLogEntry(`${floor}階に進んだ！敵が強くなった！状態異常がリセットされた！`);

  // ★★以上のカードから1枚追加
  const candidateCards = cardPool.filter(c => c.rarity === '★★' || c.rarity === '★★★');
  if (candidateCards.length > 0) {
    const reward = getRandomCards(1, candidateCards)[0];
    // 構築デッキに追加
    constructedDeck.push(reward);
    // 山札にも追加
    playerDeck.push(reward);
    addLogEntry(`報酬として${reward.name}（${reward.rarity}）を獲得！`);
  }

  updateBattleStatus();
  updateStatusIcons(); // 状態異常アイコンも更新
  drawHand();
 
 // 状態異常アイコンの更新を確実にする
 setTimeout(() => {
   updateStatusIcons();
 }, 100);
  
  // UIの表示状態を正しく設定
 document.getElementById("main-title").style.display = "none";
 document.getElementById("battle-screen").style.display = "block";
 document.getElementById("deck-builder").style.display = "none";
 document.getElementById("gacha-area").style.display = "none";
 document.getElementById("path-selection").style.display = "none";
 document.getElementById("collection-book").style.display = "none";
 document.getElementById("close-collection").style.display = "none";
 document.getElementById("return-main-from-gacha").style.display = "none";
 document.getElementById("show-stats").style.display = "none";
 document.getElementById("load-game").style.display = "none";
 document.getElementById("save-game").style.display = "inline-block";
 document.getElementById("return-main").style.display = "inline-block";
}

function getRarityClass(rarity) {
  switch (rarity) {
    case '★': return 'rarity-common';
    case '★★': return 'rarity-rare';
    case '★★★': return 'rarity-epic';
    case '★★★★': return 'rarity-legendary';
    case '★★★★★': return 'rarity-mythic';
    default: return 'rarity-common';
  }
}

function endPlayerTurn() {
  // デバッグログ
  console.log(`=== endPlayerTurn開始 ===`);
  console.log(`現在の手札枚数: ${currentHand.length}`);
  console.log(`現在の山札枚数: ${playerDeck.length}`);
  console.log(`現在の捨て札枚数: ${discardPile.length}`);

  // 未使用の手札を山札に戻す
  playerDeck.push(...currentHand);
  currentHand = [];
  console.log(`手札を山札に戻しました - 山札: ${playerDeck.length}枚`);

  // 画面からもすべての手札カードを削除
  const handContainer = document.getElementById("hand-container");
  handContainer.innerHTML = "";
  updateDiscardPileDisplay();
  console.log(`=== endPlayerTurn終了 ===`);
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
      <p>${card.description}</p>
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

// 選択肢の分岐処理
function showPathSelection() {
  const pathArea = document.getElementById("path-selection");
  pathArea.style.display = "block";

  document.querySelectorAll(".path-btn").forEach(btn => {
    btn.onclick = () => {
      const choice = btn.dataset.type;
      pathArea.style.display = "none";

      if (choice === "battle") {
        startBattlePhase();
      } else if (choice === "rest") {
        player.hp = Math.min(player.hp + 10, MAX_HP);
        addLogEntry("休憩してHPが10回復した！");
        startBattlePhase();
      } else if (choice === "event") {
        triggerRandomEvent();
      }
    };
  });
}

function triggerRandomEvent() {
  const eventTypes = ["treasure", "trap", "merchant"];
  const selectedEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];

  if (selectedEvent === "treasure") {
    const healed = Math.floor(Math.random() * 6) + 5; // 5〜10
    player.hp = Math.min(player.hp + healed, MAX_HP);
    addLogEntry(`宝箱を見つけた！HPが${healed}回復した！`);
  } else if (selectedEvent === "trap") {
    const damage = Math.floor(Math.random() * 6) + 3; // 3〜8
    player.hp = Math.max(player.hp - damage, 0);
    addLogEntry(`罠にかかった！HPが${damage}減少した…`);
  } else if (selectedEvent === "merchant") {
    const choice = getRandomCards(1, cardPool)[0];
    // イベントで獲得したカードを構築デッキに追加
    constructedDeck.push(choice);
    // 山札にも追加
    playerDeck.push(choice);
    playerOwnedCards.push(choice); // 所持カードにも追加
    addLogEntry(`旅商人と出会った。「${choice.name}」のカードを手に入れた！`);
  }

  setTimeout(() => {
    startBattlePhase();
  }, 1000);
}

// === セーブ関数（確認ダイアログ付き） ===
function saveGame() {
  const confirmed = confirm(
    "※このゲームの進行状況は端末のブラウザに自動保存されます。\n" +
    "※同じ端末・ブラウザでのみ再開可能です。\n" +
    "※プライベートブラウズや履歴削除ではセーブデータが消える可能性があります。\n\n" +
    "現在の進行状況をセーブしますか？"
  );

  if (!confirmed) return;

  const saveData = {
    player,
    playerStatus,
    enemy,
    enemyStatus,
    floor,
    playerDeck,
    constructedDeck,
    discardPile,
    playerOwnedCards,
    initialCardPool,
    turnCount,
    playerCoins,
    gameStats
  };

  try {
    localStorage.setItem("gameSave", JSON.stringify(saveData));
    alert("ゲームを保存しました！");
  } catch (e) {
    alert("セーブに失敗しました：" + e.message);
  }
}

// === ロード関数 ===
function loadGame() {
  const data = localStorage.getItem("gameSave");
  if (!data) {
    alert("保存データが見つかりません。\nセーブ後にロードしてください。")
    return;
  }

  try {
    const saveData = JSON.parse(data);
    player = saveData.player;
    playerStatus = saveData.playerStatus;
    enemy = saveData.enemy;
    enemyStatus = saveData.enemyStatus;
    floor = saveData.floor;
    playerDeck = saveData.playerDeck;
    constructedDeck = saveData.constructedDeck || [];
    discardPile = saveData.discardPile;
    playerOwnedCards = saveData.playerOwnedCards;
    initialCardPool = saveData.initialCardPool || [];
    turnCount = saveData.turnCount || 0;
    playerCoins = saveData.playerCoins || 0;
    gameStats = saveData.gameStats || { totalDamage: 0, cardsPlayed: 0, battlesWon: 0, battlesLost: 0, totalCoinsEarned: 0, gachaPulls: 0, maxFloor: 1, playTime: 0 };

    // メインメニューのUIを全て非表示に
    document.getElementById("start-battle").style.display = "none";
    document.getElementById("go-gacha").style.display = "none";
    document.getElementById("open-collection").style.display = "none";
    document.getElementById("load-game").style.display = "none";

    alert("セーブデータを読み込みました！");
    startBattlePhase();
  } catch (e) {
    alert("ロードに失敗しました：" + e.message);
  }
}

// === メインメニューに戻る処理 ===
function returnToMainMenu() {
  isInBattle = false;
  // デッキ構築済みの場合はカウントを保持、そうでなければリセット
  if (constructedDeck.length === 0) {
    deckBuildCount = 0;
  } else {
    deckBuildCount = 10; // デッキ構築済みとして設定
  }
  document.getElementById("main-title").style.display = "block";
  document.getElementById("battle-screen").style.display = "none";
  document.getElementById("deck-builder").style.display = "none";
  document.getElementById("gacha-area").style.display = "none";
  document.getElementById("path-selection").style.display = "none";
  document.getElementById("collection-book").style.display = "none";
  document.getElementById("close-collection").style.display = "none";
  document.getElementById("return-main-from-gacha").style.display = "none";

  // メインメニュー表示をリセット
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) mainMenu.style.display = "flex";

  const buttons = [
    "start-battle",
    "go-gacha",
    "open-collection",
    "show-stats",
    "load-game",
    "save-game",
    "return-main"
  ];
  buttons.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === "save-game" || id === "return-main") {
        el.style.display = "none";
      } else if (id === "load-game") {
        el.style.display = "inline-block";
      } else {
        el.style.display = "block";
      }
    }
  });

  document.body.classList.remove("gacha-background");
}