// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            MQTTServerIp: string;
            MQTTUsername: string;
            MQTTPassword: string;
            MQTTServerPort: number;
            MQTTUseServer: boolean;
            unseenTime: number;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
