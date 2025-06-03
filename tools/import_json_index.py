import json
import os

# 指定 JSON 原檔路徑
json_path = os.path.join("data", "processed", "mediaList.json")

# 確認檔案存在再繼續
if not os.path.isfile(json_path):
    print(f"找不到 {json_path}，請確定路徑正確。")
    exit(1)

# 讀取 mediaList.json
with open(json_path, "r", encoding="utf-8") as f:
    media_list = json.load(f)

# 將 Python 物件格式化成 JS 常數
js_content = "const mediaList = " + json.dumps(media_list, ensure_ascii=False, indent=2) + ";"

# 輸出到 mediaList_inject.js
output_path = "mediaList_inject.js"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"已生成 {output_path}，請在 HTML 裡透過 <script src=\"{output_path}\"></script> 引用。")
