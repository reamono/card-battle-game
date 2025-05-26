// スプレッドシートのJSONエンドポイントを指定
const API_URL = 'https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec'; // 実際のURLに置き換え

let selectedCards = [];
let allCards = [];

document.addEventListener("DOMContentLoaded", () => {
  fetch(API_URL)
    .then(res => res.json())
    .then(data => {
      allCards = data;
      renderCards(data);
    });

  document.getElementById("start-battle").addEventListener("click", () => {
    startBattle();
  });
});

function renderCards(cards) {
  const container = document.getElementById("card-container");
  container.innerHTML = "";

  cards.forEach(card => {
    const cardElem = document.createElement("div");
    cardElem.className = "card";
    cardElem.innerHTML = `
      <img src="${card.image}" alt="${card.name}">
      <h3>${card.name}</h3>
      <p>${card.effect}</p>
      <p>コスト: ${card.cost}</p>
    `;
    cardElem.addEventListener("click", () => {
      toggleCard(card.id, cardElem);
    });
    container.appendChild(cardElem);
  });
}

function toggleCard(id, element) {
  if (selectedCards.includes(id)) {
    selectedCards = selectedCards.filter(c => c !== id);
    element.classList.remove("selected");
  } else {
    selectedCards.push(id);
    element.classList.add("selected");
  }
}

function startBattle() {
  const log = document.getElementById("log");
  log.innerHTML = "<h2>バトルログ</h2>";

  selectedCards.forEach(cardId => {
    const card = allCards.find(c => c.id == cardId);
    if (card) {
      log.innerHTML += `<p>${card.name} を使用 → ${card.effect}</p>`;
    }
  });

  selectedCards = [];
}
