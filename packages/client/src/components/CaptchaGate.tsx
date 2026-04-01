import { Box, Button, Text, VStack } from '@chakra-ui/react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Turnstile } from '@marsidev/react-turnstile';

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA').trim(); // test key fallback

type CaptchaGateProps = {
  onVerified: (token: string) => void;
  isLoading?: boolean;
};

export const CaptchaGate = ({ onVerified, isLoading }: CaptchaGateProps): JSX.Element => {
  const { t } = useTranslation('ui');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [expired, setExpired] = useState(false);
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const handleSuccess = useCallback((t: string) => {
    setToken(t);
    setError(false);
    setExpired(false);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    setToken(null);
  }, []);

  const handleJoin = useCallback(() => {
    if (token) {
      onVerified(token);
    }
  }, [token, onVerified]);

  return (
    <VStack spacing={4}>
      <Box>
        <Turnstile
          ref={turnstileRef as any}
          siteKey={SITE_KEY}
          onSuccess={handleSuccess}
          onError={handleError}
          onExpire={() => { setToken(null); setExpired(true); }}
          options={{
            theme: 'dark',
            size: 'compact',
          }}
        />
      </Box>

      {error && (
        <Text color="red.400" size="sm">
          {t('captcha.failed')}
        </Text>
      )}

      {expired && !error && (
        <Text color="orange.300" fontSize="sm">
          {t('captcha.expired')}
        </Text>
      )}

      <Button
        isDisabled={!token}
        isLoading={isLoading}
        loadingText={t('captcha.joining')}
        onClick={handleJoin}
        size="sm"
      >
        {t('captcha.joinQueue')}
      </Button>
    </VStack>
  );
};
