# eruda-tools

휴대폰 브라우저에서 [Eruda](https://github.com/liriliri/eruda)(개발자 도구)를 띄우고, Elements 탭을 더 편하게 쓰게 해 주는 북마클릿입니다.

- Elements 탭 글자를 길게 눌러 선택·복사
- ✎ 버튼: 선택한 노드(HTML·속성·텍스트) 직접 수정, 되돌리기
- 🔍 버튼: 글자·속성·CSS 선택자로 검색
- 톱니 버튼 길게 누르기: 숨김 (숨긴 동안 화면을 건드리면 잠깐 보였다 사라짐)
  - 누르는 동안 톱니 둘레에 테두리가 차오르고, 다 차는 순간(0.6초) 숨김/보이기가 바뀝니다
- 북마클릿을 다시 누르면 Eruda 끄기
- 진단: Eruda > Info 탭 맨 아래 '선택·수정·검색 패치 진단'

## 짧은 북마클릿 (삼성 브라우저 등 북마크 주소가 2048자로 제한된 브라우저)

[`eruda-bookmarklet-short.txt`](eruda-bookmarklet-short.txt)의 내용 한 줄을 그대로 복사해서 북마크 주소에 붙여 넣으세요.
이 북마클릿은 아래 주소에서 전체 코드를 받아 실행합니다 (jsDelivr를 거쳐 이 저장소의 `v1.6.0` 태그 파일을 받음).

```
https://cdn.jsdelivr.net/gh/relaxedbrownie/eruda-tools@v1.6.0/eruda-bookmarklet.js
```

1. 아무 페이지나 북마크로 저장
2. 그 북마크를 편집해서 주소 칸을 지우고 `eruda-bookmarklet-short.txt` 내용을 붙여 넣기
3. Eruda를 쓰고 싶은 페이지에서 북마크 목록을 열고 그 북마크를 누르기

## 안 될 때

누르면 이유를 알림창으로 알려 줍니다.

- **사이트 보안 정책(CSP·Trusted Types)**: 외부 스크립트를 막는 사이트(GitHub, Google 일부 등)에선 북마클릿으로 띄울 수 없습니다. 유저스크립트 버전(Tampermonkey·wBlock·AdGuard)을 쓰세요.
- **코드 파일을 못 받음**: 네트워크·차단 앱, 또는 이 저장소와 태그(`v1.6.0`)가 그대로 있는지 확인하세요.
- 알림조차 안 뜨면 브라우저가 북마클릿 실행 자체를 막은 경우입니다.

## 파일

| 파일 | 설명 |
|---|---|
| `eruda-bookmarklet.js` | 짧은 북마클릿이 불러가는 전체 코드 (전체 북마클릿과 같은 코드) |
| `eruda-bookmarklet-short.txt` | 짧은 북마클릿 |

## 업데이트

새 버전은 파일을 바꾸고 새 태그(예: `v1.6.1`)를 붙입니다. 짧은 북마클릿에는 버전이 주소에 들어 있어서 늘 정확히 그 버전을 받으며, 새 버전으로 바꾸려면 북마크도 새 `eruda-bookmarklet-short.txt` 내용으로 바꿔야 합니다.
