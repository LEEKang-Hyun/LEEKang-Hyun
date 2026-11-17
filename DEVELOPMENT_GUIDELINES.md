# news-curator 개발 가이드라인

관심 키워드별로 최신 뉴스를 수집해 요약·정리해 주는 웹 애플리케이션 **news-curator**의 개발 규칙입니다.
모든 코드 작성·수정은 이 문서를 따릅니다.

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 백엔드 | Node.js + Express | 현재 PC에 설치된 Node.js 사용 (LTS 권장) |
| 프론트엔드 | Vanilla HTML / CSS / JavaScript | 프레임워크·번들러·트랜스파일러 사용 금지 |
| 모듈 시스템 | ES Modules (`"type": "module"`) | 백엔드·프론트엔드 모두 `import` / `export` 사용 |
| 설정 | `.env` + `dotenv` | 비밀 값은 절대 커밋하지 않음 |

원칙
- **단순함 우선**: 꼭 필요한 의존성만 추가하고, 추가 시 이유를 PR/커밋 메시지에 남깁니다.
- 프론트엔드는 빌드 단계 없이 브라우저에서 바로 실행되어야 합니다.

---

## 2. 폴더 구조

```
news-curator/
├── DEVELOPMENT_GUIDELINES.md   # 이 문서
├── package.json
├── .env.example                # 환경변수 예시 (실제 .env는 커밋 금지)
├── .gitignore
├── server/                     # 백엔드
│   ├── index.js                # 진입점: 서버 기동만 담당
│   ├── app.js                  # Express 앱 구성 (미들웨어·라우터 등록)
│   ├── config/                 # 환경변수 로딩·상수
│   │   └── index.js
│   ├── routes/                 # URL ↔ 컨트롤러 연결만 담당
│   │   └── news.routes.js
│   ├── controllers/            # 요청/응답 처리 (검증 → 서비스 호출 → 응답)
│   │   └── news.controller.js
│   ├── services/               # 핵심 비즈니스 로직 (수집·요약·정리)
│   │   ├── fetcher.service.js  # 뉴스 수집
│   │   └── summarizer.service.js # 요약
│   ├── middlewares/            # 공통 미들웨어
│   │   ├── errorHandler.js     # 중앙 에러 핸들러
│   │   └── notFound.js         # 404 처리
│   ├── utils/                  # 순수 유틸 함수 (logger, AppError 등)
│   └── data/                   # 로컬 저장 데이터(키워드 등), 커밋 제외 가능
├── public/                     # 프론트엔드 (정적 파일, Express가 서빙)
│   ├── index.html
│   ├── css/
│   │   ├── base.css            # 리셋·변수·타이포
│   │   └── components.css      # 카드·버튼 등 컴포넌트 스타일
│   └── js/
│       ├── main.js             # 진입점: 초기화·이벤트 바인딩
│       ├── api.js              # fetch 래퍼 (서버 통신 전담)
│       ├── state.js            # 간단한 상태 관리
│       ├── ui/                 # DOM 렌더링 함수 모음
│       └── utils/              # 프론트 유틸 함수
└── tests/                      # 테스트 (도입 시)
```

### 계층별 책임 (백엔드)
- **routes** → 경로와 컨트롤러만 연결. 로직 금지.
- **controllers** → 입력 검증, 서비스 호출, HTTP 응답 생성. 외부 API를 직접 호출하지 않습니다.
- **services** → 외부 API 호출·요약·가공 등 실제 로직. `req`/`res`를 알지 못해야 합니다.
- **utils** → 상태 없는 순수 함수.

한 파일은 **한 가지 책임**만 갖고, 약 **200줄**을 넘기면 분리를 검토합니다.

---

## 3. 코딩 컨벤션

### 3.1 주석 (한국어 필수)
- **모든 주석은 한국어**로 작성합니다.
- 파일 상단에 파일의 역할을 한 줄 이상 설명합니다.
- 함수에는 JSDoc 형식(한국어)으로 목적·매개변수·반환값·예외를 적습니다.
- "무엇"보다 **"왜"** 를 설명합니다. 코드를 그대로 번역한 주석은 지양합니다.
- 임시 코드는 `TODO:`, 알려진 문제는 `FIXME:` 접두사를 사용합니다.

