// p5.js/sketch.js

let allSlides = [];     // 所有 PNG 檔案（跨所有學生資料夾），按檔名排序
let audioPath = null;   // 只使用第一支 audioItems[0].file

let imgElement = null;
let currentSlideIndex = 0;
let slideTimer = null;

const SLIDE_DURATION = 2745; // 每張投影片顯示 2745 毫秒

let started = false;

function setup() {
  createCanvas(windowWidth, windowHeight).style('background', 'transparent');
  partitionMediaList();

  window.addEventListener('click', () => {
    if (started) return;
    started = true;
    playSlidesAndAudio();
  }, { once: true });
}

function partitionMediaList() {
  const slideFiles = [];
  let firstAudio = null;

  mediaList.forEach(entry => {
    const sid = entry.student_id;
    (entry.media || []).forEach(item => {
      const rel = `data/processed/${sid}/${item.file}`;
      if (item.type === 'slide') {
        slideFiles.push(rel);
      }
      else if (item.type === 'audio' && firstAudio === null) {
        firstAudio = rel;
      }
      // (忽略 type==="video" 的所有內容)
    });
  });

  // 把所有投影片按檔名排序
  slideFiles.sort();
  allSlides = slideFiles;

  // 只取第一支 audio 路徑（若存在）
  audioPath = firstAudio;
}

function playSlidesAndAudio() {
  if (audioPath) {
    const snd = new Audio(audioPath);
    snd.onended = () => {
      // 音訊結束後停止投影片輪播
      if (slideTimer) {
        clearInterval(slideTimer);
        slideTimer = null;
      }
    };
    snd.onerror = () => {
      if (slideTimer) {
        clearInterval(slideTimer);
        slideTimer = null;
      }
    };
    snd.play().catch(() => {
      if (slideTimer) {
        clearInterval(slideTimer);
        slideTimer = null;
      }
    });
  }

  // 先顯示第一張投影片
  currentSlideIndex = 0;
  if (allSlides.length > 0) {
    showSlide(allSlides[0]);
    slideTimer = setInterval(() => {
      currentSlideIndex++;
      if (currentSlideIndex < allSlides.length) {
        showSlide(allSlides[currentSlideIndex]);
      } else {
        // 全部投影片播完，就停在最後一張，等音訊結束再清掉 interval
        clearInterval(slideTimer);
        slideTimer = null;
      }
    }, SLIDE_DURATION);
  }
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
