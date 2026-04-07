# XPlatform Dev Environment

XPlatform 개발 환경 설정 도구 VS Code Extension입니다.

## ✨ 주요 기능

- **환경 설정**: Gradle, JDK (DCEVM), Tomcat 경로 설정 및 검증
- **빌드 관리**: Gradle을 통한 프로젝트 클린/빌드
- **Tomcat 관리**: 개발 서버 시작/중지/디버그
- **프로젝트 설정**: VS Code 설정 자동화
- **Hot Reload**: DCEVM을 활용한 핫스왑 지원

## 📋 필수 요구사항

- **Node.js**: v18 이상
- **VS Code**: v1.85.0 이상
- **JDK 1.8 with DCEVM**: altjvm 포함
- **Gradle**: 프로젝트에 맞는 버전
- **Apache Tomcat**: 개발 서버용

## 🏗️ 프로젝트 구조

```
├── src/                    # Extension 소스 코드
│   ├── extension.ts        # Extension 진입점
│   ├── panels/             # Webview 패널 프로바이더
│   │   ├── UnifiedPanelProvider.ts  # 통합 패널 (Settings, Main, ProjectSettings)
│   │   └── WebviewProvider.ts       # 공통 베이스 클래스
│   ├── services/           # 비즈니스 로직
│   │   ├── SettingsService.ts       # 설정 관리
│   │   ├── ValidationService.ts     # 경로 검증
│   │   ├── TomcatService.ts         # Tomcat 제어
│   │   └── GradleService.ts         # Gradle 빌드
│   ├── types/              # TypeScript 타입 정의
│   └── utils/              # 유틸리티 함수
├── ui/                     # React Webview UI (Vite)
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   ├── pages/          # 페이지 컴포넌트
│   │   ├── hooks/          # 커스텀 훅
│   │   ├── types/          # 타입 정의
│   │   └── styles/         # CSS 스타일
│   └── vite.config.ts      # Vite 설정
├── webview-dist/           # Webview 빌드 결과물
├── out/                    # Extension 컴파일 결과물
├── media/                  # 아이콘 등 미디어 파일
├── package.json            # Extension 매니페스트
└── tsconfig.json           # TypeScript 설정
```

## 🚀 빌드 방법

### 1. 의존성 설치

```bash
# Extension 의존성
npm install

# Webview UI 의존성
cd ui && npm install
```

### 2. 전체 빌드 (Extension + Webview)

```bash
npm run build:all
```

### 3. 개별 빌드

```bash
# Extension만 컴파일
npm run compile

# Webview UI만 빌드
npm run compile:webview
```

### 4. 개발 모드 (Watch)

각각 별도의 터미널에서 실행:

```bash
# Extension 개발 모드
npm run watch

# Webview UI 개발 모드
npm run watch:webview
```

## 🎯 실행 방법

1. VS Code에서 이 프로젝트를 엽니다.
2. `F5` 키를 눌러 Extension Development Host를 실행합니다.
3. 새로 열린 VS Code 창에서 사이드바의 **XPlatform** 아이콘을 클릭합니다.

## 📝 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npm run compile` | Extension TypeScript 컴파일 |
| `npm run compile:webview` | Webview UI 빌드 (React) |
| `npm run build:all` | Extension + Webview 전체 빌드 |
| `npm run watch` | Extension 변경 감지 컴파일 |
| `npm run watch:webview` | Webview UI 개발 서버 |
| `npm run lint` | ESLint 코드 검사 |
| `npm run vscode:prepublish` | 배포 전 전체 빌드 |

## 📦 패키징 (VSIX 생성)

Extension을 VSIX 파일로 패키징하려면:

```bash
# vsce 설치 (최초 1회)
npm install -g @vscode/vsce

# VSIX 파일 생성
vsce package
```

생성된 `.vsix` 파일을 VS Code에서 설치하면 됩니다.

## 🔧 개발 가이드

### Webview UI 수정

1. `ui/src/` 폴더에서 React 컴포넌트 수정
2. `npm run watch:webview`로 개발 서버 실행
3. Extension 리로드 시 반영

### Extension 로직 수정

1. `src/` 폴더에서 TypeScript 코드 수정
2. `npm run watch`로 자동 컴파일
3. Extension Development Host에서 Reload Window

### 메시지 통신

Webview와 Extension 간 통신은 `postMessage`를 사용합니다:

- **Webview → Extension**: `vscode.postMessage({ type: 'commandName', ... })`
- **Extension → Webview**: `this._postMessage({ type: 'stateUpdate', ... })`

## 📄 라이선스

Private - Internal Use Only
