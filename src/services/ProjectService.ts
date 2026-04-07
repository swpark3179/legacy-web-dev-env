import * as vscode from 'vscode';
import type { ProjectSettingsOptions, Settings } from '../types';
import path from 'path';
import os from 'os';
import JSON5 from 'json5';
import * as fs from 'fs';

// 프로젝트 설정 저장 서비스
// settings.json 에 접근하는 기능인데, vscode.workspace.getConfiguration을 사용하는게 더 합리적이겠으나, 관련 확장 프로그램이 설치되지 않은 상황 고려하여 JSON 라이브러리 활용하여 강제 적용 (JSON5를 써서 유연한 json)
export class ProjectService {
    private _log: vscode.OutputChannel;
    private _settings: Settings;
    private _extensionPath: vscode.Uri;

    constructor(log: vscode.OutputChannel, settings: Settings, extensionPath: vscode.Uri) {
        this._log = log;
        this._settings = settings;
        this._extensionPath = extensionPath;
    }

    // 프로젝트 설정 초기화
    public async initProjectSettings(options: ProjectSettingsOptions): Promise<void> {
        this._log.appendLine('프로젝트 설정 초기화');
        try {
            this._log.appendLine('프로젝트 설정 적용 중...');

            const settingsPath = path.join(this._settings.projectRoot, '.vscode', 'settings.json');
            const vscodeDir = path.dirname(settingsPath);

            // .vscode 디렉터리 확인
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }

            // 기존 설정 로드
            let settings_json: Record<string, unknown> = {};
            if (fs.existsSync(settingsPath)) {
                const content = fs.readFileSync(settingsPath, 'utf-8');
                settings_json = JSON5.parse(content);
            }

            // Gradle 및 JDK 설정 적용
            settings_json['java.import.gradle.home'] = this._settings.gradlePath;
            settings_json['java.import.gradle.java.home'] = this._settings.jdkPath;
            settings_json['java.import.gradle.wrapper.enabled'] = false;
            settings_json['java.configuration.updateBuildConfiguration'] = 'automatic';
            settings_json['java.project.sourcePaths'] = ['src/java'];
            settings_json['java.project.resourceFilters'] = ['src/config', 'src/query'];
            settings_json['java.project.referencedLibraries'] = ['src/lib/**/*.jar'];
            settings_json['java.compile.nullAnalysis.mode'] = 'automatic';
            settings_json['java.configuration.runtimes'] = [{name: 'JavaSE-1.8', path: this._settings.jdkPath, default: true}];
            settings_json['rsp-ui.rsp.java.home'] = this._settings.jdkPath;
            settings_json['maven.terminal.customEnv'] = [{name: 'JAVA_HOME', value: this._settings.jdkPath}];

            // 터미널 설정 적용
            settings_json['terminal.integrated.defaultProfile.windows'] = 'Command Prompt';
            settings_json['terminal.integrated.env.windows'] = {
                JAVA_HOME: this._settings.jdkPath,
                PATH: `${path.join(this._settings.jdkPath, 'bin')}${path.delimiter}${path.join(this._settings.gradlePath, 'bin')}${path.delimiter}${process.env.PATH}`
            };

            // 숨김 파일 적용
            const excludePatterns: Record<string, boolean> = {};
            if (options.hideSimpleFolder) {
                excludePatterns['**/out'] = true;
                excludePatterns['**/bin'] = true;
                excludePatterns['**/.idea'] = true;
                excludePatterns['**/.gradle'] = true;
                excludePatterns['**/.settings'] = true;
                excludePatterns['**/.github'] = true;
            };

            if (options.hideExtFolder) {
                excludePatterns['**/deploy'] = true;
                excludePatterns['**/.tomcat'] = true;
                excludePatterns['**/target'] = true;
            }
            if (Object.keys(excludePatterns).length > 0) settings_json['files.exclude'] = excludePatterns;
            else delete settings_json['files.exclude'];

            fs.writeFileSync(settingsPath, JSON.stringify(settings_json, null, 4), 'utf-8'); // settings.json 저장
            if(options.initProjectFile && await this.decideOverwriteProjectFile()) {
                this.createProjectFile(); // .project 파일 생성
                this.createClassPathFile(); // .classpath 파일 생성
            }
            this._log.appendLine('프로젝트 설정 적용 완료');
            vscode.window.showInformationMessage('프로젝트 설정 적용 완료');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`프로젝트 설정 적용 실패: ${errorMessage}`);
            this._log.appendLine(`프로젝트 설정 적용 실패: ${errorMessage}`);
        }
    }

    // 사용자 홈 설정 적용
    public async handleApplyHomeSettings(): Promise<void> {
        if (!await this.applyGitConfig()) return; // Git 전역 설정 적용
        await this.applyGradleProperties(); // Gradle 프록시 설정 적용
        this._log.appendLine('사용자 홈 설정 적용 완료');
        vscode.window.showInformationMessage('설정 적용 완료');
    }

    private async applyGitConfig(): Promise<boolean> {
        const name = await vscode.window.showInputBox({
            prompt: 'Git 사용자 이름을 입력하세요',
            placeHolder: '홍길동',
            validateInput: (value) => {
                if (value.trim() === '') return '이름을 입력하세요';
                return null;
            }
        });
        if (!name) return false; // 이름을 제대로 입력하지 않으면 중지
        const email = await vscode.window.showInputBox({
            prompt: 'Git 사용자 이메일을 입력하세요',
            placeHolder: 'honggildong@example.com',
            validateInput: (value) => {
                if (value.trim() === '') return '이메일을 입력하세요';
                return null;
            }
        });
        if (!email) return false; // 이메일을 제대로 입력하지 않으면 중지
        const gitconfigPath = path.join(os.homedir(), '.gitconfig');
        const gitConfigContent = `[user]
\tname = ${name}
\temail = ${email}
[core]
\tquotePath = false
\tlongpaths = true
\tautocrlf = true
[http]
\tsslVerify = false
[credential "https://code.sdsdev.co.kr"]
\tprovider = github
`;
        fs.writeFileSync(gitconfigPath, gitConfigContent, 'utf8');
        this._log.appendLine('사용자 홈 폴더의 .gitconfig 파일 설정 적용 완료');
        return true;
    }

    // 사용자 홈폴더의 .gradle/gradle.properties 파일 설정 적용
    private async applyGradleProperties(): Promise<void> {
        const gradlePropertiesPath = path.join(os.homedir(), '.gradle', 'gradle.properties');
        const ourProps: Record<string, string> = {
            'systemProp.http.proxyHost': '60.200.254.1',
            'systemProp.http.proxyPort': '9090',
            'systemProp.http.nonProxyHosts': 'localhost|127.0.0.1|70.10.15.*|*.sdsdev.co.kr|qa.shi-api.com|60.101.107.90|60.101.107.57',
            'systemProp.https.proxyHost': '60.200.254.1',
            'systemProp.https.proxyPort': '9090',
            'systemProp.https.nonProxyHosts': 'localhost|127.0.0.1|70.10.15.*|*.sdsdev.co.kr|qa.shi-api.com|60.101.107.90|60.101.107.57'
        };
        let content: string;
        if (fs.existsSync(gradlePropertiesPath)) {
            content = fs.readFileSync(gradlePropertiesPath, 'utf8');
            for (const [key, value] of Object.entries(ourProps)) {
                const keyEscaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`^(${keyEscaped})=.*$`, 'm');
                if (regex.test(content)) {
                    content = content.replace(regex, `$1=${value}`);
                } else {
                    content += `\n${key}=${value}`;
                }
            }
        } else {
            content = Object.entries(ourProps).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
        }
        const gradleDir = path.dirname(gradlePropertiesPath);
        if (!fs.existsSync(gradleDir)) fs.mkdirSync(gradleDir, { recursive: true });
        fs.writeFileSync(gradlePropertiesPath, content, 'utf8');
        this._log.appendLine('사용자 홈 폴더의 .gradle/gradle.properties 파일 설정 적용 완료');
    }
    
    // .project 파일과 .classpath 파일이 이미 존재하는지 확인하고, 덮어쓸지 결정
    private async decideOverwriteProjectFile(): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this._log.appendLine("오류 : 프로젝트 폴더가 확인되지 않습니다.");
            return false;
        }
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const projectPath = path.join(workspacePath, '.project');
        const classpathPath = path.join(workspacePath, '.classpath');
        const existsProjectFile = fs.existsSync(projectPath);
        const existsClasspathFile = fs.existsSync(classpathPath);
        if (existsProjectFile && existsClasspathFile) {
            return await vscode.window.showWarningMessage('.project 파일과 .classpath 파일이 이미 존재합니다. 덮어쓰시겠습니까?', '예', '아니오') === '예';
        } else if (existsProjectFile) {
            return await vscode.window.showWarningMessage('.project 파일이 이미 존재합니다. 덮어쓰시겠습니까?', '예', '아니오') === '예';
        } else if (existsClasspathFile) {
            return await vscode.window.showWarningMessage('.classpath 파일이 이미 존재합니다. 덮어쓰시겠습니까?', '예', '아니오') === '예';
        }
        return true;
    }

    // .project 파일 생성
    private async createProjectFile(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this._log.appendLine('오류 : 프로젝트 폴더가 확인되지 않습니다.');
                throw new Error('오류 : 프로젝트 폴더가 확인되지 않습니다.');
            }
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const projectPath = path.join(workspacePath, '.project');
            const projectName = path.basename(workspacePath);
            const projectContent = `<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
    <name>${projectName}</name>
    <comment></comment>
    <projects></projects>
    <buildSpec>
        <buildCommand>
            <name>org.eclipse.jdt.core.javabuilder</name>
            <arguments></arguments>
        </buildCommand>
    </buildSpec>
    <natures>
        <nature>org.eclipse.jdt.core.javanature</nature>
    </natures>
</projectDescription>
`;

            // Write to .project file
            fs.writeFileSync(projectPath, projectContent, 'utf8');
            this._log.appendLine(`.project 파일이 생성되었습니다: ${projectPath}`);
        } catch (error) {
            this._log.appendLine(`.project 파일 생성 실패: ${error}`);
        }
    }

    // .classpath 파일 생성
    private async createClassPathFile(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this._log.appendLine('오류 : 프로젝트 폴더가 확인되지 않습니다.');
                throw new Error('오류 : 프로젝트 폴더가 확인되지 않습니다.');
            }
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const classpathPath = path.join(workspacePath, '.classpath');

            const rtJarPath = path.join(this._extensionPath.fsPath, 'resources', 'rt.jar');
            let rtJarEntry = '';
            if(fs.existsSync(rtJarPath)) rtJarEntry = `<classpathentry kind="lib" path="${rtJarPath}"/>`;
            const classpathContent = `<?xml version="1.0" encoding="UTF-8"?>
<classpath>
    ${rtJarEntry}
    <classpathentry kind="src" path="src/java"/>
    <classpathentry kind="src" path="src/config"/>
    <classpathentry kind="src" path="src/query"/>
    <classpathentry kind="con" path="org.eclipse.jdt.launching.JRE_CONTAINER/org.eclipse.jdt.internal.debug.ui.launcher.StandardVMType/JavaSE-1.8"/>
    <classpathentry kind="con" path="org.eclipse.jst.j2ee.internal.web.container"/>
    <classpathentry kind="output" path="target/out"/>
    <classpathentry kind="lib" path="src/lib/**/*.jar"/>
</classpath>
`;
            fs.writeFileSync(classpathPath, classpathContent, 'utf8');
            this.updateClassPathFile();
            this._log.appendLine(`.classpath 파일이 생성되었습니다: ${classpathPath}`);

        } catch (error) {
            this._log.appendLine(`.classpath 파일 생성 실패: ${error}`);
        }
    }

    // .classpath 파일에 lib 각 파일 갱신
    private async updateClassPathFile(): Promise<void> {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                this._log.appendLine('오류 : 프로젝트 폴더가 확인되지 않습니다.');
                throw new Error('오류 : 프로젝트 폴더가 확인되지 않습니다.');
            }
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const classpathPath = path.join(workspacePath, '.classpath');
            let classpathContent = fs.readFileSync(classpathPath, 'utf8');

            // 1. kind="lib" classpathentry 중 path 최종경로가 rt.jar 인 것만 유지, 나머지는 태그 삭제
            classpathContent = classpathContent.replace(/<classpathentry[^>]*\/>\s*/g, (match) => {
                if (!match.includes('kind="lib"')) return match;
                const pathMatch = match.match(/path="([^"]+)"/);
                if (!pathMatch) return match;
                const pathVal = pathMatch[1];
                if (path.basename(pathVal) === 'rt.jar') return match;
                return '';
            });

            // 2. workspacePath/src/lib 의 모든 jar 파일을 classpathentry로 등록
            const srcLibDir = path.join(workspacePath, 'src', 'lib');
            const jarFiles: string[] = [];
            if (fs.existsSync(srcLibDir)) {
                const collectJars = (dir: string): void => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const ent of entries) {
                        const fullPath = path.join(dir, ent.name);
                        if (ent.isDirectory()) {
                            collectJars(fullPath);
                        } else if (ent.name.toLowerCase().endsWith('.jar')) {
                            jarFiles.push(fullPath);
                        }
                    }
                };
                collectJars(srcLibDir);
            }

            const libEntries = jarFiles.map((jarPath) => {
                const relPath = path.relative(workspacePath, jarPath).replace(/\\/g, '/');
                return `    <classpathentry kind="lib" path="${relPath}"/>`;
            }).join('\n');

            if (libEntries) {
                classpathContent = classpathContent.replace('</classpath>', `\n${libEntries}\n</classpath>`);
            }

            fs.writeFileSync(classpathPath, classpathContent, 'utf8');
            this._log.appendLine('lib 파일 갱신 완료');
        } catch (error) {
            this._log.appendLine(`.classpath 파일 갱신 실패: ${error}`);
        }
    }
}
