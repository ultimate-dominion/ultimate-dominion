import { Menu, MenuButton, MenuItem, MenuList, IconButton } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { IoLanguage } from 'react-icons/io5';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

export const LanguageSwitcher = (): JSX.Element => {
  const { i18n } = useTranslation();

  const currentLang = (i18n.language?.substring(0, 2) || 'en') as SupportedLanguage;

  return (
    <Menu>
      <MenuButton
        as={IconButton}
        aria-label="Change language"
        color="#8A7E6A"
        icon={<IoLanguage size={18} />}
        size="sm"
        variant="unstyled"
        _hover={{ color: '#C4B89E' }}
      />
      <MenuList
        bg="#1C1814"
        borderColor="#3A3228"
        minW="120px"
      >
        {(Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]).map(
          ([code, label]) => (
            <MenuItem
              key={code}
              bg={currentLang === code ? '#2E2820' : 'transparent'}
              color={currentLang === code ? '#E8DCC8' : '#8A7E6A'}
              fontSize="sm"
              onClick={() => i18n.changeLanguage(code)}
              _hover={{ bg: '#2E2820', color: '#C4B89E' }}
            >
              {label}
            </MenuItem>
          ),
        )}
      </MenuList>
    </Menu>
  );
};
