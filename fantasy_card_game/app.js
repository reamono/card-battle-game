(() => {
  "use strict";

  const API_BASE = "https://script.google.com/macros/s/AKfycbwmrF3D7q_pO8up68oFgOhKqyx6PbbVs4BOYv17atgBWWh1i_Q6-IKsEmq0mbNSnOVD/exec";

  // ゲーム関連変数
  let deck = [];
  let live2dApp, live2dModel;
  let playerMana = 3;
  let maxMana = 3;
  let enemyHP = 20;
  let playerHP = 20;

  // DOM要素
  const getCardsBtn = document.getElementById("get-cards-btn");
  const battleBtn = document.getElementById("battle-button");
  const cardContainer = document.getElementById("card-container");
  const messageP = document.getElementById("message");
  const deckCountP = document.getElementById("deck-count");

  // --- カード取得 ---
  function getCards() {
    if (deck.length >= 10) return;

    fetch(`${API_BASE}?action=get`)
      .then(res => res.json())
      .then(data => {
        const selected = [];
        while (selected.length < 3 && selected.length < data.length) {
          const randomIndex = Math.floor(Math.random() * data.length);
          const card = data[randomIndex];
          if (!selected.includes(card)) selected.push(card);
        }

        cardContainer.innerHTML = "";

        selected.forEach(card => {
          const div = document.createElement("div");
          div.className = "card";
          div.innerHTML = `
            <img src="${card.image || 'https://via.placeholder.com/150'}" alt="${card.name}">
            <strong>${card.name}</strong><br>
            種類: ${card.type}<br>
            効果: ${card.effect}<br>
            レア: ${card.rarity}
          `;
          div.onclick = () => addCard(card);
          cardContainer.appendChild(div);
        });
      });
  }

  // --- カード追加 ---
  function addCard(card) {
    if (deck.length >= 10) return;
    deck.push(card);
    messageP.innerText = `${card.name} をデッキに追加しました！`;
    updateDeckCount();

    cardContainer.innerHTML = "";
    if (deck.length < 10) {
      setTimeout(() => getCards(), 500);
    }
  }

  // --- デッキカウント更新 ---
  function updateDeckCount() {
    deckCountP.innerText = `現在のデッキ枚数: ${deck.length} / 10`;

    if (deck.length === 10) {
      battleBtn.style.display = "inline-block";
      getCardsBtn.style.display = "none";
    } else {
      battleBtn.style.display = "none";
      getCardsBtn.style.display = "inline-block";
    }
  }

  // --- バトル開始ダミー ---
  function startBattle() {
    playerMana = maxMana;
    playerHP = 20;
    enemyHP = 20;
    updateStatusDisplay();
  }

  // --- カードプレイ時の処理 ---
  function playCard(card) {
    if (card.cost > playerMana) {
      alert("マナが足りません！");
      return;
    }
    playerMana -= card.cost;
    applyEffect(card.effect);
    updateStatusDisplay();
  
    if (playerMana <= 0) {
      endTurn();
    }
  }

  // --- カード効果の適用関数 ---
  function applyEffect(effectString) {
    const [effectType, valueStr] = effectString.split(":");
    const value = parseInt(valueStr);
  
    switch (effectType) {
      case "attack":
        enemyHP -= value;
        console.log(`敵に${value}のダメージ。残りHP: ${enemyHP}`);
        break;
      case "heal":
        playerHP += value;
        console.log(`プレイヤーのHPが${value}回復。現在HP: ${playerHP}`);
        break;
      case "draw":
        // カードドロー処理（必要に応じて実装）
        break;
      default:
        console.log("未知の効果:", effectString);
    }
  }

  function endTurn() {
    console.log("ターン終了。マナを回復し、次のターンへ");
    playerMana = maxMana;
    updateStatusDisplay();
    // 敵のターン処理があればここに追加
  }

  // --- マナとHPの表示更新関数 ---
  function updateStatusDisplay() {
    document.getElementById("manaDisplay").textContent = `マナ: ${playerMana}/${maxMana}`;
    document.getElementById("playerHP").textContent = `プレイヤーHP: ${playerHP}`;
    document.getElementById("enemyHP").textContent = `敵HP: ${enemyHP}`;
  }

  // // Live2D初期化
  // function initLive2D() {
  //   live2dApp = new PIXI.Application({
  //     width: 300,
  //     height: 500,
  //     transparent: true,
  //     premultipliedAlpha: false,
  //   });

  //   const live2dContainer = document.getElementById("live2d-app");
  //   live2dContainer.appendChild(live2dApp.view);

  //   PIXI.live2d.Live2DModel.from("IceGirl_Live2d/IceGirl.model3.json")
  //     .then(model => {
  //       live2dModel = model;
  //       model.scale.set(0.07);
  //       model.anchor.set(0.5, 0.5);
  //       model.x = live2dApp.renderer.width / 2;
  //       model.y = live2dApp.renderer.height / 2 + 20;
  //       live2dApp.stage.addChild(model);
        
  //       // ここにモーション一覧を定義してconsole.logで確認
  //       // const availableMotions = [
  //       //   "IceGirl_Live2d/DaiJi.motion3.json",
  //       //   "IceGirl_Live2d/HuiShou.motion3.json",
  //       //   "IceGirl_Live2d/MeiYan.motion3.json"
  //       // ];
  //       // console.log("使えるモーション:", availableMotions);

  //       // 自動揺れなどを停止（モーション確認用→使えなかった）
  //       //model.internalModel.motionManager.stopAllMotions();
        
  //       // 例：最初のモーションを再生
  //       // model.motion(availableMotions[2])
  //       //   .then(() => console.log("モーション再生完了"))
  //       //   .catch(console.error);
        
  //     })
  //     .catch(err => {
  //       console.error("Live2Dモデルの読み込みに失敗:", err);
  //     });
  // }

  // ページ読み込み完了時に処理をセット
  window.addEventListener("DOMContentLoaded", () => {
    getCardsBtn.addEventListener("click", getCards);
    battleBtn.addEventListener("click", startBattle);
    updateDeckCount();
    initLive2D();
    cardElement.addEventListener("click", () => {
    playCard(card);
    });
  });

  // グローバルに必要な関数を展開
  window.getCards = getCards;
  window.startBattle = startBattle;

})();
