import {
  Avatar,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  FaCrown,
  FaShieldAlt,
  FaSignOutAlt,
  FaTrash,
  FaUserMinus,
  FaUserPlus,
} from 'react-icons/fa';
import { GiTwoCoins } from 'react-icons/gi';
import { useNavigate } from 'react-router-dom';
import { formatEther } from 'viem';
import { Pagination } from '../components/Pagination';
import { PolygonalCard } from '../components/PolygonalCard';
import { useCharacter } from '../contexts/CharacterContext';
import { useAuth } from '../contexts/AuthContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import {
  encodeBytes32Key,
  toBigInt,
  toNumber,
  useGameTable,
  useGameValue,
} from '../lib/gameStore';
import { CHARACTERS_PATH, HOME_PATH } from '../Routes';

const MEMBERS_PER_PAGE = 10;

// Guild role constants
const ROLE_MEMBER = 0;
const ROLE_OFFICER = 1;
const ROLE_LEADER = 2;

type GuildEntry = {
  guildId: string;
  name: string;
  tag: string;
  description: string;
  isOpen: boolean;
  memberCount: number;
  treasury: bigint;
  leaderId: string;
};

type MemberEntry = {
  characterId: string;
  characterName: string;
  characterImage?: string;
  role: number;
  joinedAt: number;
};

type ApplicationEntry = {
  characterId: string;
  characterName: string;
  characterImage?: string;
  appliedAt: number;
};

// ---------- Create Guild Modal ----------

type CreateGuildModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    tag: string,
    isOpen: boolean,
    description: string,
  ) => Promise<void>;
  isCreating: boolean;
};

const CreateGuildModal: React.FC<CreateGuildModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}) => {
  const { t } = useTranslation('ui');
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [isOpenGuild, setIsOpenGuild] = useState(true);
  const [description, setDescription] = useState('');

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !tag.trim()) return;
    await onCreate(name.trim(), tag.trim(), isOpenGuild, description.trim());
    setName('');
    setTag('');
    setIsOpenGuild(true);
    setDescription('');
  }, [name, tag, isOpenGuild, description, onCreate]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          <Text>{t('guild.createModal.title')}</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 6, sm: 8 }}>
          <VStack gap={4}>
            <FormControl isRequired>
              <FormLabel color="#8A7E6A" fontSize="sm">
                {t('guild.createModal.nameLabel')}
              </FormLabel>
              <Input
                isDisabled={isCreating}
                maxLength={24}
                onChange={e => setName(e.target.value)}
                placeholder={t('guild.createModal.namePlaceholder')}
                value={name}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="#8A7E6A" fontSize="sm">
                {t('guild.createModal.tagLabel')}
              </FormLabel>
              <Input
                isDisabled={isCreating}
                maxLength={5}
                onChange={e => setTag(e.target.value.toUpperCase())}
                placeholder={t('guild.createModal.tagPlaceholder')}
                value={tag}
              />
            </FormControl>
            <FormControl>
              <HStack justify="space-between">
                <FormLabel color="#8A7E6A" fontSize="sm" mb={0}>
                  {t('guild.createModal.openLabel')}
                </FormLabel>
                <Switch
                  colorScheme="yellow"
                  isChecked={isOpenGuild}
                  isDisabled={isCreating}
                  onChange={e => setIsOpenGuild(e.target.checked)}
                />
              </HStack>
            </FormControl>
            <FormControl>
              <FormLabel color="#8A7E6A" fontSize="sm">
                {t('guild.createModal.descLabel')}
              </FormLabel>
              <Textarea
                height="100px"
                isDisabled={isCreating}
                maxLength={200}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('guild.createModal.descPlaceholder')}
                value={description}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} variant="ghost">
            {t('guild.createModal.cancel')}
          </Button>
          <Button
            isDisabled={!name.trim() || !tag.trim()}
            isLoading={isCreating}
            loadingText={t('guild.createModal.creating')}
            onClick={handleCreate}
          >
            {t('guild.createModal.create')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// ---------- Withdraw Treasury Modal ----------

type WithdrawModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onWithdraw: (amount: string) => Promise<void>;
  isWithdrawing: boolean;
  maxAmount: bigint;
};

const WithdrawTreasuryModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  onWithdraw,
  isWithdrawing,
  maxAmount,
}) => {
  const { t } = useTranslation('ui');
  const [amount, setAmount] = useState('');

  const handleWithdraw = useCallback(async () => {
    if (!amount) return;
    await onWithdraw(amount);
    setAmount('');
  }, [amount, onWithdraw]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          <Text>{t('guild.withdrawModal.title')}</Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody px={{ base: 6, sm: 8 }}>
          <VStack gap={4}>
            <Text color="#8A7E6A" fontSize="sm">
              {t('guild.withdrawModal.available', { amount: Number(formatEther(maxAmount)).toLocaleString() })}
            </Text>
            <FormControl>
              <Input
                isDisabled={isWithdrawing}
                onChange={e => setAmount(e.target.value)}
                placeholder={t('guild.withdrawModal.amountPlaceholder')}
                type="number"
                value={amount}
              />
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button onClick={onClose} variant="ghost">
            {t('guild.withdrawModal.cancel')}
          </Button>
          <Button
            isDisabled={!amount || Number(amount) <= 0}
            isLoading={isWithdrawing}
            loadingText={t('guild.withdrawModal.withdrawing')}
            onClick={handleWithdraw}
          >
            {t('guild.withdrawModal.withdraw')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// ---------- Guild Directory (no guild) ----------

type GuildDirectoryProps = {
  guilds: GuildEntry[];
  onJoin: (guildId: string) => Promise<void>;
  onApply: (guildId: string) => Promise<void>;
  onOpenCreate: () => void;
  isJoining: boolean;
};

const GuildDirectory: React.FC<GuildDirectoryProps> = ({
  guilds,
  onJoin,
  onApply,
  onOpenCreate,
  isJoining,
}) => {
  const { t } = useTranslation('ui');
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(1);

  const pagedGuilds = useMemo(
    () =>
      guilds.slice(
        (page - 1) * MEMBERS_PER_PAGE,
        page * MEMBERS_PER_PAGE,
      ),
    [guilds, page],
  );

  return (
    <VStack spacing={4} w="100%">
      <Flex
        align="center"
        justify="space-between"
        px={4}
        pt={2}
        w="100%"
      >
        <Text color="#8A7E6A" fontSize="sm">
          {t('guild.directory.count', { count: guilds.length })}
        </Text>
        <Button onClick={onOpenCreate} size="sm">
          {t('guild.directory.createButton')}
        </Button>
      </Flex>

      <VStack spacing={0} w="100%">
        <Box
          bgColor="rgba(196,184,158,0.08)"
          boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
          h="5px"
          w="100%"
        />
        {pagedGuilds.length > 0 ? (
          pagedGuilds.map(guild => (
            <Box key={guild.guildId} w="100%">
              <HStack px={4} py={3} spacing={3} w="100%">
                <VStack align="start" flex={1} spacing={0}>
                  <HStack spacing={2}>
                    <Text color="#E8DCC8" fontWeight={600} fontSize="sm">
                      {guild.name}
                    </Text>
                    <Text
                      bg="rgba(200,169,110,0.15)"
                      borderRadius="sm"
                      color="#C8A96E"
                      fontSize="xs"
                      fontWeight={700}
                      px={1.5}
                    >
                      [{guild.tag}]
                    </Text>
                  </HStack>
                  <HStack spacing={3}>
                    <Text color="#6A6050" fontSize="xs">
                      {t('guild.directory.members', { count: guild.memberCount })}
                    </Text>
                    <Text
                      color={guild.isOpen ? '#6AAF6A' : '#AF6A6A'}
                      fontSize="xs"
                    >
                      {guild.isOpen ? t('guild.directory.open') : t('guild.directory.closed')}
                    </Text>
                  </HStack>
                </VStack>
                {guild.isOpen ? (
                  <Button
                    isLoading={isJoining}
                    onClick={() => onJoin(guild.guildId)}
                    size="xs"
                  >
                    {t('guild.directory.join')}
                  </Button>
                ) : (
                  <Button
                    isLoading={isJoining}
                    onClick={() => onApply(guild.guildId)}
                    size="xs"
                    variant="outline"
                  >
                    {t('guild.directory.apply')}
                  </Button>
                )}
              </HStack>
              <Box
                bg="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="1px"
                w="100%"
              />
            </Box>
          ))
        ) : (
          <VStack py={8} spacing={2}>
            <FaShieldAlt color="#5A5040" size={32} />
            <Text color="#8A7E6A" mt={2} fontSize="sm">
              {t('guild.directory.emptyTitle')}
            </Text>
            <Text color="#5A5040" fontSize="xs">
              {t('guild.directory.emptySubtitle')}
            </Text>
          </VStack>
        )}
      </VStack>

      <HStack my={3} visibility={guilds.length > 0 ? 'visible' : 'hidden'}>
        <Pagination
          length={guilds.length}
          page={page}
          pageLimit={pageLimit}
          perPage={MEMBERS_PER_PAGE}
          setPage={setPage}
          setPageLimit={setPageLimit}
        />
      </HStack>
    </VStack>
  );
};

// ---------- Member Row ----------

type MemberRowProps = {
  member: MemberEntry;
  isLeader: boolean;
  isOfficer: boolean;
  onPromote?: (characterId: string) => void;
  onDemote?: (characterId: string) => void;
  onKick?: (characterId: string) => void;
};

const MemberRow: React.FC<MemberRowProps> = ({
  member,
  isLeader,
  isOfficer,
  onPromote,
  onDemote,
  onKick,
}) => {
  const { t } = useTranslation('ui');
  const roleLabel =
    member.role === ROLE_LEADER
      ? t('guild.roles.leader')
      : member.role === ROLE_OFFICER
        ? t('guild.roles.officer')
        : t('guild.roles.member');

  const roleColor =
    member.role === ROLE_LEADER
      ? '#C8A96E'
      : member.role === ROLE_OFFICER
        ? '#8AB4F8'
        : '#6A6050';

  return (
    <HStack px={4} py={3} spacing={3} w="100%" _hover={{ bg: 'rgba(196,184,158,0.06)' }}>
      <Avatar size="xs" src={member.characterImage} />
      <Text
        as="a"
        color="#E8DCC8"
        flex={1}
        fontWeight={600}
        fontSize="sm"
        href={`${CHARACTERS_PATH}/${member.characterId}`}
      >
        {member.characterName}
      </Text>
      <HStack spacing={1}>
        {member.role === ROLE_LEADER && (
          <Tooltip hasArrow label={t('guild.tooltips.leader')} placement="top">
            <span>
              <FaCrown color="#C8A96E" size={12} />
            </span>
          </Tooltip>
        )}
        <Text color={roleColor} fontFamily="mono" fontSize="xs">
          {roleLabel}
        </Text>
      </HStack>
      {/* Leader can promote/demote/kick non-leaders */}
      {isLeader && member.role !== ROLE_LEADER && (
        <HStack spacing={1}>
          {member.role === ROLE_MEMBER && onPromote && (
            <Tooltip hasArrow label={t('guild.tooltips.promote')} placement="top">
              <Button
                onClick={() => onPromote(member.characterId)}
                size="xs"
                variant="ghost"
              >
                <FaUserPlus size={10} />
              </Button>
            </Tooltip>
          )}
          {member.role === ROLE_OFFICER && onDemote && (
            <Tooltip hasArrow label={t('guild.tooltips.demote')} placement="top">
              <Button
                onClick={() => onDemote(member.characterId)}
                size="xs"
                variant="ghost"
              >
                <FaUserMinus size={10} />
              </Button>
            </Tooltip>
          )}
          {onKick && (
            <Tooltip hasArrow label={t('guild.tooltips.kick')} placement="top">
              <Button
                colorScheme="red"
                onClick={() => onKick(member.characterId)}
                size="xs"
                variant="ghost"
              >
                <FaTrash size={10} />
              </Button>
            </Tooltip>
          )}
        </HStack>
      )}
      {/* Officers can kick members (not other officers or leader) */}
      {isOfficer && !isLeader && member.role === ROLE_MEMBER && onKick && (
        <Tooltip hasArrow label="Kick" placement="top">
          <Button
            colorScheme="red"
            onClick={() => onKick(member.characterId)}
            size="xs"
            variant="ghost"
          >
            <FaTrash size={10} />
          </Button>
        </Tooltip>
      )}
    </HStack>
  );
};

// ---------- Main Guild Page ----------

export const Guild = (): JSX.Element => {
  const { t } = useTranslation('ui');
  const navigate = useNavigate();
  const { isAuthenticated: isConnected, isConnecting } = useAuth();
  const { character } = useCharacter();
  const { allCharacters } = useMap();
  const { systemCalls } = useMUD();

  const guildTable = useGameTable('Guild');
  const guildMemberTable = useGameTable('GuildMember');
  const guildApplicationTable = useGameTable('GuildApplication');

  // Current player's guild membership
  const characterId = character?.id;
  const memberKey = characterId ? encodeBytes32Key(characterId) : undefined;
  const memberData = useGameValue('GuildMember', memberKey);
  const myGuildId = memberData?.guildId as string | undefined;
  const myRole = memberData ? toNumber(memberData.role) : ROLE_MEMBER;
  const isInGuild = !!myGuildId && myGuildId !== '0' && myGuildId !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  // My guild data
  const guildKey = isInGuild ? encodeBytes32Key(myGuildId) : undefined;
  const myGuildData = useGameValue('Guild', guildKey);

  // Action states
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isDisbanding, setIsDisbanding] = useState(false);
  const [taxRate, setTaxRate] = useState(0);

  const {
    isOpen: isCreateOpen,
    onOpen: onOpenCreate,
    onClose: onCloseCreate,
  } = useDisclosure();

  const {
    isOpen: isWithdrawOpen,
    onOpen: onOpenWithdraw,
    onClose: onCloseWithdraw,
  } = useDisclosure();

  // Redirect if not connected
  useEffect(() => {
    if (isConnecting) return;
    if (!isConnected) {
      navigate(HOME_PATH);
    }
  }, [isConnected, isConnecting, navigate]);

  // Sync tax rate slider to guild data
  useEffect(() => {
    if (myGuildData?.taxRate != null) {
      setTaxRate(toNumber(myGuildData.taxRate));
    }
  }, [myGuildData?.taxRate]);

  // ---------- Derived data ----------

  // All guilds for the directory
  const guilds: GuildEntry[] = useMemo(() => {
    if (!guildTable) return [];
    return Object.entries(guildTable)
      .map(([, data]) => {
        const id = data.guildId as string;
        if (!id || id === '0') return null;

        // Count members for this guild
        let memberCount = 0;
        if (guildMemberTable) {
          Object.values(guildMemberTable).forEach(m => {
            if ((m.guildId as string) === id) memberCount++;
          });
        }

        return {
          guildId: id,
          name: (data.name as string) ?? 'Unknown',
          tag: (data.tag as string) ?? '',
          description: (data.description as string) ?? '',
          isOpen: !!data.isOpen,
          memberCount,
          treasury: toBigInt(data.treasury),
          leaderId: (data.leaderId as string) ?? '',
        };
      })
      .filter((g): g is GuildEntry => g !== null);
  }, [guildTable, guildMemberTable]);

  // Guild members (filtered by my guild)
  const members: MemberEntry[] = useMemo(() => {
    if (!isInGuild || !guildMemberTable) return [];
    return Object.entries(guildMemberTable)
      .map(([, data]) => {
        if ((data.guildId as string) !== myGuildId) return null;
        const charId = data.characterId as string;
        const char = allCharacters.find(c => c.id === charId);
        return {
          characterId: charId,
          characterName: char?.name ?? 'Unknown',
          characterImage: char?.image,
          role: toNumber(data.role),
          joinedAt: toNumber(data.joinedAt),
        };
      })
      .filter((m): m is MemberEntry => m !== null)
      .sort((a, b) => b.role - a.role || a.joinedAt - b.joinedAt);
  }, [isInGuild, guildMemberTable, myGuildId, allCharacters]);

  // Pending applications for my guild
  const applications: ApplicationEntry[] = useMemo(() => {
    if (!isInGuild || !guildApplicationTable) return [];
    return Object.entries(guildApplicationTable)
      .map(([, data]) => {
        if ((data.guildId as string) !== myGuildId) return null;
        const charId = data.characterId as string;
        const char = allCharacters.find(c => c.id === charId);
        return {
          characterId: charId,
          characterName: char?.name ?? 'Unknown',
          characterImage: char?.image,
          appliedAt: toNumber(data.appliedAt),
        };
      })
      .filter((a): a is ApplicationEntry => a !== null)
      .sort((a, b) => a.appliedAt - b.appliedAt);
  }, [isInGuild, guildApplicationTable, myGuildId, allCharacters]);

  const isLeader = myRole === ROLE_LEADER;
  const isOfficer = myRole === ROLE_OFFICER;

  // Member pagination
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageLimit, setMemberPageLimit] = useState(1);

  const pagedMembers = useMemo(
    () =>
      members.slice(
        (memberPage - 1) * MEMBERS_PER_PAGE,
        memberPage * MEMBERS_PER_PAGE,
      ),
    [members, memberPage],
  );

  // ---------- Actions ----------

  const handleCreateGuild = useCallback(
    async (name: string, tag: string, isOpen: boolean, description: string) => {
      if (!characterId) return;
      setIsCreating(true);
      try {
        await systemCalls.createGuild(characterId, name, tag, isOpen, description);
        onCloseCreate();
      } finally {
        setIsCreating(false);
      }
    },
    [characterId, systemCalls, onCloseCreate],
  );

  const handleJoinGuild = useCallback(
    async (guildId: string) => {
      if (!characterId) return;
      setIsJoining(true);
      try {
        await systemCalls.joinGuild(characterId, guildId);
      } finally {
        setIsJoining(false);
      }
    },
    [characterId, systemCalls],
  );

  const handleApplyToGuild = useCallback(
    async (guildId: string) => {
      if (!characterId) return;
      setIsJoining(true);
      try {
        await systemCalls.applyToGuild(characterId, guildId);
      } finally {
        setIsJoining(false);
      }
    },
    [characterId, systemCalls],
  );

  const handleLeaveGuild = useCallback(async () => {
    if (!characterId) return;
    setIsLeaving(true);
    try {
      await systemCalls.leaveGuild(characterId);
    } finally {
      setIsLeaving(false);
    }
  }, [characterId, systemCalls]);

  const handleSetTaxRate = useCallback(
    async (newRate: number) => {
      if (!characterId) return;
      try {
        await systemCalls.setTaxRate(characterId, newRate);
      } catch {
        // Reset slider on failure
        if (myGuildData?.taxRate != null) {
          setTaxRate(toNumber(myGuildData.taxRate));
        }
      }
    },
    [characterId, systemCalls, myGuildData?.taxRate],
  );

  const handleWithdraw = useCallback(
    async (amount: string) => {
      if (!characterId) return;
      setIsWithdrawing(true);
      try {
        await systemCalls.withdrawTreasury(characterId, amount);
        onCloseWithdraw();
      } finally {
        setIsWithdrawing(false);
      }
    },
    [characterId, systemCalls, onCloseWithdraw],
  );

  const handleDisband = useCallback(async () => {
    if (!characterId) return;
    setIsDisbanding(true);
    try {
      await systemCalls.disbandGuild(characterId);
    } finally {
      setIsDisbanding(false);
    }
  }, [characterId, systemCalls]);

  // ---------- Render ----------

  return (
    <PolygonalCard clipPath="polygon(0% 0%, 50px 0%, calc(100% - 50px) 0%, 100% 50px, 100% 100%, 0% 100%)">
      <Helmet>
        <title>{t('guild.pageTitle')}</title>
      </Helmet>
      <VStack>
        <HStack bgColor="blue500" h="66px" px="20px" width="100%">
          <FaShieldAlt color="white" size={24} />
          <Heading color="white">{t('guild.heading')}</Heading>
        </HStack>

        {!isInGuild ? (
          // ---------- No Guild: Directory ----------
          <GuildDirectory
            guilds={guilds}
            isJoining={isJoining}
            onApply={handleApplyToGuild}
            onJoin={handleJoinGuild}
            onOpenCreate={onOpenCreate}
          />
        ) : (
          // ---------- In Guild ----------
          <VStack px={3} py={4} spacing={4} w="100%">
            {/* Guild Header */}
            <VStack spacing={1} w="100%">
              <HStack spacing={2}>
                <Heading color="#E8DCC8" size="md">
                  {(myGuildData?.name as string) ?? 'Guild'}
                </Heading>
                <Text
                  bg="rgba(200,169,110,0.15)"
                  borderRadius="sm"
                  color="#C8A96E"
                  fontSize="sm"
                  fontWeight={700}
                  px={2}
                >
                  [{(myGuildData?.tag as string) ?? ''}]
                </Text>
              </HStack>
              {myGuildData?.description && (
                <Text color="#8A7E6A" fontSize="sm" textAlign="center">
                  {myGuildData.description as string}
                </Text>
              )}
            </VStack>

            {/* Treasury */}
            <HStack
              bg="rgba(200,169,110,0.08)"
              border="1px solid"
              borderColor="#3A3428"
              borderRadius="md"
              justify="center"
              px={4}
              py={3}
              spacing={2}
              w="100%"
            >
              <GiTwoCoins color="#C8A96E" size={18} />
              <Text color="#C8A96E" fontFamily="mono" fontSize="lg" fontWeight={700}>
                {Number(
                  formatEther(toBigInt(myGuildData?.treasury)),
                ).toLocaleString()}
              </Text>
              <Text color="#8A7E6A" fontSize="sm">
                {t('guild.treasury')}
              </Text>
            </HStack>

            {/* Leader Controls */}
            {isLeader && (
              <VStack
                bg="rgba(200,169,110,0.05)"
                border="1px solid"
                borderColor="#3A3428"
                borderRadius="md"
                p={4}
                spacing={3}
                w="100%"
              >
                <Text color="#C8A96E" fontSize="sm" fontWeight={700}>
                  {t('guild.leaderControls')}
                </Text>

                {/* Tax Rate */}
                <FormControl>
                  <HStack justify="space-between" mb={1}>
                    <FormLabel color="#8A7E6A" fontSize="xs" mb={0}>
                      {t('guild.taxRate')}
                    </FormLabel>
                    <Text color="#E8DCC8" fontFamily="mono" fontSize="xs">
                      {taxRate}%
                    </Text>
                  </HStack>
                  <Slider
                    max={50}
                    min={0}
                    onChange={setTaxRate}
                    onChangeEnd={handleSetTaxRate}
                    step={1}
                    value={taxRate}
                  >
                    <SliderTrack bg="#3A3428">
                      <SliderFilledTrack bg="#C8A96E" />
                    </SliderTrack>
                    <SliderThumb boxSize={4} />
                  </Slider>
                </FormControl>

                <HStack spacing={2} w="100%">
                  <Button flex={1} onClick={onOpenWithdraw} size="sm">
                    {t('guild.withdrawTreasury')}
                  </Button>
                  <Button
                    colorScheme="red"
                    flex={1}
                    isLoading={isDisbanding}
                    loadingText={t('guild.disbanding')}
                    onClick={handleDisband}
                    size="sm"
                    variant="outline"
                  >
                    {t('guild.disbandGuild')}
                  </Button>
                </HStack>
              </VStack>
            )}

            {/* Applications (Leader + Officer) */}
            {(isLeader || isOfficer) && applications.length > 0 && (
              <VStack
                bg="rgba(200,169,110,0.05)"
                border="1px solid"
                borderColor="#3A3428"
                borderRadius="md"
                p={4}
                spacing={2}
                w="100%"
              >
                <Text color="#C8A96E" fontSize="sm" fontWeight={700}>
                  {t('guild.pendingApplications', { count: applications.length })}
                </Text>
                {applications.map(app => (
                  <HStack
                    key={app.characterId}
                    justify="space-between"
                    w="100%"
                  >
                    <HStack spacing={2}>
                      <Avatar size="xs" src={app.characterImage} />
                      <Text color="#E8DCC8" fontSize="sm">
                        {app.characterName}
                      </Text>
                    </HStack>
                    <HStack spacing={1}>
                      <Button
                        colorScheme="green"
                        onClick={() => handleJoinGuild(myGuildId)}
                        size="xs"
                      >
                        {t('guild.approve')}
                      </Button>
                      <Button
                        colorScheme="red"
                        size="xs"
                        variant="outline"
                      >
                        {t('guild.reject')}
                      </Button>
                    </HStack>
                  </HStack>
                ))}
              </VStack>
            )}

            {/* Member List */}
            <VStack spacing={0} w="100%">
              <Flex align="center" justify="space-between" px={1} w="100%">
                <Text color="#8A7E6A" fontSize="sm">
                  {t('guild.memberCount', { count: members.length })}
                </Text>
              </Flex>
              <Box
                bgColor="rgba(196,184,158,0.08)"
                boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                h="5px"
                mt={2}
                w="100%"
              />
              {pagedMembers.map(member => (
                <Box key={member.characterId} w="100%">
                  <MemberRow
                    isLeader={isLeader}
                    isOfficer={isOfficer}
                    member={member}
                    onKick={
                      isLeader || isOfficer
                        ? (_id: string) => {
                            // Kick uses leaveGuild pattern — would need a dedicated system call
                            // Placeholder for systemCalls.kickMember(characterId, _id)
                          }
                        : undefined
                    }
                    onPromote={
                      isLeader
                        ? (_id: string) => {
                            // systemCalls.promoteMember(characterId, _id)
                          }
                        : undefined
                    }
                    onDemote={
                      isLeader
                        ? (_id: string) => {
                            // systemCalls.demoteMember(characterId, _id)
                          }
                        : undefined
                    }
                  />
                  <Box
                    bg="rgba(196,184,158,0.08)"
                    boxShadow="0 1px 0 rgba(196,184,158,0.08), 0 -1px 0 rgba(0,0,0,0.3)"
                    h="1px"
                    w="100%"
                  />
                </Box>
              ))}
            </VStack>

            <HStack
              my={3}
              visibility={members.length > MEMBERS_PER_PAGE ? 'visible' : 'hidden'}
            >
              <Pagination
                length={members.length}
                page={memberPage}
                pageLimit={memberPageLimit}
                perPage={MEMBERS_PER_PAGE}
                setPage={setMemberPage}
                setPageLimit={setMemberPageLimit}
              />
            </HStack>

            {/* Leave Guild (non-leaders) */}
            {!isLeader && (
              <Button
                colorScheme="red"
                isLoading={isLeaving}
                leftIcon={<FaSignOutAlt />}
                loadingText={t('guild.leaving')}
                onClick={handleLeaveGuild}
                size="sm"
                variant="outline"
                w="100%"
              >
                {t('guild.leaveGuild')}
              </Button>
            )}
          </VStack>
        )}
      </VStack>

      {/* Modals */}
      <CreateGuildModal
        isCreating={isCreating}
        isOpen={isCreateOpen}
        onClose={onCloseCreate}
        onCreate={handleCreateGuild}
      />
      {isInGuild && (
        <WithdrawTreasuryModal
          isOpen={isWithdrawOpen}
          isWithdrawing={isWithdrawing}
          maxAmount={toBigInt(myGuildData?.treasury)}
          onClose={onCloseWithdraw}
          onWithdraw={handleWithdraw}
        />
      )}
    </PolygonalCard>
  );
};
