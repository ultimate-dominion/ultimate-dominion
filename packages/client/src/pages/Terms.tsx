import {
  Box,
  Heading,
  Link,
  ListItem,
  Text,
  UnorderedList,
  VStack,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

import { HOME_PATH, PRIVACY_PATH } from '../Routes';

export const Terms = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>Terms of Service | Ultimate Dominion</title>
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
            Terms of Service
          </Heading>

          <VStack fontWeight={500} maxW="750px" spacing={5} textAlign="left" w="100%">
            <Text color="#8A7E6A" fontSize="sm">
              Effective date: March 8, 2026
            </Text>

            <Text>
              These Terms of Service ("Terms") govern your access to and use of Ultimate
              Dominion, including the websites at ultimatedominion.com and
              beta.ultimatedominion.com, the game, and all related services (collectively,
              the "Service"). By accessing or using the Service, you agree to be bound by
              these Terms. If you do not agree, do not use the Service.
            </Text>

            {/* 1 */}
            <Heading size="sm" w="100%">1. Eligibility</Heading>
            <Text>
              You must be at least 13 years of age to use the Service. If you are between 13
              and 18 years of age (or the age of majority in your jurisdiction), you may only
              use the Service with the consent of a parent or legal guardian who agrees to be
              bound by these Terms. By using the Service, you represent and warrant that you
              meet these eligibility requirements.
            </Text>

            {/* 2 */}
            <Heading size="sm" w="100%">2. Account Registration</Heading>
            <Text>
              To use the Service, you must sign in using a Google account. Upon sign-in, a
              blockchain wallet is automatically created for you by Privy, Inc. ("Privy"),
              our wallet infrastructure provider. You are responsible for maintaining the
              security of your Google account credentials and for all activity that occurs
              under your account.
            </Text>
            <Text>
              You agree to: (a) provide accurate information in connection with your account;
              (b) not share your account credentials with any third party; (c) not create
              multiple accounts for the purpose of circumventing these Terms or game mechanics;
              and (d) notify us immediately if you suspect unauthorized access to your account.
            </Text>

            {/* 3 */}
            <Heading size="sm" w="100%">3. The Service</Heading>
            <Text>
              Ultimate Dominion is a browser-based game in which players create characters,
              explore a persistent world, engage in combat, collect items, and trade with other
              players. The game operates on the Base blockchain (a Layer 2 network built on
              Ethereum). Game state — including characters, items, gold balances, and player
              actions — is recorded on-chain as smart contract data.
            </Text>
            <Text>
              The Service is provided on an "as is" and "as available" basis. We reserve the
              right to modify, suspend, or discontinue the Service (or any part thereof) at any
              time, with or without notice. We are under no obligation to maintain, support, or
              update the Service.
            </Text>

            {/* 4 */}
            <Heading size="sm" w="100%">4. Blockchain and Digital Assets</Heading>

            <Heading size="xs" w="100%">4.1 Nature of On-Chain Assets</Heading>
            <Text>
              Characters, items, gold, and other in-game assets exist as data within smart
              contracts deployed on the Base blockchain. These assets are associated with your
              wallet address. Blockchain transactions are irreversible — once recorded, they
              cannot be undone, reversed, or modified by us or anyone. You acknowledge and
              accept this permanence.
            </Text>

            <Heading size="xs" w="100%">4.2 No Guaranteed Value</Heading>
            <Text>
              In-game assets (including Gold, items, and characters) have no inherent monetary
              value outside the game. We make no representations regarding the real-world value,
              transferability, or liquidity of any in-game asset. The existence of third-party
              markets for blockchain assets does not constitute an endorsement or guarantee of
              value by us.
            </Text>

            <Heading size="xs" w="100%">4.3 Wallet Custody</Heading>
            <Text>
              Your wallet is managed by Privy using multi-party computation (MPC). Neither we
              nor Privy hold your complete private key. You are solely responsible for
              maintaining access to your account. If you lose access to your Google account,
              you may lose access to your wallet and associated assets. We are not responsible
              for lost access.
            </Text>

            <Heading size="xs" w="100%">4.4 Gas Fees</Heading>
            <Text>
              Interactions with the blockchain require transaction fees ("gas"). We may provide
              initial gas funding for new users and periodic top-ups as a convenience. We are
              under no obligation to continue providing gas funding and may modify or discontinue
              this service at any time.
            </Text>

            <Heading size="xs" w="100%">4.5 Smart Contract Risks</Heading>
            <Text>
              The game operates through smart contracts, which are software programs deployed on
              a public blockchain. Smart contracts may contain bugs, vulnerabilities, or
              unexpected behavior. While we take reasonable steps to test and secure our smart
              contracts, we do not guarantee that they are free from defects. You acknowledge
              that interacting with smart contracts carries inherent risks, including the
              potential loss of assets.
            </Text>

            {/* 5 */}
            <Heading size="sm" w="100%">5. Purchases and Payments</Heading>
            <Text>
              You may purchase Gold (the in-game currency) through the Gold Merchant feature
              using fiat currency. Payments are processed by MoonPay, a third-party payment
              processor. By making a purchase, you agree to MoonPay's terms and conditions.
            </Text>
            <Text>
              <strong>All purchases are final and non-refundable.</strong> Once Gold is delivered
              to your blockchain wallet, the transaction is complete and irreversible. We do not
              offer refunds, exchanges, or credits for purchased Gold, except as required by
              applicable law. If you believe a transaction was made in error, contact MoonPay
              directly.
            </Text>
            <Text>
              You are responsible for any taxes, duties, or other governmental assessments
              associated with your purchases.
            </Text>

            {/* 6 */}
            <Heading size="sm" w="100%">6. Acceptable Use</Heading>
            <Text>You agree not to:</Text>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>
                Use bots, scripts, automation tools, or other software to interact with the
                Service without our express written permission
              </ListItem>
              <ListItem>
                Exploit bugs, glitches, or unintended game mechanics, and to report such
                issues promptly
              </ListItem>
              <ListItem>
                Create multiple accounts to circumvent game rules, gain unfair advantages,
                or manipulate the in-game economy
              </ListItem>
              <ListItem>
                Engage in real-money trading of in-game assets outside of officially supported
                mechanisms
              </ListItem>
              <ListItem>
                Harass, threaten, or abuse other players through in-game communication channels
              </ListItem>
              <ListItem>
                Attempt to interfere with, compromise, or disrupt the Service, servers, or
                connected networks
              </ListItem>
              <ListItem>
                Reverse-engineer, decompile, or disassemble any part of the Service, except as
                permitted by the open-source licenses of applicable smart contracts
              </ListItem>
              <ListItem>
                Use the Service for any unlawful purpose or in violation of any applicable law
                or regulation
              </ListItem>
            </UnorderedList>
            <Text>
              We reserve the right to restrict, suspend, or terminate access to the Service
              for any account that violates these Terms, at our sole discretion. Restrictions
              may include limiting access to game systems through on-chain access controls.
            </Text>

            {/* 7 */}
            <Heading size="sm" w="100%">7. Intellectual Property</Heading>
            <Text>
              The Service, including its visual design, artwork, text, code (excluding
              open-source components), game mechanics, trade names, and trademarks, is owned
              by or licensed to Ultimate Dominion and is protected by intellectual property
              laws. You are granted a limited, non-exclusive, non-transferable, revocable
              license to use the Service for personal, non-commercial purposes.
            </Text>
            <Text>
              Smart contracts deployed on the blockchain are publicly accessible by nature of
              the blockchain's design. The availability of smart contract bytecode on-chain
              does not constitute a license to the underlying source code or game design.
            </Text>

            {/* 8 */}
            <Heading size="sm" w="100%">8. Game Modifications</Heading>
            <Text>
              We reserve the right to modify game mechanics, balance, economics, and other
              game systems at any time. This includes but is not limited to adjusting item
              statistics, experience rates, drop rates, gold costs, combat formulas, and
              monster encounters. Game modifications may affect the utility or perceived value
              of in-game assets. Such changes are a normal part of game operation and do not
              entitle you to compensation.
            </Text>

            {/* 9 */}
            <Heading size="sm" w="100%">9. Disclaimers</Heading>
            <Text>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO IMPLIED
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND
              NON-INFRINGEMENT.
            </Text>
            <Text>
              WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR
              FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS. WE DO NOT WARRANT THE ACCURACY,
              RELIABILITY, OR COMPLETENESS OF ANY INFORMATION PROVIDED THROUGH THE SERVICE.
            </Text>
            <Text>
              YOU ACKNOWLEDGE THAT THE USE OF BLOCKCHAIN TECHNOLOGY AND DIGITAL ASSETS INVOLVES
              SIGNIFICANT RISKS, INCLUDING BUT NOT LIMITED TO PRICE VOLATILITY, REGULATORY
              UNCERTAINTY, SMART CONTRACT VULNERABILITIES, AND NETWORK CONGESTION. YOU ASSUME
              ALL RISKS ASSOCIATED WITH YOUR USE OF THE SERVICE AND ANY BLOCKCHAIN TRANSACTIONS.
            </Text>

            {/* 10 */}
            <Heading size="sm" w="100%">10. Limitation of Liability</Heading>
            <Text>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ULTIMATE
              DOMINION, ITS OPERATORS, AFFILIATES, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING
              OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, WHETHER BASED ON WARRANTY,
              CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL
              THEORY, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </Text>
            <Text>
              OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE
              SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU HAVE PAID TO US IN
              THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS
              ($100.00).
            </Text>
            <Text>
              THIS LIMITATION APPLIES TO ALL CLAIMS, INCLUDING BUT NOT LIMITED TO LOSS OF
              ON-CHAIN ASSETS (CHARACTERS, ITEMS, GOLD, ETH), SMART CONTRACT FAILURES,
              BLOCKCHAIN NETWORK ISSUES, WALLET PROVIDER OUTAGES, AND UNAUTHORIZED ACCESS TO
              YOUR ACCOUNT.
            </Text>

            {/* 11 */}
            <Heading size="sm" w="100%">11. Indemnification</Heading>
            <Text>
              You agree to indemnify, defend, and hold harmless Ultimate Dominion, its
              operators, affiliates, and their respective directors, officers, employees, and
              agents from and against any claims, liabilities, damages, losses, costs, and
              expenses (including reasonable attorneys' fees) arising out of or relating to:
              (a) your use of the Service; (b) your violation of these Terms; (c) your
              violation of any rights of a third party; or (d) your blockchain transactions.
            </Text>

            {/* 12 */}
            <Heading size="sm" w="100%">12. Dispute Resolution</Heading>
            <Text>
              Any dispute arising out of or relating to these Terms or the Service shall first
              be attempted to be resolved through good-faith negotiation. If the dispute cannot
              be resolved through negotiation within thirty (30) days, either party may pursue
              resolution through binding arbitration or in a court of competent jurisdiction.
            </Text>
            <Text>
              You agree that any claims will be brought individually and not as part of a class
              action, class arbitration, or other representative proceeding.
            </Text>

            {/* 13 */}
            <Heading size="sm" w="100%">13. Governing Law</Heading>
            <Text>
              These Terms shall be governed by and construed in accordance with the laws of the
              Republic of Ireland, without regard to its conflict of law provisions.
            </Text>

            {/* 14 */}
            <Heading size="sm" w="100%">14. Third-Party Services</Heading>
            <Text>
              The Service integrates with third-party services, including Privy (wallet
              infrastructure), MoonPay (payment processing), Google (authentication), and the
              Base blockchain network. Your use of these services is subject to their respective
              terms and conditions. We are not responsible for the acts or omissions of
              third-party service providers.
            </Text>

            {/* 15 */}
            <Heading size="sm" w="100%">15. Privacy</Heading>
            <Text>
              Our collection and use of personal information is described in our{' '}
              <Link color="#C87A2A" onClick={() => navigate(PRIVACY_PATH)} cursor="pointer">
                Privacy Policy
              </Link>,
              which is incorporated into these Terms by reference.
            </Text>

            {/* 16 */}
            <Heading size="sm" w="100%">16. Termination</Heading>
            <Text>
              We may restrict, suspend, or terminate your access to the Service at any time,
              for any reason, with or without notice. Upon termination, your right to use the
              Service ceases immediately. On-chain assets associated with your wallet address
              will remain on the blockchain, as we cannot modify or delete blockchain data.
              Sections 4, 5, 7, 9, 10, 11, 12, 13, and 18 survive termination.
            </Text>

            {/* 17 */}
            <Heading size="sm" w="100%">17. Changes to These Terms</Heading>
            <Text>
              We may revise these Terms at any time by posting an updated version on this page
              and updating the "Effective date" above. Material changes will be indicated by a
              prominent notice on the Service. Your continued use of the Service after the
              effective date of any changes constitutes your acceptance of the revised Terms.
              If you do not agree to the revised Terms, you must stop using the Service.
            </Text>

            {/* 18 */}
            <Heading size="sm" w="100%">18. General</Heading>
            <Text>
              These Terms, together with the Privacy Policy, constitute the entire agreement
              between you and Ultimate Dominion regarding the Service. If any provision of
              these Terms is found to be unenforceable, the remaining provisions will remain
              in full force and effect. Our failure to enforce any right or provision of these
              Terms will not be deemed a waiver. You may not assign or transfer these Terms
              without our prior written consent. We may assign these Terms without restriction.
            </Text>

            {/* 19 */}
            <Heading size="sm" w="100%">19. Contact</Heading>
            <Text>
              If you have questions about these Terms, contact us at:
            </Text>
            <Text>
              Ultimate Dominion<br />
              Email:{' '}
              <Link href="mailto:hello@ultimatedominion.com" color="#C87A2A">
                hello@ultimatedominion.com
              </Link>
            </Text>
          </VStack>

          <Text
            color="#C87A2A"
            cursor="pointer"
            fontSize="sm"
            mt={4}
            onClick={() => navigate(HOME_PATH)}
            _hover={{ textDecoration: 'underline' }}
          >
            Back to game
          </Text>
        </VStack>
      </Box>
    </Box>
  );
};
