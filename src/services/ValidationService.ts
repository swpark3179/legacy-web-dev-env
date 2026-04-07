import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import * as vscode from 'vscode';
import type { ValidationItem, ValidationState, Settings } from '../types';

/**
 * 검증 서비스 - Gradle, JDK, Tomcat, 프로젝트 구조 검증
 */
export class ValidationService {
    private _validation: ValidationState;
    private _log: vscode.OutputChannel;

    constructor(log: vscode.OutputChannel, validation: ValidationState) {
        this._log = log;
        this._validation = validation;
    }

    /**
     * 저장된 검증 상태로 설정 (설정 로드 시)
     */
    setAsValidated(settings: Settings): void {
        if (settings.gradlePath.length > 0) this._validation.gradle = { status: 'valid', message: '저장된 설정 로드됨' };
        if (settings.jdkPath.length > 0) {
            // jdk 경로가 있으면 dcevm 체크도 수행
            const altjvmPath = path.join(settings.jdkPath, 'jre', 'lib', 'amd64', 'dcevm');
            const altjvmPath2 = path.join(settings.jdkPath, 'jre', 'lib', 'dcevm');
            const altjvmPath3 = path.join(settings.jdkPath, 'jre', 'bin', 'dcevm', 'jvm.dll');
            const hasDcevm = fs.existsSync(altjvmPath) || fs.existsSync(altjvmPath2) || fs.existsSync(altjvmPath3);
            this._validation.jdk_has_dcevm = hasDcevm;
            let jdkMessage = '저장된 설정 로드됨';
            jdkMessage += hasDcevm ? ' (DCEVM)' : ' (DCEVM 미설치)';
            this._validation.jdk = { status: 'valid', message: jdkMessage };
        }
        if (settings.tomcatPath.length > 0) this._validation.tomcat = { status: 'valid', message: '저장된 설정 로드됨' };
        if (this._validation.gradle.status === 'valid' &&
            this._validation.jdk.status === 'valid' &&
            this._validation.tomcat.status === 'valid' &&
            this._validation.projectValid) this._validation.allValid = true;
    }

    /**
     * 프로젝트 구조 검증
     */
    validateProjectStructure(projectRoot: string): void {
        if (!projectRoot) {
            this._validation.projectValid = false;
            return;
        }
        const webXmlPath = path.join(projectRoot, 'src', 'webapp', 'WEB-INF', 'web.xml');
        if (!fs.existsSync(webXmlPath) || !fs.statSync(webXmlPath).isFile()) {
            this._validation.projectValid = false;
            return;
        }
        // web.xml에서 display-name 파싱 가능 여부 확인 (context root 필수)
        try {
            const content = fs.readFileSync(webXmlPath, 'utf8');
            const match = content.match(/<display-name>\s*([\s\S]*?)\s*<\/display-name>/);
            this._validation.projectValid = !!(match && match[1] !== undefined);
        } catch {
            this._validation.projectValid = false;
        }
    }

