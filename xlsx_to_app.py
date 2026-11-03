#!/usr/bin/env python3
"""
정리된 엑셀(신입사무_월별교육_달력데이터.xlsx)을 '수정 없이 그대로' 읽어 js/edu-recommend.js 를 만듭니다.

사용법:  python xlsx_to_app.py 신입사무_월별교육_달력데이터.xlsx
  - 카테고리1_담당자추천 → 사무(경영지원) 과정 목록
  - 카테고리2_동기수강   → 사무(영업·요금) 과정 목록
  - 일정상세             → 과정별 실제 개설일 (이미 같은 날짜·같은 과정명 중복 제거됨)
  - 월별달력             → '이달의 추천 교육' 카드에 보일 월 (recMonths). 카테고리 시트에 있어도 월별달력에 없는 월·과정은 카드에서 제외
    (교육추천 목록은 카테고리 시트의 ● 개설월(months)을 그대로 사용)
엑셀을 고친 뒤 다시 실행하면 앱에 반영됩니다.
"""
import json, sys, os
from collections import defaultdict
from openpyxl import load_workbook

src = sys.argv[1] if len(sys.argv) > 1 else "신입사무_월별교육_달력데이터.xlsx"
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "js", "edu-recommend.js")
wb = load_workbook(src, read_only=True, data_only=True)

# 일정상세: 과정명 → 개설일 목록 (YYYY-MM-DD)
dates = defaultdict(set)
ws = wb["일정상세"]
hdr = [c for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
iN, iD = hdr.index("과정명"), hdr.index("교육시작일")
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[iN]: dates[r[iN]].add(str(r[iD]).replace(".", "-"))

# 월별달력: (담당자|동기, 과정명) → 이달의 추천 교육에 보일 월
cal = defaultdict(set)
ws = wb["월별달력"]
hdr = [c for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
iM, iK, iC = hdr.index("월"), hdr.index("카테고리"), hdr.index("과정명")
for r in ws.iter_rows(min_row=2, values_only=True):
    if not r[iM] or not r[iC]: continue
    for who in ("담당자", "동기"):
        if who in str(r[iK]): cal[(who, r[iC])].add(int(r[iM]))

# 분류 조정: 엑셀은 그대로 두고 앱에서만 '구분'을 바꿀 과정 (과정명 → 구분)
#   '필수'·'보직필수' = 직무 필수 / '직무연계' = 직무 선택   예) "회계입문과정": "직무연계"
#   (2026-11-02 회계입문과정은 엑셀에서 직접 '직무연계'로 바뀌어 조정 불필요)
KIND_OVERRIDE = {
}

def read_cat(sheet, who):
    ws = wb[sheet]
    rows = list(ws.iter_rows(min_row=3, values_only=True))
    h = list(rows[0]); col = {k: h.index(k) for k in h if k}
    out = []
    for r in rows[1:]:
        if r[col["과정명"]] is None: continue
        name = r[col["과정명"]]
        out.append(dict(
            rank=int(r[col["우선순위"]]), cls=r[col["분류"]], kind=KIND_OVERRIDE.get(name, r[col["구분"]]), name=name, status=r[col["상태"]],
            code=str(r[col["과정코드"]]), method=r[col["교육방법"]], days=r[col["교육일수"]], hours=int(r[col["교육시간"]]),
            dept=r[col["교육부서"]],
            months=[m for m in range(1, 13) if r[col[f"{m}월"]] == "●"],
            recMonths=sorted(cal.get((who, name), [])),
            dates=sorted(dates.get(name, [])),
        ))
    return out

c1, c2 = read_cat("카테고리1_담당자추천", "담당자"), read_cat("카테고리2_동기수강", "동기")
c1.sort(key=lambda c: c["rank"]); c2.sort(key=lambda c: c["rank"])
rec = {
    "source": "신입사무_월별교육_달력데이터.xlsx (교육실적 2024~2026.9, 중복 제거) · 개설월은 2025·2026년 실적 기준 예상",
    "byJob": {
        "사무(경영지원)": {"jobLabel": "직무필수(경영지원)", "courses": c1},
        "사무(영업·요금)": {"jobLabel": "직무필수(요금)", "courses": c2},
    },
}
js = ("// 교육 추천 데이터 — xlsx_to_app.py 가 '신입사무_월별교육_달력데이터.xlsx'에서 자동 생성 (직접 수정하지 마세요)\n"
      "// rank: 1~ 직무필수·직무연계 · 101~ 공통역량 · 901~ 입문·법정(수료) / months: 개설 예상월(교육추천 목록) / recMonths: 이달의 추천 교육에 보일 월(월별달력) / dates: 2025~2026 실제 개설일\n"
      "(function () {\n  OB.data = OB.data || {};\n  OB.data.EDU_REC = " + json.dumps(rec, ensure_ascii=False) + ";\n})();\n")
open(out, "w", encoding="utf-8").write(js)
diff = [c["name"] for c in c1 + c2 if c["months"] != c["recMonths"]]
print(f"✓ 경영지원 {len(c1)}개 · 요금 {len(c2)}개 과정 → {out}")
if diff: print("  월별달력과 개설월이 다른 과정(이달의 추천 교육은 월별달력 기준):", sorted(set(diff)))
