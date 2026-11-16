# 아침 이슈 브리핑 작성 지침

매일 아침(한국 시간) Claude가 이 지침에 따라 브리핑을 작성해 `public/briefing/`에 올린다.

## 원재료
- `public/data/history.json` — 매시간 수집이 쌓는 최근 4일 치 기사 제목 (`source`, `country`, `title`=원문, `titleKo`=Claude 번역(일부 Google), `tr`=번역기, `opinion`=칼럼 표시, `url`, `date`).
- 이 중 **직전 72시간** 기사만 쓴다. 매체 정보와 진영은 `sources.json`과 아래 표를 따른다.
- 판단은 반드시 **원문 제목(title)** 으로 한다. `titleKo`(기계번역)는 참고만 한다.

## 진영 (칸 순서 그대로)
| 지역 | 매체(id) |
|---|---|
| 미국 us | nyt 진보 · wsj 경제 · fox 보수 |
| 중국 cn | xinhua 국영 · caixin 경제 · reuters_cn 서방 통신 · bbc_cn 서방 방송 |
| 영국 uk | guardian 진보 · ft 경제 · telegraph 보수 |
| 러시아 ru | tass 국영 · kommersant 경제 · meduza 독립 |
| 프랑스 fr | liberation 좌파 · echos 경제 · figaro 우파 |
| 중동 me | aljazeera 카타르 · haaretz 이스라엘 · presstv 이란 국영 · asharq 사우디·경제 |
| 인도 in | jagran 북인도·힌디 · hindu 남인도 · republic 친정부 · wire 비판 · et 경제 |

## 이슈 고르기
1. 나라마다 **정치·외교·사회·경제 흐름**을 보여주는 이슈 2~3개. 스포츠·연예·단신·광고성 기사는 제외.
2. `opinion: true`(칼럼·분석)는 사실 근거로 쓰지 않고, 진영 시각을 보여주는 자료로만 쓴다.
3. 우선순위: ① 여러 진영 매체가 함께 다룬 것 ② 다른 나라 매체도 다룬 것 ③ 정책·선거·전쟁·거시경제 무게 ④ 최신성.
4. 한 진영만 다룬 이슈라도 그 나라 흐름에 중요하면 넣되, 다른 진영이 **다루지 않았다는 사실**도 입장 차이로 적을 수 있다.
5. 핵심 사실(누가·무엇을·숫자)은 **웹 검색으로 확인**한다. 확인되지 않으면 단정하지 말고 "~라는 보도가 나왔다"로 쓴다.

## 쓰기
- 한국어, 신문 기사체. 고유명사는 국립국어원 외래어 표기 관례(예: 스타머, 마크롱, 리창).
- `what`: 무슨 일인지 2문장. 배경 1문장 포함 가능.
- `stances`: 진영별 매체가 이 이슈를 **어떻게 다뤘는지** 한 문장씩. 제목의 단어 선택·강조점·무엇을 뺐는지를 근거로 쓴다. 매체의 입장을 지어내지 말 것 — 제목에 드러난 것만.
- 평가·훈계는 넣지 않는다. 진영 간 차이를 보여주는 데 집중.
- `headline`: 오늘의 세계 3줄. 나라를 가로지르는 흐름 위주, 각 1~2문장.
- `links`: 근거 기사. history.json의 url을 그대로, `title`은 titleKo가 자연스러우면 그것을, 아니면 직접 다듬은 한국어 제목.

## 형식 — `public/briefing/YYYY-MM-DD.json`
```json
{"date":"2026-11-16","title":"11월 16일(월) 아침 이슈 브리핑","window":"11월 13~16일","articles":176,"author":"Claude",
 "headline":["…","…","…"],
 "countries":[{"id":"us","issues":[{"title":"…","what":"…",
   "stances":[{"source":"nyt","text":"…"}],
   "links":[{"source":"nyt","title":"…","url":"https://…"}]}]}]}
```
- `countries` 순서: us, cn, uk, ru, fr, me, in.
- `public/briefing/index.json`의 `dates` 맨 앞에 날짜를 넣는다(최신순, 최대 90개).
- 올리기 전 `node scripts/brief-check.mjs public/briefing/YYYY-MM-DD.json` 으로 검사.
