# 비서실 · 다올 & 똑똑이

다올님과 똑똑이만 쓰는 작은 비서실 페이지입니다. GitHub Pages로 배포되는 정적 사이트예요.

- **오피스 맵** — 작업실 · 회의실 · 자료실 · 휴게실 네 공간과, 그 사이를 옮겨 다니는 노란 `ㄷ` 모양 캐릭터 똑똑이
- **업무 현황판** — `data/status.json`을 읽어 자동화 작업 상태와 마지막 업데이트 시각 표시
- **@똑똑이 메모 보드** — 지시·메모를 남기는 채팅형 보드 (기본은 브라우저 localStorage, 선택 시 Firebase Realtime Database로 기기 간 동기화)

## 파일 구성

```
index.html        화면 구조
style.css         디자인 (라이트/다크 테마 포함)
app.js            오피스 맵 · 현황판 · 메모 보드 동작
data/status.json  업무 현황 데이터
favicon.svg       파비콘
```

## 현황판 고치기

`data/status.json`만 수정해서 올리면 페이지에 반영됩니다.

```json
{
  "updatedAt": "2026-11-27T14:45:00+09:00",
  "assistant": { "name": "똑똑이", "mood": "집중", "line": "말풍선에 보일 한 줄" },
  "tasks": [
    {
      "id": "talktalk",
      "label": "작업 이름",
      "room": "work",
      "state": "running",
      "schedule": "30분마다",
      "lastRun": "14:30",
      "note": "이 방에 있을 때 말풍선에 보일 말"
    }
  ]
}
```

- `room`: `work` · `meeting` · `archive` · `lounge`
- `state`: `running`(진행 중) · `waiting`(대기) · `done`(완료) · `idle`(쉬는 중)
- `updatedAt`: ISO 8601 (한국 시간 `+09:00`)

## 메모 보드를 기기 간에 함께 쓰기 (선택)

1. Firebase 콘솔에서 Realtime Database를 만듭니다.
2. 페이지 오른쪽 위 톱니바퀴 → **Realtime Database URL**에 주소를 넣고 저장합니다.
   예: `https://my-office-default-rtdb.firebaseio.com`
3. 데이터는 `/office/messages` 아래에 쌓입니다. 읽기·쓰기가 가능한 규칙이어야 동작합니다.
4. 주소를 비우면 다시 이 브라우저에만 저장됩니다.

## 공개 저장소 주의

이 사이트는 공개 GitHub 저장소에서 배포됩니다. 전화번호, 집 주소, 실명, 계좌번호, 금액 같은 개인정보는 페이지와 `status.json`에 넣지 마세요. 작업은 "톡톡 감시", "원고 전달"처럼 일반적인 이름으로만 적습니다. 메모 보드에 연결한 Firebase 데이터도 공개 주소이므로 민감한 내용을 적지 마세요.
