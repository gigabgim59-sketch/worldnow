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

번역 순서: ① DEEPL_API_KEY가 있으면 DeepL ② 없으면 Google 번역 무료 엔드포인트(키 불필요, 25개씩 묶어 요청) ③ 실패한 제목만 MyMemory(일일 4,000자 이내) ④ 그래도 안 되면 원문. 번역 결과는 캐시해 재사용하며 제목만 전달합니다. Google 무료 엔드포인트는 공식 API가 아니어서 예고 없이 제한될 수 있습니다.

더 넉넉한 번역은 Settings → Secrets and variables → Actions에 **DEEPL_API_KEY**를 등록해 사용할 수 있습니다. 키를 코드나 HTML에 적지 마세요. 이용료는 해당 제공사 정책에 따릅니다.

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
