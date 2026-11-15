# 세계의 오늘 — GitHub Pages 버전

6개국과 중동의 23개 매체(경제매체 7곳 포함)를 한 페이지에서 읽습니다.

## 설치

1. GitHub에 `world-news` 등 새 저장소를 만듭니다. GitHub Free의 Pages는 공개 저장소가 필요합니다.
2. 이 폴더 내용을 저장소 루트에 올립니다. **`.github/workflows/news.yml`도 포함**해야 합니다. 다른 프로젝트를 덮어쓰지 마세요.
3. Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정합니다.
4. Actions → Collect news and publish Pages → Run workflow를 실행합니다.
5. 성공한 Deploy 작업에 표시된 Pages 주소를 엽니다.

매시 17분에 수집을 시도합니다. 예약 실행은 지연될 수 있으며, 공개 저장소에 활동이 60일간 없으면 예약 작업이 중단될 수 있습니다. Actions에서 다시 활성화할 수 있습니다. 정확한 실행 시각은 보장하지 않습니다.

## 수집과 장애 처리

브라우저는 외부 RSS 서버 대신 같은 사이트의 미리 생성된 데이터를 읽습니다. 화면을 닫아도 GitHub Actions가 수집합니다. 매체 일부가 실패하면 마지막 성공 기사를 보존하고, 모두 실패하면 새 배포를 중단해 기존 게시본을 유지합니다. 마지막 갱신 시각을 표시합니다. 화면의 새로고침은 게시된 데이터 확인이며 수집 즉시 실행 버튼이 아닙니다.

`public/index.html`을 로컬에서 열어도 동봉된 `data/news.js`의 수집본이 표시됩니다. 자동 갱신에는 Pages와 Actions가 필요합니다.

## 번역

번역 순서: ① **Claude**(저장소 Secrets에 `ANTHROPIC_API_KEY`가 있을 때) ② Google 번역 무료 엔드포인트(키 불필요, 20개씩 묶어 요청) ③ 실패한 제목만 DeepL(키가 있을 때) 또는 MyMemory(일일 4,000자 이내) ④ 그래도 안 되면 원문. 번역 결과는 캐시해 재사용하며 제목만 전달합니다.

Claude 번역은 매체·나라·언어 정보와 `scripts/glossary.json`의 용어집을 함께 보내 헤드라인 문체로 옮기고, 원문 숫자가 번역에 남아 있는지 검사해 통과한 것만 씁니다. 키를 넣은 뒤에는 새 제목부터, 이어서 기존 Google 번역을 실행마다 조금씩 Claude 번역으로 바꿉니다. 바뀐 제목의 이전 번역은 비교용으로 `titleKoAlt`에 남깁니다.

**비용 한도**
- 월 한도: 저장소 Settings → Secrets and variables → Actions → **Variables**의 `CLAUDE_MONTHLY_USD`(기본 2달러). 누적액은 `data/translation-spend.json`에 기록되고, 한도에 닿을 요청은 보내지 않으며 남은 제목은 Google 번역으로 넘어갑니다.
- 실행당 상한: `CLAUDE_MAX_TITLES_PER_RUN`(기본 60개).
- 최종 상한: Claude Console에서 이 사이트 전용 워크스페이스를 만들고 그 워크스페이스의 월 지출 한도를 걸어 두세요. 코드의 계산이 어긋나도 이 한도를 넘지 않습니다.
- 단가 기본값은 Claude Haiku 5.5(100만 토큰당 입력 0.10달러, 출력 0.50달러)입니다. 모델을 바꾸면 Variables의 `CLAUDE_MODEL`, `CLAUDE_PRICE_IN`, `CLAUDE_PRICE_OUT`도 함께 바꾸세요.

## 범위

Google News 검색 RSS에서 최근 3일, 매체당 최대 8개를 수집하고 화면에 최대 5개를 표시합니다. 외부 서버 제한·검색 누락은 여전히 발생할 수 있습니다. 토픽은 제목 키워드 분류이며 국가 전체 의제의 정확한 순위가 아닙니다. 유료 구독을 우회하거나 기사 본문을 복제하지 않습니다.

## 로컬 실행

Node.js 22 이상에서 저장소 루트에서 실행합니다. 별도 패키지 설치는 필요 없습니다.

```sh
node scripts/collect.mjs
node scripts/check.mjs
python3 -m http.server 8000 --directory public
```

브라우저에서 http://localhost:8000/ 을 엽니다.
