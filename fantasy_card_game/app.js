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

// JSONデータを取得して初期化
document.addEventListener("DOMContentLoaded", () => {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      cardPool = data;
      showDeckChoices();
    });
});

// デッキ構築用：ランダムに3枚表示
function showDeckChoices() {
  const choiceArea = document.getElementById("deck-choice");
  choiceArea.innerHTML = "";

  const random3 = getRandomCards(3, cardPool);

  random3.forEach(card => {
    const cardElem = document.createElement("div");
    cardElem.className = "card";
    cardElem.innerHTML = `
      <img src="${card.image}" alt="${card.name}" />
      <h3>${card.name}</h3>
      <p>${card.effect}</p>
      <p>マナ: ${card.cost}</p>
    `;

    cardElem.addEventListener("click", () => {
      playerDeck.push(card);
      deckBuildCount++;
      document.getElementById("deck-count").textContent = deckBuildCount;

      if (deckBuildCount >= 10) {
        startBattlePhase(); // 完成したらバトル画面へ
      } else {
        showDeckChoices();  // 次の選択へ
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
    cardElem.className = "card";
    cardElem.innerHTML = `
      <img src="${card.image}" alt="${card.name}">
      <h3>${card.name}</h3>
      <p>${card.effect}</p>
      <p>マナ: ${card.cost}</p>
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

function playCard(card) {
  const log = document.getElementById("log");
  log.innerHTML += `<p>${card.name} を使った！</p>`;

  player.mana -= card.cost;

  switch (card.type) {
    case "攻撃":
      enemy.hp -= card.power;
      log.innerHTML += `<p>敵に${card.power}ダメージ！</p>`;
      break;
    case "回復":
      player.hp += card.power;
      log.innerHTML += `<p>HPを${card.power}回復！</p>`;
      break;
    case "防御":
      player.shield += card.power;
      log.innerHTML += `<p>シールド${card.power}付与！</p>`;
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

function enemyTurn() {
  const log = document.getElementById("log");
  log.innerHTML += `<p>敵のターン！</p>`;

  let damage = enemy.attack;
  if (player.shield > 0) {
    const blocked = Math.min(player.shield, damage);
    damage -= blocked;
    player.shield -= blocked;
    log.innerHTML += `<p>シールドで${blocked}軽減！</p>`;
  }

  player.hp -= damage;
  log.innerHTML += `<p>敵の攻撃！${damage}ダメージを受けた！</p>`;

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

function nextFloor() {
  floor++;
  enemy.hp = 20 + floor * 5;
  enemy.attack = 4 + floor;
  player.mana = 3;
  player.shield = 0;

  const log = document.getElementById("log");
  log.innerHTML += `<p>${floor}階に進んだ！敵が強くなった！</p>`;

  updateBattleStatus();
  drawHand();
}
