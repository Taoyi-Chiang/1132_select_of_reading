import os
import re
import shutil
import json
from pathlib import Path
from collections import defaultdict
from pdf2image import convert_from_path
from concurrent.futures import ProcessPoolExecutor, as_completed
from tqdm import tqdm
from docx import Document

# === 全域參數與目錄設定 ===
RAW_DIR    = Path("D:/1132_select_of_reading/data/raw")
OUTPUT_DIR = Path("D:/1132_select_of_reading/data/processed")
PDF_DPI    = 100

game_keywords   = ['遊戲']
audio_keywords  = ['歌唱', '口述', '說故事', 'podcast', '手繪動畫']
audio_exts      = ['.mp3', '.m4a', '.wav']
video_exts      = ['.mp4', '.mov']
pdf_ext         = '.pdf'
pptx_ext        = '.pptx'
docx_ext        = '.docx'

student_id_pattern = re.compile(
    r'(?<![A-Za-z0-9])'
    r'(?:'
      r'Z\d{7}'
      r'|'
      r'\d{8,9}'
    r')'
    r'(?![A-Za-z0-9])'
)

def extract_hyperlinks_from_docx(docx_path):
    links = []
    doc = Document(docx_path)
    rels = doc.part.rels
    for rel in rels:
        if rels[rel].reltype == "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink":
            links.append(rels[rel].target_ref)
    return links

def classify_files():
    student_data = defaultdict(lambda: {
        'pdf': [], 'pptx': [], 'game': [], 'audio': [], 'video': [], 'others': []
    })
    unmatched_files = []

    all_files = list(RAW_DIR.glob("*.*"))
    for file_path in tqdm(all_files, desc="分類檔案"):
        filename = file_path.name
        ext = file_path.suffix.lower()

        sid_match = student_id_pattern.search(filename)
        if not sid_match:
            unmatched_files.append(filename)
            continue

        student_id = sid_match.group(0)

        if any(k in filename for k in game_keywords):
            student_data[student_id]['game'].append(filename)
        elif ext == pdf_ext:
            student_data[student_id]['pdf'].append(filename)
        elif ext == pptx_ext:
            student_data[student_id]['pptx'].append(filename)
        elif any(k in filename for k in audio_keywords) and ext in audio_exts:
            student_data[student_id]['audio'].append(filename)
        elif any(k in filename for k in audio_keywords) and ext in video_exts:
            student_data[student_id]['video'].append(filename)
        elif ext in audio_exts:
            student_data[student_id]['audio'].append(filename)
        elif ext in video_exts:
            student_data[student_id]['video'].append(filename)
        else:
            student_data[student_id]['others'].append(filename)

    return student_data, unmatched_files

def convert_pdf_task(args):
    sid, pdf_name = args
    pdf_src = RAW_DIR / pdf_name
    stu_dir = OUTPUT_DIR / sid
    stu_dir.mkdir(exist_ok=True)

    try:
        images = convert_from_path(str(pdf_src), dpi=PDF_DPI)
        slide_count = len(images)
        for i, img in enumerate(images, start=1):
            png_name = f"{sid}_{i:03}.png"
            png_path = stu_dir / png_name
            img.save(png_path, "PNG")
        return sid, slide_count, None
    except Exception as e:
        return sid, None, f"{pdf_name} 轉檔失敗：{e}"

def write_meta_json(student_data, slide_counts):
    for sid, data in tqdm(student_data.items(), desc="寫 meta.json"):
        stu_dir = OUTPUT_DIR / sid
        stu_dir.mkdir(exist_ok=True)

        meta = {
            "student_id": sid,
            "name": None,
            "media": [],
            "game_links": []
        }

        # 加入 slides
        png_files = sorted(stu_dir.glob(f"{sid}_*.png"))
        for png_path in png_files:
            order = int(png_path.stem.split("_")[-1])
            meta["media"].append({
                "type": "slide",
                "file": png_path.name,
                "order": order,
                "description": None
            })

        # 加入 audio
        audio_file = None
        for ext in audio_exts:
            candidate = stu_dir / f"audio{ext}"
            if candidate.exists():
                audio_file = candidate.name
                break
        if audio_file:
            meta["media"].append({
                "type": "audio",
                "file": audio_file,
                "loop": True,
                "volume": 0.7
            })

        # 加入 video
        video_file = None
        for ext in video_exts:
            candidate = stu_dir / f"video{ext}"
            if candidate.exists():
                video_file = candidate.name
                break
        if video_file:
            meta["media"].append({
                "type": "video",
                "file": video_file,
                "loop": False,
                "volume": 1.0
            })

        # 加入 game_links
        links_path = OUTPUT_DIR / "game_links" / f"{sid}.txt"
        if links_path.exists():
            with open(links_path, "r", encoding="utf-8") as f:
                for line in f:
                    url = line.strip()
                    if url:
                        meta["game_links"].append(url)

        if meta["media"] or meta["game_links"]:
            meta_path = stu_dir / "meta.json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)

