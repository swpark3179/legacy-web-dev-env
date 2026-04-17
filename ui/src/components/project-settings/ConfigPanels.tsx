import React from 'react';
import { Panel, Button, ButtonGroup } from '../common';

interface homeSettingsPanelProps {
    onSetupHomeSettings: () => void;
}

export const HomeSettingsPanel: React.FC<homeSettingsPanelProps> = ({ onSetupHomeSettings }) => {
    return (
        <Panel title="사용자 홈 설정">
            <p className="panel-description">
                사용자 홈 폴더의 .gradle 및 .gitconfig 관련 설정을 적용합니다.
            </p>
            <div className="settings-options">
                <div className="option-item always-applied">
                    <span className="option-icon" aria-hidden="true">✓</span>
                    <div className="option-content">
                        <span className="option-label">프록시 설정</span>
                        <span className="option-desc">
                            프록시 url: 60.200.254.1:9090<br />예외 url 처리 포함
                        </span>
                    </div>
                </div>
            </div>
            <ButtonGroup style={{ marginTop: '16px' }}>
                <Button onClick={onSetupHomeSettings}>사용자 홈 설정 적용</Button>
            </ButtonGroup>
        </Panel>
    );
};

