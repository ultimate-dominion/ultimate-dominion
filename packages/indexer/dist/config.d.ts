import 'dotenv/config';
export declare const config: {
    readonly database: {
        readonly url: string;
    };
    readonly chain: {
        readonly rpcHttpUrl: string;
        readonly rpcWsUrl: string;
        readonly chainId: number;
    };
    readonly world: {
        readonly address: `0x${string}`;
        readonly startBlock: bigint;
    };
    readonly server: {
        readonly port: number;
        readonly corsOrigins: string[];
    };
    readonly cleanup: {
        readonly privateKey: `0x${string}`;
    };
};
