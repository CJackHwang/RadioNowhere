/**
 * Mail Queue - 听众来信队列系统
 * 实时收集用户留言，供 Director 在每个节目周期消费
 */

export interface MailItem {
    id: string;
    content: string;
    timestamp: number;
    processed: boolean;
}

class MailQueue {
    private queue: MailItem[] = [];
    private listeners: ((mail: MailItem) => void)[] = [];

    /**
     * 添加听众留言
     */
    push(content: string): MailItem {
        const mail: MailItem = {
            id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            content: content.trim(),
            timestamp: Date.now(),
            processed: false
        };
        this.queue.push(mail);
        this.listeners.forEach(fn => fn(mail));
        console.log('[MailQueue] New mail added:', mail.id);
        return mail;
    }

    /**
     * 获取下一封未处理的来信（FIFO）
     */
    getNext(): MailItem | null {
        const mail = this.queue.find(m => !m.processed);
        if (mail) {
            mail.processed = true;
            console.log('[MailQueue] Mail consumed:', mail.id);
        }
        return mail || null;
    }

    /**
     * 获取所有未处理的来信
     */
    getPending(): MailItem[] {
        return this.queue.filter(m => !m.processed);
    }

    /**
     * 获取队列状态
     */
    getStatus(): { total: number; pending: number; processed: number } {
        const pending = this.queue.filter(m => !m.processed).length;
        return {
            total: this.queue.length,
            pending,
            processed: this.queue.length - pending
        };
    }

    /**
     * 监听新邮件
     */
    onMail(callback: (mail: MailItem) => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(fn => fn !== callback);
        };
    }

    /**
     * 清空队列
     */
    clear(): void {
        this.queue = [];
    }
}

// 单例导出
export const mailQueue = new MailQueue();
