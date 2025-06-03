// p5.js/sketch.js

let allSlides = [];
let allAudios = [];
let allVideos = [];     // 存 Blob URL
let rawVideoFiles = []; // 存使用者選的 File 物件

let imgElement = null;
let vidElement = null;

let currentSlideIndex = 0;
let slideTimer = null;

let audioIndex = 0;
let videoIndex = 0;

// 投影片原本停留時間（毫秒）
const SLIDE_DURATION = 2745;

// 全域倍速，任意自行調整（只要 < 32 都是真實播放；>= 32 走模擬跳過）
const playbackSpeed = 16;

let started = false;

function setup() {
  createCanvas(windowWidth, windowHeight).style('background', 'transparent');
  partitionMediaList(); // 先把 allSlides & allAudios 塞好

  // 1. 先監聽使用者「挑影片」事件
  const fileInput = select('#videoFilesInput');
  fileInput.changed(handleVideoFileSelection);
}

// 選完檔後立刻觸發播放
function handleVideoFileSelection() {
  rawVideoFiles = this.elt.files;
  if (rawVideoFiles.length === 0) {
    console.warn('>>> 尚未選任何影片');
    return;
  }
  console.log('>>> 使用者選了幾支影片：', rawVideoFiles.length);

  // 清空並轉為 Blob URL
  allVideos = [];
  for (let i = 0; i < rawVideoFiles.length; i++) {
    const file = rawVideoFiles[i];
    const blobURL = URL.createObjectURL(file);
    allVideos.push(blobURL);
    console.log('>>> 轉換成 Blob URL:', blobURL);
  }

  // 隱藏選檔區塊
  select('#file-selector').hide();

  // 選完檔就直接開始播放
  if (!started) {
    started = true;
    console.log(`>>> 選檔完成，自動開始播放 (倍速 ${playbackSpeed}×)`);
    playSlidesWithMultipleAudios();
  }
}

function partitionMediaList() {
  console.log('>>> partitionMediaList() 執行');
  const slideFiles = [];
  allAudios = [];

  mediaList.forEach(entry => {
    const sid = entry.student_id;
    (entry.media || []).forEach(item => {
      const relPath = `data/processed/${sid}/${item.file}`;
      if (item.type === 'slide') {
        slideFiles.push(relPath);
      } else if (item.type === 'audio') {
        allAudios.push(relPath);
      }
    });
  });

  slideFiles.sort();
  allSlides = slideFiles;

  console.log('>>> 全部投影片:', allSlides);
  console.log('>>> 全部音訊:', allAudios);
  console.log('>>> 影片要靠使用者自己選 (allVideos length:', allVideos.length, ')');
}

function playSlidesWithMultipleAudios() {
  console.log(`>>> playSlidesWithMultipleAudios 呼叫 (倍速 ${playbackSpeed}×)`);

  // 1. 播放音訊串接
  if (allAudios.length > 0) {
    audioIndex = 0;
    playAudioSequentially();
  } else {
    console.log('>>> 無音訊，直接播放影片');
    stopSlidesAndPlayVideos();
  }

  // 2. 同步投影片輪播 (SLIDE_DURATION / playbackSpeed)
  if (allSlides.length > 0) {
    currentSlideIndex = 0;
    showSlide(allSlides[0]);

    const adjustedInterval = SLIDE_DURATION / playbackSpeed;
    slideTimer = setInterval(() => {
      currentSlideIndex++;
      if (currentSlideIndex < allSlides.length) {
        showSlide(allSlides[currentSlideIndex]);
      } else {
        clearInterval(slideTimer);
        slideTimer = null;
        console.log('>>> 投影片輪播到最後一張，暫停');
      }
    }, adjustedInterval);
  }
}

