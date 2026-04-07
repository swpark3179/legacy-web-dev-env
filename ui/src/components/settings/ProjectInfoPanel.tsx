import React from 'react';
import type { Settings, ValidationState } from '../../types';
import { Panel } from '../common';

export const ProjectInfoPanel: React.FC<{ settings: Settings, validation: ValidationState }> = ({ settings, validation }) => {
    return (
        <Panel title="프로젝트">
            <div className="project-info">
                <div className="project-path">
                    <span className="label">작업 폴더:</span>
                    <span className="value">{settings.projectRoot || '폴더가 열려있지 않음'}</span>
                </div>
                <div className={`project-status ${validation.projectValid ? 'valid' : 'invalid'}`}>
                    <span className={`status-icon ${validation.projectValid ? 'valid' : 'invalid'}`}>
                        {validation.projectValid ? '✓' : '✗'}
                    </span>
                    <span className="status-message">
                        {validation.projectValid ? '레거시 웹 프로젝트 구조 확인됨' : '레거시 웹 프로젝트 구조가 감지되지 않음'}
                    </span>
                </div>
            </div>
        </Panel>
    );
};
