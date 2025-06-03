import os
import re
import shutil
import json
from pathlib import Path
from collections import defaultdict
from pdf2image import convert_from_path

# === 參數與目錄設定 ===
# 原始檔案資料夾（.pdf/.pptx/.mp3/.mp4/... 等）
RAW_DIR = Path("D:/1132_select_of_reading/data/raw")

# 處理後檔案輸出根目錄
OUTPUT_DIR = Path("D:/1132_select_of_reading/data/processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# PDF 轉 PNG 的解析度（dpi）
PDF_DPI = 200

# 關鍵詞與副檔名設定
game_keywords = ['遊戲']
audio_keywords = ['歌唱', '口述', '說故事', 'podcast', '手繪動畫']
audio_exts = ['.mp3', '.m4a', '.wav']
video_exts = ['.mp4', '.mov']
pdf_ext = '.pdf'
pptx_ext = '.pptx'

# ‖‖‖ 修改：「學號」匹配改為 8～9 個連續英數字 ‖‖‖
# r'\b[A-Za-z0-9]{8,9}\b' ：邊界 + 8~9 個英數字 + 邊界
student_id_pattern = re.compile(r'\b[A-Za-z0-9]{8,9}\b')

# 儲存分類後的結果
student_data = defaultdict(lambda: {
    'pdf': [],
    'pptx': [],
    'game': [],
    'audio': [],
    'video': [],
    'others': []
})
unmatched_files = []

# === 第一步：遍歷 RAW_DIR 下所有檔案，將其依學號分類 ===
for file_path in RAW_DIR.glob("*.*"):
    filename = file_path.name
    ext = file_path.suffix.lower()

    # 改用新的學號規則：連續 8~9 個英數字
    sid_match = student_id_pattern.search(filename)
    if not sid_match:
        # 找不到學號就歸為未匹配
        unmatched_files.append(filename)
        continue

    student_id = sid_match.group()
    lower_name = filename.lower()

    # 如果檔名含「遊戲」，歸到 game
    if any(k in filename for k in game_keywords):
        student_data[student_id]['game'].append(filename)

    # PDF 檔（只要有 PDF，就優先分類為展示素材）
    elif ext == pdf_ext:
        student_data[student_id]['pdf'].append(filename)

    # PPTX 檔（有 PDF 時會被忽略，分類上先保留）
    elif ext == pptx_ext:
        student_data[student_id]['pptx'].append(filename)

    # 若檔名含指定音訊關鍵字，且 ext 是音訊格式
    elif any(k in filename for k in audio_keywords) and ext in audio_exts:
        student_data[student_id]['audio'].append(filename)

    # 若檔名含指定音訊關鍵字，但 ext 屬於視訊格式，也歸為 video
    elif any(k in filename for k in audio_keywords) and ext in video_exts:
        student_data[student_id]['video'].append(filename)

    # 一般音訊格式
    elif ext in audio_exts:
        student_data[student_id]['audio'].append(filename)

    # 一般視訊格式
    elif ext in video_exts:
        student_data[student_id]['video'].append(filename)

    # 其它檔案暫存於 others
    else:
        student_data[student_id]['others'].append(filename)

# === 第二步：逐一為每位學生建立處理後目錄，並依規則輸出檔案 ===
for sid, data in student_data.items():
    # 1. 建立學生目錄：processed/學號/
    stu_dir = OUTPUT_DIR / sid
    stu_dir.mkdir(exist_ok=True)

    # 預設 metadata
    meta = {
        "student_id": sid,
        "slide_count": 0,       # PDF 轉成 PNG 的頁數
        "has_video": False,
        "has_audio": False,
        "has_game": bool(data['game']),
        "audio_file": None,
        "video_file": None
    }

    # ---- 處理 PDF → PNG ----
    if data['pdf']:
        pdf_name = data['pdf'][0]
        pdf_src = RAW_DIR / pdf_name
        try:
            # 轉換 PDF 每頁為 PNG，命名為 {sid}_001.png, {sid}_002.png, ...
            images = convert_from_path(str(pdf_src), dpi=PDF_DPI)
            meta['slide_count'] = len(images)
            for i, img in enumerate(images, start=1):
                png_name = f"{sid}_{i:03}.png"
                png_path = stu_dir / png_name
                img.save(png_path, "PNG")
        except Exception as e:
            print(f"❌ PDF 轉 PNG 失敗：{pdf_src.name}，錯誤訊息：{e}")

    # ---- 處理 背景音樂 (Audio) ----
    if data['audio'] and not data['video']:
        audio_name = data['audio'][0]
        audio_src = RAW_DIR / audio_name
        audio_dst = stu_dir / f"audio{Path(audio_name).suffix.lower()}"
        try:
            shutil.copy2(audio_src, audio_dst)
            meta['has_audio'] = True
            meta['audio_file'] = audio_dst.name
        except Exception as e:
            print(f"❌ 復制音訊檔失敗：{audio_src.name}，錯誤訊息：{e}")

    # ---- 處理 主展示影音 (Video) ----
    if data['video']:
        video_name = data['video'][0]
        video_src = RAW_DIR / video_name
        video_dst = stu_dir / f"video{Path(video_name).suffix.lower()}"
        try:
            shutil.copy2(video_src, video_dst)
            meta['has_video'] = True
            meta['video_file'] = video_dst.name
        except Exception as e:
            print(f"❌ 復制視訊檔失敗：{video_src.name}，錯誤訊息：{e}")

    # ---- 處理「遊戲」檔案 (僅輸出檔名供後續人工檢查) ----
    if data['game']:
        links_txt = OUTPUT_DIR / "game_links" / f"{sid}.txt"
        links_txt.parent.mkdir(exist_ok=True)
        with open(links_txt, "w", encoding="utf-8") as f:
            for game_file in data['game']:
                f.write(game_file + "\n")

    # ---- 寫入每位學生的 meta.json ----
    meta_path = stu_dir / "meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

# === 第三步：生成 mediaList.json（供 p5.js 使用） ===
media_list = []
for sid in sorted(student_data.keys()):
    stu_dir = OUTPUT_DIR / sid
    if not stu_dir.exists():
        continue

    entry = {
        "student_id": sid,
        "slides": [],
        "audio": None,
        "video": None
    }

    # 收集所有 {sid}_XXX.png
    for png_path in stu_dir.glob(f"{sid}_*.png"):
        entry["slides"].append(png_path.name)

    # 讀取 meta.json 決定 audio/video
    meta_path = stu_dir / "meta.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            if meta.get("has_audio"):
                entry["audio"] = meta.get("audio_file")
            if meta.get("has_video"):
                entry["video"] = meta.get("video_file")

    media_list.append(entry)

media_list_path = OUTPUT_DIR / "mediaList.json"
with open(media_list_path, "w", encoding="utf-8") as f:
    json.dump(media_list, f, ensure_ascii=False, indent=2)

# === 第四步：提示無法匹配檔案 ===
unmatched_path = OUTPUT_DIR / "unmatched_files.txt"
if unmatched_files:
    with open(unmatched_path, "w", encoding="utf-8") as f:
        for fname in unmatched_files:
            f.write(fname + "\n")
    print(f"\n⚠️ 已將 {len(unmatched_files)} 個無法識別學號的檔案，寫入：{unmatched_path}")
else:
    unmatched_path.write_text("", encoding="utf-8")
    print("\n✅ 所有檔案皆已成功分類，無未匹配檔案。")

print(f"\n✅ 處理完畢。請檢查資料夾：{OUTPUT_DIR.resolve()}")
