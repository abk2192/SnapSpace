/**
 * Lightweight Event Bus (Publish/Subscribe)
 * Used to decouple ViewModels and Services.
 */
class PubSub {
    constructor() {
        this.events = {};
    }

    subscribe(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        // Return an unsubscribe function
        return () => this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    publish(event, data) {
        if (this.events[event]) this.events[event].forEach(cb => cb(data));
    }
}

export const globalEvents = new PubSub();