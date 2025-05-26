// スプレッドシートのJSONエンドポイントを指定
const API_URL = 'https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec';

let cardPool = [];         // 全カードデータ
let playerDeck = [];       // 選ばれた10枚
let deckBuildCount = 0;    // 選択済み枚数

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
