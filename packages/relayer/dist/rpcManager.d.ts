export declare function startRpcHealthCheck(): void;
export declare function stopRpcHealthCheck(): void;
export declare function isUsingFallback(): boolean;
export declare function getRpcStatus(): {
    primaryHealthy: boolean;
    consecutiveFailures: number;
    fallbackConfigured: boolean;
    active: string;
    lastCheckTime: string | null;
};
