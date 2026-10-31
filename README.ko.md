# Session Tree

[English](README.md)

Claude 데스크톱 앱에서 어떤 세션이 어떤 세션을 시작했는지 보여 주는 옆 패널입니다. 사이드바는 세션을 목록으로 보여 주지만, Session Tree는 폴더별 가계도로 그려서 작업 구조를 한눈에 볼 수 있게 합니다.

![폴더별로 묶인 세션을 보여 주는 Session Tree 패널](docs/screenshot.png)

*스크린샷은 `/session-tree demo`의 예시 데이터입니다.*

## 기능

- **가계도:** 화살표가 자식 세션에서 보고받는 부모 세션 쪽을 가리킵니다.
- **폴더:** 사이드바처럼 폴더별로 묶고, 폴더마다 접을 수 있습니다.
- **세션 종류:** 워크트리, 포크, 사이드 채팅 세션에 표시가 붙습니다.
- **상태:** 즐겨찾기 세션에는 ★, 실행 중인 세션에는 ● 표시가 붙습니다.
- **검색:** 제목으로 찾습니다. 찾은 세션은 부모 아래 제자리에 그대로 나옵니다.
- **보관 세션:** 기본으로 숨기고, 버튼으로 볼 수 있습니다.
- **눌러서 열기:** 카드를 누르면 앱에서 그 세션을 엽니다.
- **한국어와 영어:** 고른 언어를 기억합니다.

패널이 열려 있으면 1분마다 스스로 새로 고칩니다.

## 설치

Claude 데스크톱 앱과 Claude Code CLI가 필요합니다. 터미널에서 실행합니다.

```bash
claude plugin marketplace add dshw1234-dot/session-tree
claude plugin install session-tree@session-tree --scope user
```

새 세션을 열고 `/session-tree`를 입력합니다. 오른쪽 위 ⚙ 버튼을 누르면 설정이 열립니다.

자동 업데이트를 쓰려면 터미널의 `/plugin`에서 **Marketplaces** 항목으로 들어가 이 마켓플레이스의 자동 업데이트를 켭니다. 직접 업데이트하려면 다음을 실행합니다.

```bash
claude plugin update session-tree@session-tree
```

## 토큰 사용

패널을 그리거나 새로 고치거나 버튼을 눌러도 모델을 부르지 않습니다. `/session-tree` 명령이 대화에 남기는 한 줄을 다음 메시지 때 모델이 읽는 것이 유일한 작은 비용입니다.

## 읽고 보내는 것

- 데스크톱 앱이 내 컴퓨터에 둔 세션 파일과, 저장소 이름을 알기 위한 각 프로젝트의 `.git/config`를 읽습니다.
- 클라우드 세션과 실행 상태를 알기 위해 `ListAgents`와 `list_sessions` 도구를 부릅니다. 이미 허용된 경우에만 부르므로 권한 창을 띄우지 않습니다.
- 패널이 열려 있으면 세션마다 한 번, 새 버전을 확인하려고 `raw.githubusercontent.com`에서 이 저장소의 `plugin.json`을 받습니다. 내 데이터는 보내지 않습니다.

## 한계

- **Windows에서만 시험했습니다.** macOS와 Linux 지원 코드는 있지만 해당 환경에서 실행해 보지 않았습니다. 제보를 환영합니다.
- **앱이 업데이트되면 고장 날 수 있습니다.** 세션 파일은 공개 API가 아니라 앱 내부 형식입니다.
- **클라우드 세션은 제목만 나옵니다.** 모드가 알 수 있는 정보가 아니어서 폴더, 부모 관계, 눌러서 열기를 지원하지 않습니다.
- **실행 상태에 지금 세션은 나오지 않고,** 최대 1분 늦을 수 있습니다.

## 개발

```bash
claude plugin validate .
claude plugin test .
```

`hooks/tree.ts`가 나무를 만들고, `hooks/register.tsx`가 패널을 그리며, `hooks/strings.ts`에 두 언어의 문구가 있습니다.

## 라이선스

[MIT](LICENSE)
