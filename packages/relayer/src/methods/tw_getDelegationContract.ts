import { config } from '../config.js';

export async function handleGetDelegationContract(): Promise<{
  delegationContract: string;
}> {
  return { delegationContract: config.delegationContract };
}
