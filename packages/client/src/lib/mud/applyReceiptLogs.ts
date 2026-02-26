/**
 * Applies MUD Store event logs from a transaction receipt directly into the
 * RECS component store. This bypasses the independent block polling loop,
 * giving instant UI updates with confirmed on-chain state.
 *
 * Used by the embedded wallet path where the receipt arrives via viem polling
 * but RECS sync runs on a separate, slower schedule.
 */

import { spliceHex } from '@latticexyz/common';
import { decodeValueArgs } from '@latticexyz/protocol-parser/internal';
import { getComponentValue, removeComponent, setComponent } from '@latticexyz/recs';
import type { World } from '@latticexyz/recs';
import { hexKeyTupleToEntity } from '@latticexyz/store-sync/recs';
import { type Log, concatHex, parseAbi, parseEventLogs, size } from 'viem';

const storeEventsAbi = parseAbi([
  'event Store_SetRecord(bytes32 indexed tableId, bytes32[] keyTuple, bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'event Store_SpliceStaticData(bytes32 indexed tableId, bytes32[] keyTuple, uint48 start, bytes data)',
  'event Store_SpliceDynamicData(bytes32 indexed tableId, bytes32[] keyTuple, uint8 dynamicFieldIndex, uint48 start, uint40 deleteCount, bytes32 encodedLengths, bytes data)',
  'event Store_DeleteRecord(bytes32 indexed tableId, bytes32[] keyTuple)',
]);

type ReceiptLog = Log<bigint, number, false>;

export function applyReceiptLogs(
  world: World,
  receiptLogs: readonly ReceiptLog[],
): number {
  // Parse only MUD Store events from the receipt
  const mudLogs = parseEventLogs({
    abi: storeEventsAbi,
    logs: receiptLogs as any,
    strict: false,
  });

  let applied = 0;

  for (const log of mudLogs) {
    if (!log.eventName || !log.args) continue;

    const args = log.args as Record<string, any>;
    const tableId = args.tableId as string;

    // Find the RECS component registered for this tableId
    const component = world.components.find(
      (c: any) => c.id === tableId,
    );
    if (!component) continue;

    // Get the value schema from component metadata
    const valueSchema = (component as any).metadata?.valueSchema;
    if (!valueSchema) continue;

    const entity = hexKeyTupleToEntity(args.keyTuple);

    if (log.eventName === 'Store_SetRecord') {
      const value = decodeValueArgs(valueSchema, args);
      setComponent(component, entity, {
        ...value,
        __staticData: args.staticData,
        __encodedLengths: args.encodedLengths,
        __dynamicData: args.dynamicData,
      });
      applied++;
    } else if (log.eventName === 'Store_SpliceStaticData') {
      const previousValue = getComponentValue(component, entity) as any;
      const previousStaticData = previousValue?.__staticData ?? '0x';
      const newStaticData = spliceHex(
        previousStaticData,
        args.start,
        size(args.data),
        args.data,
      );
      const newValue = decodeValueArgs(valueSchema, {
        staticData: newStaticData,
        encodedLengths: previousValue?.__encodedLengths ?? '0x',
        dynamicData: previousValue?.__dynamicData ?? '0x',
      });
      setComponent(component, entity, {
        ...newValue,
        __staticData: newStaticData,
      });
      applied++;
    } else if (log.eventName === 'Store_SpliceDynamicData') {
      const previousValue = getComponentValue(component, entity) as any;
      const previousDynamicData = previousValue?.__dynamicData ?? '0x';
      const newDynamicData = spliceHex(
        previousDynamicData,
        args.start,
        args.deleteCount,
        args.data,
      );
      const newValue = decodeValueArgs(valueSchema, {
        staticData: previousValue?.__staticData ?? '0x',
        encodedLengths: args.encodedLengths,
        dynamicData: newDynamicData,
      });
      setComponent(component, entity, {
        ...newValue,
        __encodedLengths: args.encodedLengths,
        __dynamicData: newDynamicData,
      });
      applied++;
    } else if (log.eventName === 'Store_DeleteRecord') {
      removeComponent(component, entity);
      applied++;
    }
  }

  return applied;
}
