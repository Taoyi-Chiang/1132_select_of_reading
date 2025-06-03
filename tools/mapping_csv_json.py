import csv
import json

csv_path = r"D:\1132_select_of_reading\data\mapping.csv"
mapping = {}

with open(csv_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        key = row['filename']  # 或 f"{row['student_id']}/{row['filename']}"
        mapping[key] = row['url']

with open('mapping.json', 'w', encoding='utf-8') as f:
    json.dump(mapping, f, ensure_ascii=False, indent=2)