    /**
     * Gradle 검증
     */
    async validateGradle(gradlePath: string): Promise<ValidationItem> {
        if (!gradlePath) return { status: 'invalid', message: 'Gradle 경로가 설정되지 않음' };

        try {
            const gradleBat = path.join(gradlePath, 'bin', 'gradle.bat');

            if (!fs.existsSync(gradleBat)) {
                return { status: 'invalid', message: 'gradle.bat을 찾을 수 없음' };
            }

            try {
                const result = spawnSync(gradleBat, ['--version'], {
                    encoding: 'utf-8',
                    timeout: 30000
                });
                const output = (result.stdout || '') + (result.stderr || '');

                const versionMatch = output.match(/Gradle\s+([0-9.]+)/);

                if (versionMatch) {
                    const version = versionMatch[1];
                    if (version.startsWith('6.9')) {
                        return { status: 'valid', message: `Gradle ${version}`, version };
                    } else {
                        return { status: 'invalid', message: `Gradle ${version} (6.9.x 필요)`, version };
                    }
                }
                this._log.appendLine('Gradle 버전 확인 실패');
                throw new Error();
            } catch {
                return { status: 'invalid', message: 'Gradle 버전 확인 실패' };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { status: 'invalid', message: errorMessage };
        }
    }

    /**
     * JDK 검증
     */
    async validateJdk(jdkPath: string): Promise<ValidationItem> {
        if (!jdkPath) return { status: 'invalid', message: 'JDK 경로가 설정되지 않음' };

        try {
            const javaBin = process.platform === 'win32' ? 'java.exe' : 'java';
            const javaExe = path.join(jdkPath, 'bin', javaBin);

            if (!fs.existsSync(javaExe)) return { status: 'invalid', message: 'java 실행 파일을 찾을 수 없음' };

            const altjvmPath = path.join(jdkPath, 'jre', 'lib', 'amd64', 'dcevm');
            const altjvmPath2 = path.join(jdkPath, 'jre', 'lib', 'dcevm');
            const altjvmPath3 = path.join(jdkPath, 'jre', 'bin', 'dcevm', 'jvm.dll');
            const hasDcevm = fs.existsSync(altjvmPath) || fs.existsSync(altjvmPath2) || fs.existsSync(altjvmPath3);
            this._validation.jdk_has_dcevm = hasDcevm;

            try {
                // java -version은 보통 stderr로 출력되므로 spawnSync로 둘 다 캡처
                const result = spawnSync(javaExe, ['-version'], {
                    encoding: 'utf-8',
                    timeout: 10000
                });
                const output = result.stdout + result.stderr;

                const versionMatch = output.match(/version\s+"?([\d][\w._-]+)"?/);
                if (versionMatch) {
                    const version = versionMatch[1];
                    if (version.startsWith('1.8')) {
                        let message = 'JDK 확인됨';
                        message += hasDcevm ? ' (DCEVM)' : ' (DCEVM 미설치)';
                        return { status: 'valid', message, version };
                    } else return { status: 'invalid', message: `JDK ${version} (1.8.x 필요)`, version };
                }
                throw new Error();
            } catch {
                return { status: 'invalid', message: 'JDK 버전 확인 실패' };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { status: 'invalid', message: errorMessage };
        }
    }
    /**
     * Tomcat 검증
     */
    async validateTomcat(tomcatPath: string): Promise<ValidationItem> {
        if (!tomcatPath) {
            return { status: 'invalid', message: 'Tomcat 경로가 설정되지 않음' };
        }

        try {
            const catalinaBat = path.join(tomcatPath, 'bin', 'catalina.bat');
            const catalinaSh = path.join(tomcatPath, 'bin', 'catalina.sh');

            const hasCatalina = process.platform === 'win32'
                ? fs.existsSync(catalinaBat)
                : fs.existsSync(catalinaSh);

            if (!hasCatalina) {
                return { status: 'invalid', message: 'catalina 스크립트를 찾을 수 없음' };
            }

            const serverXml = path.join(tomcatPath, 'conf', 'server.xml');
            if (!fs.existsSync(serverXml)) {
                return { status: 'invalid', message: 'server.xml을 찾을 수 없음' };
            }

            const releaseNotes = path.join(tomcatPath, 'RELEASE-NOTES');
            let version = '';

            if (fs.existsSync(releaseNotes)) {
                const content = fs.readFileSync(releaseNotes, 'utf-8');
                const versionMatch = content.match(/Apache\s+Tomcat\s+Version\s+(\d+\.\d+\.\d+)/i);
                if (versionMatch) {
                    version = versionMatch[1];
                    if (version.startsWith('9.0') || version.startsWith('8.5')) {
                        return { status: 'valid', message: `Tomcat ${version}`, version };
                    } else {
                        return { status: 'invalid', message: `Tomcat ${version} (9.0.x 또는 8.5.x 필요)` };
                    }
                }
                throw new Error();
            }
            throw new Error();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { status: 'invalid', message: errorMessage };
        }
    }

    /**
     * 전체 검증 수행
     */
    async validateAll(
        settings: Settings,
        onUpdate: () => void,
        postProcess: () => void
    ): Promise<void> {
        this._log.appendLine('전체 검증 수행 시작');
        this._validation.isValidating = true;
        onUpdate();

        // Gradle
        this._validation.gradle = { status: 'validating', message: '검증 중...' };
        onUpdate();
        this._validation.gradle = await this.validateGradle(settings.gradlePath);
        onUpdate();

        // JDK
        this._validation.jdk = { status: 'validating', message: '검증 중...' };
        onUpdate();
        this._validation.jdk = await this.validateJdk(settings.jdkPath);
        onUpdate();

        // Tomcat
        this._validation.tomcat = { status: 'validating', message: '검증 중...' };
        onUpdate();
        this._validation.tomcat = await this.validateTomcat(settings.tomcatPath);
        onUpdate();

        // Update overall state
        this._validation.isValidating = false;
        this._validation.allValid =
            this._validation.projectValid &&
            (this._validation.gradle.status === 'valid' || this._validation.gradle.status === 'warning') &&
            this._validation.jdk.status === 'valid' &&
            this._validation.tomcat.status === 'valid';

        onUpdate();
        this._log.appendLine('전체 검증 수행 완료');
        if (this._validation.allValid) postProcess();
    }
}
