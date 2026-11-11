# DEADLINE: SEOUL 협동 멀티플레이 운영 가이드

## 구현 상태

- api/multiplayer.js: Vercel Functions WebSocket 서버 (현재 인스턴스별 메모리 방; 테스트용)
- multiplayer/coop-engine.mjs: 최대 4인 서버 권한 기반 이동·사격·좀비 AI·웨이브·소생·탈출 엔진
- scripts/coop-client.cjs: 기존 싱글플레이 안에 별도의 대기실·동료 모델·동기화 기능
- multiplayer/server.mjs: Railway/Render에서 실행하는 상시 기동 1-레플리카 서버
- railway.json: 단일 레플리카 Railway 배포 구성
- npm run test:coop: 4개 실제 WebSocket 연결과 서버 엔진 검사

## 안정적 외부 친구 초대 서비스 배포

Vercel Functions는 WebSocket 자체를 지원하지만, 서로 다른 브라우저의 접속이 같은 Function 인스턴스에 배치된다는 보장이 없습니다. 따라서 Vercel의 메모리 기반 Preview에서는 ROOM_NOT_FOUND 오류가 간헐적으로 날 수 있습니다.

외부 친구와 안정적으로 플레이하려면 Railway를 연결하고 위 저장소의 multiplayer/server.mjs를 단일 인스턴스로 호스팅하세요.

1. Railway 프로젝트에 이 GitHub 저장소를 연결합니다. railway.json에 있는 시작 명령인 node multiplayer/server.mjs를 사용합니다.
2. Railway 서비스에 COOP_ALLOWED_ORIGINS=https://<게임-도메인> 환경변수를 등록합니다. 실제 게임 페이지의 Origin을 정확히 적습니다. 여러 게임 도메인은 쉼표로 구분합니다.
3. Railway 서비스에 HTTPS/WSS 도메인을 활성화합니다.
4. Vercel 게임 프로젝트의 Preview 환경변수 COOP_SERVER_URL=wss://<서버도메인>/api/multiplayer 를 설정합니다.
5. 새 Vercel Preview를 생성해 2~4개의 별도 기기로 입장, 대기실 준비, 공동 전투, 탈출과 네트워크 재접속을 검증합니다.
6. 정식 운영 도메인 배포는 테스트 통과 뒤에 별도로 진행합니다.

**주의:** 단일 Railway 인스턴스에 저장된 방 상태도 현재는 프로세스 메모리만 사용합니다. 서버 재시작·롤링 배포 시 진행 중인 방이 종료됩니다. 소규모 MVP 수준이며, 다중 리전·무중단 운영을 위해서는 Cloudflare Durable Objects 또는 Redis Pub/Sub 등 분산 룸 저장 계층이 추가로 필요합니다.

## 개발·QA 명령

- npm install --ignore-scripts
- npm run test:coop
- npm run build
- node scripts/coop-dev-server.mjs
- 다른 터미널에서 node scripts/browser-coop.cjs 실행 (Playwright Chromium 설치 필요)

테스트 대상: 인원 제한, 방장 이관, 서버 이동 제한·사격 속도 제한·탄약·재장전, 웨이브 총 194마리, 3초 소생, 전멸·탈출 승패, 4개 동시 WebSocket 상태 동기화 및 1개 브라우저 + 별도 소켓 동료의 상호작용.

현재 업데이트 주기: 서버 20Hz / 상태 스냅샷 10Hz. 서울·해외의 실제 이용자 대상 왕복 지연 측정, 중급 Android FPS와 네트워크 장애 복구는 아직 진행되지 않았습니다.
