// sketch.js

let mediaList;
let imageItems = [];
let audioItems = [];
let videoItems = []; // 支持多支 MP4

let imgElement = null;
let vidElement = null;

let bgSounds = [];
let bgSoundIdx = 0;

let imageIdx = 0;
let videoIdx = 0; // 影片索引
let imageTimer = null;

// 總音訊長度 1603000 ms，共 584 張 slides，計算每張停留時間
let imageDisplayDuration = Math.floor(1603000 / 584); // 約 2745 ms

let started = false;

function preload() {
  mediaList = loadJSON(
    '../data/processed/mediaList.json',
    () => { console.log("✅ JSON 載入成功：", mediaList); },
    (err) => { console.error("❌ JSON 載入失敗：", err); }
  );
}

function setup() {
  // 建立透明背景的 canvas
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('background', 'transparent');

  partitionMediaList();

  // 載入背景音樂
  audioItems.forEach(entry => {
    let snd = loadSound(entry.file,
      () => { console.log("✅ bgSounds 載入成功：", entry.file); },
      (err) => { console.error("❌ bgSounds 載入失敗：", entry.file, err); }
    );
    bgSounds.push(snd);
  });

  // 建立圖片滑桿
  const slider = select('#imageSlider');
  if (imageItems.length > 0) {
    slider.attribute('max', imageItems.length - 1);
    slider.value(imageIdx);
  }
  slider.input(() => {
    let idx = int(slider.value());
    imageIdx = idx;
    clearTimeout(imageTimer);
    if (imgElement) imgElement.remove();
    if (vidElement) { vidElement.stop(); vidElement.remove(); vidElement = null; }

    let entry = imageItems[imageIdx];
    console.log("slider 立刻顯示 image-only：", entry.file);
    imgElement = createImg(entry.file);
    imgElement.style("position", "absolute");
    imgElement.style("top", "50%");
    imgElement.style("left", "50%");
    imgElement.style("transform", "translate(-50%, -50%)");
    imgElement.style("max-width", "80%");
    imgElement.style("max-height", "80%");
  });

  // 建立圖片顯示時間輸入框
  const durationInput = select('#durationInput');
  durationInput.value(imageDisplayDuration);
  durationInput.input(() => {
    const v = int(durationInput.value());
    if (!isNaN(v) && v >= 500) {
      imageDisplayDuration = v;
      console.log("已更新圖片顯示時間 (ms)：", imageDisplayDuration);
      if (imageTimer) {
        clearTimeout(imageTimer);
        showNextImage();
      }
    }
  });
}

function draw() { }

function partitionMediaList() {
  if (!mediaList) {
    console.error("⚠️ partitionMediaList：mediaList 尚未定義");
    return;
  }

  let listArray;
  if (Array.isArray(mediaList)) {
    listArray = mediaList;
  } else {
    listArray = Object.values(mediaList);
    console.warn("⚠️ mediaList 不是陣列，已用 Object.values() 轉成陣列。");
  }

  imageItems = [];
  audioItems = [];
  videoItems = [];

  for (let entry of listArray) {
    const sid = entry.student_id;
    if (entry.media) {
      entry.media.forEach(item => {
        if (item.type === "slide") {
          imageItems.push({ student_id: sid, file: `../data/processed/${sid}/${item.file}`, order: item.order });
        } else if (item.type === "audio") {
          audioItems.push({ student_id: sid, file: `../data/processed/${sid}/${item.file}` });
        } else if (item.type === "video") {
          videoItems.push({ student_id: sid, file: `../data/processed/${sid}/${item.file}` });
        }
      });
    }
  }

  imageItems.sort((a, b) => {
    if (a.student_id === b.student_id) return a.order - b.order;
    return a.student_id < b.student_id ? -1 : 1;
  });

  console.log("imageItems:", imageItems);
  console.log("audioItems:", audioItems);
  console.log("videoItems:", videoItems);
}

function mousePressed() {
  if (!started) {
    userStartAudio().then(() => {
      console.log("✅ AudioContext 已啟動，開始播放背景音樂與輪播");
      started = true;
      if (bgSounds.length > 0) playNextBgAudio();
      if (imageItems.length > 0) showNextImage();
      else if (videoItems.length > 0) playNextVideo();
    }).catch(err => console.error("❌ userStartAudio() 失敗：", err));
  }
}

function playNextBgAudio() {
  if (vidElement) return;
  if (bgSounds[bgSoundIdx].isPlaying()) bgSounds[bgSoundIdx].stop();
  console.log("播放 bg sound：", bgSounds[bgSoundIdx].url);
  bgSounds[bgSoundIdx].play();
  bgSounds[bgSoundIdx].onended(() => {
    bgSoundIdx = (bgSoundIdx + 1) % bgSounds.length;
    playNextBgAudio();
  });
}

function showNextImage() {
  if (vidElement) return;
  if (imageTimer) { clearTimeout(imageTimer); imageTimer = null; }

  const entry = imageItems[imageIdx];
  console.log("顯示 image-only", entry.file);
  imgElement = createImg(entry.file);
  imgElement.style("position", "absolute");
  imgElement.style("top", "50%");
  imgElement.style("left", "50%");
  imgElement.style("transform", "translate(-50%, -50%)");
  imgElement.style("max-width", "80%");
  imgElement.style("max-height", "80%");

  imageTimer = setTimeout(() => {
    clearExistingElements();
    // 如果播到最後一張，就播影片
    if (imageIdx === imageItems.length - 1 && videoItems.length) {
      playNextVideo();
    } else {
      imageIdx = (imageIdx + 1) % imageItems.length;
      showNextImage();
    }
  }, imageDisplayDuration);
}

function playNextVideo() {
  if (!videoItems.length) {
    showNextImage();
    return;
  }
  const entry = videoItems[videoIdx];
  console.log("播放 video-only：", entry.file);

  if (bgSounds.length && bgSounds[bgSoundIdx].isPlaying()) bgSounds[bgSoundIdx].pause();
  if (imageTimer) { clearTimeout(imageTimer); imageTimer = null; }
  clearExistingElements();

  vidElement = createVideo(entry.file, () => {
    vidElement.size(width * 0.8, height * 0.8);
    vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
    vidElement.elt.volume = 1;
    vidElement.elt.loop = false;
    vidElement.play();

    vidElement.elt.onended(() => {
      vidElement.remove(); vidElement = null;
      if (bgSounds.length) bgSounds[bgSoundIdx].play();
      videoIdx = (videoIdx + 1) % videoItems.length;
      if (videoIdx === 0) {
        imageIdx = 0;
      }
      showNextImage();
    });
  });
}

function clearExistingElements() {
  if (imgElement) { imgElement.remove(); imgElement = null; }
  if (vidElement) { vidElement.stop(); vidElement.remove(); vidElement = null; }
}

function keyPressed() {
  if ((key === 'v' || key === 'V') && started) {
    playNextVideo();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