def write_unmatched(unmatched_files):
    unmatched_path = OUTPUT_DIR / "unmatched_files.txt"
    if unmatched_files:
        with open(unmatched_path, "w", encoding="utf-8") as f:
            for fname in unmatched_files:
                f.write(fname + "\n")
        print(f"\n⚠️ 已將 {len(unmatched_files)} 個無法識別學號的檔案，寫入：{unmatched_path}")
    else:
        unmatched_path.write_text("", encoding="utf-8")
        print("\n✅ 所有檔案皆已成功分類，無未匹配檔案。")

if __name__ == "__main__":
    # 1. 分類 raw 資料夾
    student_data, unmatched_files = classify_files()

    # 2. 平行轉 PDF → PNG
    pdf_tasks   = [(sid, data['pdf'][0]) for sid, data in student_data.items() if data['pdf']]
    slide_counts = {}
    if pdf_tasks:
        with ProcessPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(convert_pdf_task, task): task for task in pdf_tasks}
            for fut in tqdm(as_completed(futures), total=len(futures), desc="平行轉檔 PDF"):
                sid, count, err = fut.result()
                if err:
                    print("❌", err)
                    slide_counts[sid] = 0
                else:
                    slide_counts[sid] = count

    for sid in student_data.keys():
        if sid not in slide_counts:
            slide_counts[sid] = 0

    # 3. 處理 game_links、複製 audio/video
    for sid, data in tqdm(student_data.items(), desc="處理遊戲連結"):
        if data['game']:
            links_txt = OUTPUT_DIR / "game_links" / f"{sid}.txt"
            links_txt.parent.mkdir(exist_ok=True)
            all_urls = []
            for game_file in data['game']:
                if game_file.lower().endswith(docx_ext):
                    docx_path = RAW_DIR / game_file
                    try:
                        urls = extract_hyperlinks_from_docx(docx_path)
                        if urls:
                            all_urls.extend(urls)
                        else:
                            all_urls.append(f"(無超連結) {game_file}")
                    except Exception as e:
                        all_urls.append(f"(讀取失敗) {game_file}：{e}")
                else:
                    all_urls.append(f"(非 docx 檔) {game_file}")

            with open(links_txt, "w", encoding="utf-8") as f:
                for line in all_urls:
                    f.write(line + "\n")

    for sid, data in tqdm(student_data.items(), desc="複製音訊與影片"):
        stu_dir = OUTPUT_DIR / sid
        stu_dir.mkdir(exist_ok=True)

        if data['audio'] and not data['video']:
            audio_name = data['audio'][0]
            audio_src  = RAW_DIR / audio_name
            audio_dst  = stu_dir / f"audio{Path(audio_name).suffix.lower()}"
            try:
                shutil.copy2(audio_src, audio_dst)
            except Exception as e:
                print(f"❌ 複製音訊檔失敗：{audio_src.name}，錯誤訊息：{e}")

        if data['video']:
            video_name = data['video'][0]
            video_src  = RAW_DIR / video_name
            video_dst  = stu_dir / f"video{Path(video_name).suffix.lower()}"
            try:
                shutil.copy2(video_src, video_dst)
            except Exception as e:
                print(f"❌ 複製視訊檔失敗：{video_src.name}，錯誤訊息：{e}")

    # 4. 寫入每位學生的 meta.json
    write_meta_json(student_data, slide_counts)

    # 5. 輸出 unmatched_files.txt
    write_unmatched(unmatched_files)

    # 6. 合併所有學生的 meta.json
    combined = []
    processed_root = OUTPUT_DIR
    for sid_dir in processed_root.iterdir():
        if not sid_dir.is_dir():
            continue
        meta_path = sid_dir / "meta.json"
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            combined.append(data)

    # 6. 寫 data/processed/mediaList.json
    output_media_list = processed_root / "mediaList.json"
    with open(output_media_list, "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)

    print(f"✅ 同步產生 mediaList：{output_media_list}")
    print(f"\n✅ 處理完畢。請檢查資料夾：{OUTPUT_DIR.resolve()}")
