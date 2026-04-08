import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, execFileSync, ChildProcess } from 'child_process';
import { Settings } from '../types';

// Gradle 빌드 명령 실행 서비스
export class GradleService {
    private _runningProcess?: ChildProcess;
    private _log: vscode.OutputChannel;
    private _settings: Settings;
    private _onProcessComplete?: () => void;

    constructor(log: vscode.OutputChannel, settings: Settings, onProcessComplete?: () => void) {
        this._log = log;
        this._settings = settings;
        this._onProcessComplete = onProcessComplete;
    }

    // Gradle 명령 실행
    runCommand(command: string, taskName: string, onComplete?: (success: boolean) => void): void {
        if (!this._settings.gradlePath || !this._settings.jdkPath || !this._settings.projectRoot) {
            vscode.window.showErrorMessage('Gradle, JDK 경로 또는 프로젝트 루트가 설정되지 않았습니다.');
            this._onProcessComplete?.();
            if (onComplete) onComplete(false);
            return;
        }

        if (this._runningProcess) {
            vscode.window.showWarningMessage('이전 작업이 아직 실행 중입니다.');
            this._onProcessComplete?.();
            if (onComplete) onComplete(false);
            return;
        }

        const gradleExe = process.platform === 'win32'
            ? path.join(this._settings.gradlePath, 'bin', 'gradle.bat')
            : path.join(this._settings.gradlePath, 'bin', 'gradle');

        if (!fs.existsSync(gradleExe)) {
            vscode.window.showErrorMessage(`Gradle 실행 파일을 찾을 수 없습니다: ${gradleExe}`);
            this._onProcessComplete?.();
            return;
        }

        this._log.clear();
        this._log.show(true);

        const startTime = new Date();
        this._log.appendLine(`[${startTime.toLocaleTimeString()}] ${taskName} 시작...`);
        this._log.appendLine(`> gradle --console=plain ${command}`);
        this._log.appendLine('');

        const env = {
            ...process.env,
            JAVA_HOME: this._settings.jdkPath,
            PATH: `${path.join(this._settings.jdkPath, 'bin')}${path.delimiter}${process.env.PATH}`,
            JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS || ''} -Dfile.encoding=UTF-8`.trim(),
        };

        // Gradle 데몬이 확장에서 지정한 JDK를 사용하도록 명시 (데몬이 다른 JDK로 기동된 경우 버전 불일치 방지)
        const javaHomeArg = `-Dorg.gradle.java.home=${this._settings.jdkPath}`;

        // --console=plain: TTY가 아닌 경우에도 출력을 줄 단위로 플러시하여 버퍼링 감소
        this._runningProcess = spawn(gradleExe, [javaHomeArg, '--console=plain', command], {
            cwd: this._settings.projectRoot,
            env,
            shell: true
        });

        const logStreamData = (data: Buffer) => {
            data.toString('utf8').split(/\r?\n/).forEach((line) => {
                if (line.trim()) this._log.appendLine(line);
            });
        };
        this._runningProcess.stdout?.on('data', logStreamData);
        this._runningProcess.stderr?.on('data', logStreamData);

        this._runningProcess.on('close', (code: number | null) => {
            const endTime = new Date();
            const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);

            this._log.appendLine('');
            const isSuccess = code === 0;
            if (isSuccess) {
                this._log.appendLine(`[${endTime.toLocaleTimeString()}] ${taskName} 완료 (${duration}초)`);
            } else {
                this._log.appendLine(`[${endTime.toLocaleTimeString()}] ${taskName} 실패 (종료 코드: ${code})`);
            }
            this._runningProcess = undefined;
            this._onProcessComplete?.();
            if (onComplete) onComplete(isSuccess);
        });

        this._runningProcess.on('error', (err: Error) => {
            this._log.appendLine(`[ERROR] 프로세스 오류: ${err.message}`);
            vscode.window.showErrorMessage(`${taskName} 실행 오류: ${err.message}`);
            this._runningProcess = undefined;
            this._onProcessComplete?.();
            if (onComplete) onComplete(false);
        });
    }

    /** 실행 중인 Gradle 프로세스 강제 종료 (프로세스 트리 전체 kill) */
    stopGradle(): void {
        const proc = this._runningProcess;
        if (proc?.pid) {
            try {
                const pid = Number(proc.pid);
                if (Number.isInteger(pid) && pid > 0) {
                    if (process.platform === 'win32') {
                        execFileSync('taskkill', ['/PID', pid.toString(), '/T', '/F'], { stdio: 'pipe', encoding: 'utf8' });
                    } else {
                        process.kill(pid, 'SIGKILL');
                    }
                }
            } catch {
                try {
                    proc.kill('SIGKILL');
                } catch {
                    // 무시
                }
            }
            this._runningProcess = undefined;
            this._log.appendLine('[Gradle] 빌드 프로세스 강제 종료');
        }
        this._onProcessComplete?.();
    }

    // 빌드(classes) 실행
    buildClasses(): void {
        this.runCommand('classes', '빌드(classes)');
    }

    // 빌드(classes) 실행 후 콜백 호출 (배포 적용 등에서 사용)
    buildClassesWithCallback(onComplete: (success: boolean) => void): void {
        if (!this._settings.gradlePath || !this._settings.jdkPath || !this._settings.projectRoot) {
            vscode.window.showErrorMessage('Gradle, JDK 경로 또는 프로젝트 루트가 설정되지 않았습니다.');
            onComplete(false);
            return;
        }
        if (this._runningProcess) {
            vscode.window.showWarningMessage('이전 작업이 아직 실행 중입니다.');
            onComplete(false);
            return;
        }

        // 기존 _onProcessComplete를 백업하고 일시적으로 교체
        const originalCallback = this._onProcessComplete;
        this._onProcessComplete = () => {
            this._onProcessComplete = originalCallback; // 원래 콜백 복원
            originalCallback?.();
        };

        // runCommand 내부에서 close/error 이벤트에 _onProcessComplete를 호출함
        // 그러나 성공/실패를 판별해야 하므로 직접 실행
        const gradleExe = process.platform === 'win32'
            ? path.join(this._settings.gradlePath, 'bin', 'gradle.bat')
            : path.join(this._settings.gradlePath, 'bin', 'gradle');

        if (!fs.existsSync(gradleExe)) {
            onComplete(false);
            return;
        }

        this._log.show(true);
        const startTime = new Date();
        this._log.appendLine(`[${startTime.toLocaleTimeString()}] 빌드(classes) 시작... [배포 적용]`);

        const env = {
            ...process.env,
            JAVA_HOME: this._settings.jdkPath,
            PATH: `${path.join(this._settings.jdkPath, 'bin')}${path.delimiter}${process.env.PATH}`,
            JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS || ''} -Dfile.encoding=UTF-8`.trim(),
        };

