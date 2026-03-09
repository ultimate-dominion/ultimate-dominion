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

import { HOME_PATH, TERMS_PATH } from '../Routes';

export const Privacy = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <Box border="6px solid #3A3228" p={1.5}>
      <Helmet>
        <title>Privacy Policy | Ultimate Dominion</title>
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
            Privacy Policy
          </Heading>

          <VStack fontWeight={500} maxW="750px" spacing={5} textAlign="left" w="100%">
            <Text color="#8A7E6A" fontSize="sm">
              Effective date: March 8, 2026
            </Text>

            <Text>
              This Privacy Policy describes how Ultimate Dominion ("we," "us," or "our")
              collects, uses, and shares information when you use our website at
              ultimatedominion.com and beta.ultimatedominion.com, and the game services
              accessible through them (collectively, the "Service"). By using the Service,
              you agree to the collection and use of information as described in this policy.
            </Text>

            {/* 1 */}
            <Heading size="sm" w="100%">1. Information We Collect</Heading>

            <Heading size="xs" w="100%">1.1 Information You Provide</Heading>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>
                <strong>Google Account Data.</strong> When you sign in with Google, we receive
                your email address, display name, and Google account identifier. We use this to
                create and authenticate your account.
              </ListItem>
              <ListItem>
                <strong>Wallet Address.</strong> A blockchain wallet is automatically created for
                you by our wallet infrastructure provider, Privy, Inc. ("Privy"). We store the
                association between your email and your wallet address to provide game services.
              </ListItem>
              <ListItem>
                <strong>Communications.</strong> If you contact us by email, we retain the content
                of your message and your email address to respond and maintain records.
              </ListItem>
            </UnorderedList>

            <Heading size="xs" w="100%">1.2 Information Collected Automatically</Heading>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>
                <strong>Usage Data.</strong> We collect anonymized usage analytics (page views,
                feature interactions, session duration) through Vercel Analytics. This data does
                not contain personal identifiers and cannot be used to identify you.
              </ListItem>
              <ListItem>
                <strong>Log Data.</strong> Our servers automatically record information including
                your IP address, browser type, referring URL, pages visited, and the date and time
                of your visit. We use this for security, diagnostics, and abuse prevention.
              </ListItem>
              <ListItem>
                <strong>Device Information.</strong> We may collect information about the device
                you use to access the Service, including device type, operating system, and
                browser version, for compatibility and performance purposes.
              </ListItem>
            </UnorderedList>

            <Heading size="xs" w="100%">1.3 Blockchain Data</Heading>
            <Text>
              When you interact with the game, your actions (including character creation, movement,
              combat, item transactions, and marketplace activity) are recorded on the Base
              blockchain (a public Layer 2 network built on Ethereum). Blockchain data is public,
              transparent, and permanent by design. Your wallet address and all associated
              transactions are visible to anyone. We do not control the blockchain and cannot
              modify or delete on-chain data.
            </Text>

            {/* 2 */}
            <Heading size="sm" w="100%">2. How We Use Your Information</Heading>
            <Text>We use the information we collect to:</Text>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>Provide, operate, and maintain the Service</ListItem>
              <ListItem>Authenticate your identity and manage your account</ListItem>
              <ListItem>Send transactional communications (queue notifications, account alerts)</ListItem>
              <ListItem>Monitor and analyze usage trends to improve the Service</ListItem>
              <ListItem>Detect, prevent, and address fraud, abuse, and security issues</ListItem>
              <ListItem>Comply with legal obligations</ListItem>
            </UnorderedList>
            <Text>
              We do not use your information for advertising. We do not sell your personal data.
              We do not build advertising profiles.
            </Text>

            {/* 3 */}
            <Heading size="sm" w="100%">3. Third-Party Services</Heading>
            <Text>
              We use the following third-party services that may collect or process your data
              under their own privacy policies:
            </Text>

            <Heading size="xs" w="100%">3.1 Privy (Wallet Infrastructure)</Heading>
            <Text>
              Privy creates and manages your embedded blockchain wallet. Your private keys are
              protected using multi-party computation (MPC) — they are split into shares held
              by separate parties and are never reconstructed or stored in full by any single
              entity, including us. We do not have access to your private keys. Privy's
              processing of your data is governed by the{' '}
              <Link href="https://www.privy.io/privacy" color="#C87A2A" isExternal>
                Privy Privacy Policy
              </Link>.
            </Text>

            <Heading size="xs" w="100%">3.2 MoonPay (Payment Processing)</Heading>
            <Text>
              If you purchase Gold through the Gold Merchant, the fiat-to-cryptocurrency
              transaction is processed by MoonPay. MoonPay collects payment information
              (credit/debit card details, billing address) and may perform identity verification
              as required by applicable financial regulations. We do not receive, see, or store
              your payment card details. MoonPay's processing of your data is governed by the{' '}
              <Link href="https://www.moonpay.com/legal/privacy_policy" color="#C87A2A" isExternal>
                MoonPay Privacy Policy
              </Link>.
            </Text>

            <Heading size="xs" w="100%">3.3 Google (Authentication)</Heading>
            <Text>
              We use Google OAuth for sign-in. Google may collect data in connection with the
              authentication process under the{' '}
              <Link href="https://policies.google.com/privacy" color="#C87A2A" isExternal>
                Google Privacy Policy
              </Link>.
            </Text>

            <Heading size="xs" w="100%">3.4 Vercel (Hosting & Analytics)</Heading>
            <Text>
              The Service is hosted on Vercel. Vercel collects anonymized analytics data and
              standard server logs. See the{' '}
              <Link href="https://vercel.com/legal/privacy-policy" color="#C87A2A" isExternal>
                Vercel Privacy Policy
              </Link>.
            </Text>

            {/* 4 */}
            <Heading size="sm" w="100%">4. Information Sharing</Heading>
            <Text>
              We do not sell, rent, or trade your personal information. We may share information
              in the following limited circumstances:
            </Text>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>
                <strong>Service Providers.</strong> With the third-party providers listed in
                Section 3, strictly as necessary to operate the Service.
              </ListItem>
              <ListItem>
                <strong>Legal Requirements.</strong> If required by law, regulation, legal process,
                or governmental request.
              </ListItem>
              <ListItem>
                <strong>Safety.</strong> To protect the rights, property, or safety of Ultimate
                Dominion, our users, or the public.
              </ListItem>
              <ListItem>
                <strong>Business Transfers.</strong> In connection with a merger, acquisition, or
                sale of assets, in which case your information would be transferred to the
                successor entity.
              </ListItem>
            </UnorderedList>

            {/* 5 */}
            <Heading size="sm" w="100%">5. Data Retention</Heading>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>
                <strong>Account Data</strong> (email, wallet association): retained for as long
                as your account is active. You may request deletion by contacting us.
              </ListItem>
              <ListItem>
                <strong>Server Logs:</strong> retained for up to 90 days.
              </ListItem>
              <ListItem>
                <strong>Analytics Data:</strong> retained in anonymized, aggregated form
                indefinitely.
              </ListItem>
              <ListItem>
                <strong>Blockchain Data:</strong> permanent and immutable. On-chain records
                (characters, items, transactions) cannot be deleted by us or anyone.
              </ListItem>
            </UnorderedList>

            {/* 6 */}
            <Heading size="sm" w="100%">6. Your Rights and Choices</Heading>
            <Text>Depending on your jurisdiction, you may have the right to:</Text>
            <UnorderedList spacing={2} pl={4}>
              <ListItem>Access the personal information we hold about you</ListItem>
              <ListItem>Request correction of inaccurate data</ListItem>
              <ListItem>Request deletion of your personal data (subject to the limitations
                regarding on-chain data described above)</ListItem>
              <ListItem>Object to or restrict certain processing of your data</ListItem>
              <ListItem>Data portability — receive your data in a structured, machine-readable format</ListItem>
              <ListItem>Withdraw consent where processing is based on consent</ListItem>
            </UnorderedList>
            <Text>
              To exercise any of these rights, contact us at{' '}
              <Link href="mailto:privacy@ultimatedominion.com" color="#C87A2A">
                privacy@ultimatedominion.com
              </Link>.
              We will respond within 30 days. Note that deletion of off-chain account data does
              not affect on-chain blockchain records, which are permanent by design.
            </Text>

            {/* 7 */}
            <Heading size="sm" w="100%">7. Cookies and Local Storage</Heading>
            <Text>
              We use browser local storage and session storage to maintain your authentication
              state and game preferences. We do not use third-party tracking cookies. Vercel
              Analytics uses privacy-focused, cookieless analytics that do not track individual
              users across sessions.
            </Text>

            {/* 8 */}
            <Heading size="sm" w="100%">8. Security</Heading>
            <Text>
              We implement reasonable technical and organizational measures to protect your
              information, including encrypted connections (TLS), access controls, and secure
              key management through Privy's MPC infrastructure. However, no method of
              electronic transmission or storage is completely secure, and we cannot guarantee
              absolute security.
            </Text>

            {/* 9 */}
            <Heading size="sm" w="100%">9. Children's Privacy</Heading>
            <Text>
              The Service is not directed to children under 13. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and
              believe your child has provided us with personal information, please contact us
              at{' '}
              <Link href="mailto:privacy@ultimatedominion.com" color="#C87A2A">
                privacy@ultimatedominion.com
              </Link>{' '}
              and we will take steps to delete such information.
            </Text>

            {/* 10 */}
            <Heading size="sm" w="100%">10. International Data Transfers</Heading>
            <Text>
              Your information may be processed in countries other than the country in which
              you reside. Our servers, service providers, and blockchain infrastructure operate
              globally. By using the Service, you consent to the transfer of your information
              to these locations, which may have different data protection laws than your
              jurisdiction.
            </Text>

            {/* 11 */}
            <Heading size="sm" w="100%">11. Changes to This Policy</Heading>
            <Text>
              We may update this Privacy Policy from time to time. We will notify you of
              material changes by posting the new policy on this page and updating the
              "Effective date" above. Your continued use of the Service after changes are
              posted constitutes acceptance of the updated policy. We encourage you to review
              this page periodically.
            </Text>

            {/* 12 */}
            <Heading size="sm" w="100%">12. Contact Us</Heading>
            <Text>
              If you have questions or concerns about this Privacy Policy or our data practices,
              contact us at:
            </Text>
            <Text>
              Ultimate Dominion<br />
              Email:{' '}
              <Link href="mailto:privacy@ultimatedominion.com" color="#C87A2A">
                privacy@ultimatedominion.com
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