```js
/**
 * 키워드로 최신 뉴스를 수집한다.
 * @param {string} keyword - 검색할 관심 키워드
 * @param {number} [limit=10] - 가져올 기사 최대 개수
 * @returns {Promise<Article[]>} 수집된 기사 목록
 * @throws {AppError} 외부 뉴스 API 호출에 실패한 경우
 */
export async function fetchNewsByKeyword(keyword, limit = 10) {
  // ...
}
```

### 3.2 네이밍
| 대상 | 규칙 | 예 |
| --- | --- | --- |
| 변수·함수 | camelCase | `fetchNewsByKeyword` |
| 클래스·생성자 | PascalCase | `AppError` |
| 상수 | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| 파일(백엔드) | `이름.역할.js` (소문자, 점 구분) | `news.controller.js` |
| 파일(프론트) | 소문자 camelCase 또는 kebab-case | `renderCard.js` |
| CSS 클래스 | kebab-case (BEM 느슨하게 허용) | `news-card__title` |

### 3.3 JavaScript 스타일
- `const` 기본, 재할당이 필요할 때만 `let`. `var` 금지.
- 비동기는 `async/await` 사용. 콜백 중첩 지양.
- 비교는 `===`, `!==` 사용.
- 세미콜론 사용, 들여쓰기 2칸, 작은따옴표 사용.
- 매직 넘버·문자열은 상수로 분리.
- `console.log` 직접 사용 대신 `utils/logger.js`를 통해 기록합니다. (프론트는 개발 중 디버깅용 `console.*`만 허용, 커밋 전 제거)

### 3.4 프론트엔드 규칙
- HTML은 시맨틱 태그(`header`, `main`, `section`, `article` 등)를 사용합니다.
- 인라인 `style`·인라인 이벤트 핸들러(`onclick=`) 금지. JS에서 `addEventListener` 사용.
- 스타일은 CSS 변수(`:root`)로 색상·간격을 관리합니다.
- 사용자 입력/외부 데이터를 DOM에 넣을 때는 `textContent`를 사용하고, `innerHTML`은 이스케이프된 신뢰 데이터에만 사용합니다. (XSS 방지)
- 서버 통신은 반드시 `api.js`를 거칩니다. 컴포넌트에서 직접 `fetch` 금지.
- 모바일 우선 반응형, 기본적인 접근성(`alt`, `label`, 키보드 포커스)을 지킵니다.

---

## 4. 에러 핸들링

### 4.1 백엔드
1. **커스텀 에러 클래스** `AppError`(`statusCode`, `message`, `code`)를 `utils/`에 두고, 예상 가능한 오류는 이를 던집니다.
2. **비동기 라우트 래퍼**를 사용해 `try/catch` 중복을 줄이고 모든 오류를 중앙 핸들러로 전달합니다.
3. **중앙 에러 핸들러**(`middlewares/errorHandler.js`)가 모든 오류를 일관된 JSON으로 응답합니다.
4. 존재하지 않는 경로는 `notFound` 미들웨어에서 404로 처리합니다.
5. 외부 API 호출에는 **타임아웃**을 설정하고, 실패 시 의미 있는 메시지와 함께 `502/504` 계열로 변환합니다.
6. 사용자 입력(키워드 등)은 컨트롤러에서 **검증**하고 잘못되면 `400`을 반환합니다.
7. 서버 내부 정보(스택 트레이스, 키 값)는 **클라이언트에 노출하지 않습니다.** 상세 내용은 서버 로그에만 남깁니다.
8. `unhandledRejection`, `uncaughtException`을 `index.js`에서 로깅하고 안전하게 종료합니다.

