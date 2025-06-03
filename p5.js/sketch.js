// sketch.js

let mediaList;       // 讀進來的完整 JSON 物件陣列
let playlist = [];   // 最終整合出的「單一播放清單」
let currentIdx = 0;  // 正在顯示／播放的 playlist 索引

// 以下用來暫存動態建立的 DOM 元素
let imgElement = null;
let vidElement = null;
let soundElement = null;
let isPlaying = false;

function preload() {
  // 1. 用 loadJSON 把 mediaList.json 讀進來
  mediaList = loadJSON('assets/data/mediaList.json');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(255);

  // 2. 建立 playlist：把每個學生的 slides、audio、video 都推到 playlist 裡
  buildPlaylistFromMediaList();

  // 3. 一開始顯示／播放 playlist[0]
  showCurrentItem();
}

function draw() {
  // 整個輪播邏輯都在 showCurrentItem() 與回呼裡，draw() 不用持續畫
}

// ──── 根據 mediaList 內容產生整合播放清單 ────
function buildPlaylistFromMediaList() {
  playlist = [];

  // mediaList 是一個陣列，每個元素像 { student_id, slides: [...], audio: "...", video: "..." }
  // 先把純投影片（slides）塞進 playlist
  for (let entry of mediaList) {
    const sid = entry.student_id;

    // 1. 如果 slides 陣列有值，就把每張 PNG 都推成一筆 type="image-only"
    if (entry.slides && entry.slides.length > 0) {
      for (let i = 0; i < entry.slides.length; i++) {
        let filename = entry.slides[i];
        playlist.push({
          student_id: sid,
          type: 'image-only',
          file: `assets/images/${filename}`,  // 完整相對路徑
          order: i + 1
        });
      }
    }

    // 2. 如果有 audio 字串，就推一筆 type="audio-only"
    if (entry.audio) {
      playlist.push({
        student_id: sid,
        type: 'audio-only',
        file: `assets/audio/${entry.audio}`
      });
    }

    // 3. 如果有 video 字串，就推一筆 type="video-only"
    if (entry.video) {
      playlist.push({
        student_id: sid,
        type: 'video-only',
        file: `assets/video/${entry.video}`
      });
    }
  }

  // （可選）如果有特定要把「前三筆純聲音」硬插在前面，也可以寫在這裡，例如：
  // let specialAudioOnly = ["112101516","112101012","112101001"];
  // for (let id of specialAudioOnly) {
  //   playlist.unshift({
  //     student_id: null,
  //     type: "audio-only",
  //     file: `assets/audio/${id}.mp3`
  //   });
  // }

  // 4. 最後，我們可以用 student_id 與 order 做一次排序：
  playlist.sort((a, b) => {
    // 如果同一個 student，就依 order 排（若沒有 order 則都當 0）
    if (a.student_id && b.student_id && a.student_id === b.student_id) {
      return (a.order || 0) - (b.order || 0);
    }
    // 有 student_id 的擺前面，沒有 student_id（e.g. 特殊音檔）放後面
    if (a.student_id && !b.student_id) return -1;
    if (!a.student_id && b.student_id) return 1;
    // 不同的 student，依 student_id 字串排序
    let sa = a.student_id || "";
    let sb = b.student_id || "";
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  });

  console.log("最終 playlist：", playlist);
}

// ──── 顯示／播放當前索引的素材 ────
function showCurrentItem() {
  background(0);
  clearExistingElements();

  if (playlist.length === 0) {
    text("播放清單為空", width / 2, height / 2);
    return;
  }

  let item = playlist[currentIdx];

  // 1. image-only：純投影片，一張顯示 3 秒後自動切下一張
  if (item.type === "image-only") {
    imgElement = createImg(item.file);
    imgElement.style("position", "absolute");
    imgElement.style("top", "50%");
    imgElement.style("left", "50%");
    imgElement.style("transform", "translate(-50%, -50%)");
    imgElement.style("max-width", "90%");
    imgElement.style("max-height", "80%");

    // 3 秒後跳下一筆
    setTimeout(() => {
      goToNext();
    }, 3000);
  }
  // 2. audio-only：純聲音，播完自動切下一筆
  else if (item.type === "audio-only") {
    // loadSound 會非同步載入，播放後在 onended 觸發 goToNext()
    soundElement = loadSound(item.file, () => {
      soundElement.play();
      isPlaying = true;
      soundElement.onended(() => {
        isPlaying = false;
        goToNext();
      });
    });
    // 顯示文字提示正在播放哪個聲音
    fill(255);
    text(`播放聲音：${item.file}`, width / 2, height / 2);
  }
  // 3. video-only：純影片，監聽 onended 切下一筆
  else if (item.type === "video-only") {
    vidElement = createVideo(item.file, () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
      vidElement.elt.controls = false;
      vidElement.elt.loop = false;
      vidElement.elt.volume = 1.0;
      vidElement.play();
      // 監聽影片結束
      vidElement.elt.onended = () => {
        goToNext();
      };
    });
  }
  else {
    // 理論上不會到這裡，因為目前只有三種 type
    text("未知的素材類型", width / 2, height / 2);
  }
}

// ──── 切換到下一筆並重播 ────
function goToNext() {
  clearExistingElements();
  currentIdx = (currentIdx + 1) % playlist.length;
  showCurrentItem();
}

// ──── 清除畫面上所有動態產生的 DOM 元素 ────
function clearExistingElements() {
  if (imgElement) {
    imgElement.remove();
    imgElement = null;
  }
  if (vidElement) {
    vidElement.stop();
    vidElement.remove();
    vidElement = null;
  }
  if (soundElement) {
    if (soundElement.isPlaying()) soundElement.stop();
    soundElement = null;
  }
}

// 當視窗尺寸改變時，調整 canvas
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