        const javaHomeArg = `-Dorg.gradle.java.home=${this._settings.jdkPath}`;

        // --console=plain: TTY가 아닌 경우에도 출력을 줄 단위로 플러시하여 버퍼링 감소
        this._runningProcess = spawn(gradleExe, [javaHomeArg, '--console=plain', 'classes'], {
            cwd: this._settings.projectRoot,
            env,
            shell: true
        });

        const logStreamData = (data: Buffer) => {
            data.toString('utf8').split(/\r?\n/).forEach((line) => {
                if (line.trim()) this._log.appendLine(line);
            });
        };
        this._runningProcess.stdout?.on('data', logStreamData);
        this._runningProcess.stderr?.on('data', logStreamData);

        this._runningProcess.on('close', (code: number | null) => {
            const endTime = new Date();
            const duration = ((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1);
            if (code === 0) {
                this._log.appendLine(`[${endTime.toLocaleTimeString()}] 빌드(classes) 완료 (${duration}초)`);
            } else {
                this._log.appendLine(`[${endTime.toLocaleTimeString()}] 빌드(classes) 실패 (종료 코드: ${code})`);
            }
            this._runningProcess = undefined;
            this._onProcessComplete = originalCallback;
            originalCallback?.();
            onComplete(code === 0);
        });

        this._runningProcess.on('error', (err: Error) => {
            this._log.appendLine(`[ERROR] 프로세스 오류: ${err.message}`);
            this._runningProcess = undefined;
            this._onProcessComplete = originalCallback;
            originalCallback?.();
            onComplete(false);
        });
    }

