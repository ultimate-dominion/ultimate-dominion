import { Button, Tooltip } from '@chakra-ui/react';
import { useCallback, useState } from 'react';

export const CopyText = ({
  children,
  text,
}: {
  children: JSX.Element;
  text: string;
}): JSX.Element => {
  const [isCopied, setIsCopied] = useState(false);

  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setIsCopied(prev => !prev);
  }, [text]);

  return (
    <Tooltip
      bg="#070D2A"
      closeDelay={1000}
      hasArrow
      openDelay={200}
      label={isCopied ? 'Copied!' : text}
      placement="top"
    >
      <Button onClick={onCopy} variant="unstyled">
        {children}
      </Button>
    </Tooltip>
  );
};
