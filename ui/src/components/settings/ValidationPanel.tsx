import React from 'react';
import type { Settings, ValidationState } from '../../types';
import { Panel, Button, ButtonGroup } from '../common';

export const ValidationPanel: React.FC<{ settings: Settings, validation: ValidationState, onValidateAll: () => void }> = ({ settings, validation, onValidateAll }) => {
    const canValidate =
        settings.gradlePath &&
        settings.jdkPath &&
        settings.tomcatPath &&
        validation.projectValid;

    const getProgress = () => {
        if (!validation.isValidating) return 0;
        let completed = 0;
        const items: ('gradle' | 'jdk' | 'tomcat')[] = ['gradle', 'jdk', 'tomcat'];
        for (const item of items) {
            const status = validation[item].status;
            if (status === 'valid' || status === 'invalid' || status === 'warning') {
                completed++;
            }
        }
        return Math.round((completed / 3) * 100);
    };

    const renderValidationItem = (
        name: string,
        status: string,
        message: string
    ) => (
        <li className="validation-item">
            <span className={`status-icon ${status}`} />
            <div className="validation-text">
                <strong>{name}</strong>
                {message && <div className={`validation-message ${status}`}>{message}</div>}
            </div>
        </li>
    );

    return (
        <Panel title="검증 상태">
            {validation.isValidating && (
                <div className="progress-container">
                    <div style={{ marginBottom: '4px', fontSize: '12px' }}>{getProgress()}%</div>
                    <div className="progress-track">
                        <div className="progress-bar" style={{ width: `${getProgress()}%` }} />
                    </div>
                </div>
            )}

            <ul className="validation-list">
                {renderValidationItem(
                    '프로젝트',
                    validation.projectValid ? 'valid' : 'invalid',
                    validation.projectValid ? '레거시 웹 프로젝트 구조 확인됨' : '레거시 웹 프로젝트 구조가 감지되지 않음',
                )}
                {renderValidationItem('Gradle', validation.gradle.status, validation.gradle.message)}
                {renderValidationItem('JDK', validation.jdk.status, validation.jdk.message)}
                {renderValidationItem('Tomcat', validation.tomcat.status, validation.tomcat.message)}
            </ul>

            <ButtonGroup style={{ marginTop: '12px' }}>
                <Button
                    onClick={onValidateAll}
                    disabled={!canValidate || validation.isValidating}
                >
                    {validation.isValidating ? '검증 중...' : '전체 검증'}
                </Button>
            </ButtonGroup>

            {!canValidate && (
                <p className="validation-message" style={{ marginTop: '8px' }}>
                    검증하기 전에 모든 경로를 설정해주세요.
                </p>
            )}
        </Panel>
    );
};