    // Clean 실행
    cleanProject(): void {
        this.runCommand('clean', '빌드 초기화(clean)');
    }

    // 라이브러리 적용 실행
    applyLibrary(onComplete: (success: boolean) => void): void {
        const vscodeDirPath = path.join(this._settings.projectRoot, '.vscode');
        if (!fs.existsSync(vscodeDirPath)) {
            fs.mkdirSync(vscodeDirPath, { recursive: true });
        }

        const initScriptPath = path.join(vscodeDirPath, 'copy-lib.vscode-init.gradle');
        if (!fs.existsSync(initScriptPath)) {
            const initScriptContent = `allprojects {
    afterEvaluate { project ->
        project.task('copyLib', type: Copy) {
            group = "custom"
            description = "Copy runtime dependencies to .vscode/lib"
            into ".vscode/lib"
            from configurations.runtimeClasspath
        }
    }
}`;
            fs.writeFileSync(initScriptPath, initScriptContent, 'utf8');
        }

        const command = `--init-script .vscode/copy-lib.vscode-init.gradle copyLib`;

        this.runCommand(command, '라이브러리 적용', (success) => {
            if (success) {
                this._updateClasspathAfterLibraryApply();
            } else {
                vscode.window.showErrorMessage('라이브러리 복사(Gradle) 중 오류가 발생했습니다. 출력창을 확인해주세요.');
                this._log.show(true);
            }
            onComplete(success);
        });
    }

    private _updateClasspathAfterLibraryApply(): void {
        const classpathFile = path.join(this._settings.projectRoot, '.classpath');
        if (!fs.existsSync(classpathFile)) {
            vscode.window.showErrorMessage('.classpath 파일을 찾을 수 없습니다.');
            return;
        }

        try {
            let content = fs.readFileSync(classpathFile, 'utf8');
            const lines = content.split(/\r?\n/);

            // kind="lib" 인 라인 모두 제거
            const newLines = lines.filter(line => !line.includes('<classpathentry kind="lib"'));

            const libDir = path.join(this._settings.projectRoot, '.vscode', 'lib');
            const jarFiles: string[] = [];

            if (fs.existsSync(libDir)) {
                const files = fs.readdirSync(libDir);
                for (const file of files) {
                    if (file.toLowerCase().endsWith('.jar')) {
                        jarFiles.push(file);
                    }
                }
            }

            const classpathEntryLines = jarFiles.map(jar => `\t<classpathentry kind="lib" path=".vscode/lib/${jar}"/>`);

            // </classpath> 닫히기 전 위치 찾기
            const insertIndex = newLines.findIndex(line => line.includes('</classpath>'));

            if (insertIndex !== -1) {
                newLines.splice(insertIndex, 0, ...classpathEntryLines);
            }

            // 빈 라인 제거
            const finalLines = newLines.filter(line => line.trim() !== '');

            fs.writeFileSync(classpathFile, finalLines.join('\n'), 'utf8');
            vscode.window.showInformationMessage('라이브러리 적용이 완료되었습니다.');
            this._log.appendLine('라이브러리 적용: .classpath 갱신 완료');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._log.appendLine(`[ERROR] .classpath 갱신 중 오류: ${errorMessage}`);
            vscode.window.showErrorMessage(`.classpath 파일 갱신 중 오류가 발생했습니다: ${errorMessage}`);
        }
    }
}
