# eruda-tools

휴대폰 브라우저에서 [Eruda](https://github.com/liriliri/eruda)(개발자 도구)를 띄우고, Elements 탭을 더 편하게 쓰게 해 주는 유저스크립트와 북마클릿입니다.

- Elements 탭 글자를 길게 눌러 선택·복사
- <picture><source media="(prefers-color-scheme: dark)" srcset="images/icon-edit-dark.svg"><img src="images/icon-edit.svg" width="16" height="16" alt="수정"></picture> 수정 버튼: 선택한 노드(HTML·속성·텍스트) 직접 수정, 되돌리기
- <picture><source media="(prefers-color-scheme: dark)" srcset="images/icon-find-dark.svg"><img src="images/icon-find.svg" width="16" height="16" alt="검색"></picture> 검색 버튼: 글자·속성·CSS 선택자로 검색
- 톱니 버튼 길게 누르기: 숨김(숨긴 동안 화면을 건드리면 잠깐 보였다 사라짐)
  - 누르는 동안 톱니 테두리를 따라 선이 한 바퀴 그려지고, 다 그려지는 순간(0.6초) 숨김/보이기가 바뀜
- 북마클릿을 다시 누르면 Eruda 끄기
- 진단: Eruda > Info 탭 맨 아래 '선택·수정·검색 패치 진단'

세 가지 방법 모두 기능은 같습니다.

- [**유저스크립트**](#유저스크립트): Tampermonkey·wBlock(iOS)·AdGuard를 쓸 때 추천합니다. 페이지를 열면 자동으로 뜨고, 북마클릿이 막히는 사이트에서도 대부분 됩니다.
- [**짧은 북마클릿**](#짧은-북마클릿): 유저스크립트 앱을 설치하지 않고 쓸 때 추천합니다. 사파리·삼성 브라우저·크롬 등 대부분의 휴대폰 브라우저에서 됩니다.
- [**전체 북마클릿**](#전체-북마클릿): 사파리처럼 북마크 주소 길이 제한이 없는 브라우저에서, 이 저장소를 거치지 않고 쓰고 싶을 때 씁니다.

## 유저스크립트

[`eruda-select.user.js`](https://raw.githubusercontent.com/relaxedbrownie/eruda-tools/main/eruda-select.user.js)를 여세요.

- **Tampermonkey**: 위 링크를 열면 설치 화면이 뜹니다.
- **wBlock·AdGuard**: 유저스크립트를 주소로 추가하는 메뉴에 아래 주소를 넣으세요.

```
https://raw.githubusercontent.com/relaxedbrownie/eruda-tools/main/eruda-select.user.js
```

## 짧은 북마클릿

아래 코드 블록 오른쪽의 **복사 버튼**을 눌러 한 줄 전체를 복사하세요([`eruda-bookmarklet-short.txt`](eruda-bookmarklet-short.txt)와 같은 내용).

```
javascript:!function()%7Bvar%20e=%22https://cdn.jsdelivr.net/gh/relaxedbrownie/eruda-tools@v1.6.0/eruda-bookmarklet.js%22;try%7Bvar%20t=document.createElement(%22script%22);t.src=e,t.onerror=function()%7Balert(%22[Eruda%20%5Cubd81%5Cub9c8%5Cud074%5Cub9bf]%20%5Cucf54%5Cub4dc%20%5Cud30c%5Cuc77c%5Cuc744%20%5Cubd88%5Cub7ec%5Cuc624%5Cuc9c0%20%5Cubabb%5Cud588%5Cuc5b4%5Cuc694.%5Cn%5Cuc6d0%5Cuc778:%20%5Cuc0ac%5Cuc774%5Cud2b8%20%5Cubcf4%5Cuc548%20%5Cuc815%5Cucc45(CSP)%5Cxb7%5Cub124%5Cud2b8%5Cuc6cc%5Cud06c%5Cxb7%5Cucc28%5Cub2e8%20%5Cuc571,%20%5Cub610%5Cub294%20GitHub%20%5Cuc800%5Cuc7a5%5Cuc18c%5Cxb7%5Cud0dc%5Cuadf8(v1.6.0)%20%5Cud655%5Cuc778%5Cn%22+e)%7D,(document.head%7C%7Cdocument.documentElement).appendChild(t)%7Dcatch(e)%7Balert(%22[Eruda%20%5Cubd81%5Cub9c8%5Cud074%5Cub9bf]%20%22+(/trusted/i.test(e.message)?%22%5Cuc774%20%5Cuc0ac%5Cuc774%5Cud2b8%5Cuc758%20%5Cubcf4%5Cuc548%20%5Cuc815%5Cucc45(Trusted%20Types)%5Cuc774%20%5Cub9c9%5Cuc74c%20%5Cu2192%20%5Cuc720%5Cuc800%5Cuc2a4%5Cud06c%5Cub9bd%5Cud2b8%5Cub97c%20%5Cuc4f0%5Cuc138%5Cuc694%22:e.message))%7D%7D();//%
```

1. 아무 페이지나 북마크로 저장하고, 이름을 `Eruda`처럼 짧게 바꾸기
2. 그 북마크를 편집해서 주소 칸을 지우고 위에서 복사한 코드를 붙여 넣기
3. Eruda를 쓰고 싶은 페이지에서 실행하기
   - **사파리**: 북마크 목록에서 누르기
   - **삼성 브라우저·안드로이드 크롬**: 북마크 목록에서 누르면 실행되지 않습니다. **주소창**에 북마크 이름 앞 몇 글자(예: `er`)를 입력하고, 추천 목록에서 **별 아이콘이 붙은 그 북마크 줄**을 누르세요. 키보드의 '이동'(엔터)이나 추천 검색어를 누르면 검색으로 넘어갑니다.

짧은 북마클릿은 실행할 때 이 저장소의 `v1.6.0` 태그에 있는 코드를 받아 옵니다. 그래서 2048자까지만 넣을 수 있는 삼성 브라우저에서도 쓸 수 있습니다.

## 전체 북마클릿

[`eruda-bookmarklet.txt`](eruda-bookmarklet.txt)를 열고 파일 위쪽의 **복사 버튼**(Copy raw file)으로 전체를 복사해서, 짧은 북마클릿과 같은 방법으로 북마크 주소에 붙여 넣으세요.

- 코드가 모두 들어 있어서 이 저장소가 없어도 작동합니다.
- 4만 자 가까이 되어서 삼성 브라우저처럼 북마크 주소가 2048자로 제한된 곳에는 넣을 수 없습니다. 그런 곳은 짧은 북마클릿을 쓰세요.

## 안 될 때

북마클릿은 안 되면 이유를 알림창으로 알려 줍니다.

- **사이트 보안 정책(CSP·Trusted Types)**: 외부 스크립트를 막는 사이트(GitHub, Google 일부 등)에선 북마클릿으로 띄울 수 없습니다. 유저스크립트를 쓰세요.
- **코드 파일을 못 받음**(짧은 북마클릿): 네트워크·차단 앱, 또는 이 저장소와 태그(`v1.6.0`)가 그대로 있는지 확인하세요.
- 알림조차 안 뜨면 브라우저가 북마클릿 실행 자체를 막은 경우입니다.
- 유저스크립트·북마클릿 모두 Eruda > Info 탭의 진단 화면에서 상태를 볼 수 있습니다.

## 파일

| 파일 | 설명 |
|---|---|
| `eruda-select.user.js` | 유저스크립트 |
| `eruda-bookmarklet-short.txt` | 짧은 북마클릿 |
| `eruda-bookmarklet.txt` | 전체 북마클릿 |
| `eruda-bookmarklet.js` | 짧은 북마클릿이 실행할 때 jsDelivr를 거쳐 받아 오는 전체 코드(전체 북마클릿과 같은 코드, `v1.6.0` 태그의 파일) |

## 업데이트

새 버전은 파일을 바꾸고 새 태그(예: `v1.6.1`)를 붙입니다.

- **유저스크립트**: 새 `eruda-select.user.js`로 다시 설치하세요.
- **북마클릿**: 짧은 북마클릿은 버전이 주소에 들어 있어서 늘 정확히 그 버전을 받습니다. 새 버전으로 바꾸려면 북마크 내용도 새 코드로 바꿔야 합니다(전체 북마클릿도 마찬가지).
