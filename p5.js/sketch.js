// p5.js/sketch.js

let allSlides = [];
let allAudios = [];
let allVideos = [];     // 存 Blob URL，最短影片會放在第一個
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
const playbackSpeed = 1;

let started = false;

function setup() {
  createCanvas(windowWidth, windowHeight).style('background', 'transparent');
  partitionMediaList(); // 先把 allSlides & allAudios 塞好

  // 1. 先監聽使用者「挑影片」事件
  const fileInput = select('#videoFilesInput');
  fileInput.changed(handleVideoFileSelection);
}

// 選完檔後先蒐集各影片的 URL、原始順序以及長度，找出最短的放第一，再開始播放最短影片
function handleVideoFileSelection() {
  rawVideoFiles = this.elt.files;
  if (rawVideoFiles.length === 0) {
    console.warn('>>> 尚未選任何影片');
    return;
  }
  console.log('>>> 使用者選了幾支影片：', rawVideoFiles.length);

  let videoInfos = [];
  let loadedCount = 0;

  rawVideoFiles.forEach((file, idx) => {
    const blobURL = URL.createObjectURL(file);
    let tempVid = createVideo(blobURL, () => {});
    tempVid.hide();

    tempVid.elt.onloadedmetadata = () => {
      videoInfos.push({ url: blobURL, duration: tempVid.elt.duration, index: idx });
      tempVid.remove();
      loadedCount++;
      if (loadedCount === rawVideoFiles.length) {
        let sortedByDuration = [...videoInfos].sort((a, b) => a.duration - b.duration);
        let shortest = sortedByDuration[0];
        let others = videoInfos
          .filter(v => v.url !== shortest.url)
          .sort((a, b) => a.index - b.index);
        allVideos = [shortest.url, ...others.map(v => v.url)];

        select('#file-selector').hide();

        if (!started) {
          started = true;
          console.log(`>>> 選檔完成，自動播放最短影片 (倍速 ${playbackSpeed}×)`);
          playInitialShortestVideo();
        }
      }
    };

    tempVid.elt.onerror = () => {
      console.error(`❌ 讀取影片 metadata 失敗：`, blobURL);
      tempVid.remove();
      loadedCount++;
      if (loadedCount === rawVideoFiles.length) {
        allVideos = rawVideoFiles.map(f => URL.createObjectURL(f));
        select('#file-selector').hide();
        if (!started) {
          started = true;
          console.log(`>>> 選檔完成，自動播放最短影片 (倍速 ${playbackSpeed}×)，部分 metadata 讀取失敗`);
          playInitialShortestVideo();
        }
      }
    };
  });
}

// 播放最短影片，結束後接著播放投影片+音訊
function playInitialShortestVideo() {
  if (allVideos.length === 0) {
    console.warn('>>> 沒有影片可以播放，直接播放投影片+音訊');
    playSlidesWithMultipleAudios();
    return;
  }
  const blobURL = allVideos[0];
  console.log(`>>> 播放最短影片（倍速 ${playbackSpeed}×）：`, blobURL);

  if (playbackSpeed >= 32) {
    vidElement = createVideo(blobURL, () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
      vidElement.elt.volume = 1;
      vidElement.elt.loop = false;
      setTimeout(() => {
        vidElement.remove();
        vidElement = null;
        console.log('>>> 最短影片模擬結束，開始投影片+音訊');
        playSlidesWithMultipleAudios();
      }, 10);
    });
    return;
  }

  vidElement = createVideo(
    blobURL,
    () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
      vidElement.elt.playbackRate = playbackSpeed;
      vidElement.elt.volume = 1;
      vidElement.elt.loop = false;
      vidElement.play();
      vidElement.elt.onended = () => {
        vidElement.remove();
        vidElement = null;
        console.log('>>> 最短影片結束，開始投影片+音訊');
        playSlidesWithMultipleAudios();
      };
      vidElement.elt.onerror = (e) => {
        console.error(`❌ 最短影片載入失敗：`, blobURL, e);
        vidElement.remove();
        vidElement = null;
        playSlidesWithMultipleAudios();
      };
    },
    (err) => {
      console.error(`❌ 最短影片載入錯誤：`, blobURL, err);
      if (vidElement) {
        vidElement.remove();
        vidElement = null;
      }
      playSlidesWithMultipleAudios();
    }
  );
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

  if (allAudios.length > 0) {
    audioIndex = 0;
    playAudioSequentially();
  } else {
    console.log('>>> 無音訊，直接播放其他影片');
    stopSlidesAndPlayRemainingVideos();
  }

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
    console.log('>>> 所有音訊播放完，準備播放其他影片');
    stopSlidesAndPlayRemainingVideos();
    return;
  }
  const path = allAudios[audioIndex];
  console.log(`>>> 播放第 ${audioIndex + 1} 支音訊（倍速 ${playbackSpeed}×）：`, path);

  if (playbackSpeed >= 32) {
    setTimeout(() => {
      console.log(`>>> 模擬第 ${audioIndex + 1} 支音訊結束 (10ms)`);
      audioIndex++;
      playAudioSequentially();
    }, 10);
    return;
  }

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

// 投影片+音訊結束後，只播放較長的影片，跳過最短的 index 0
function stopSlidesAndPlayRemainingVideos() {
  console.log('>>> stopSlidesAndPlayRemainingVideos() 呼叫');
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

  if (allVideos.length > 1) {
    videoIndex = 1;
    console.log(`>>> 播放剩餘影片，共 ${allVideos.length - 1} 支（倍速 ${playbackSpeed}×）`);
    playRemainingVideosSequentially();
  } else {
    console.log('>>> 沒有其他影片，流程結束');
  }
}

function playRemainingVideosSequentially() {
  if (videoIndex >= allVideos.length) {
    console.log('>>> 所有長影片播放完畢，流程結束');
    return;
  }
  const blobURL = allVideos[videoIndex];
  console.log(`>>> 播放第 ${videoIndex + 1} 支長影片（倍速 ${playbackSpeed}×）：`, blobURL);

  if (vidElement) {
    vidElement.stop();
    vidElement.remove();
    vidElement = null;
  }

  if (playbackSpeed >= 32) {
    vidElement = createVideo(blobURL, () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
      vidElement.elt.volume = 1;
      vidElement.elt.loop = false;
      setTimeout(() => {
        vidElement.remove();
        vidElement = null;
        console.log(`>>> 模擬第 ${videoIndex + 1} 支長影片結束 (10ms)`);
        videoIndex++;
        playRemainingVideosSequentially();
      }, 10);
    });
    return;
  }

  vidElement = createVideo(
    blobURL,
    () => {
      vidElement.size(width * 0.8, height * 0.8);
      vidElement.position((width - vidElement.width) / 2, (height - vidElement.height) / 2);
      vidElement.elt.playbackRate = playbackSpeed;
      vidElement.elt.volume = 1;
      vidElement.elt.loop = false;
      vidElement.play();
      vidElement.elt.onended = () => {
        vidElement.remove();
        vidElement = null;
        console.log(`>>> 第 ${videoIndex + 1} 支長影片結束：`, blobURL);
        videoIndex++;
        playRemainingVideosSequentially();
      };
      vidElement.elt.onerror = (e) => {
        console.error(`❌ 播放長影片失敗：`, blobURL, e);
        vidElement.remove();
        vidElement = null;
        videoIndex++;
        playRemainingVideosSequentially();
      };
    },
    (err) => {
      console.error(`❌ 長影片載入錯誤：`, blobURL, err);
      if (vidElement) {
        vidElement.remove();
        vidElement = null;
      }
      videoIndex++;
      playRemainingVideosSequentially();
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