function playAudioSequentially() {
  if (audioIndex >= allAudios.length) {
    console.log('>>> 所有音訊播放完，準備切影片');
    stopSlidesAndPlayVideos();
    return;
  }
  const path = allAudios[audioIndex];
  console.log(`>>> 播放第 ${audioIndex + 1} 支音訊（倍速 ${playbackSpeed}×）：`, path);

  // 只有 playbackSpeed >= 32 時模擬跳過
  if (playbackSpeed >= 32) {
    setTimeout(() => {
      console.log(`>>> 模擬第 ${audioIndex + 1} 支音訊結束 (10ms)`);
      audioIndex++;
      playAudioSequentially();
    }, 10);
    return;
  }

  // playbackSpeed < 32 時真實播放
  const snd = new Audio(path);
  snd.playbackRate = playbackSpeed;
  snd.onended = () => {
    console.log(`>>> 第 ${audioIndex + 1} 支音訊結束`);
    audioIndex++;
    playAudioSequentially();
  };
  snd.onerror = () => {
    console.error(`❌ 播放音訊失敗：`, path);
    audioIndex++;
    playAudioSequentially();
  };
  snd.play().catch(err => {
    console.error(`❌ audio.play() 被拒絕：`, path, err);
    audioIndex++;
    playAudioSequentially();
  });
}

function stopSlidesAndPlayVideos() {
  console.log('>>> stopSlidesAndPlayVideos() 呼叫');
  // 停止投影片輪播
  if (slideTimer) {
    clearInterval(slideTimer);
    slideTimer = null;
    console.log('>>> 投影片輪播已停止');
  }
  if (imgElement) {
    imgElement.remove();
    imgElement = null;
    console.log('>>> 移除最後一張投影片');
  }

  // 播放使用者選的影片串接
  if (allVideos.length > 0) {
    videoIndex = 0;
    console.log(`>>> 準備播放影片，共 ${allVideos.length} 支（倍速 ${playbackSpeed}×）`);
    playVideoSequentially();
  } else {
    console.log('>>> 找不到任何影片，要從頭再播投影片與音訊');
    playSlidesWithMultipleAudios();
  }
}

function playVideoSequentially() {
  if (videoIndex >= allVideos.length) {
    console.log('>>> 所有影片播放完畢，回到投影片+音訊');
    playSlidesWithMultipleAudios();
    return;
  }
  const blobURL = allVideos[videoIndex];
  console.log(`>>> 播放第 ${videoIndex + 1} 支影片（倍速 ${playbackSpeed}×）：`, blobURL);

  // 如果上一個 vidElement 還在，就先停掉並移除
  if (vidElement) {
    vidElement.stop();
    vidElement.remove();
    vidElement = null;
  }

  // 只有 playbackSpeed >= 32 時才模擬跳過
  if (playbackSpeed >= 32) {
    vidElement = createVideo(blobURL, () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
      vidElement.elt.volume = 1;
      vidElement.elt.loop = false;
      setTimeout(() => {
        console.log(`>>> 模擬第 ${videoIndex + 1} 支影片結束 (10ms)`);
        vidElement.remove();
        vidElement = null;
        videoIndex++;
        playVideoSequentially();
      }, 10);
    });
    return;
  }

  // playbackSpeed < 32 時真實播放
  vidElement = createVideo(blobURL,
    () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);

      vidElement.elt.playbackRate = playbackSpeed;  // 8× 真正快轉播放
      vidElement.elt.volume = 1;
      vidElement.elt.loop = false;
      vidElement.play();

      vidElement.elt.onended = () => {
        console.log(`>>> 第 ${videoIndex + 1} 支影片結束：`, blobURL);
        vidElement.remove();
        vidElement = null;
        videoIndex++;
        playVideoSequentially();
      };
      vidElement.elt.onerror = (e) => {
        console.error(`❌ 播放影片失敗：`, blobURL, e);
        vidElement.remove();
        vidElement = null;
        videoIndex++;
        playVideoSequentially();
      };
    },
    (err) => {
      console.error(`❌ 影片載入錯誤：`, blobURL, err);
      if (vidElement) {
        vidElement.remove();
        vidElement = null;
      }
      videoIndex++;
      playVideoSequentially();
    }
  );
}

function showSlide(path) {
  if (imgElement) {
    imgElement.remove();
    imgElement = null;
  }
  imgElement = createImg(path);
  imgElement.style('position', 'absolute');
  imgElement.style('top', '50%');
  imgElement.style('left', '50%');
  imgElement.style('transform', 'translate(-50%, -50%)');
  imgElement.style('max-width', '80%');
  imgElement.style('max-height', '80%');
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
