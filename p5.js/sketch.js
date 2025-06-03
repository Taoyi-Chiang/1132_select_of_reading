// sketch.js

let mediaList;          // 改為稍後從 File API 傳進來
let imageItems = [];
let audioItems = [];
let videoItems = [];

let imgElement = null;
let vidElement = null;
let bgSounds = [];
let bgSoundIdx = 0;

let imageIdx = 0;
let videoIdx = 0;
let imageTimer = null;

// 預設值，可讓使用者改
let imageDisplayDuration = 3000;
let started = false;

function setup() {
  // 先建立一個 full-screen canvas
  createCanvas(windowWidth, windowHeight).style('background', 'transparent');

  // 一開始先隱藏 controls，等 user 選完 JSON 再顯示
  select('#controls').style('display', 'none');

  // 處理檔案由 File Input 讀取
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', evt => {
    const file = evt.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      alert('請選擇 mediaList.json');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        mediaList = JSON.parse(e.target.result);
      } catch (err) {
        alert('解析 JSON 時出錯：' + err);
        return;
      }
      console.log('✅ 使用者選擇的 mediaList.json 已讀取：', mediaList);
      initAfterLoadJSON();
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function initAfterLoadJSON() {
  // 檔案讀完之後把 controls 顯示出來，並隱藏 fileInput
  select('#controls').style('display', 'block');
  select('#fileInput').style.display = 'none';

  // 注意：此處不應重新定義 partitionMediaList！
  // 需要呼叫外層的 partitionMediaList()，而不是在此處嵌套函式。
  partitionMediaList();

  // 載入所有背景音訊
  audioItems.forEach(entry => {
    let snd = loadSound(
      entry.file,
      () => console.log('✅ bgSounds 載入成功：', entry.file),
      err => console.error('❌ bgSounds 載入失敗：', entry.file, err)
    );
    bgSounds.push(snd);
  });

  // 設定圖片滑桿
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
    if (vidElement) {
      vidElement.stop();
      vidElement.remove();
      vidElement = null;
    }
    let entry = imageItems[imageIdx];
    imgElement = createImg(entry.file);
    imgElement.style('position', 'absolute');
    imgElement.style('top', '50%');
    imgElement.style('left', '50%');
    imgElement.style('transform', 'translate(-50%, -50%)');
    imgElement.style('max-width', '80%');
    imgElement.style('max-height', '80%');
  });

  // 設定圖片顯示時間輸入框
  const durationInput = select('#durationInput');
  durationInput.value(imageDisplayDuration);
  durationInput.input(() => {
    const v = int(durationInput.value());
    if (!isNaN(v) && v >= 500) {
      imageDisplayDuration = v;
      if (imageTimer) {
        clearTimeout(imageTimer);
        showNextImage();
      }
    }
  });
}

function partitionMediaList() {
  imageItems = [];
  audioItems = [];
  videoItems = [];

  const listArray = Array.isArray(mediaList) ? mediaList : Object.values(mediaList);

  for (let entry of listArray) {
    const sid = entry.student_id;
    if (entry.media) {
      entry.media.forEach(item => {
        if (item.type === 'slide') {
          imageItems.push({
            student_id: sid,
            file: `data/processed/${sid}/${item.file}`,
            order: item.order
          });
        } else if (item.type === 'audio') {
          audioItems.push({
            student_id: sid,
            file: `data/processed/${sid}/${item.file}`
          });
        } else if (item.type === 'video') {
          videoItems.push({
            student_id: sid,
            file: `data/processed/${sid}/${item.file}`
          });
        }
      });
    }
  }

  imageItems.sort((a, b) => {
    if (a.student_id === b.student_id) return a.order - b.order;
    return a.student_id < b.student_id ? -1 : 1;
  });

  console.log('imageItems:', imageItems);
  console.log('audioItems:', audioItems);
  console.log('videoItems:', videoItems);
}

function mousePressed() {
  if (!started) {
    userStartAudio().then(() => {
      started = true;
      if (bgSounds.length > 0) playNextBgAudio();
      if (imageItems.length > 0) showNextImage();
      else if (videoItems.length > 0) playNextVideo();
    });
  }
}

function playNextBgAudio() {
  if (vidElement) return;
  if (bgSounds[bgSoundIdx].isPlaying()) bgSounds[bgSoundIdx].stop();
  bgSounds[bgSoundIdx].play();
  bgSounds[bgSoundIdx].onended(() => {
    bgSoundIdx = (bgSoundIdx + 1) % bgSounds.length;
    playNextBgAudio();
  });
}

function showNextImage() {
  if (vidElement) return;
  if (imageTimer) clearTimeout(imageTimer);

  const entry = imageItems[imageIdx];
  if (imgElement) imgElement.remove();
  imgElement = createImg(entry.file);
  imgElement.style('position', 'absolute');
  imgElement.style('top', '50%');
  imgElement.style('left', '50%');
  imgElement.style('transform', 'translate(-50%, -50%)');
  imgElement.style('max-width', '80%');
  imgElement.style('max-height', '80%');

  imageTimer = setTimeout(() => {
    imgElement.remove();
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
  vidElement = createVideo(entry.file, () => {
    vidElement.size(width * 0.8, height * 0.8)
             .position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
    vidElement.elt.volume = 1;
    vidElement.elt.loop = false;
    vidElement.play();

    vidElement.elt.onended(() => {
      vidElement.remove();
      if (videoIdx < videoItems.length - 1) {
        videoIdx++;
        playNextVideo();
      } else {
        videoIdx = 0;
        if (bgSounds.length) bgSounds[bgSoundIdx].play();
        showNextImage();
      }
    });
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