**표준 에러 응답 형식**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_KEYWORD",
    "message": "키워드는 1자 이상 50자 이하여야 합니다."
  }
}
```

**표준 성공 응답 형식**
```json
{
  "success": true,
  "data": { }
}
```

**HTTP 상태 코드 기준**
| 코드 | 의미 |
| --- | --- |
| 400 | 잘못된 요청(검증 실패) |
| 404 | 리소스/경로 없음 |
| 429 | 요청 과다 |
| 500 | 서버 내부 오류 |
| 502 / 504 | 외부 뉴스 API 실패 / 타임아웃 |

### 4.2 프론트엔드
- `api.js`에서 응답이 `success: false`이거나 네트워크 오류면 예외를 던지고, 호출부에서 `try/catch`로 처리합니다.
- 사용자에게는 **이해하기 쉬운 한국어 메시지**를 보여 주고(토스트/배너), 기술적 세부 정보는 노출하지 않습니다.
- 모든 비동기 화면에는 **로딩 / 빈 상태 / 오류 상태** 세 가지를 반드시 구현합니다.
- 실패 시 재시도 버튼을 제공합니다.

---

## 5. API 설계 규칙

- 경로는 `/api` 접두사를 사용하고, 리소스 중심 명사형으로 설계합니다. 예) `GET /api/news?keyword=AI&limit=10`
- 응답은 항상 위의 표준 형식(`success`, `data` / `error`)을 따릅니다.
- 쿼리·본문 값은 서버에서 반드시 검증·정규화합니다.
- 외부 뉴스 소스 호출 결과는 서비스 계층에서 **내부 공통 포맷**(`Article`)으로 변환해 반환합니다.

```js
/**
 * @typedef {Object} Article
 * @property {string} title       - 기사 제목
 * @property {string} summary     - 요약문
 * @property {string} url         - 원문 링크
 * @property {string} source      - 언론사
 * @property {string} publishedAt - 발행 시각(ISO 8601)
 */
```

---

## 6. 보안 및 설정

- API 키 등 비밀 값은 `.env`에만 두고 `.gitignore`에 등록합니다. 대신 `.env.example`을 제공합니다.
- 환경변수는 `server/config/index.js`에서 한 번만 읽고, 필수 값이 없으면 서버 기동 시 즉시 실패시킵니다.
- 외부 입력은 신뢰하지 않습니다(검증·이스케이프).
- 필요 시 `helmet`, `express-rate-limit` 등 최소한의 보안 미들웨어를 적용합니다.
- 외부 API 호출은 **서버에서만** 수행하고, 키가 브라우저에 노출되지 않게 합니다.

---

## 7. 로깅

- `utils/logger.js`에 레벨(`info`, `warn`, `error`) 함수를 두고 일관되게 사용합니다.
- 로그는 한국어로 작성하되, 에러 로그에는 원인 파악이 가능하도록 컨텍스트(키워드, URL 등)를 포함합니다.
- 비밀 값·개인정보는 로그에 남기지 않습니다.

---

## 8. Git 및 협업

- 브랜치 접두사: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`
- 커밋 메시지는 Conventional Commits 형식을 따르며 설명은 한국어로 작성합니다.
  - 예) `feat: 키워드별 뉴스 수집 API 추가`
  - 예) `fix: 외부 API 타임아웃 시 500 대신 504 반환`
- 하나의 커밋은 하나의 목적만 담습니다.
- 커밋 전 확인: 불필요한 `console.log` 제거, 비밀 값 미포함, 앱이 실제로 실행되는지 확인.

---

## 9. 테스트 및 품질

- 서비스 계층(수집·요약 로직)은 가능한 한 **순수 함수**로 작성해 테스트하기 쉽게 만듭니다.
- 테스트 도입 시 Node 내장 테스트 러너(`node --test`)를 우선 사용합니다.
- 새 기능 추가 시 정상 경로와 **오류 경로**를 모두 확인합니다.

---

## 10. 개발 진행 순서 (권장)

1. 프로젝트 초기화(`package.json`, 폴더 구조, `.gitignore`, `.env.example`)
2. Express 앱 뼈대 + 중앙 에러 핸들러 + 정적 파일 서빙
3. 뉴스 수집 서비스 → 컨트롤러/라우트 연결
4. 요약·정리 서비스
5. 프론트엔드 화면(키워드 입력, 뉴스 카드 목록, 로딩/빈/오류 상태)
6. 관심 키워드 저장·관리 기능
7. 테스트 및 문서 정리

---

> 이 문서는 프로젝트가 진행되면서 함께 갱신합니다. 규칙을 바꿀 때는 먼저 이 문서를 수정한 뒤 코드에 반영합니다.
