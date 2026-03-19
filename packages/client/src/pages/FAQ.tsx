import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Heading,
  Link,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { HOME_PATH } from '../Routes';

const faqs = [
  {
    q: 'What is Ultimate Dominion?',
    a: 'Ultimate Dominion is a free multiplayer text-based RPG (MUD) playable in any browser. You create a character, explore a persistent dark fantasy world, fight monsters, trade items with other players, and build your legacy in a world where every action is permanent and stored on-chain.',
  },
  {
    q: 'Is Ultimate Dominion free to play?',
    a: 'Yes. Ultimate Dominion is completely free to play. There are no paywalls, subscriptions, or pay-to-win mechanics. You can optionally purchase gold through the in-game Gold Merchant, but everything in the game can be earned through gameplay alone. Just open your browser and start playing — no downloads required.',
  },
  {
    q: 'What kind of game is Ultimate Dominion?',
    a: 'Ultimate Dominion is a MUD (Multi-User Dungeon) — a text-based multiplayer RPG in the tradition of classic games like Zork, Achaea, and Aardwolf, but built for the modern web. It features turn-based combat, a player-driven economy, PvP in danger zones, and permanent on-chain ownership of characters and items.',
  },
  {
    q: 'How do I start playing?',
    a: 'Go to ultimatedominion.com and click Sign In. You can use your Google account — no crypto wallet or technical knowledge needed. After signing in, you\'ll create a character by choosing a race, power source, rolling stats, and picking starter gear. Then you\'re in the world, ready to fight your first monster.',
  },
  {
    q: 'What makes Ultimate Dominion different from other MUDs?',
    a: 'Three things: permanence, ownership, and accessibility. Every character, item, and piece of gold exists permanently on the Base blockchain — no server wipes, no resets, no admin can delete your progress. You provably own everything you earn. And unlike traditional MUDs, it runs in any browser with no downloads or technical setup required.',
  },
  {
    q: 'Do I need cryptocurrency or a wallet to play?',
    a: 'No. When you sign in with Google, a wallet is automatically created for you behind the scenes using Privy. You never need to manage keys, buy crypto, or interact with blockchain technology directly. The tech is invisible — you just play the game.',
  },
  {
    q: 'What classes are available?',
    a: 'At level 10, you choose one of 9 advanced classes: Warrior, Paladin, Ranger, Rogue, Druid, Warlock, Wizard, Cleric, or Sorcerer. Each class has unique damage multipliers, stat bonuses, and a special combat ability. Before level 10, you play as a classless adventurer. Class selection is permanent.',
  },
  {
    q: 'Is there PvP in Ultimate Dominion?',
    a: 'Yes. The Dark Cave is divided into the Alcove (safe) and the Winding Dark (dangerous). In the Winding Dark, any player on the same tile can attack you. PvP uses a gold escrow system — you deposit gold before entering, and the winner claims a portion of the loser\'s escrowed gold. Your main balance is always safe.',
  },
  {
    q: 'What blockchain is Ultimate Dominion on?',
    a: 'Ultimate Dominion runs on Base, an Ethereum Layer 2 network. Base provides fast, low-cost transactions while inheriting Ethereum\'s security. All game state — characters, items, gold, combat outcomes — is recorded on-chain. A gas relayer handles all transaction costs, so players never pay gas fees.',
  },
  {
    q: 'Can I trade items with other players?',
    a: 'Yes. The in-game marketplace lets you list items for sale at any price, browse other players\' listings, and place gold offers on items you want. All trades are executed on-chain with a small ~3% marketplace fee. You can also earn items through monster drops and NPC shops.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
};

export const FAQ = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>FAQ | Ultimate Dominion</title>
        <meta
          name="description"
          content="Frequently asked questions about Ultimate Dominion — a free multiplayer text-based RPG (MUD) playable in any browser. Learn about gameplay, classes, PvP, blockchain integration, and more."
        />
        <link rel="canonical" href="https://ultimatedominion.com/faq" />
        <meta property="og:title" content="FAQ | Ultimate Dominion" />
        <meta
          property="og:description"
          content="Frequently asked questions about Ultimate Dominion — a free multiplayer text-based RPG (MUD) playable in any browser."
        />
        <meta property="og:url" content="https://ultimatedominion.com/faq" />
        <script type="application/ld+json">
          {JSON.stringify(faqJsonLd)}
        </script>
      </Helmet>
      <Box border="0.5px solid #3A3228">
        <VStack
          justifyContent="center"
          mb={16}
          mt={{ base: 12, sm: 20 }}
          px={{ base: 4, sm: 12, md: 20 }}
          spacing={{ base: 8, md: 10 }}
        >
          <Heading
            size={{ base: 'md', md: 'lg' }}
            textAlign="center"
            textTransform="uppercase"
          >
            Frequently Asked Questions
          </Heading>

          <Text
            color="#8A7E6A"
            maxW="650px"
            textAlign="center"
          >
            Ultimate Dominion is a free multiplayer text-based RPG (MUD) playable
            in any browser. Fight monsters, trade items, and build your legacy in
            a persistent on-chain world.
          </Text>

          <VStack maxW="750px" spacing={0} w="100%">
            <Accordion allowMultiple w="100%">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  border="none"
                  borderBottom="1px solid"
                  borderColor="#3A3228"
                >
                  <AccordionButton
                    px={0}
                    py={5}
                    _hover={{ bg: 'transparent' }}
                  >
                    <Text
                      flex="1"
                      fontWeight={600}
                      textAlign="left"
                    >
                      {faq.q}
                    </Text>
                    <AccordionIcon color="#8A7E6A" />
                  </AccordionButton>
                  <AccordionPanel pb={5} px={0}>
                    <Text color="#C4B89A" lineHeight="1.8">
                      {faq.a}
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </VStack>

          <VStack spacing={3} mt={4}>
            <Link
              href="https://ultimatedominion.com"
              color="#C87A2A"
              fontSize="sm"
              _hover={{ textDecoration: 'underline' }}
            >
              Start playing now
            </Link>
            <Text
              color="#C87A2A"
              cursor="pointer"
              fontSize="sm"
              onClick={() => navigate(HOME_PATH)}
              _hover={{ textDecoration: 'underline' }}
            >
              Back to game
            </Text>
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
};
