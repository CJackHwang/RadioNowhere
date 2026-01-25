import { IApiSettings, ApiType, TTSProvider } from '@shared/services/storage-service/settings';

export type TestStatus = "idle" | "testing" | "success" | "error";

export interface SettingsPanelState {
    settings: IApiSettings;
    testStatus: TestStatus;
    testMessage: string;
    saved: boolean;
    models: string[];
    loadingModels: boolean;
    showModelDropdown: boolean;
    ttsTestStatus: TestStatus;
    ttsTestMessage: string;
}

export interface SettingsPanelActions {
    handleChange: (field: keyof IApiSettings, value: string | boolean | number) => void;
    handleSave: () => void;
    handleTest: () => Promise<void>;
    handleFetchModels: () => Promise<void>;
    handleTtsTest: () => Promise<void>;
    handleSelectModel: (model: string) => void;
    setShowModelDropdown: (show: boolean) => void;
}
