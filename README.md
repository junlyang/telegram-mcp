# Telegram MCP Server

Telegram 메시지 발송을 위한 Model Context Protocol (MCP) 서버입니다.

## 기능

- **send_message**: Telegram 채팅방으로 메시지 전송
  - 최대 4096자까지 지원
  - HTML, Markdown, MarkdownV2 형식 지원

## 설치

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env.example`을 복사하여 `.env`를 생성하고 다음 값을 입력하세요:

```bash
cp .env.example .env
```

#### 필수 환경 변수

- `TELEGRAM_BOT_TOKEN`: @BotFather에서 생성한 봇 토큰
- `TELEGRAM_CHAT_ID`: 메시지를 받을 채팅 ID

### 3. 빌드

```bash
pnpm build
```

## 사용법

### Claude에 MCP 서버 등록

클라우드에서 이 MCP 서버를 사용하려면, `.claude/mcp.json` 파일에서 다음과 같이 설정해야 합니다:

```json
{
  "mcpServers": {
    "telegram": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "your_bot_token",
        "TELEGRAM_CHAT_ID": "your_chat_id"
      }
    }
  }
}
```

### 도구 사용

#### send_message

메시지를 Telegram으로 전송합니다.

**파라미터:**
- `message` (필수): 전송할 메시지 내용 (최대 4096자)
- `parse_mode` (선택): `HTML`, `Markdown`, 또는 `MarkdownV2`

**예시:**

```
메시지 "Hello World"를 telegram으로 전송해줘
```

**마크다운 형식 사용:**

```
다음 메시지를 HTML 형식으로 telegram에 보내줘:
<b>굵은 텍스트</b>
<i>기울임 텍스트</i>
```

## Telegram 봇 설정

### 1. BotFather에서 봇 생성

1. Telegram에서 @BotFather를 검색
2. `/start` 명령으로 시작
3. `/newbot` 명령으로 새 봇 생성
4. 봇 이름과 username 설정
5. 생성된 토큰 복사

### 2. Chat ID 확인

다음 방법 중 하나로 Chat ID를 확인할 수 있습니다:

**방법 1: getMe API 사용**
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe
```

**방법 2: 메시지 전송 후 업데이트 확인**
```bash
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

## 문제 해결

### "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required"

환경 변수가 올바르게 설정되었는지 확인하세요.

### Telegram API 에러

- **401 Unauthorized**: 봇 토큰이 잘못되었을 수 있습니다.
- **400 Bad Request**: Chat ID가 잘못되었거나 봇이 해당 채팅방에 접근 권한이 없을 수 있습니다.

## 개발

### 개발 모드 실행

```bash
pnpm dev
```

### 빌드

```bash
pnpm build
```

## 라이선스

MIT
