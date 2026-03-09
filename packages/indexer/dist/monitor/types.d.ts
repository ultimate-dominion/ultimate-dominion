export type ServiceName = 'base-node' | 'relayer' | 'indexer' | 'client-prod' | 'client-beta' | 'api';
export type ServiceStatus = 'up' | 'down' | 'degraded' | 'unknown';
export interface ServiceCheckResult {
    status: ServiceStatus;
    latencyMs: number;
    details?: Record<string, unknown>;
    error?: string;
}
export interface ServiceState {
    currentStatus: ServiceStatus;
    lastChange: number;
    consecutiveFailures: number;
    history: ServiceCheckResult[];
    lastCheck: ServiceCheckResult | null;
}
export interface AlertEvent {
    service: ServiceName;
    previousStatus: ServiceStatus;
    newStatus: ServiceStatus;
    details?: string;
    timestamp: number;
}
