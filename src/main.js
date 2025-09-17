import * as PIXI from 'pixi.js';
// 引入 Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import './style.css'

// --- 引入圖片資源 ---
import dogImg from '/picture/dog.png';
import catImg from '/picture/cat.png';
import penguinImg from '/picture/penguin.png';

// --- Firebase 設定 ---
// 請將這裡換成您自己的 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyBrNDUTSm5O2yAWBfh23foAuzp-l3c9O6w",
  authDomain: "hidegame.firebaseapp.com",
  projectId: "hidegame",
  storageBucket: "hidegame.firebasestorage.app",
  messagingSenderId: "597882623750",
  appId: "1:597882623750:web:12639d3fc5c741d542f087",
  measurementId: "G-ESZW3VEQG5"
};

// 初始化 Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const leaderboardCol = collection(db, "leaderboard");

const app = new PIXI.Application();

(async () => {
  await app.init({ background: '#1099bb', resizeTo: window });
  document.body.appendChild(app.view);
  
  // 遊戲變數
  let player;
  let scoreMultiplier = 1; // 分數倍率
  let gameOver = true; // 遊戲一開始是結束狀態，等待角色選擇
  let selectedCharacterName = ''; // 儲存選擇的角色名稱
  let gameStarted = false; // 遊戲是否已開始

  // 啟用互動
  app.stage.interactive = true;
  app.stage.hitArea = app.screen;

  // 監聽觸控/滑鼠移動事件
  app.stage.on('pointermove', (event) => {
    if (!gameOver) {
      player.x = event.global.x;
      player.y = event.global.y;
    }
  });

  // 建立角色選擇畫面
  const selectionContainer = new PIXI.Container();
  app.stage.addChild(selectionContainer);

  // 選擇畫面的背景
  const background = new PIXI.Graphics();
  background.fill({ color: 0x000000, alpha: 0.7 });
  background.rect(0, 0, app.screen.width, app.screen.height);
  background.fill();
  selectionContainer.addChild(background);

  const titleText = new PIXI.Text({ text: '選擇你的角色', style: { fill: 'white', fontSize: 36, align: 'center' } });
  titleText.anchor.set(0.5);
  titleText.x = app.screen.width / 2;
  titleText.y = app.screen.height / 2 - 100;
  selectionContainer.addChild(titleText);

  // 定義角色及其屬性 (路徑, 大小, 分數倍率)
  const characters = [
    { path: dogImg, size: 40, multiplier: 1, name: '狗狗 (簡單)' },
    { path: catImg, size: 50, multiplier: 1.2, name: '貓咪 (普通)' },
    { path: penguinImg, size: 60, multiplier: 1.5, name: '企鵝 (困難)' },
  ];

  const characterChoices = [];
  for (let i = 0; i < characters.length; i++) {
    const charData = characters[i];
    const container = new PIXI.Container(); // 為每個選項建立一個容器

    const texture = await PIXI.Assets.load(charData.path);
    const choice = new PIXI.Sprite(texture);
    const frame = new PIXI.Graphics();
    const frameWidth = 80;
    const frameHeight = 80;

    // 繪製框框
    frame.roundRect(0, 0, frameWidth, frameHeight, 10);
    frame.fill({ color: 0x333333, alpha: 0.8 });
    frame.stroke({ width: 2, color: 0xffffff });

    // 角色名稱文字
    const nameText = new PIXI.Text({ text: charData.name, style: { fill: 'white', fontSize: 16 } });
    nameText.anchor.set(0.5);
    nameText.y = frameHeight / 2 + 25;

    container.x = app.screen.width / 2 + (i - 1) * 150; // 增加選項間距
    container.y = app.screen.height / 2;
    container.interactive = true;
    container.cursor = 'pointer';

    // --- 調整角色圖案大小 ---
    choice.anchor.set(0.5);
    choice.width = 60; // 將圖案縮小以放入框內
    choice.height = 60;

    container.on('pointerdown', () => {
      startGame(texture, charData.size, charData.multiplier, charData.name);
    });

    container.addChild(frame);
    container.addChild(nameText);
    frame.addChild(choice); // 將角色圖片加到框裡面
    selectionContainer.addChild(container);
  }

  // 開始遊戲的函式
  function startGame(playerTexture, playerSize, multiplier, charName) {
    // 建立玩家
    player = new PIXI.Sprite(playerTexture);
    player.anchor.set(0.5);
    player.x = app.screen.width / 2;
    player.y = app.screen.height / 2;

    // --- 根據選擇的角色設定大小 ---
    player.width = playerSize;
    player.height = playerSize;
    app.stage.addChild(player);

    // 設定分數倍率
    scoreMultiplier = multiplier;
    selectedCharacterName = charName; // 儲存角色名稱

    // 移除選擇畫面
    app.stage.removeChild(selectionContainer);
    selectionContainer.destroy({ children: true });

    // 重設遊戲狀態
    gameOver = false;
    gameStarted = true;
    score = 0;
    spawnTimes.forEach(spawn => spawn.spawned = false); // 重置障礙物生成計時器
    createObstacles(initialObstacles); // 創建初始障礙物
  }

  // 建立障礙物
  const obstacles = [];
  const initialObstacles = 10; // 初始障礙物數量
  const obstacleTexture = PIXI.Texture.WHITE; // 使用白色方塊作為障礙物

  // 定義障礙物類型
  const obstacleTypes = {
    type1: { size: 40, speed: 2.5, color: 0xff0000 }, // 普通
    type2: { size: 20, speed: 5, color: 0xffff00 },   // 小而快 (黃色)
    type3: { size: 80, speed: 1.5, color: 0x800080 }, // 大而慢 (紫色)
  };

  // 建立障礙物的函數
  function createObstacles(count) {
    for (let i = 0; i < count; i++) {
      const obstacle = new PIXI.Sprite(obstacleTexture);
      obstacle.anchor.set(0.5);
      // 初始化所有障礙物為第一類
      obstacle.obstacleType = 'type1';
      const type = obstacleTypes[obstacle.obstacleType];
      obstacle.tint = type.color;
      obstacle.width = obstacle.height = type.size;
      resetObstacle(obstacle);
      obstacles.push(obstacle);
      app.stage.addChild(obstacle);
    }
  }

  // 重設障礙物位置及速度
  function resetObstacle(obstacle) {
    // 根據障礙物類型設定速度
    const type = obstacleTypes[obstacle.obstacleType];
    const speed = type.speed;

    const edge = Math.floor(Math.random() * 4); // 0:上, 1:右, 2:下, 3:左

    switch (edge) {
      case 0: // 從上方出現
        obstacle.x = Math.random() * app.screen.width;
        obstacle.y = -obstacle.height;
        obstacle.vx = (Math.random() * 2 - 1) * speed; // 左右隨機
        obstacle.vy = speed;
        break;
      case 1: // 從右方出現
        obstacle.x = app.screen.width + obstacle.width;
        obstacle.y = Math.random() * app.screen.height;
        obstacle.vx = -speed;
        obstacle.vy = (Math.random() * 2 - 1) * speed;
        break;
      case 2: // 從下方出現
        obstacle.x = Math.random() * app.screen.width;
        obstacle.y = app.screen.height + obstacle.height;
        obstacle.vx = (Math.random() * 2 - 1) * speed;
        obstacle.vy = -speed;
        break;
      case 3: // 從左方出現
        obstacle.x = -obstacle.width;
        obstacle.y = Math.random() * app.screen.height;
        obstacle.vx = speed;
        obstacle.vy = (Math.random() * 2 - 1) * speed;
        break;
    }
  }

  // 分數 (計時器)
  let score = 0;
  const scoreText = new PIXI.Text({ text: `Score: 0`, style: { fill: 'white', fontSize: 24 } });
  scoreText.x = 10;
  scoreText.y = 10;
  app.stage.addChild(scoreText);

  // 遊戲結束文字
  const gameOverText = new PIXI.Text({ text: `Game Over!`, style: { fill: 'white', fontSize: 48, align: 'center' } });
  gameOverText.anchor.set(0.5);
  gameOverText.x = app.screen.width / 2;
  gameOverText.y = app.screen.height / 2;
  gameOverText.visible = false;
  app.stage.addChild(gameOverText);

  // 設定在特定時間點增加障礙物
  const spawnTimes = [
    { time: 15, count: 5, spawned: false }, // 在 15 秒時增加 5 個
    { time: 30, count: 5, spawned: false }, // 在 30 秒時再增加 5 個
    { time: 45, count: 5, spawned: false }, // 在 45 秒時再增加 5 個
  ];

  // 遊戲主迴圈
  app.ticker.add((time) => {
    if (gameOver || !gameStarted) return;

    // 更新分數
    // score += time.deltaTime; // 這裡的 deltaTime 會讓分數變成浮點數，直接用整數比較好
    score += (1 / 60) * scoreMultiplier; // 根據倍率增加分數
    const currentTime = Math.floor(score);
    scoreText.text = `Score: ${currentTime}`;

    // 根據時間增加障礙物
    spawnTimes.forEach(spawn => {
      if (!spawn.spawned && currentTime >= spawn.time) {
        createObstacles(spawn.count);
        spawn.spawned = true; // 標記為已生成，避免重複生成
      }
    });

    // 更新障礙物位置
    obstacles.forEach(obstacle => {
      obstacle.x += obstacle.vx * time.deltaTime;
      obstacle.y += obstacle.vy * time.deltaTime;

      // 如果障礙物移出畫面，根據當前遊戲時間決定它的新類型
      if (obstacle.x < -obstacle.width || obstacle.x > app.screen.width + obstacle.width ||
          obstacle.y < -obstacle.height || obstacle.y > app.screen.height + obstacle.height) {

        let availableTypes = ['type1'];
        if (currentTime >= 20) {
          availableTypes.push('type2');
        }
        if (currentTime >= 40) {
          availableTypes.push('type3');
        }

        obstacle.obstacleType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const typeData = obstacleTypes[obstacle.obstacleType];
        obstacle.tint = typeData.color;
        obstacle.width = obstacle.height = typeData.size;

        resetObstacle(obstacle);
      }

      // 碰撞偵測
      if (hitTest(player, obstacle)) {
        endGame();
      }
    });
  });

  // 碰撞偵測函式
  function hitTest(sprite1, sprite2) {
    const dx = sprite1.x - sprite2.x;
    const dy = sprite1.y - sprite2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (sprite1.width / 2) + (sprite2.width / 2);
  }

  // 遊戲結束函式
  async function endGame() {
    gameOver = true;
    app.stage.interactive = false; // 停止玩家移動
    player.tint = 0xff0000;

    const finalScore = Math.floor(score);
    const defaultName = "躲貓貓天才";

    // 自動儲存成績，包含新欄位
    try {
      const docRef = await addDoc(leaderboardCol, {
        name: defaultName,
        score: finalScore,
        character: selectedCharacterName, // 新增角色欄位
        createdAt: formatTimestamp(new Date()) // 新增格式化時間欄位
      });
      // 顯示排行榜和輸入畫面，並傳入新紀錄的 ID
      showLeaderboard(docRef.id, finalScore, defaultName);
    } catch (e) {
      console.error("Error adding document: ", e);
      // 即使儲存失敗，也顯示排行榜
      showLeaderboard(null, finalScore, defaultName);
    }
  }

  // --- 時間格式化函式 ---
  function formatTimestamp(date) {
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${Y}/${M}/${D} ${h}:${m}`;
  }



  // --- 排行榜相關函式 ---
  async function showLeaderboard(docId, finalScore, currentName) {
    const leaderboardContainer = document.getElementById('leaderboard-container');
    const finalScoreSpan = document.getElementById('final-score');
    const nicknameInput = document.getElementById('nickname-input');
    const submitButton = document.getElementById('submit-score');
    const restartButton = document.getElementById('restart-button');
    const leaderboardList = document.getElementById('leaderboard-list');
    const currentPlayerRankP = document.getElementById('current-player-rank');
    const nicknameSection = document.getElementById('nickname-input-section');

    finalScoreSpan.textContent = finalScore;
    nicknameInput.placeholder = "躲貓貓天才"; // 設定預設提示
    leaderboardContainer.style.display = 'block';
    nicknameSection.style.display = 'block'; // 確保輸入區塊可見
    nicknameInput.value = ''; // 清空輸入框

    // 提交分數的邏輯
    submitButton.onclick = async () => {
      const newNickname = nicknameInput.value.trim();
      
      // 如果沒有輸入新暱稱，或沒有 docId，則不執行任何操作
      if (!newNickname || !docId) {
        nicknameSection.style.display = 'none'; // 隱藏輸入區塊
        return;
      }

      // 隱藏輸入框，避免重複提交
      nicknameSection.style.display = 'none';

      // 更新 Firebase 中的暱稱
      const docRef = doc(db, "leaderboard", docId);
      await updateDoc(docRef, {
        name: newNickname
      });

      // 重新載入並顯示排行榜，使用新的暱稱來尋找排名
      loadAndDisplayRankings(finalScore, newNickname);
    };

    restartButton.onclick = () => {
      window.location.reload();
    };

    // 載入並顯示排行榜
    async function loadAndDisplayRankings(currentScore, currentNickname) {
      leaderboardList.innerHTML = '讀取中...';
      currentPlayerRankP.textContent = ''; // 清空之前的排名

      const q = query(leaderboardCol, orderBy("score", "desc"));
      const querySnapshot = await getDocs(q);
      const allScores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 顯示前 10 名
      leaderboardList.innerHTML = '';
      allScores.slice(0, 10).forEach((entry, index) => {
        const li = document.createElement('li'); // 建立 li 元素
        // 使用 innerHTML 插入帶有 class 的 span 元素
        li.innerHTML = `
          <span class="rank">${index + 1}.</span>
          <span class="name">${entry.name}</span>
          <span class="score">${entry.score}</span>
          <span class="details">(${entry.character}) - ${entry.createdAt}</span>
        `;
        leaderboardList.appendChild(li);
      });

      // 找到目前玩家的名次
      if (currentScore !== undefined && currentNickname) {
        // 為了找到準確的排名，我們需要考慮分數和名字
        // 如果是剛剛更新的，就用新的名字找
        const currentPlayerIndex = allScores.findIndex(entry => entry.score === currentScore && entry.name === currentNickname);
        
        if (currentPlayerIndex !== -1) {
          currentPlayerRankP.textContent = `你的名次: 第 ${currentPlayerIndex + 1} 名 (共 ${allScores.length} 名)`;
        }
      }
    }

    // 初始載入，並顯示當前玩家的分數和預設排名
    loadAndDisplayRankings(finalScore, currentName);
  }
})();
