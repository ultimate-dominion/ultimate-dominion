import { describe, test, expect, beforeAll } from "vitest";
import type { Hex } from "viem";
import {
  createTestWallet,
  sendTx,
  readWorld,
  simulateAndSend,
  uniqueName,
  Race,
  PowerSource,
  ArmorType,
  type TestWallet,
} from "./setup";
import { runDiscovery, type DiscoveryResult } from "./discovery";
import {
  getOrCreateCharacter,
  adminBoostToLevel,
  adminDropGold,
} from "./helpers";

// ---------------------------------------------------------------------------
// Guild System Smoke Tests
// ---------------------------------------------------------------------------

let discovery: DiscoveryResult;
let leader: TestWallet;
let officer: TestWallet;
let member: TestWallet;
let leaderCharId: Hex;
let officerCharId: Hex;
let memberCharId: Hex;
let guildId: bigint;

beforeAll(async () => {
  console.log("[guild] Running discovery...");
  discovery = await runDiscovery();

  console.log("[guild] Creating test wallets...");
  leader = await createTestWallet("guild_leader");
  officer = await createTestWallet("guild_officer");
  member = await createTestWallet("guild_member");
  console.log(`[guild] Leader:  ${leader.address}`);
  console.log(`[guild] Officer: ${officer.address}`);
  console.log(`[guild] Member:  ${member.address}`);

  console.log("[guild] Creating characters...");
  const leaderResult = await getOrCreateCharacter(leader.wallet, {
    name: uniqueName("g_lead"),
    race: Race.Human,
    powerSource: PowerSource.Physical,
    armorType: ArmorType.Plate,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  leaderCharId = leaderResult.characterId;

  const officerResult = await getOrCreateCharacter(officer.wallet, {
    name: uniqueName("g_off"),
    race: Race.Elf,
    powerSource: PowerSource.Weave,
    armorType: ArmorType.Leather,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  officerCharId = officerResult.characterId;

  const memberResult = await getOrCreateCharacter(member.wallet, {
    name: uniqueName("g_mem"),
    race: Race.Dwarf,
    powerSource: PowerSource.Divine,
    armorType: ArmorType.Cloth,
    starterWeaponId: discovery.starterItems.weapons[0],
    starterArmorId: discovery.starterItems.armors[0],
  });
  memberCharId = memberResult.characterId;

  // Boost all to level 5
  await adminBoostToLevel(leaderCharId, 5);
  await adminBoostToLevel(officerCharId, 5);
  await adminBoostToLevel(memberCharId, 5);

  // Give leader gold for guild creation (costs 100 gold)
  await adminDropGold(leaderCharId, 200n * 10n ** 18n);

  // If the leader is already in a guild from a previous run, try to disband it
  try {
    const alreadyInGuild = (await readWorld("UD__isGuildMember", [
      leaderCharId,
    ])) as boolean;
    if (alreadyInGuild) {
      console.log("[guild] Leader already in guild — attempting disband...");
      // Kick any lingering members first (officer/member might still be in)
      for (const charId of [officerCharId, memberCharId]) {
        try {
          const inGuild = (await readWorld("UD__isGuildMember", [
            charId,
          ])) as boolean;
          if (inGuild) {
            await sendTx(leader.wallet, "UD__kickMember", [
              leaderCharId,
              charId,
            ]);
          }
        } catch {}
      }
      await sendTx(leader.wallet, "UD__disbandGuild", [leaderCharId]);
      console.log("[guild] Previous guild disbanded");
    }
  } catch (err: any) {
    console.log(
      `[guild] Pre-cleanup note: ${err.message?.slice(0, 100)}`,
    );
  }

  // Also clean up officer and member if they're stuck in a guild
  for (const [wallet, charId, label] of [
    [officer.wallet, officerCharId, "officer"],
    [member.wallet, memberCharId, "member"],
  ] as const) {
    try {
      const inGuild = (await readWorld("UD__isGuildMember", [
        charId,
      ])) as boolean;
      if (inGuild) {
        console.log(`[guild] ${label} stuck in guild — leaving...`);
        await sendTx(wallet, "UD__leaveGuild", [charId]);
      }
    } catch {}
  }

  console.log(`[guild] Leader char:  ${leaderCharId}`);
  console.log(`[guild] Officer char: ${officerCharId}`);
  console.log(`[guild] Member char:  ${memberCharId}`);
}, 120_000);

// ---------------------------------------------------------------------------
// Phase 2 — Guild Creation
// ---------------------------------------------------------------------------

describe("Phase 2 — Guild Creation", () => {
  test(
    "leader creates a guild",
    async () => {
      const { result } = await simulateAndSend<bigint>(
        leader.wallet,
        "UD__createGuild",
        [leaderCharId, "Smoke Guild", "SMKE", true, "Test guild"],
      );
      guildId = result;

      expect(guildId).toBeGreaterThan(0n);

      const isMember = (await readWorld("UD__isGuildMember", [
        leaderCharId,
      ])) as boolean;
      expect(isMember).toBe(true);

      console.log(`[guild] Guild created with ID: ${guildId}`);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 3 — Guild Membership (open guild)
// ---------------------------------------------------------------------------

describe("Phase 3 — Guild Membership (open guild)", () => {
  test(
    "member joins the open guild",
    async () => {
      await sendTx(member.wallet, "UD__joinGuild", [memberCharId, guildId]);

      const isMember = (await readWorld("UD__isGuildMember", [
        memberCharId,
      ])) as boolean;
      expect(isMember).toBe(true);

      console.log("[guild] Member joined guild");
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 4 — Guild Management
// ---------------------------------------------------------------------------

describe("Phase 4 — Guild Management", () => {
  test(
    "leader promotes member to officer",
    async () => {
      await sendTx(leader.wallet, "UD__promoteMember", [
        leaderCharId,
        memberCharId,
      ]);
      console.log("[guild] Member promoted to officer");
    },
    60_000,
  );

  test(
    "leader sets tax rate to 10%",
    async () => {
      await sendTx(leader.wallet, "UD__setTaxRate", [leaderCharId, 1000n]);
      console.log("[guild] Tax rate set to 1000 bps (10%)");
    },
    60_000,
  );

  test(
    "leader sets description",
    async () => {
      await sendTx(leader.wallet, "UD__setDescription", [
        leaderCharId,
        "Updated smoke test guild description",
      ]);
      console.log("[guild] Description updated");
    },
    60_000,
  );

  test(
    "getGuildBonus returns non-zero values",
    async () => {
      const [goldBonus, xpBonus, dropBonus] = (await readWorld(
        "UD__getGuildBonus",
        [],
      )) as [bigint, bigint, bigint];

      expect(goldBonus).toBeGreaterThan(0n);
      expect(xpBonus).toBeGreaterThan(0n);
      expect(dropBonus).toBeGreaterThan(0n);

      console.log(
        `[guild] Guild bonuses — gold: ${goldBonus}, xp: ${xpBonus}, drop: ${dropBonus}`,
      );
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 5 — Leave & Kick
// ---------------------------------------------------------------------------

describe("Phase 5 — Leave & Kick", () => {
  test(
    "officer (promoted member) leaves guild",
    async () => {
      // The member was promoted to officer in phase 4
      await sendTx(member.wallet, "UD__leaveGuild", [memberCharId]);

      const isMember = (await readWorld("UD__isGuildMember", [
        memberCharId,
      ])) as boolean;
      expect(isMember).toBe(false);

      console.log("[guild] Officer (formerly member) left guild");
    },
    60_000,
  );

  test(
    "member re-joins the open guild",
    async () => {
      await sendTx(member.wallet, "UD__joinGuild", [memberCharId, guildId]);

      const isMember = (await readWorld("UD__isGuildMember", [
        memberCharId,
      ])) as boolean;
      expect(isMember).toBe(true);

      console.log("[guild] Member re-joined guild");
    },
    60_000,
  );

  test(
    "leader kicks member",
    async () => {
      await sendTx(leader.wallet, "UD__kickMember", [
        leaderCharId,
        memberCharId,
      ]);

      const isMember = (await readWorld("UD__isGuildMember", [
        memberCharId,
      ])) as boolean;
      expect(isMember).toBe(false);

      console.log("[guild] Leader kicked member");
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 6 — Closed Guild Flow
// ---------------------------------------------------------------------------

describe("Phase 6 — Closed Guild Flow", () => {
  test(
    "leader sets guild to closed",
    async () => {
      await sendTx(leader.wallet, "UD__setIsOpen", [leaderCharId, false]);
      console.log("[guild] Guild set to closed");
    },
    60_000,
  );

  test(
    "member applies to closed guild",
    async () => {
      await sendTx(member.wallet, "UD__applyToGuild", [
        memberCharId,
        guildId,
      ]);
      console.log("[guild] Member applied to closed guild");
    },
    60_000,
  );

  test(
    "leader approves application",
    async () => {
      await sendTx(leader.wallet, "UD__approveApplication", [
        leaderCharId,
        memberCharId,
      ]);

      const isMember = (await readWorld("UD__isGuildMember", [
        memberCharId,
      ])) as boolean;
      expect(isMember).toBe(true);

      console.log("[guild] Leader approved application — member is back in");
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------
// Phase 7 — Disband
// ---------------------------------------------------------------------------

describe("Phase 7 — Disband", () => {
  test(
    "member leaves before disband",
    async () => {
      await sendTx(member.wallet, "UD__leaveGuild", [memberCharId]);

      const isMember = (await readWorld("UD__isGuildMember", [
        memberCharId,
      ])) as boolean;
      expect(isMember).toBe(false);

      console.log("[guild] Member left guild before disband");
    },
    60_000,
  );

  test(
    "leader disbands guild",
    async () => {
      await sendTx(leader.wallet, "UD__disbandGuild", [leaderCharId]);

      const isMember = (await readWorld("UD__isGuildMember", [
        leaderCharId,
      ])) as boolean;
      expect(isMember).toBe(false);

      console.log("[guild] Guild disbanded");
    },
    60_000,
  );
});
