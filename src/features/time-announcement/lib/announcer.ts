/**
 * Time Announcement Service - 整点报时服务
 * 在整点和半点播放报时音频
 */

import { ttsAgent } from '@features/tts/lib/tts-agent';
import { audioMixer } from '@shared/services/audio-service/mixer';
import { radioMonitor } from '@shared/services/monitor-service';
import { TIME_ANNOUNCEMENT } from '@shared/utils/constants';

// ================== Types ==================

interface TimeAnnouncementState {
    isActive: boolean;
    nextAnnouncementTime: Date | null;
    preparedAudio: ArrayBuffer | null;
    checkInterval: NodeJS.Timeout | null;
    isPlaying: boolean; // 防止重复触发
    isPreparing: boolean; // 防止重复生成
}

// ================== Constants ==================

const JINGLE_PATH = '/整点报时5s.mp3';
const TRIGGER_BEFORE_MS = TIME_ANNOUNCEMENT.TRIGGER_BEFORE_MS;
const RESUME_DELAY_MS = TIME_ANNOUNCEMENT.RESUME_DELAY_MS;
const CHECK_INTERVAL_MS = TIME_ANNOUNCEMENT.CHECK_INTERVAL_MS;

// ================== Service ==================

class TimeAnnouncementService {
    private state: TimeAnnouncementState = {
        isActive: false,
        nextAnnouncementTime: null,
        preparedAudio: null,
        checkInterval: null,
        isPlaying: false,
        isPreparing: false
    };

    private pausedState: {
        wasMusicPlaying: boolean;
        wasVoicePlaying: boolean;
    } | null = null;

    /**
     * 启动报时服务
     */
    start(): void {
        if (this.state.isActive) return;

        this.state.isActive = true;
        this.state.isPlaying = false;
        this.state.isPreparing = false;
        this.state.nextAnnouncementTime = this.calculateNextAnnouncementTime();

        radioMonitor.log('DIRECTOR', `Time announcement started. Next: ${this.state.nextAnnouncementTime?.toLocaleTimeString()}`, 'info');

        // 开始定期检查
        this.state.checkInterval = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    }

    /**
     * 停止报时服务
     */
    stop(): void {
        this.state.isActive = false;
        this.state.isPlaying = false;
        if (this.state.checkInterval) {
            clearInterval(this.state.checkInterval);
            this.state.checkInterval = null;
        }
        this.state.preparedAudio = null;
        this.state.nextAnnouncementTime = null;
        this.state.isPreparing = false;
    }

    /**
     * 计算下一个报时时间（整点或半点）
     */
    private calculateNextAnnouncementTime(): Date {
        const now = new Date();
        const next = new Date(now);

        const minutes = now.getMinutes();

        if (minutes < 30) {
            // 下一个是本小时的30分
            next.setMinutes(30, 0, 0);
        } else {
            // 下一个是下一小时的整点
            next.setHours(now.getHours() + 1, 0, 0, 0);
        }

        return next;
    }

    /**
     * 生成报时文本
     */
    private generateAnnouncementText(time: Date): string {
        const hour = time.getHours();
        const minute = time.getMinutes();

        // 时段描述
        let period = '';
        if (hour >= 5 && hour < 8) period = '早上';
        else if (hour >= 8 && hour < 12) period = '上午';
        else if (hour >= 12 && hour < 14) period = '中午';
        else if (hour >= 14 && hour < 18) period = '下午';
        else if (hour >= 18 && hour < 22) period = '晚上';
        else period = '深夜';

        const hourText = hour > 12 ? hour - 12 : hour;
        const minuteText = minute === 0 ? '整' : '三十分';

        return `现在是北京时间，${period}${hourText}点${minuteText}。`;
    }

    /**
     * 定期检查是否需要准备或播放报时
     */
    private async check(): Promise<void> {
        if (!this.state.isActive || !this.state.nextAnnouncementTime) return;

        // 如果正在播放或正在准备，跳过检查
        if (this.state.isPlaying || this.state.isPreparing) return;

        const now = Date.now();
        const targetTime = this.state.nextAnnouncementTime.getTime();
        const timeUntil = targetTime - now;

        // 如果还没准备 TTS，立即开始准备（只要时间还够）
        if (!this.state.preparedAudio && timeUntil > TRIGGER_BEFORE_MS) {
            await this.prepareTTS();
        }

        // 提前6秒触发播放（只触发一次）
        if (timeUntil <= TRIGGER_BEFORE_MS && timeUntil > 0 && this.state.preparedAudio && !this.state.isPlaying) {
            this.state.isPlaying = true; // 立即设置标志，防止重复触发
            await this.playAnnouncement();
        }
    }

    /**
     * 准备报时TTS
     */
    private async prepareTTS(): Promise<void> {
        if (!this.state.nextAnnouncementTime) return;

        this.state.isPreparing = true;

        try {
            const text = this.generateAnnouncementText(this.state.nextAnnouncementTime);
            radioMonitor.log('DIRECTOR', `Preparing time announcement: ${text}`, 'info');

            // 使用严肃的报时音色
            const result = await ttsAgent.generateSpeech(
                text,
                'announcer',
                { mood: 'serious' }
            );

            if (result.success && result.audioData) {
                this.state.preparedAudio = result.audioData;
                radioMonitor.log('DIRECTOR', 'Time announcement TTS ready', 'info');
            }
        } catch (error) {
            radioMonitor.log('DIRECTOR', `Failed to prepare time announcement: ${error}`, 'error');
        } finally {
            this.state.isPreparing = false;
        }
    }

    /**
     * 播放报时
     */
    private async playAnnouncement(): Promise<void> {
        if (!this.state.preparedAudio) {
            this.state.isPlaying = false;
            return;
        }

        radioMonitor.log('DIRECTOR', 'Playing time announcement', 'info');

        // 1. 暂停当前音频
        this.pausedState = {
            wasMusicPlaying: audioMixer.getState().music.isPlaying,
            wasVoicePlaying: audioMixer.getState().voice.isPlaying
        };
        audioMixer.pauseAll();

        try {
            // 2. 播放 jingle（5秒倒计时铃声）
            await this.playJingle();

            // 3. 播放报时 TTS
            await audioMixer.playVoice(this.state.preparedAudio);

            // 4. 等待 3 秒
            await this.delay(RESUME_DELAY_MS);

        } catch (error) {
            radioMonitor.log('DIRECTOR', `Time announcement error: ${error}`, 'error');
        }

        // 5. 恢复原音频
        if (this.pausedState?.wasMusicPlaying) {
            audioMixer.resumeMusic();
        }
        this.pausedState = null;

        // 6. 重置状态，计算下一次报时
        this.state.preparedAudio = null;
        this.state.isPlaying = false;
        this.state.nextAnnouncementTime = this.calculateNextAnnouncementTime();
        radioMonitor.log('DIRECTOR', `Next announcement: ${this.state.nextAnnouncementTime.toLocaleTimeString()}`, 'info');
    }

    /**
     * 播放 Jingle
     */
    private async playJingle(): Promise<void> {
        return new Promise((resolve) => {
            const audio = new Audio(JINGLE_PATH);
            audio.volume = 0.8;
            audio.onended = () => resolve();
            audio.onerror = () => resolve(); // 即使失败也继续
            audio.play().catch(() => resolve());
        });
    }

    /**
     * 延迟
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取下一次报时时间
     */
    getNextAnnouncementTime(): Date | null {
        return this.state.nextAnnouncementTime;
    }
}

export const timeAnnouncementService = new TimeAnnouncementService();
